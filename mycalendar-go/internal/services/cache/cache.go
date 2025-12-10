package cache

import (
	"fmt"
	"sync"
	"time"
)

// CacheEntry represents a cached value with expiration
type CacheEntry struct {
	Data      interface{}
	ExpiresAt time.Time
}

// CacheManager provides in-memory caching with TTL-based expiration
type CacheManager struct {
	cache map[int64]map[string]*CacheEntry
	mu    sync.RWMutex
}

// NewCacheManager creates a new cache manager instance
func NewCacheManager() *CacheManager {
	return &CacheManager{
		cache: make(map[int64]map[string]*CacheEntry),
	}
}

// generateKey generates a cache key for a resource
func (cm *CacheManager) generateKey(resource string, courseID *int) string {
	if courseID != nil {
		return fmt.Sprintf("%s:%d", resource, *courseID)
	}
	return resource
}

// Get retrieves data from cache
func (cm *CacheManager) Get(userID int64, resource string, courseID *int) interface{} {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	key := cm.generateKey(resource, courseID)
	userCache, ok := cm.cache[userID]
	if !ok {
		return nil
	}

	entry, ok := userCache[key]
	if !ok {
		return nil
	}

	// Check if cache has expired
	if time.Now().After(entry.ExpiresAt) {
		// Note: We can't delete here due to RLock, will be cleaned up on next Set
		return nil
	}

	return entry.Data
}

// Set stores data in cache with TTL
func (cm *CacheManager) Set(userID int64, resource string, data interface{}, ttlSeconds int, courseID *int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	key := cm.generateKey(resource, courseID)

	if _, ok := cm.cache[userID]; !ok {
		cm.cache[userID] = make(map[string]*CacheEntry)
	}

	// Clean up expired entries while we have the write lock
	cm.cleanExpiredEntriesLocked(userID)

	expiresAt := time.Now().Add(time.Duration(ttlSeconds) * time.Second)
	cm.cache[userID][key] = &CacheEntry{
		Data:      data,
		ExpiresAt: expiresAt,
	}
}

// Has checks if a cache entry exists and is valid
func (cm *CacheManager) Has(userID int64, resource string, courseID *int) bool {
	return cm.Get(userID, resource, courseID) != nil
}

// Invalidate removes specific cache entries by pattern
func (cm *CacheManager) Invalidate(userID int64, pattern string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	userCache, ok := cm.cache[userID]
	if !ok {
		return
	}

	// Check if pattern has wildcard
	if len(pattern) > 2 && pattern[len(pattern)-2:] == ":*" {
		// Wildcard pattern: delete all keys starting with prefix
		prefix := pattern[:len(pattern)-2]
		for key := range userCache {
			if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
				delete(userCache, key)
			}
		}
	} else {
		// Exact pattern: delete specific key
		delete(userCache, pattern)
	}
}

// Clear removes all cache for a specific user
func (cm *CacheManager) Clear(userID int64) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	delete(cm.cache, userID)
}

// ClearAll removes all cache across all users
func (cm *CacheManager) ClearAll() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.cache = make(map[int64]map[string]*CacheEntry)
}

// cleanExpiredEntriesLocked removes expired entries (must be called with write lock)
func (cm *CacheManager) cleanExpiredEntriesLocked(userID int64) {
	userCache, ok := cm.cache[userID]
	if !ok {
		return
	}

	now := time.Now()
	for key, entry := range userCache {
		if now.After(entry.ExpiresAt) {
			delete(userCache, key)
		}
	}
}

// UserStats represents cache statistics for a user
type UserStats struct {
	UserID       int64 `json:"userId"`
	CacheEntries int   `json:"cacheEntries"`
}

// CacheStats represents overall cache statistics
type CacheStats struct {
	TotalUsers   int         `json:"totalUsers"`
	TotalEntries int         `json:"totalEntries"`
	UserStats    []UserStats `json:"userStats"`
}

// GetStats returns cache statistics
func (cm *CacheManager) GetStats() CacheStats {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	stats := CacheStats{
		TotalUsers: len(cm.cache),
		UserStats:  make([]UserStats, 0),
	}

	for userID, userCache := range cm.cache {
		entryCount := len(userCache)
		stats.TotalEntries += entryCount
		stats.UserStats = append(stats.UserStats, UserStats{
			UserID:       userID,
			CacheEntries: entryCount,
		})
	}

	return stats
}

// Global cache manager instance
var globalCache = NewCacheManager()

// GetCacheManager returns the global cache manager instance
func GetCacheManager() *CacheManager {
	return globalCache
}

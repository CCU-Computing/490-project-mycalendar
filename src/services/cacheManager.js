/**
 * Cache Manager Service
 * Provides in-memory caching for frequently accessed data with TTL-based expiration
 * Reduces Moodle API calls and improves page load performance
 */

class CacheManager {
  constructor() {
    this.cache = new Map(); // Map<userId, Map<key, { data, expiresAt }>>
  }

  /**
   * Generate cache key for a given resource
   * @param {string} resource - Resource type (e.g., 'courses', 'workItems', 'calendar')
   * @param {string} [courseId] - Optional course ID for course-specific caches
   * @returns {string} Cache key
   */
  _generateKey(resource, courseId = null) {
    return courseId ? `${resource}:${courseId}` : resource;
  }

  /**
   * Get data from cache
   * @param {number} userId - User ID
   * @param {string} resource - Resource type
   * @param {string} [courseId] - Optional course ID
   * @returns {any|null} Cached data if valid, null if expired or not found
   */
  get(userId, resource, courseId = null) {
    const key = this._generateKey(resource, courseId);
    const userCache = this.cache.get(userId);

    if (!userCache) {
      return null;
    }

    const cacheEntry = userCache.get(key);

    if (!cacheEntry) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cacheEntry.expiresAt) {
      userCache.delete(key);
      return null;
    }

    return cacheEntry.data;
  }

  /**
   * Set data in cache with TTL
   * @param {number} userId - User ID
   * @param {string} resource - Resource type
   * @param {any} data - Data to cache
   * @param {number} ttlSeconds - Time to live in seconds
   * @param {string} [courseId] - Optional course ID
   */
  set(userId, resource, data, ttlSeconds, courseId = null) {
    const key = this._generateKey(resource, courseId);

    if (!this.cache.has(userId)) {
      this.cache.set(userId, new Map());
    }

    const userCache = this.cache.get(userId);
    const expiresAt = Date.now() + ttlSeconds * 1000;

    userCache.set(key, {
      data,
      expiresAt,
    });
  }

  /**
   * Check if a cache entry exists and is valid
   * @param {number} userId - User ID
   * @param {string} resource - Resource type
   * @param {string} [courseId] - Optional course ID
   * @returns {boolean} True if cache is valid
   */
  has(userId, resource, courseId = null) {
    return this.get(userId, resource, courseId) !== null;
  }

  /**
   * Invalidate specific cache entries by pattern
   * Supports wildcards: 'workItems:*' clears all work items caches
   * @param {number} userId - User ID
   * @param {string} pattern - Pattern to match (e.g., 'workItems:*', 'calendar', 'courses:123')
   */
  invalidate(userId, pattern) {
    const userCache = this.cache.get(userId);

    if (!userCache) {
      return;
    }

    if (pattern.endsWith(':*')) {
      // Wildcard pattern: delete all keys starting with prefix
      const prefix = pattern.slice(0, -2); // Remove ':*'
      for (const key of userCache.keys()) {
        if (key.startsWith(prefix)) {
          userCache.delete(key);
        }
      }
    } else {
      // Exact pattern: delete specific key
      userCache.delete(pattern);
    }
  }

  /**
   * Clear all cache for a specific user
   * Called on logout or when user data needs full refresh
   * @param {number} userId - User ID
   */
  clear(userId) {
    this.cache.delete(userId);
  }

  /**
   * Clear all cache across all users
   * Use sparingly (e.g., on server restart or maintenance)
   */
  clearAll() {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   * @returns {object} Stats with entry counts and memory info
   */
  getStats() {
    const stats = {
      totalUsers: this.cache.size,
      totalEntries: 0,
      userStats: [],
    };

    for (const [userId, userCache] of this.cache) {
      const entryCount = userCache.size;
      stats.totalEntries += entryCount;
      stats.userStats.push({
        userId,
        cacheEntries: entryCount,
      });
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new CacheManager();

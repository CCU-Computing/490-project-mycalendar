/**
 * Client-side cache using localStorage
 * Provides TTL-based caching for API responses
 */
const cacheManager = {
  /**
   * Get cached data if valid
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/not found
   */
  get(key) {
    try {
      const item = localStorage.getItem(`mc_cache_${key}`);
      if (!item) return null;

      const { data, expiresAt } = JSON.parse(item);
      if (Date.now() > expiresAt) {
        localStorage.removeItem(`mc_cache_${key}`);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },

  /**
   * Set data in cache with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttlSeconds - Time to live in seconds
   */
  set(key, data, ttlSeconds) {
    try {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      localStorage.setItem(
        `mc_cache_${key}`,
        JSON.stringify({ data, expiresAt })
      );
    } catch (e) {
      // Silently fail if localStorage is full or unavailable
    }
  },

  /**
   * Invalidate specific cache entries
   * @param {string} pattern - Key pattern to match (exact match or prefix with wildcards)
   */
  invalidate(pattern) {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `mc_cache_${pattern}`;

      if (pattern.endsWith("*")) {
        // Wildcard pattern
        const searchPrefix = prefix.slice(0, -1);
        keys.forEach((key) => {
          if (key.startsWith(searchPrefix)) {
            localStorage.removeItem(key);
          }
        });
      } else {
        // Exact match
        localStorage.removeItem(prefix);
      }
    } catch (e) {
      // Silently fail
    }
  },

  /**
   * Clear all app cache
   */
  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("mc_cache_")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Silently fail
    }
  },
};

/**
 * Cache-While-Revalidate Helper
 * Returns cached data immediately while fetching fresh data in background
 * Calls onFresh callback if fresh data differs from cached data
 */
const revalidationManager = {
  /**
   * Fetch data with cache-while-revalidate pattern
   * @param {string} cacheKey - Cache key
   * @param {Function} fetchFn - Function that returns Promise<data>
   * @param {number} ttlSeconds - Cache TTL in seconds
   * @param {Function} onFresh - Optional callback when fresh data arrives
   * @returns {Promise<any>} Cached data immediately, fresh data via callback
   */
  async fetchWithRevalidate(cacheKey, fetchFn, ttlSeconds, onFresh) {
    // Return cached data immediately if available
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      console.log(`[Cache-While-Revalidate] Cache HIT for "${cacheKey}" - returning cached data, fetching fresh in background...`);
      // Fetch fresh data in background without blocking
      this._revalidateInBackground(cacheKey, fetchFn, ttlSeconds, onFresh, cached);
      return cached;
    }

    // No cache: fetch fresh data synchronously
    console.log(`[Cache-While-Revalidate] Cache MISS for "${cacheKey}" - fetching fresh data...`);
    const fresh = await fetchFn();
    cacheManager.set(cacheKey, fresh, ttlSeconds);
    return fresh;
  },

  /**
   * Fetch fresh data in background and notify if changed
   * @private
   */
  async _revalidateInBackground(cacheKey, fetchFn, ttlSeconds, onFresh, cachedData) {
    try {
      console.log(`[Cache-While-Revalidate] Background fetch started for "${cacheKey}"...`);
      const fresh = await fetchFn();
      cacheManager.set(cacheKey, fresh, ttlSeconds);

      // Only call callback if data meaningfully changed
      if (this._hasDataChanged(cachedData, fresh)) {
        console.log(`[Cache-While-Revalidate] Data CHANGED for "${cacheKey}" - calling onFresh callback`);
        if (typeof onFresh === 'function') {
          onFresh(fresh);
        }
      } else {
        console.log(`[Cache-While-Revalidate] Data UNCHANGED for "${cacheKey}" - no UI update needed`);
      }
    } catch (error) {
      // Silently fail background revalidation - cached data is still valid
      console.warn(`[Cache-While-Revalidate] Background fetch FAILED for "${cacheKey}": ${error.message}`);
    }
  },

  /**
   * Detect if data has meaningfully changed
   * Deep comparison for objects/arrays, strict for primitives
   * @private
   */
  _hasDataChanged(oldData, newData) {
    // If types differ, data changed
    if (typeof oldData !== typeof newData) return true;

    // For primitives, use strict equality
    if (typeof oldData !== 'object') return oldData !== newData;

    // For null/undefined
    if (oldData === null || newData === null) return oldData !== newData;

    // For arrays
    if (Array.isArray(oldData) && Array.isArray(newData)) {
      if (oldData.length !== newData.length) return true;
      // Shallow comparison of items
      return oldData.some((item, i) => {
        if (typeof item === 'object') {
          return JSON.stringify(item) !== JSON.stringify(newData[i]);
        }
        return item !== newData[i];
      });
    }

    // For objects
    if (typeof oldData === 'object' && typeof newData === 'object') {
      const oldKeys = Object.keys(oldData);
      const newKeys = Object.keys(newData);
      if (oldKeys.length !== newKeys.length) return true;
      return oldKeys.some(key => {
        if (typeof oldData[key] === 'object') {
          return JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]);
        }
        return oldData[key] !== newData[key];
      });
    }

    return true;
  },
};

async function handle(resp) {
  if (resp.status === 401) {
    // not logged in on the server -> bounce to login
    window.location.href = "./login.html";
    throw new Error("Not logged in");
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(txt || resp.statusText);
  }
  return resp.json();
}

export const api = {
  login: (name, token) =>
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, token }),
    }).then(handle),

  me: () => fetch("/api/me").then(handle),

  courses: async () => {
    // Check cache first (24 hour TTL)
    const cached = cacheManager.get("courses");
    if (cached) return cached;

    const data = await fetch("/api/courses").then(handle);
    cacheManager.set("courses", data, 86400);
    return data;
  },

  // ?courseId=123 optional
  // Pass onFresh callback to get fresh data updates in background
  work: async (courseId, { onFresh } = {}) => {
    const cacheKey = courseId ? `work_${courseId}` : "work";
    const fetchFn = () =>
      fetch(
        "/api/work" + (courseId ? `?courseId=${encodeURIComponent(courseId)}` : "")
      ).then(handle);

    // Use cache-while-revalidate if callback provided, otherwise simple cache
    if (typeof onFresh === 'function') {
      return revalidationManager.fetchWithRevalidate(cacheKey, fetchFn, 900, onFresh);
    }

    // Simple cache fallback for backward compatibility
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;
    const data = await fetchFn();
    cacheManager.set(cacheKey, data, 900);
    return data;
  },

  calendar: async ({ onFresh } = {}) => {
    const fetchFn = () => fetch("/api/calendar").then(handle);

    // Use cache-while-revalidate if callback provided, otherwise simple cache
    if (typeof onFresh === 'function') {
      return revalidationManager.fetchWithRevalidate("calendar", fetchFn, 900, onFresh);
    }

    // Simple cache fallback for backward compatibility
    const cached = cacheManager.get("calendar");
    if (cached) return cached;
    const data = await fetchFn();
    cacheManager.set("calendar", data, 900);
    return data;
  },

  prefs: {
    get: async () => {
      // Check cache first (24 hour TTL)
      const cached = cacheManager.get("prefs");
      if (cached) return cached;

      const data = await fetch("/api/prefs").then(handle);
      cacheManager.set("prefs", data, 86400);
      return data;
    },
    setCourseColor: async (courseId, color) => {
      const data = await fetch("/api/prefs/courseColor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, color }),
      }).then(handle);
      // Invalidate related caches
      cacheManager.invalidate("calendar");
      cacheManager.invalidate("prefs");
      return data;
    },
    setEventOverride: async (id, patch) => {
      const data = await fetch("/api/prefs/eventOverride", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      }).then(handle);
      // Invalidate related caches
      cacheManager.invalidate("calendar");
      cacheManager.invalidate("prefs");
      return data;
    },
    setAssignmentTypeColor: async (assignmentType, color) => {
      const data = await fetch("/api/prefs/assignmentTypeColor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentType, color }),
      }).then(handle);
      // Invalidate related caches
      cacheManager.invalidate("calendar");
      cacheManager.invalidate("prefs");
      return data;
    },
  },

  studyBlocks: {
    create: async (data) => {
      const result = await fetch("/api/custom-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handle);
      // Invalidate calendar cache
      cacheManager.invalidate("calendar");
      return result;
    },
    getAll: async () => {
      // Check cache first (15 minute TTL)
      const cached = cacheManager.get("studyBlocks");
      if (cached) return cached;

      const data = await fetch("/api/custom-events").then(handle);
      cacheManager.set("studyBlocks", data, 900);
      return data;
    },
    getForAssignment: async (assignmentId) => {
      // Check cache first (15 minute TTL)
      const cacheKey = `studyBlocks_${assignmentId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const data = await fetch(
        `/api/custom-events?moodleAssignmentId=${encodeURIComponent(assignmentId)}`
      ).then(handle);
      cacheManager.set(cacheKey, data, 900);
      return data;
    },
    update: async (id, data) => {
      const result = await fetch(`/api/custom-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handle);
      // Invalidate calendar and study blocks cache
      cacheManager.invalidate("calendar");
      cacheManager.invalidate("studyBlocks*");
      return result;
    },
    delete: async (id) => {
      const result = await fetch(`/api/custom-events/${id}`, {
        method: "DELETE",
      }).then(handle);
      // Invalidate calendar and study blocks cache
      cacheManager.invalidate("calendar");
      cacheManager.invalidate("studyBlocks*");
      return result;
    },
  },

  courseMetadata: {
    getAll: async () => {
      // Check cache first (24 hour TTL)
      const cached = cacheManager.get("courseMetadata");
      if (cached) return cached;

      const data = await fetch("/api/course-metadata").then(handle);
      cacheManager.set("courseMetadata", data, 86400);
      return data;
    },
    get: async (courseId) => {
      // Check cache first (24 hour TTL)
      const cacheKey = `courseMetadata_${courseId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const data = await fetch(
        `/api/course-metadata/${encodeURIComponent(courseId)}`
      ).then(handle);
      cacheManager.set(cacheKey, data, 86400);
      return data;
    },
    update: async (courseId, data) => {
      const result = await fetch(
        `/api/course-metadata/${encodeURIComponent(courseId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      ).then(handle);
      // Invalidate course metadata caches
      cacheManager.invalidate("courseMetadata*");
      cacheManager.invalidate("courses");
      return result;
    },
    delete: async (courseId) => {
      const result = await fetch(
        `/api/course-metadata/${encodeURIComponent(courseId)}`,
        {
          method: "DELETE",
        }
      ).then(handle);
      // Invalidate course metadata caches
      cacheManager.invalidate("courseMetadata*");
      cacheManager.invalidate("courses");
      return result;
    },
  },

  assignmentRatings: {
    get: (assignmentId) =>
      fetch(`/api/assignment-ratings/${encodeURIComponent(assignmentId)}`).then(handle),
    getAll: () => fetch("/api/assignment-ratings").then(handle),
    rate: (assignmentId, rating, assignmentData = {}) =>
      fetch(`/api/assignment-ratings/${encodeURIComponent(assignmentId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, ...assignmentData }),
      }).then(handle),
    delete: (assignmentId) =>
      fetch(`/api/assignment-ratings/${encodeURIComponent(assignmentId)}`, {
        method: "DELETE",
      }).then(handle),
  },

  starredAssignments: {
    getAll: async () => {
      // Check cache first (15 minute TTL)
      const cached = cacheManager.get("starredAssignments");
      if (cached) return cached;

      const data = await fetch("/api/starred-assignments").then(handle);
      cacheManager.set("starredAssignments", data, 900);
      return data;
    },
    star: async (moodleAssignmentId) => {
      const result = await fetch("/api/starred-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleAssignmentId }),
      }).then(handle);
      // Invalidate starred assignments and work items cache
      cacheManager.invalidate("starredAssignments");
      cacheManager.invalidate("work*");
      cacheManager.invalidate("calendar");
      return result;
    },
    unstar: async (moodleAssignmentId) => {
      const result = await fetch(
        `/api/starred-assignments/${encodeURIComponent(moodleAssignmentId)}`,
        {
          method: "DELETE",
        }
      ).then(handle);
      // Invalidate starred assignments and work items cache
      cacheManager.invalidate("starredAssignments");
      cacheManager.invalidate("work*");
      cacheManager.invalidate("calendar");
      return result;
    },
    check: async (moodleAssignmentId) => {
      // Don't cache check endpoint, always fetch fresh
      return fetch(
        `/api/starred-assignments/check/${encodeURIComponent(moodleAssignmentId)}`
      ).then(handle);
    },
  },

  focusMode: {
    getToday: () => fetch("/api/focus-mode/today").then(handle),
    getItem: (id, type) =>
      fetch(`/api/focus-mode/item?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`).then(handle),

    notes: {
      get: (id, type) =>
        fetch(`/api/focus-mode/notes?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`).then(handle),
      save: (id, type, notes) =>
        fetch("/api/focus-mode/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, type, notes }),
        }).then(handle),
    },

    sessions: {
      create: (id, type, sessionType, targetDuration) =>
        fetch("/api/focus-mode/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, type, sessionType, targetDuration }),
        }).then(handle),
      end: (sessionId, actualDuration, completed) =>
        fetch(`/api/focus-mode/sessions/${sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actualDuration, completed }),
        }).then(handle),
      getHistory: (id, type) =>
        fetch(`/api/focus-mode/sessions?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`).then(handle),
    },
  },
};
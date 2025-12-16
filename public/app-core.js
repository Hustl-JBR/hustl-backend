/**
 * 🚀 Hustl App Core - Modern, Optimized, Advanced
 * Performance optimizations, modern JS patterns, caching, debouncing
 */

// ========== PERFORMANCE UTILITIES ==========

/**
 * Debounce function calls to prevent excessive API calls
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls (execute at most once per interval)
 */
function throttle(func, limit = 1000) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Memoize expensive function calls
 */
function memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return function(...args) {
    const key = keyGenerator(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// ========== API CACHE ==========

class ApiCache {
  constructor(ttl = 30000) { // 30 seconds default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

// Global API cache
const apiCache = new ApiCache(30000); // 30 seconds

// ========== OPTIMIZED API CLIENT ==========

class OptimizedApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.requestQueue = new Map();
    this.activeRequests = new Map();
  }

  /**
   * Make an optimized API request with caching, request deduplication, and error handling
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      cache = true,
      useCache = true,
      skipCache = false,
      ...restOptions
    } = options;

    const cacheKey = `${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
    
    // Return cached result if available (GET requests only)
    if (method === 'GET' && useCache && !skipCache) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Deduplicate concurrent identical requests
    if (this.activeRequests.has(cacheKey)) {
      return this.activeRequests.get(cacheKey);
    }

    // Get token
    const token = localStorage.getItem("hustl_token");
    const headers = {
      'Content-Type': 'application/json',
      ...restOptions.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create request promise
    const requestPromise = fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      ...restOptions,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        // Cache successful GET requests
        if (method === 'GET' && cache && useCache) {
          apiCache.set(cacheKey, data);
        }
        
        return data;
      })
      .finally(() => {
        // Remove from active requests
        this.activeRequests.delete(cacheKey);
      });

    // Store active request for deduplication
    if (method === 'GET') {
      this.activeRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Invalidate cache for specific endpoint pattern
   */
  invalidateCache(pattern) {
    apiCache.cache.forEach((value, key) => {
      if (key.includes(pattern)) {
        apiCache.delete(key);
      }
    });
  }
}

// Global optimized API client
window.optimizedApi = new OptimizedApiClient('');

// ========== STATE MANAGEMENT ==========

class StateManager {
  constructor() {
    this.listeners = new Map();
    this.state = {};
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  setState(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    // Notify listeners
    this.listeners.get(key)?.forEach(callback => {
      callback(value, oldValue);
    });
  }

  getState(key) {
    return this.state[key];
  }
}

const stateManager = new StateManager();

// ========== LOADING STATE MANAGER ==========

class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
    this.listeners = new Set();
  }

  setLoading(key, isLoading) {
    this.loadingStates.set(key, isLoading);
    this.notify();
  }

  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(callback => callback(this.loadingStates));
  }
}

const loadingManager = new LoadingManager();

// ========== ERROR HANDLER ==========

class ErrorHandler {
  constructor() {
    this.errorListeners = new Set();
  }

  handle(error, context = '') {
    console.error(`[ErrorHandler] ${context}:`, error);
    
    // Use the error message from API response if available
    let message = 'An error occurred';
    
    // Check if error has details from API response
    if (error.details && error.details.message) {
      message = error.details.message;
    } else if (error.message) {
      const lowerMsg = error.message.toLowerCase();
      
      // Network/connection errors
      if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || 
          lowerMsg.includes('failed to fetch') || lowerMsg.includes('networkerror')) {
        message = 'Connection error. Please check your internet and try again.';
      } 
      // Database connection errors
      else if (lowerMsg.includes('database connection') || lowerMsg.includes('unable to connect to database')) {
        message = 'Database connection error. The server is temporarily unavailable. Please try again in a moment.';
      }
      // Email verification required errors (must come before other 403 errors)
      else if (lowerMsg.includes('email verification required') || 
               lowerMsg.includes('email not verified') ||
               (error.status === 403 && error.details?.requiresEmailVerification)) {
        message = error.details?.message || error.message || 'Please verify your email address to continue.';
        // Mark this as a verification error for frontend handling
        error.requiresEmailVerification = true;
      }
      // Authentication errors
      else if (lowerMsg.includes('unauthorized') || lowerMsg.includes('401') || 
               lowerMsg.includes('authentication error') || lowerMsg.includes('please log in')) {
        message = 'Please log in to continue.';
      } 
      // Permission errors
      else if (lowerMsg.includes('forbidden') || lowerMsg.includes('403') || 
               lowerMsg.includes('don\'t have permission')) {
        message = 'You don\'t have permission to do that.';
      } 
      // Not found errors
      else if (lowerMsg.includes('not found') || lowerMsg.includes('404')) {
        message = 'Item not found.';
      } 
      // Validation errors
      else if (lowerMsg.includes('validation') || lowerMsg.includes('invalid')) {
        message = error.message; // Use the full validation message
      }
      // Rate limiting
      else if (lowerMsg.includes('too many requests') || lowerMsg.includes('429')) {
        message = 'Too many requests. Please wait a moment and try again.';
      }
      // Server errors - check status code
      else if (error.status === 500 || error.status === 503) {
        // Use the actual error message from the API if available
        if (error.details && error.details.error) {
          message = error.details.error;
        } else {
          message = 'Server error. Please try again later.';
        }
      }
      // Use the actual error message if it's user-friendly
      else if (error.message && !lowerMsg.includes('internal server error')) {
        message = error.message;
      } 
      // Generic fallback
      else {
        message = 'An unexpected error occurred. Please try again.';
      }
    }
    
    // Notify listeners
    this.errorListeners.forEach(listener => listener(error, message, context));
    
    return message;
  }

  subscribe(callback) {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }
}

const errorHandler = new ErrorHandler();

// ========== PERFORMANCE MONITORING ==========

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  start(label) {
    this.metrics.set(label, performance.now());
  }

  end(label) {
    const start = this.metrics.get(label);
    if (start) {
      const duration = performance.now() - start;
      this.metrics.delete(label);
      if (duration > 100) { // Log slow operations
        console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms`);
      }
      return duration;
    }
    return null;
  }

  measure(label, fn) {
    this.start(label);
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.finally(() => this.end(label));
      }
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

const perfMonitor = new PerformanceMonitor();

// ========== EXPORTS ==========

window.appCore = {
  debounce,
  throttle,
  memoize,
  apiCache,
  optimizedApi: window.optimizedApi,
  stateManager,
  loadingManager,
  errorHandler,
  perfMonitor,
};

// ========== TOKEN MANAGER - Persistent Login ==========

class TokenManager {
  constructor() {
    this.refreshTimer = null;
    this.refreshInterval = 24 * 60 * 60 * 1000; // Refresh every 24 hours (token lasts 7 days)
    this.initialized = false;
  }

  /**
   * Decode JWT token and get expiry time (browser-compatible, no jwt library needed)
   */
  getTokenExpiry(token) {
    if (!token) return null;
    try {
      // JWT structure: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Decode payload (base64url)
      const payload = parts[1];
      // Add padding if needed
      const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
      // Replace base64url chars with base64
      const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
      // Decode
      const decoded = JSON.parse(atob(base64));
      
      if (decoded && decoded.exp) {
        return decoded.exp * 1000; // Convert to milliseconds
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
    return null;
  }

  /**
   * Check if token needs refresh (refresh if less than 3 days remaining)
   */
  needsRefresh(token) {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    const timeUntilExpiry = expiry - Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return timeUntilExpiry < threeDays;
  }

  /**
   * Refresh token automatically
   */
  async refreshToken() {
    const token = localStorage.getItem('hustl_token');
    if (!token) return false;

    // Check if refresh is needed
    if (!this.needsRefresh(token)) {
      return false; // Token is still fresh
    }

    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.token) {
        localStorage.setItem('hustl_token', data.token);
        
        // Invalidate API cache since user data might have changed
        if (window.optimizedApi) {
          window.optimizedApi.invalidateCache('/users/me');
        }
        
        console.log('✅ Token refreshed automatically');
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Don't log out user - token might still be valid
      return false;
    }

    return false;
  }

  /**
   * Start automatic token refresh
   */
  startAutoRefresh() {
    if (this.initialized) return;
    this.initialized = true;

    // Refresh immediately if needed
    this.refreshToken().catch(() => {});

    // Set up periodic refresh (every 24 hours)
    this.refreshTimer = setInterval(() => {
      this.refreshToken().catch(() => {});
    }, this.refreshInterval);

    console.log('✅ Token auto-refresh started');
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.initialized = false;
  }
}

const tokenManager = new TokenManager();

// ========== REAL-TIME POLLING MANAGER ==========

class PollingManager {
  constructor() {
    this.intervals = new Map();
    this.isPolling = false;
  }

  /**
   * Start polling for jobs (every 30 seconds when on jobs view)
   */
  startJobsPolling(callback, interval = 30000) {
    this.stopPolling('jobs');
    
    if (document.getElementById('view-jobs')?.style.display === 'none') {
      return; // Don't poll if not on jobs view
    }

    this.intervals.set('jobs', setInterval(() => {
      if (document.getElementById('view-jobs')?.style.display !== 'none') {
        callback();
      } else {
        this.stopPolling('jobs');
      }
    }, interval));

    console.log(`✅ Jobs polling started (${interval/1000}s interval)`);
  }

  /**
   * Start polling for messages (every 15 seconds when on messages view)
   */
  startMessagesPolling(callback, interval = 15000) {
    this.stopPolling('messages');
    
    if (document.getElementById('view-messages')?.style.display === 'none') {
      return; // Don't poll if not on messages view
    }

    this.intervals.set('messages', setInterval(() => {
      if (document.getElementById('view-messages')?.style.display !== 'none') {
        callback();
      } else {
        this.stopPolling('messages');
      }
    }, interval));

    console.log(`✅ Messages polling started (${interval/1000}s interval)`);
  }

  /**
   * Stop polling for specific resource
   */
  stopPolling(key) {
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  /**
   * Stop all polling
   */
  stopAll() {
    this.intervals.forEach((interval, key) => {
      clearInterval(interval);
    });
    this.intervals.clear();
  }
}

const pollingManager = new PollingManager();

// ========== URL ROUTING MANAGER ==========

class RouteManager {
  constructor() {
    this.currentRoute = null;
    this.init();
  }

  init() {
    // Restore route from URL hash on page load
    window.addEventListener('load', () => {
      const hash = window.location.hash.slice(1);
      if (hash && ['home', 'jobs', 'post', 'messages', 'profile', 'about'].includes(hash)) {
        this.currentRoute = hash;
        if (typeof setView === 'function') {
          setView(hash);
        }
      }
    });

    // Save route to URL hash
    this.saveRoute = (view) => {
      if (view && view !== 'home') {
        window.location.hash = view;
      } else {
        window.location.hash = '';
      }
      this.currentRoute = view;
    };
  }

  getCurrentRoute() {
    return window.location.hash.slice(1) || 'home';
  }
}

const routeManager = new RouteManager();

// Export additional modules
window.appCore = {
  ...window.appCore,
  tokenManager,
  pollingManager,
  routeManager,
};

console.log('✅ App Core loaded - Modern optimizations active');


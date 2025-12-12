// Hustl API Integration
// This file provides the window.hustlAPI object for front-end use

(function() {
  'use strict';

  // Get backend URL from window config, script tag, or default
  let BACKEND_URL;
  
  // Priority 1: Check window.HUSTL_CONFIG (set in HTML)
  if (window.HUSTL_CONFIG && window.HUSTL_CONFIG.API_URL) {
    BACKEND_URL = window.HUSTL_CONFIG.API_URL;
  }
  // Priority 2: Check script tag data attribute
  else {
    const scriptTag = document.querySelector('script[src*="api-integration.js"]');
    BACKEND_URL = scriptTag?.dataset?.backendUrl;
  }
  
  // Priority 3: Auto-detect based on hostname
  if (!BACKEND_URL) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    BACKEND_URL = isLocalhost 
      ? 'http://localhost:4000' 
      : 'https://hustl-production.up.railway.app';
  }
  
  // Backend routes don't have /api prefix - routes are at /auth, /users, /jobs, etc.
  const API_BASE = BACKEND_URL;

  // Helper function to make API requests
  async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = localStorage.getItem('hustl_token');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Try to get detailed error message
        const errorMsg = data.error || data.message || `HTTP ${response.status}`;
        const details = data.details ? `: ${JSON.stringify(data.details)}` : '';
        const error = new Error(errorMsg + details);
        // Preserve additional error flags (like requiresStripe)
        if (data.requiresStripe) {
          error.requiresStripe = true;
        }
        // Store full error data for better error handling
        error.details = data;
        error.status = response.status;
        // Log validation errors for debugging
        if (response.status === 400 && data.errors) {
          console.error('[API] Validation errors:', data.errors);
          const validationErrors = data.errors.map(e => `${e.param}: ${e.msg}`).join(', ');
          error.message = `Validation failed: ${validationErrors}`;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth API
  const auth = {
    async signUp(email, password, name, username, city, zip, role = 'CUSTOMER') {
      const result = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          username,
          city,
          zip,
          role: role.toUpperCase(),
        }),
      });

      if (result.token) {
        localStorage.setItem('hustl_token', result.token);
        localStorage.setItem('hustl_user', JSON.stringify(result.user));
      }

      return result;
    },

    async signIn(email, password) {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (result.token) {
        localStorage.setItem('hustl_token', result.token);
        localStorage.setItem('hustl_user', JSON.stringify(result.user));
      }

      return result;
    },

    async signOut() {
      // Call backend logout (optional, but good practice)
      try {
        const token = localStorage.getItem('hustl_token');
        if (token) {
          await apiRequest('/auth/logout', {
            method: 'POST',
          });
        }
      } catch (error) {
        // Ignore errors - logout should always succeed even if backend call fails
        console.warn('Backend logout call failed (non-critical):', error);
      }
      
      // Clear all storage
      localStorage.removeItem('hustl_token');
      localStorage.removeItem('hustl_user');
      sessionStorage.removeItem('hustl_token');
      sessionStorage.removeItem('hustl_user');
      
      // Clear cookies (if any)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // Clear cached user
      this.currentUser = null;
    },

    async verifyEmail(email, code) {
      const result = await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      if (result.token) {
        localStorage.setItem('hustl_token', result.token);
        localStorage.setItem('hustl_user', JSON.stringify(result.user));
      }

      return result;
    },

    async resendVerification(email) {
      return await apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async getCurrentUser() {
      const token = localStorage.getItem('hustl_token') || sessionStorage.getItem('hustl_token');
      if (!token) {
        // No token - clear any stale user data
        localStorage.removeItem('hustl_user');
        sessionStorage.removeItem('hustl_user');
        this.currentUser = null;
        return null;
      }

      // Always validate token with backend - don't trust cached user data
      try {
        const user = await apiRequest('/users/me');
        // Update cached user only after successful validation
        localStorage.setItem('hustl_user', JSON.stringify(user));
        this.currentUser = user;
        return user;
      } catch (error) {
        // Token is invalid or expired - clear everything
        console.warn('Token validation failed, clearing auth data:', error);
        localStorage.removeItem('hustl_token');
        localStorage.removeItem('hustl_user');
        sessionStorage.removeItem('hustl_token');
        sessionStorage.removeItem('hustl_user');
        this.currentUser = null;
        return null;
      }
    },
  };

  // Jobs API
  const jobs = {
    async create(jobData) {
      return apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
      });
    },

    async list(filters = {}) {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.zip) queryParams.append('zip', filters.zip);
      if (filters.radius) queryParams.append('radius', filters.radius);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);

      const queryString = queryParams.toString();
      const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;
      
      return apiRequest(endpoint);
    },

    async get(id) {
      return apiRequest(`/jobs/${id}`);
    },

    async update(id, data) {
      return apiRequest(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async cancel(id) {
      return apiRequest(`/jobs/${id}/cancel`, {
        method: 'POST',
      });
    },
    
    async getMyJobs() {
      return apiRequest('/jobs/my-jobs');
    },
  };

  // Users API
  const users = {
    async getProfile(userId) {
      return apiRequest(`/users/${userId}`);
    },

    async updateProfile(data) {
      try {
        const response = await apiRequest('/users/me', {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return response;
      } catch (error) {
        console.error('[API] updateProfile error:', error);
        // Try to get more details from error
        if (error.details && error.details.errors) {
          console.error('[API] Validation errors:', error.details.errors);
        }
        throw error;
      }
    },

    async getCurrentUser() {
      return apiRequest('/users/me');
    },
  };

  // Offers API
  const offers = {
    async create(jobId, data) {
      return apiRequest(`/jobs/${jobId}/offers`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async list(jobId) {
      return apiRequest(`/jobs/${jobId}/offers`);
    },

    async accept(offerId) {
      return apiRequest(`/offers/${offerId}/accept`, {
        method: 'POST',
      });
    },

    async reject(offerId) {
      return apiRequest(`/offers/${offerId}/reject`, {
        method: 'POST',
      });
    },

    async getMyOffers() {
      return apiRequest('/offers/user/me');
    },
  };

  // Threads/Messages API
  const threads = {
    async list() {
      return apiRequest('/threads');
    },

    async get(threadId) {
      return apiRequest(`/threads/${threadId}`);
    },

    async getMessages(threadId) {
      return apiRequest(`/threads/${threadId}/messages`);
    },

    async sendMessage(threadId, content) {
      return apiRequest(`/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },

    async create(recipientId, jobId = null, initialMessage = null) {
      const body = { recipientId };
      if (jobId) body.jobId = jobId;
      if (initialMessage) body.initialMessage = initialMessage;
      
      return apiRequest('/threads', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    async markAsRead(threadId) {
      return apiRequest(`/threads/${threadId}/read`, {
        method: 'POST',
      });
    },
  };

  // Reviews API
  const reviews = {
    async create(data) {
      return apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getForUser(userId) {
      return apiRequest(`/reviews/user/${userId}`);
    },
  };

  // Payments API
  const payments = {
    async createCheckout(offerId) {
      return apiRequest('/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ offerId }),
      });
    },

    async getStatus(offerId) {
      return apiRequest(`/payments/status/${offerId}`);
    },
  };

  // Stripe Connect API
  const stripeConnect = {
    async getOnboardingLink() {
      return apiRequest('/stripe-connect/onboarding-link', {
        method: 'POST',
      });
    },

    async getStatus() {
      return apiRequest('/stripe-connect/status');
    },
  };

  // Notifications API
  const notifications = {
    async list() {
      return apiRequest('/notifications');
    },

    async markAsRead(notificationId) {
      return apiRequest(`/notifications/${notificationId}/read`, {
        method: 'POST',
      });
    },

    async markAllAsRead() {
      return apiRequest('/notifications/read-all', {
        method: 'POST',
      });
    },
  };

  // Upload API
  const uploads = {
    async getPresignedUrl(filename, contentType) {
      return apiRequest('/r2/presign', {
        method: 'POST',
        body: JSON.stringify({ filename, contentType }),
      });
    },

    async uploadFile(file) {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('hustl_token');
      const response = await fetch(`${BACKEND_URL}/r2/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
  };

  // Export to window
  window.hustlAPI = {
    auth,
    jobs,
    users,
    offers,
    threads,
    reviews,
    payments,
    stripeConnect,
    notifications,
    uploads,
    // Also expose the raw request function for custom calls
    request: apiRequest,
  };
})();

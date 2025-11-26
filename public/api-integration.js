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
  
  const API_BASE = `${BACKEND_URL}/api`;

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
        const error = new Error(data.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.status) {
        throw error;
      }
      throw new Error(`Network error: ${error.message}`);
    }
  }

  // Auth API
  const auth = {
    async signUp(email, password, name, username, role) {
      const result = await apiRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          username,
          role,
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
      localStorage.removeItem('hustl_token');
      localStorage.removeItem('hustl_user');
    },

    async getCurrentUser() {
      const storedUser = localStorage.getItem('hustl_user');
      if (storedUser) {
        try {
          return JSON.parse(storedUser);
        } catch (e) {
          // Invalid stored user, try to fetch from API
        }
      }

      const token = localStorage.getItem('hustl_token');
      if (!token) {
        return null;
      }

      try {
        const user = await apiRequest('/auth/me');
        localStorage.setItem('hustl_user', JSON.stringify(user));
        return user;
      } catch (error) {
        // Token might be invalid, clear it
        localStorage.removeItem('hustl_token');
        localStorage.removeItem('hustl_user');
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
  };

  // Export to window
  window.hustlAPI = {
    auth,
    jobs,
  };
})();


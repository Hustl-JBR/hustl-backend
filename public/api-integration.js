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
<<<<<<< HEAD
  // Priority 2: Check script tag data attribute
  else {
    const scriptTag = document.querySelector('script[src*="api-integration.js"]');
    BACKEND_URL = scriptTag?.dataset?.backendUrl;
=======

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
      throw new Error(errorMsg + details);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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

<<<<<<< HEAD
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
=======
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('hustl_token', authToken);
    localStorage.setItem('hustl_user', JSON.stringify(currentUser));

    return { user: currentUser, token: authToken };
  },

  async signIn(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('hustl_token', authToken);
    localStorage.setItem('hustl_user', JSON.stringify(currentUser));

    return { user: currentUser, token: authToken };
  },

  async signOut() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('hustl_token');
    localStorage.removeItem('hustl_user');
  },

  async getCurrentUser() {
    if (!authToken) return null;

    try {
      currentUser = await apiRequest('/users/me');
      localStorage.setItem('hustl_user', JSON.stringify(currentUser));
      return currentUser;
    } catch (error) {
      // Token expired or invalid
      authToken = null;
      localStorage.removeItem('hustl_token');
      return null;
    }
  },

  getStoredUser() {
    if (currentUser) return currentUser;
    const stored = localStorage.getItem('hustl_user');
    if (stored) {
      currentUser = JSON.parse(stored);
      return currentUser;
    }
    return null;
  },
};

// Jobs functions
const apiJobs = {
  async list(filters = {}) {
    const params = new URLSearchParams();
    // Map frontend status values to backend status values
    if (filters.status) {
      const statusUpper = filters.status.toUpperCase();
      // Backend accepts: OPEN, ASSIGNED, COMPLETED_BY_HUSTLER
      // Frontend might use: COMPLETED, PAID, DONE, etc.
      let backendStatus = statusUpper;
      if (statusUpper === 'COMPLETED' || statusUpper === 'PAID' || statusUpper === 'DONE') {
        backendStatus = 'COMPLETED_BY_HUSTLER';
      } else if (statusUpper === 'IN_PROGRESS' || statusUpper === 'IN-PROGRESS') {
        backendStatus = 'ASSIGNED';
      }
      // Only add status if it's a valid backend status
      if (['OPEN', 'ASSIGNED', 'COMPLETED_BY_HUSTLER'].includes(backendStatus)) {
        params.append('status', backendStatus);
      }
    }
    if (filters.category) params.append('category', filters.category);
    if (filters.minPay) params.append('minPay', filters.minPay);
    if (filters.payType) params.append('payType', filters.payType);
    if (filters.lat) params.append('lat', filters.lat);
    if (filters.lng) params.append('lng', filters.lng);
    if (filters.radius) params.append('radius', filters.radius);
    if (filters.city) params.append('city', filters.city);
    if (filters.zip) params.append('zip', filters.zip);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const query = params.toString();
    const endpoint = `/jobs${query ? `?${query}` : ''}`;
    const data = await apiRequest(endpoint);
    return data.jobs || [];
  },

  async get(id) {
    return await apiRequest(`/jobs/${id}`);
  },

  async create(jobData) {
    // Map frontend format to API format
    // The frontend already sends the correct format, but we need to ensure all required fields are present
    const apiData = {
      title: jobData.title,
      category: jobData.category,
      description: jobData.description,
      photos: jobData.photos || [],
      address: jobData.pickupAddress || jobData.address || '',
      date: jobData.date || new Date().toISOString(),
      startTime: jobData.startTime || new Date().toISOString(),
      endTime: jobData.endTime || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      payType: jobData.paymentType || jobData.payType || 'flat',
      // Use amount if provided (frontend calculates it), otherwise calculate from flatAmount or hourly
      amount: jobData.amount || jobData.flatAmount || 0,
      requirements: jobData.requirements || {
        vehicle: jobData.requiresVehicle || false,
        stairs: jobData.requiresStairs || false,
        teamSize: jobData.teamSize || 1,
        onSiteOnly: jobData.requirements?.onSiteOnly || false,
        notes: jobData.requirements?.notes || null,
      },
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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

<<<<<<< HEAD
      return data;
    } catch (error) {
      if (error.status) {
        throw error;
      }
      throw new Error(`Network error: ${error.message}`);
    }
=======
  async complete(id) {
    return await apiRequest(`/jobs/${id}/complete`, {
      method: 'POST',
    });
  },

  async confirmComplete(id, verificationCode) {
    const body = {};
    if (verificationCode) {
      body.verificationCode = verificationCode;
    }
    return await apiRequest(`/jobs/${id}/confirm-complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

// Offers functions
const apiOffers = {
  async list(jobId) {
    return await apiRequest(`/offers/jobs/${jobId}/offers`);
  },

  async create(jobId, note = '', proposedAmount = null) {
    const body = { note };
    if (proposedAmount !== null) {
      body.proposedAmount = proposedAmount;
    }
    return await apiRequest(`/offers/jobs/${jobId}/offers`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async accept(offerId, tipPercent = 0) {
    return await apiRequest(`/offers/${offerId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ tipPercent }),
    });
  },

  async decline(offerId) {
    return await apiRequest(`/offers/${offerId}/decline`, {
      method: 'POST',
    });
  },
};

// Messages functions
const apiMessages = {
  async getThreads() {
    return await apiRequest('/threads');
  },

  async getMessages(threadId) {
    return await apiRequest(`/threads/${threadId}/messages`);
  },

  async sendMessage(threadId, body, attachments = []) {
    return await apiRequest(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, attachments }),
    });
  },
  
  async getThreadByJobId(jobId) {
    // Helper to find thread by job ID
    const threads = await this.getThreads();
    return threads.find(t => t.jobId === jobId);
  },
};

// Payments functions
const apiPayments = {
  async confirm(jobId) {
    return await apiRequest(`/payments/jobs/${jobId}/confirm`, {
      method: 'POST',
    });
  },

  async getByJobId(jobId) {
    return await apiRequest(`/payments/jobs/${jobId}`);
  },

  async getReceipts() {
    return await apiRequest('/payments/receipts');
  },
};

// R2 Upload functions
const apiUploads = {
  async getPresignedUrl(filename, contentType, fileSize) {
    return await apiRequest('/r2/presign', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType, fileSize }),
    });
  },

  async uploadFile(file) {
    // Get presigned URL
    const { uploadUrl, fileKey, publicUrl } = await this.getPresignedUrl(
      file.name,
      file.type,
      file.size
    );

    // Upload to R2
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    return { fileKey, publicUrl };
  },
};

// Initialize auth on load
(function initAuth() {
  const stored = localStorage.getItem('hustl_token');
  if (stored) {
    authToken = stored;
    apiAuth.getCurrentUser().catch(() => {
      // Token invalid, clear it
      apiAuth.signOut();
    });
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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


// API Integration Layer for Hustl
// This file replaces Supabase calls with our Express API

const API_BASE_URL = window.location.origin; // Use same origin (backend serves frontend)
let authToken = localStorage.getItem('hustl_token') || null;
let currentUser = null;

// Helper: Make API request with auth
async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
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
      throw error;
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Auth functions
const apiAuth = {
  async signUp(email, password, name, username, city, zip, role = 'CUSTOMER') {
    const data = await apiRequest('/auth/signup', {
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
    // Backend returns array directly, not wrapped in object
    if (Array.isArray(data)) {
      return data;
    }
    // Fallback: check if wrapped in jobs property
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
    };

    // Only include hourly fields if they exist and payType is hourly
    if (jobData.payType === 'hourly' || jobData.paymentType === 'hourly') {
      if (jobData.hourlyRate !== null && jobData.hourlyRate !== undefined) {
        apiData.hourlyRate = jobData.hourlyRate;
      }
      if (jobData.estHours !== null && jobData.estHours !== undefined) {
        apiData.estHours = jobData.estHours;
      }
      // Fallback to maxHours if estHours not provided
      if (!apiData.estHours && (jobData.maxHours !== null && jobData.maxHours !== undefined)) {
        apiData.estHours = jobData.maxHours;
      }
    }

    return await apiRequest('/jobs', {
      method: 'POST',
      body: JSON.stringify(apiData),
    });
  },

  async cancel(id) {
    return await apiRequest(`/jobs/${id}/cancel`, {
      method: 'POST',
    });
  },

  async delete(id) {
    return await apiRequest(`/jobs/${id}`, {
      method: 'DELETE',
    });
  },

  async requestRefund(id) {
    return await apiRequest(`/jobs/${id}/request-refund`, {
      method: 'POST',
    });
  },

  async complete(id) {
    return await apiRequest(`/jobs/${id}/complete`, {
      method: 'POST',
    });
  },

  async confirmComplete(id, verificationCode) {
    // Ensure verification code is a string and trimmed
    const code = verificationCode ? String(verificationCode).trim() : '';
    if (!code) {
      throw new Error('Verification code is required');
    }
    return await apiRequest(`/jobs/${id}/confirm-complete`, {
      method: 'POST',
      body: JSON.stringify({ verificationCode: code }),
    });
  },


  async endJob(id) {
    return await apiRequest(`/jobs/${id}/end`, {
      method: 'POST',
    });
  },

  async reportIssue(id, reason, description) {
    return await apiRequest(`/jobs/${id}/report-issue`, {
      method: 'POST',
      body: JSON.stringify({ reason, description }),
    });
  },

  async updateStatus(id, status) {
    return await apiRequest(`/jobs/${id}/update-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async getStartCode(id, regenerate = false) {
    const url = `/jobs/${id}/start-code${regenerate ? '?regenerate=true' : ''}`;
    return await apiRequest(url, {
      method: 'GET',
    });
  },

  async startJob(id, startCode) {
    return await apiRequest(`/jobs/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ startCode }),
    });
  },
};

// Offers functions
const apiOffers = {
  async list(jobId) {
    return await apiRequest(`/offers/${jobId}`);
  },

  async create(jobId, note = '', proposedAmount = null) {
    const body = { note };
    if (proposedAmount !== null) {
      body.proposedAmount = proposedAmount;
    }
    return await apiRequest(`/offers/${jobId}`, {
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
  }
})();

// Export for use in index.html
// Users functions
const apiUsers = {
  async get(userId) {
    return await apiRequest(`/users/${userId}`);
  },
  
  async update(updateData) {
    return await apiRequest('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  },
};

// Stripe Connect functions
const apiStripeConnect = {
  async createAccount() {
    return await apiRequest('/stripe-connect/create-account', {
      method: 'POST',
    });
  },
  
  async getOnboardingLink() {
    return await apiRequest('/stripe-connect/onboarding-link');
  },
  
  async getStatus() {
    return await apiRequest('/stripe-connect/status');
  },
};

// Reviews functions
const apiReviews = {
  async create(jobId, revieweeId, stars, text, photos = []) {
    return await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({
        jobId,
        revieweeId,
        stars,
        text,
        photos,
      }),
    });
  },
  
  async getUserReviews(userId) {
    return await apiRequest(`/reviews/user/${userId}`);
  },
  
  async getJobReviews(jobId) {
    return await apiRequest(`/reviews/job/${jobId}`);
  },
};

const apiFeedback = {
  async send(name, email, message) {
    return await apiRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify({
        name: name || null,
        email: email || null,
        message,
      }),
    });
  },
};

window.hustlAPI = {
  auth: apiAuth,
  jobs: apiJobs,
  stripeConnect: apiStripeConnect,
  offers: apiOffers,
  messages: apiMessages,
  payments: apiPayments,
  uploads: apiUploads,
  users: apiUsers,
  reviews: apiReviews,
  feedback: apiFeedback,
};


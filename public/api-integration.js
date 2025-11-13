// API Integration Layer for Hustl Demo
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
      throw new Error(data.error || `HTTP ${response.status}`);
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
    if (filters.status) params.append('status', filters.status.toUpperCase());
    if (filters.category) params.append('category', filters.category);
    if (filters.minPay) params.append('minPay', filters.minPay);
    if (filters.payType) params.append('payType', filters.payType);
    if (filters.lat) params.append('lat', filters.lat);
    if (filters.lng) params.append('lng', filters.lng);
    if (filters.radius) params.append('radius', filters.radius);
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
    // Map demo format to API format
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
      amount: jobData.flatAmount || 0,
      hourlyRate: jobData.hourlyRate || null,
      estHours: jobData.maxHours || null,
      requirements: {
        vehicle: jobData.requiresVehicle || false,
        stairs: jobData.requiresStairs || false,
        teamSize: jobData.teamSize || 1,
      },
    };

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

  async complete(id) {
    return await apiRequest(`/jobs/${id}/complete`, {
      method: 'POST',
    });
  },
};

// Offers functions
const apiOffers = {
  async create(jobId, note = '') {
    return await apiRequest(`/offers/jobs/${jobId}/offers`, {
      method: 'POST',
      body: JSON.stringify({ note }),
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
};

// Payments functions
const apiPayments = {
  async confirm(jobId) {
    return await apiRequest(`/payments/jobs/${jobId}/confirm`, {
      method: 'POST',
    });
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
window.hustlAPI = {
  auth: apiAuth,
  jobs: apiJobs,
  offers: apiOffers,
  messages: apiMessages,
  payments: apiPayments,
  uploads: apiUploads,
};


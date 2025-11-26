// Main Application JavaScript
// Clean, modern, simple

let currentUser = null;
let activeView = 'home';
let currentThreadId = null;

// Initialize app when API is ready
function bootApp() {
  if (typeof window.hustlAPI === 'undefined') {
    setTimeout(bootApp, 50);
    return;
  }
  
  initNav();
  initAuth();
  initForms();
  renderAll();
}

// Navigation
function initNav() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setView(tab.dataset.view);
    });
  });
  
  // Home CTA buttons
  document.getElementById('homeCtaPost')?.addEventListener('click', () => setView('post'));
  document.getElementById('homeCtaBrowse')?.addEventListener('click', () => setView('jobs'));
  
  // Auth button
  document.getElementById('openAuthButton')?.addEventListener('click', () => {
    document.getElementById('authSection').style.display = 'block';
  });
}

function setView(view) {
  activeView = view;
  
  // Hide all views
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });
  
  // Show target view
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');
  
  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Render view content
  renderView(view);
}

// Authentication
async function initAuth() {
  // Toggle between signup/login
  document.querySelectorAll('[data-auth-mode]').forEach(link => {
    link.addEventListener('click', (e) => {
      const mode = e.target.dataset.authMode;
      if (mode === 'login') {
        document.getElementById('authBodyCreate').style.display = 'none';
        document.getElementById('authBodyLogin').style.display = 'block';
        document.getElementById('authCardTitle').textContent = 'Log in';
      } else {
        document.getElementById('authBodyCreate').style.display = 'block';
        document.getElementById('authBodyLogin').style.display = 'none';
        document.getElementById('authCardTitle').textContent = 'Create account';
      }
    });
  });
  
  // Signup
  document.getElementById('createAccountButton')?.addEventListener('click', async () => {
    try {
      const email = document.getElementById('createEmail').value;
      const password = document.getElementById('createPassword').value;
      const name = document.getElementById('createName').value;
      const role = document.getElementById('createRole').value.toUpperCase();
      
      await window.hustlAPI.auth.signUp(email, password, name, name.toLowerCase().replace(/\s+/g, ''), role);
      showToast('Account created!');
      renderAll();
    } catch (error) {
      showToast(error.message || 'Signup failed');
    }
  });
  
  // Login
  document.getElementById('loginButton')?.addEventListener('click', async () => {
    try {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      
      await window.hustlAPI.auth.signIn(email, password);
      showToast('Welcome back!');
      renderAll();
    } catch (error) {
      showToast(error.message || 'Login failed');
    }
  });
}

// Forms
function initForms() {
  // Job form
  const paymentType = document.getElementById('paymentType');
  if (paymentType) {
    paymentType.addEventListener('change', () => {
      const type = paymentType.value;
      document.getElementById('flatAmountGroup').style.display = type === 'flat' ? 'block' : 'none';
      document.getElementById('hourlyGroup').style.display = type === 'hourly' ? 'block' : 'none';
    });
  }
  
  document.getElementById('jobForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const jobData = {
        title: document.getElementById('jobTitle').value,
        category: document.getElementById('jobCategory').value,
        description: document.getElementById('jobDescription').value,
        paymentType: document.getElementById('paymentType').value,
        amount: document.getElementById('flatAmount')?.value || null,
        hourlyRate: document.getElementById('hourlyRate')?.value || null,
        maxHours: document.getElementById('maxHours')?.value || null,
        date: document.getElementById('jobDate').value,
        startTime: document.getElementById('jobStartTime').value,
        pickupArea: document.getElementById('pickupArea').value,
        pickupCity: document.getElementById('pickupCity').value,
      };
      
      await window.hustlAPI.jobs.create(jobData);
      showToast('Job posted!');
      setView('owner');
      e.target.reset();
    } catch (error) {
      showToast(error.message || 'Failed to post job');
    }
  });
  
  // Message send
  document.getElementById('sendMessageBtn')?.addEventListener('click', async () => {
    if (!currentThreadId) return;
    const text = document.getElementById('messageInput').value.trim();
    if (!text) return;
    
    try {
      await window.hustlAPI.messages.sendMessage(currentThreadId, text);
      document.getElementById('messageInput').value = '';
      renderView('messages');
    } catch (error) {
      showToast(error.message || 'Failed to send message');
    }
  });
  
  // Profile save
  document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    try {
      const updates = {
        name: document.getElementById('profileNameInput').value,
        bio: document.getElementById('profileBio').value,
        phone: document.getElementById('profilePhone').value,
      };
      
      await window.hustlAPI.users.update(updates);
      showToast('Profile updated!');
      renderView('profile');
    } catch (error) {
      showToast(error.message || 'Failed to update profile');
    }
  });
}

// Render functions
async function renderAll() {
  currentUser = await window.hustlAPI.auth.getCurrentUser();
  renderAuthPill();
  renderView(activeView);
}

function renderAuthPill() {
  const pill = document.getElementById('authPill');
  if (!pill) return;
  
  if (!currentUser) {
    pill.innerHTML = `
      <span>Not signed in</span>
      <button id="openAuthButton">Sign in / Create account</button>
    `;
    document.getElementById('openAuthButton')?.addEventListener('click', () => {
      document.getElementById('authSection').style.display = 'block';
    });
    document.getElementById('authSection').style.display = 'none';
  } else {
    pill.innerHTML = `
      <span>${currentUser.name}</span>
      <button id="logoutButton">Sign out</button>
    `;
    document.getElementById('logoutButton')?.addEventListener('click', async () => {
      await window.hustlAPI.auth.signOut();
      renderAll();
    });
    document.getElementById('authSection').style.display = 'none';
  }
}

async function renderView(view) {
  switch (view) {
    case 'home':
      renderHome();
      break;
    case 'jobs':
      renderJobs();
      break;
    case 'messages':
      renderMessages();
      break;
    case 'profile':
      renderProfile();
      break;
    case 'owner':
      renderOwner();
      break;
  }
}

function renderHome() {
  // Home view is static, no dynamic content needed
}

async function renderJobs() {
  const container = document.getElementById('jobsList');
  if (!container) return;
  
  container.innerHTML = '<div>Loading jobs...</div>';
  
  try {
    const response = await window.hustlAPI.jobs.list({ status: 'OPEN', limit: 20 });
    const jobs = response.jobs || response;
    
    if (jobs.length === 0) {
      container.innerHTML = '<p>No jobs found</p>';
      return;
    }
    
    container.innerHTML = jobs.map(job => `
      <div class="job-card" onclick="openJobDetails('${job.id}')">
        <h3>${job.title}</h3>
        <p class="job-pay">$${job.amount || job.hourlyRate || '0'}</p>
        <p>${job.description?.substring(0, 100)}...</p>
        <small>${job.category} • ${job.address || job.pickupArea}</small>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading jobs</p>';
    console.error(error);
  }
}

async function renderMessages() {
  const list = document.getElementById('conversationList');
  const view = document.getElementById('conversationView');
  
  if (!list) return;
  
  try {
    const threads = await window.hustlAPI.messages.getThreads();
    
    if (threads.length === 0) {
      list.innerHTML = '<p>No conversations</p>';
      view.style.display = 'none';
      return;
    }
    
    list.innerHTML = threads.map(thread => `
      <div class="conversation-item" onclick="openThread('${thread.id}')">
        <strong>${thread.otherUser?.name || 'User'}</strong>
        ${thread.unreadCount > 0 ? `<span class="badge">${thread.unreadCount}</span>` : ''}
        <p>${thread.lastMessage?.body || ''}</p>
      </div>
    `).join('');
  } catch (error) {
    list.innerHTML = '<p>Error loading messages</p>';
    console.error(error);
  }
}

async function openThread(threadId) {
  currentThreadId = threadId;
  const view = document.getElementById('conversationView');
  const list = document.getElementById('conversationList');
  
  if (view) view.style.display = 'block';
  if (list) list.style.display = 'none';
  
  try {
    const messages = await window.hustlAPI.messages.getMessages(threadId);
    const container = document.getElementById('conversationMessages');
    
    if (container) {
      container.innerHTML = messages.map(msg => `
        <div class="message ${msg.senderId === currentUser?.id ? 'message-sent' : 'message-received'}">
          ${msg.body}
        </div>
      `).join('');
    }
    
    await window.hustlAPI.messages.markAllRead(threadId);
  } catch (error) {
    console.error(error);
  }
}

async function renderProfile() {
  if (!currentUser) return;
  
  document.getElementById('profileName').textContent = currentUser.name || 'User';
  document.getElementById('profileUsername').textContent = `@${currentUser.username || 'user'}`;
  document.getElementById('profileNameInput').value = currentUser.name || '';
  document.getElementById('profileBio').value = currentUser.bio || '';
  document.getElementById('profilePhone').value = currentUser.phone || '';
  
  if (currentUser.photoUrl) {
    document.getElementById('profileAvatar').src = currentUser.photoUrl;
  }
  
  // Role toggle
  document.querySelectorAll('.role-btn').forEach(btn => {
    const role = btn.dataset.role;
    btn.classList.toggle('active', currentUser.roles?.includes(role));
    btn.addEventListener('click', async () => {
      const roles = currentUser.roles || [];
      const newRoles = roles.includes(role) ? roles : [...roles, role];
      await window.hustlAPI.users.update({ roles: newRoles });
      renderAll();
    });
  });
  
  // Avatar upload
  document.getElementById('changePhotoBtn')?.addEventListener('click', () => {
    document.getElementById('avatarUpload').click();
  });
  
  document.getElementById('avatarUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const { publicUrl } = await window.hustlAPI.uploads.uploadFile(file, 'photo');
      await window.hustlAPI.users.update({ photoUrl: publicUrl });
      renderView('profile');
    } catch (error) {
      showToast(error.message || 'Failed to upload photo');
    }
  });
}

async function renderOwner() {
  const container = document.getElementById('ownerJobsList');
  if (!container) return;
  
  try {
    const jobs = await fetch('/jobs/my-jobs', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('hustl_token')}` }
    }).then(r => r.json());
    
    container.innerHTML = jobs.map(job => `
      <div class="job-card">
        <h3>${job.title}</h3>
        <p>Status: ${job.status}</p>
        <p>$${job.amount || job.hourlyRate || '0'}</p>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading your jobs</p>';
  }
}

function openJobDetails(jobId) {
  // TODO: Implement job details modal
  showToast('Job details coming soon');
}

// Filters
document.getElementById('toggleFiltersBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('filtersPanel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
});

document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
  renderJobs();
});

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Start app
bootApp();


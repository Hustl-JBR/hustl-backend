/**
 * 🚀 MOBILE-FIRST CORE - Production Ready
 * TaskRabbit/Rover-level mobile experience with advanced optimizations
 * Native app feel with pull-to-refresh, haptic feedback, and smooth animations
 */

// ========== PULL TO REFRESH ==========

class PullToRefresh {
  constructor() {
    this.startY = 0;
    this.currentY = 0;
    this.pulling = false;
    this.refreshing = false;
    this.threshold = 80;
    this.refreshCallback = null;
    this.element = null;
    this.init();
  }

  init() {
    // Only on mobile
    if (window.innerWidth > 768) return;
    
    this.createRefreshIndicator();
    this.attachEvents();
  }

  createRefreshIndicator() {
    this.element = document.createElement('div');
    this.element.className = 'pull-to-refresh';
    this.element.innerHTML = `
      <svg class="pull-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      <span class="pull-text">Pull to refresh</span>
    `;
    document.body.insertBefore(this.element, document.body.firstChild);
  }

  attachEvents() {
    let scrollableParent = null;

    document.addEventListener('touchstart', (e) => {
      // Only trigger at top of page
      if (window.scrollY > 5) return;
      if (this.refreshing) return;
      
      this.startY = e.touches[0].clientY;
      this.pulling = true;
      scrollableParent = this.getScrollableParent(e.target);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this.pulling || this.refreshing) return;
      if (scrollableParent && scrollableParent.scrollTop > 0) return;
      
      this.currentY = e.touches[0].clientY;
      const diff = this.currentY - this.startY;
      
      if (diff > 0 && window.scrollY <= 0) {
        const progress = Math.min(diff / this.threshold, 1);
        this.element.style.transform = `translateY(${Math.min(diff * 0.5, 60) - 60}px)`;
        this.element.querySelector('.pull-text').textContent = 
          progress >= 1 ? 'Release to refresh' : 'Pull to refresh';
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!this.pulling) return;
      
      const diff = this.currentY - this.startY;
      
      if (diff >= this.threshold && !this.refreshing) {
        this.triggerRefresh();
      } else {
        this.reset();
      }
      
      this.pulling = false;
    });
  }

  getScrollableParent(element) {
    while (element) {
      const style = window.getComputedStyle(element);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  triggerRefresh() {
    this.refreshing = true;
    this.element.classList.add('visible', 'refreshing');
    this.element.style.transform = 'translateY(0)';
    this.element.querySelector('.pull-text').textContent = 'Refreshing...';
    
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    // Call the refresh callback
    if (this.refreshCallback) {
      Promise.resolve(this.refreshCallback())
        .then(() => this.completeRefresh())
        .catch(() => this.completeRefresh());
    } else {
      // Default: reload current view
      setTimeout(() => {
        if (typeof renderAll === 'function') {
          renderAll();
        }
        this.completeRefresh();
      }, 800);
    }
  }

  completeRefresh() {
    this.element.querySelector('.pull-text').textContent = 'Updated!';
    
    setTimeout(() => {
      this.reset();
      this.refreshing = false;
    }, 500);
  }

  reset() {
    this.element.classList.remove('visible', 'refreshing');
    this.element.style.transform = 'translateY(-100%)';
    this.startY = 0;
    this.currentY = 0;
  }

  onRefresh(callback) {
    this.refreshCallback = callback;
  }
}

// ========== HAPTIC FEEDBACK ==========

class HapticFeedback {
  constructor() {
    this.supported = 'vibrate' in navigator;
  }

  light() {
    if (this.supported) navigator.vibrate(5);
  }

  medium() {
    if (this.supported) navigator.vibrate(10);
  }

  heavy() {
    if (this.supported) navigator.vibrate(20);
  }

  success() {
    if (this.supported) navigator.vibrate([10, 50, 10]);
  }

  error() {
    if (this.supported) navigator.vibrate([50, 30, 50]);
  }

  selection() {
    if (this.supported) navigator.vibrate(3);
  }
}

// ========== SKELETON LOADER HELPER ==========

class SkeletonLoader {
  createJobCardSkeleton() {
    return `
      <div class="skeleton-card card-animate">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-meta"></div>
        <div class="skeleton skeleton-body"></div>
      </div>
    `;
  }

  createMessageSkeleton() {
    return `
      <div class="skeleton-card" style="display: flex; gap: 12px; align-items: center;">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex: 1;">
          <div class="skeleton skeleton-text" style="width: 40%;"></div>
          <div class="skeleton skeleton-text-sm"></div>
        </div>
      </div>
    `;
  }

  showInContainer(container, type = 'job', count = 3) {
    if (!container) return;
    
    let html = '';
    const generator = type === 'job' ? this.createJobCardSkeleton : this.createMessageSkeleton;
    
    for (let i = 0; i < count; i++) {
      html += generator.call(this);
    }
    
    container.innerHTML = html;
  }

  hide(container) {
    if (!container) return;
    // Content will be replaced by actual data
  }
}

// ========== ENHANCED TOAST SYSTEM ==========

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'default', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    this.container.appendChild(toast);
    
    // Haptic feedback
    if (window.mobileCore?.haptics) {
      if (type === 'success') {
        window.mobileCore.haptics.success();
      } else if (type === 'error') {
        window.mobileCore.haptics.error();
      } else {
        window.mobileCore.haptics.light();
      }
    }
    
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  success(message) {
    this.show(message, 'success');
  }

  error(message) {
    this.show(message, 'error');
  }
}

// ========== PAGE TRANSITION MANAGER ==========

class PageTransitionManager {
  constructor() {
    this.currentView = null;
  }

  transition(newView, element) {
    if (!element) return;
    
    // Add entrance animation
    element.classList.remove('page-enter', 'page-enter-active');
    void element.offsetWidth; // Force reflow
    element.classList.add('page-enter');
    
    // Haptic feedback on page change
    if (window.mobileCore?.haptics) {
      window.mobileCore.haptics.selection();
    }
    
    this.currentView = newView;
  }

  animateCards(container) {
    if (!container) return;
    
    const cards = container.querySelectorAll('.job-card, .card');
    cards.forEach((card, index) => {
      card.classList.remove('card-animate');
      card.style.animationDelay = `${index * 0.05}s`;
      void card.offsetWidth; // Force reflow
      card.classList.add('card-animate');
    });
  }
}

// ========== NETWORK STATUS INDICATOR ==========

class NetworkStatus {
  constructor() {
    this.online = navigator.onLine;
    this.init();
  }

  init() {
    window.addEventListener('online', () => {
      this.online = true;
      if (window.mobileCore?.toasts) {
        window.mobileCore.toasts.success('Back online');
      }
    });

    window.addEventListener('offline', () => {
      this.online = false;
      if (window.mobileCore?.toasts) {
        window.mobileCore.toasts.error('You\'re offline');
      }
    });
  }

  isOnline() {
    return this.online;
  }
}

// ========== MOBILE BOTTOM NAVIGATION ==========

class MobileBottomNav {
  constructor() {
    this.nav = null;
    this.currentView = 'home';
    this.unreadCount = 0;
    this.init();
  }

  init() {
    // Create bottom nav if on mobile
    if (window.innerWidth <= 768) {
      this.createBottomNav();
      this.setupEventListeners();
      this.updateActiveTab(this.currentView);
    }

    // Re-create on resize
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 768 && !this.nav) {
        this.createBottomNav();
        this.setupEventListeners();
      } else if (window.innerWidth > 768 && this.nav) {
        this.nav.remove();
        this.nav = null;
      }
    });
  }

  createBottomNav() {
    // Remove existing nav if any
    const existing = document.getElementById('mobileBottomNav');
    if (existing) existing.remove();

    this.nav = document.createElement('nav');
    this.nav.id = 'mobileBottomNav';
    this.nav.className = 'mobile-bottom-nav';

    const items = document.createElement('div');
    items.className = 'mobile-bottom-nav-items';

    const navItems = [
      { id: 'home', icon: '🏠', label: 'Home', view: 'home' },
      { id: 'jobs', icon: '💼', label: 'Jobs', view: 'jobs' },
      { id: 'create', icon: '➕', label: 'Create', view: 'post' },
      { id: 'messages', icon: '💬', label: 'Messages', view: 'messages' },
      { id: 'profile', icon: '👤', label: 'Profile', view: 'profile' },
    ];

    navItems.forEach(item => {
      const navItem = document.createElement('button');
      navItem.className = 'mobile-bottom-nav-item';
      navItem.dataset.view = item.view;
      navItem.id = `mobileNav${item.id.charAt(0).toUpperCase() + item.id.slice(1)}`;

      const icon = document.createElement('div');
      icon.className = 'mobile-bottom-nav-icon';
      icon.textContent = item.icon;

      const label = document.createElement('div');
      label.className = 'mobile-bottom-nav-label';
      label.textContent = item.label;

      navItem.appendChild(icon);
      navItem.appendChild(label);

      // Add badge for messages
      if (item.view === 'messages') {
        navItem.classList.add('mobile-bottom-nav-badge');
        navItem.setAttribute('data-count', '0');
      }

      items.appendChild(navItem);
    });

    this.nav.appendChild(items);
    document.body.appendChild(this.nav);
  }

  setupEventListeners() {
    if (!this.nav) return;

    this.nav.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const view = item.dataset.view;
        if (view) {
          // Use window.setView and check if it's the real function
          if (window.setView && typeof window.setView === 'function') {
            const funcStr = window.setView.toString();
            if (!funcStr.includes('not ready yet')) {
              window.setView(view);
              this.updateActiveTab(view);
            } else {
              // Fallback if setView is stub
              document.querySelectorAll("[id^='view-']").forEach((sec) => (sec.style.display = "none"));
              const target = document.getElementById("view-" + view);
              if (target) {
                target.style.display = "block";
                this.updateActiveTab(view);
              }
            }
          } else {
            // Fallback if setView not available
            document.querySelectorAll("[id^='view-']").forEach((sec) => (sec.style.display = "none"));
            const target = document.getElementById("view-" + view);
            if (target) {
              target.style.display = "block";
              this.updateActiveTab(view);
            }
          }
        }
      });
    });
  }

  updateActiveTab(view) {
    this.currentView = view;
    if (!this.nav) return;

    this.nav.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
      if (item.dataset.view === view) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  updateUnreadCount(count) {
    this.unreadCount = count;
    const messagesNav = document.getElementById('mobileNavMessages');
    if (messagesNav) {
      messagesNav.setAttribute('data-count', count.toString());
    }
  }
}

// ========== SIMPLIFIED LOCATION TOOLS ==========

class LocationTools {
  constructor() {
    this.overlay = null;
    this.currentZip = '';
    this.currentRadius = 10;
    this.callback = null;
  }

  show(callback) {
    this.callback = callback;
    
    // Get current values from localStorage or defaults
    this.currentZip = localStorage.getItem('savedZipFilter') || '';
    this.currentRadius = parseInt(localStorage.getItem('savedRadiusFilter') || '10', 10);

    this.createModal();
  }

  createModal() {
    // Remove existing overlay if any
    const existing = document.getElementById('locationToolsOverlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'locationToolsOverlay';
    this.overlay.className = 'location-tools-overlay';

    const modal = document.createElement('div');
    modal.className = 'location-tools-modal';

    const header = document.createElement('div');
    header.className = 'location-tools-header';
    
    const title = document.createElement('div');
    title.className = 'location-tools-title';
    title.textContent = 'Set Location';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'location-tools-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // GPS Button
    const gpsOption = document.createElement('div');
    gpsOption.className = 'location-tools-option';
    
    const gpsLabel = document.createElement('label');
    gpsLabel.className = 'location-tools-option-label';
    gpsLabel.textContent = '1. Use My Location';

    const gpsBtn = document.createElement('button');
    gpsBtn.className = 'location-tools-gps-btn';
    gpsBtn.innerHTML = '📍 Get My Location';
    gpsBtn.addEventListener('click', () => this.useGPS());

    gpsOption.appendChild(gpsLabel);
    gpsOption.appendChild(gpsBtn);

    // ZIP Input
    const zipOption = document.createElement('div');
    zipOption.className = 'location-tools-option';
    
    const zipLabel = document.createElement('label');
    zipLabel.className = 'location-tools-option-label';
    zipLabel.textContent = '2. Or Enter ZIP Code';

    const zipInput = document.createElement('input');
    zipInput.className = 'location-tools-zip-input';
    zipInput.type = 'text';
    zipInput.placeholder = '37000-38999 (Tennessee only)';
    zipInput.value = this.currentZip;
    zipInput.maxLength = 5;
    zipInput.addEventListener('input', (e) => {
      this.currentZip = e.target.value.replace(/\D/g, '').slice(0, 5);
      e.target.value = this.currentZip;
    });

    zipOption.appendChild(zipLabel);
    zipOption.appendChild(zipInput);

    // Radius Slider
    const radiusOption = document.createElement('div');
    radiusOption.className = 'location-tools-option';
    
    const radiusLabel = document.createElement('label');
    radiusLabel.className = 'location-tools-option-label';
    radiusLabel.textContent = '3. Search Radius';

    const radiusSlider = document.createElement('input');
    radiusSlider.className = 'location-tools-radius-slider';
    radiusSlider.type = 'range';
    radiusSlider.min = '5';
    radiusSlider.max = '30';
    radiusSlider.value = this.currentRadius.toString();
    radiusSlider.step = '5';

    const radiusValue = document.createElement('div');
    radiusValue.className = 'location-tools-radius-value';
    radiusValue.textContent = `${this.currentRadius} miles`;

    radiusSlider.addEventListener('input', (e) => {
      this.currentRadius = parseInt(e.target.value, 10);
      radiusValue.textContent = `${this.currentRadius} miles`;
    });

    radiusOption.appendChild(radiusLabel);
    radiusOption.appendChild(radiusSlider);
    radiusOption.appendChild(radiusValue);

    // Apply Button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'location-tools-gps-btn';
    applyBtn.textContent = 'Apply Filters';
    applyBtn.style.marginTop = '1rem';
    applyBtn.addEventListener('click', () => this.apply());

    modal.appendChild(header);
    modal.appendChild(gpsOption);
    modal.appendChild(zipOption);
    modal.appendChild(radiusOption);
    modal.appendChild(applyBtn);

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Focus ZIP input
    setTimeout(() => zipInput.focus(), 100);
  }

  useGPS() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    const btn = event.target.closest('.location-tools-gps-btn');
    if (btn) {
      btn.textContent = '📍 Getting location...';
      btn.disabled = true;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Store in localStorage
        localStorage.setItem('userLocation', JSON.stringify({
          lat,
          lng,
          timestamp: Date.now(),
        }));
        
        if (btn) {
          btn.textContent = '✅ Location set!';
        }

        setTimeout(() => {
          this.apply();
        }, 500);
      },
      (error) => {
        alert('Could not get your location. Please enter a ZIP code instead.');
        if (btn) {
          btn.textContent = '📍 Get My Location';
          btn.disabled = false;
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  apply() {
    // Save to localStorage
    if (this.currentZip) {
      localStorage.setItem('savedZipFilter', this.currentZip);
    }
    localStorage.setItem('savedRadiusFilter', this.currentRadius.toString());

    // Call callback if provided
    if (this.callback) {
      this.callback({
        zip: this.currentZip,
        radius: this.currentRadius,
      });
    }

    this.close();
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

// ========== MOBILE JOB FEED OPTIMIZER ==========

class MobileJobFeed {
  constructor() {
    this.jobsPerPage = 10; // Limit to 10 jobs per page on mobile
    this.currentPage = 1;
    this.allJobs = [];
    this.groupedJobs = null;
  }

  limitJobs(jobs, page = 1) {
    this.currentPage = page;
    const start = (page - 1) * this.jobsPerPage;
    const end = start + this.jobsPerPage;
    return jobs.slice(start, end);
  }

  groupByDistance(jobs) {
    const groups = {
      'within-5': [],
      'within-10': [],
      'within-20': [],
      'beyond-20': [],
    };

    jobs.forEach(job => {
      const distance = job.distance;
      if (distance === null || distance === undefined) {
        groups['beyond-20'].push(job);
      } else if (distance <= 5) {
        groups['within-5'].push(job);
      } else if (distance <= 10) {
        groups['within-10'].push(job);
      } else if (distance <= 20) {
        groups['within-20'].push(job);
      } else {
        groups['beyond-20'].push(job);
      }
    });

    this.groupedJobs = groups;
    return groups;
  }

  hasMore(jobs) {
    return this.currentPage * this.jobsPerPage < jobs.length;
  }

  reset() {
    this.currentPage = 1;
    this.allJobs = [];
    this.groupedJobs = null;
  }
}

// ========== LAZY IMAGE LOADER ==========

class LazyImageLoader {
  constructor() {
    this.imageObserver = null;
    this.init();
  }

  init() {
    // Use IntersectionObserver if available (modern browsers)
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            this.imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px', // Start loading 50px before image enters viewport
      });
    }
  }

  observe(img) {
    if (this.imageObserver && img instanceof HTMLImageElement) {
      img.classList.add('lazy-image');
      img.dataset.src = img.src;
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E'; // Placeholder
      this.imageObserver.observe(img);
    }
  }

  loadImage(img) {
    if (img.dataset.src) {
      const imageLoader = new Image();
      imageLoader.onload = () => {
        img.src = img.dataset.src;
        img.classList.add('loaded');
        delete img.dataset.src;
      };
      imageLoader.onerror = () => {
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%23e5e7eb" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="14"%3EImage%3C/text%3E%3C/svg%3E';
        img.classList.add('loaded');
      };
      imageLoader.src = img.dataset.src;
    }
  }

  observeAll() {
    document.querySelectorAll('img.lazy-image').forEach(img => {
      this.observe(img);
    });
  }
}

// ========== SWIPE HANDLER ==========

class SwipeHandler {
  constructor() {
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.threshold = 50;
  }

  attach(element, onSwipeLeft, onSwipeRight) {
    if (!element) return;

    element.addEventListener('touchstart', (e) => {
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
    });

    element.addEventListener('touchmove', (e) => {
      this.currentX = e.touches[0].clientX;
    });

    element.addEventListener('touchend', () => {
      const diffX = this.startX - this.currentX;
      const diffY = Math.abs(this.startY - (e.touches[0]?.clientY || this.startY));

      // Only trigger swipe if horizontal movement is greater than vertical
      if (Math.abs(diffX) > this.threshold && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && onSwipeLeft) {
          onSwipeLeft();
        } else if (diffX < 0 && onSwipeRight) {
          onSwipeRight();
        }
      }

      this.startX = 0;
      this.currentY = 0;
      this.currentX = 0;
    });
  }
}

// ========== EXPORTS ==========

window.mobileCore = {
  // Navigation & UI
  bottomNav: new MobileBottomNav(),
  locationTools: new LocationTools(),
  
  // Performance & Loading
  jobFeed: new MobileJobFeed(),
  lazyImages: new LazyImageLoader(),
  skeleton: new SkeletonLoader(),
  
  // Native App Features
  pullToRefresh: new PullToRefresh(),
  haptics: new HapticFeedback(),
  toasts: new ToastManager(),
  pageTransitions: new PageTransitionManager(),
  networkStatus: new NetworkStatus(),
  
  // Gestures
  swipeHandler: new SwipeHandler(),
};

// Set up pull-to-refresh callback for jobs view
if (window.mobileCore.pullToRefresh) {
  window.mobileCore.pullToRefresh.onRefresh(async () => {
    // Invalidate cache and refresh
    if (window.optimizedApi) {
      window.optimizedApi.invalidateCache('/jobs');
    }
    if (typeof renderAll === 'function') {
      await new Promise(resolve => {
        renderAll();
        setTimeout(resolve, 300);
      });
    }
  });
}

console.log('✅ Mobile Core loaded - Native app experience with pull-to-refresh, haptics, and smooth animations');


/**
 * 🚀 MOBILE-FIRST CORE - Production Ready
 * TaskRabbit/Rover-level mobile experience with advanced optimizations
 */

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
        const view = item.dataset.view;
        if (typeof setView === 'function') {
          setView(view);
        }
        this.updateActiveTab(view);
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
  bottomNav: new MobileBottomNav(),
  locationTools: new LocationTools(),
  jobFeed: new MobileJobFeed(),
  lazyImages: new LazyImageLoader(),
  swipeHandler: new SwipeHandler(),
};

console.log('✅ Mobile Core loaded - TaskRabbit/Rover-level mobile experience active');


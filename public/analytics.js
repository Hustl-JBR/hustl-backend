/**
 * Analytics and A/B Testing System
 * Lightweight, privacy-focused analytics
 */

class Analytics {
  constructor() {
    this.events = [];
    this.userId = null;
    this.sessionId = this.generateSessionId();
    this.experiments = {};
    this.init();
  }

  init() {
    // Load user ID from token if available
    try {
      const token = localStorage.getItem('hustl_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.userId = payload.userId || payload.id;
      }
    } catch (e) {
      // Token not available or invalid
    }

    // Load experiment assignments from localStorage
    this.loadExperiments();

    // Track page views
    this.trackPageView();

    // Track session start
    this.track('session_start', {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  loadExperiments() {
    const stored = localStorage.getItem('hustl_experiments');
    if (stored) {
      try {
        this.experiments = JSON.parse(stored);
      } catch (e) {
        this.experiments = {};
      }
    }
  }

  saveExperiments() {
    localStorage.setItem('hustl_experiments', JSON.stringify(this.experiments));
  }

  /**
   * Track an event
   */
  track(eventName, properties = {}) {
    const event = {
      name: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    this.events.push(event);

    // Send to backend (if endpoint exists)
    this.sendEvent(event);

    // Log in development
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      console.log('[Analytics]', eventName, properties);
    }
  }

  async sendEvent(event) {
    try {
      // Only send if user is authenticated (to avoid spam)
      if (!this.userId) return;

      const token = localStorage.getItem('hustl_token');
      if (!token) return;

      // Send to backend analytics endpoint (if it exists)
      await fetch('/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      }).catch(() => {
        // Silently fail - analytics shouldn't break the app
      });
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Track page view
   */
  trackPageView() {
    const view = window.location.hash.replace('#', '') || 'home';
    this.track('page_view', {
      view,
      path: window.location.pathname,
    });
  }

  /**
   * A/B Testing - Get variant for an experiment
   */
  getExperimentVariant(experimentName, variants = ['A', 'B']) {
    // Check if already assigned
    if (this.experiments[experimentName]) {
      return this.experiments[experimentName];
    }

    // Assign variant (50/50 split)
    const variant = variants[Math.floor(Math.random() * variants.length)];
    this.experiments[experimentName] = variant;
    this.saveExperiments();

    // Track assignment
    this.track('experiment_assigned', {
      experiment: experimentName,
      variant,
    });

    return variant;
  }

  /**
   * Track conversion for an experiment
   */
  trackConversion(experimentName, conversionName, value = null) {
    const variant = this.experiments[experimentName];
    if (!variant) return;

    this.track('experiment_conversion', {
      experiment: experimentName,
      variant,
      conversion: conversionName,
      value,
    });
  }

  /**
   * Track funnel step
   */
  trackFunnelStep(step, properties = {}) {
    this.track('funnel_step', {
      step,
      ...properties,
    });
  }

  /**
   * Track user action
   */
  trackAction(action, properties = {}) {
    this.track(`action_${action}`, properties);
  }

  /**
   * Get all events (for debugging)
   */
  getEvents() {
    return this.events;
  }

  /**
   * Clear events (privacy)
   */
  clearEvents() {
    this.events = [];
  }
}

// Initialize analytics
window.analytics = new Analytics();

// Track common events automatically
document.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (button && button.id) {
    window.analytics.trackAction('button_click', {
      buttonId: button.id,
      buttonText: button.textContent?.trim(),
    });
  }
});

// Track form submissions
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id) {
    window.analytics.trackAction('form_submit', {
      formId: form.id,
    });
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Analytics;
}



const express = require('express');
const prisma = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /analytics/track - Track an analytics event
router.post('/track', optionalAuth, async (req, res) => {
  try {
    const { name, properties } = req.body;
    const userId = req.user?.id || null;

    // Store event (you can use a separate analytics database or service)
    // For now, we'll just log it
    console.log('[Analytics]', name, {
      userId,
      ...properties,
    });

    // In production, you might want to:
    // 1. Store in a separate analytics database
    // 2. Send to a service like PostHog, Mixpanel, or Google Analytics
    // 3. Aggregate for reporting

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics track error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /analytics/experiments - Get active experiments (for admin)
router.get('/experiments', authenticate, async (req, res) => {
  try {
    // Only admins can view experiments
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { roles: true },
    });

    if (!user?.roles?.includes('ADMIN')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return experiment configuration
    // In production, this would come from a database or config
    res.json({
      experiments: [
        {
          name: 'onboarding_flow',
          variants: ['A', 'B'],
          description: 'Test different onboarding flows',
        },
        {
          name: 'job_posting_flow',
          variants: ['A', 'B'],
          description: 'Test job posting form variations',
        },
      ],
    });
  } catch (error) {
    console.error('Get experiments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;



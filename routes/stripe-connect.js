const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { createConnectedAccount, createAccountLink } = require('../services/stripe');

const router = express.Router();

// Authenticate but allow any user (they can be both customer and hustler)
router.use(authenticate);

// POST /stripe-connect/create-account - Create a Stripe connected account for the hustler
router.post('/create-account', async (req, res) => {
  try {
    const user = req.user;

    // Check if user has HUSTLER role
    const userRoles = (user.roles || []).map(r => r.toUpperCase());
    if (!userRoles.includes('HUSTLER')) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a hustler to connect a Stripe account'
      });
    }

    if (user.stripeAccountId) {
      return res.status(400).json({ error: 'Stripe account already connected' });
    }

    // Check if we should skip Stripe (only if explicitly set)
    // Even in test mode with sk_test_ key, we should create real Stripe accounts
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let accountId;
    
    if (skipStripeCheck) {
      // Only skip if explicitly set - this is for development without Stripe
      accountId = `acct_test_${user.id.substring(0, 24)}`;
      console.log('[SKIP_STRIPE_CHECK] Creating fake Stripe account:', accountId);
    } else {
      try {
        // Create real Stripe Connect account (works in both test and live mode)
        // In test mode, this creates a test account that can receive test payouts
        const account = await createConnectedAccount(user.email);
        accountId = account.id;
        console.log('[STRIPE CONNECT] Created account:', accountId, 'Type:', account.type);
      } catch (stripeError) {
        console.error('[STRIPE CONNECT] Error creating connected account:', stripeError);
        if (stripeError.type === 'StripeAuthenticationError' || stripeError.code === 'invalid_api_key') {
          return res.status(500).json({ 
            error: 'Stripe configuration error',
            message: 'Invalid or missing Stripe API key. Please check STRIPE_SECRET_KEY in Railway.'
          });
        }
        throw stripeError;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId },
    });

    res.json({ accountId });
  } catch (error) {
    console.error('Error creating Stripe account:', error);
    res.status(500).json({ error: 'Failed to create Stripe account' });
  }
});

// GET /stripe-connect/onboarding-link - Get a link to onboard or manage the Stripe account
router.get('/onboarding-link', async (req, res) => {
  try {
    const user = req.user;

    // Check if user has HUSTLER role
    const userRoles = (user.roles || []).map(r => r.toUpperCase());
    if (!userRoles.includes('HUSTLER')) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a hustler to connect a Stripe account'
      });
    }

    if (!user.stripeAccountId) {
      return res.status(400).json({ error: 'Stripe account not created. Please create account first.' });
    }

    // Check if we should skip Stripe (only if explicitly set)
    // Even in test mode with sk_test_ key, we should create real Stripe onboarding links
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    if (skipStripeCheck) {
      // Only skip if explicitly set - this is for development without Stripe
      const origin = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || req.get('origin');
      const fakeUrl = `${origin}/profile?stripe_onboarding=success&test_mode=true`;
      console.log('[SKIP_STRIPE_CHECK] Returning fake Stripe onboarding link');
      return res.json({ url: fakeUrl });
    }

    // Create real Stripe account link (works in both test and live mode)
    // In test mode, this will create a test onboarding link that goes to Stripe's test onboarding
    const origin = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || req.get('origin');
    const returnUrl = `${origin}/profile?stripe_onboarding=success`;
    const refreshUrl = `${origin}/profile?stripe_onboarding=refresh`;

    try {
      const accountLink = await createAccountLink(user.stripeAccountId, returnUrl, refreshUrl);
      console.log('[STRIPE CONNECT] Created onboarding link:', accountLink.url);
      res.json({ url: accountLink.url });
    } catch (stripeError) {
      console.error('[STRIPE CONNECT] Error creating account link:', stripeError);
      if (stripeError.type === 'StripeAuthenticationError' || stripeError.code === 'invalid_api_key') {
        return res.status(500).json({ 
          error: 'Stripe configuration error',
          message: 'Invalid or missing Stripe API key. Please check STRIPE_SECRET_KEY in Railway.'
        });
      }
      throw stripeError;
    }
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).json({ error: 'Failed to create Stripe account link' });
  }
});

// GET /stripe-connect/status - Check the status of the connected Stripe account
router.get('/status', async (req, res) => {
  try {
    const user = req.user;

    // Check if user has HUSTLER role
    const userRoles = (user.roles || []).map(r => r.toUpperCase());
    if (!userRoles.includes('HUSTLER')) {
      return res.json({ connected: false, accountId: null });
    }

    if (!user.stripeAccountId) {
      return res.json({ connected: false, accountId: null });
    }

    // In a real app, you'd fetch the account from Stripe to check details
    // For now, just checking if accountId exists is sufficient for 'connected'
    res.json({ connected: true, accountId: user.stripeAccountId });
  } catch (error) {
    console.error('Error checking Stripe status:', error);
    res.status(500).json({ error: 'Failed to check Stripe status' });
  }
});

module.exports = router;

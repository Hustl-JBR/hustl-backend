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
// POST /stripe-connect/onboarding-link - Create account and get onboarding link (if account doesn't exist)
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

    // If account doesn't exist, create it first
    if (!user.stripeAccountId) {
      console.log('[STRIPE CONNECT] Account not found, creating new account for user:', user.id);
      
      // Create account first
      const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
      let accountId;
      
      if (skipStripeCheck) {
        accountId = `acct_test_${user.id.substring(0, 24)}`;
        console.log('[SKIP_STRIPE_CHECK] Creating fake Stripe account:', accountId);
      } else {
        try {
          const account = await createConnectedAccount(user.email);
          accountId = account.id;
          console.log('[STRIPE CONNECT] Created account:', accountId);
        } catch (stripeError) {
          console.error('[STRIPE CONNECT] Error creating account:', stripeError);
          return res.status(500).json({ 
            error: 'Failed to create Stripe account',
            message: stripeError.message
          });
        }
      }

      // Save account ID
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId },
      });
      
      // Update user object for next step
      user.stripeAccountId = accountId;
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
      console.error('[STRIPE CONNECT] Error details:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        accountId: user.stripeAccountId
      });
      
      if (stripeError.type === 'StripeAuthenticationError' || stripeError.code === 'invalid_api_key') {
        return res.status(500).json({ 
          error: 'Stripe configuration error',
          message: 'Invalid or missing Stripe API key. Please check STRIPE_SECRET_KEY in Railway.',
          details: stripeError.message
        });
      }
      
      if (stripeError.code === 'resource_missing') {
        return res.status(400).json({
          error: 'Stripe account not found',
          message: 'The Stripe account ID in database does not exist in Stripe. Please create a new account.',
          accountId: user.stripeAccountId,
          hint: 'Call POST /stripe-connect/create-account to create a new account'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create Stripe account link',
        message: stripeError.message || 'Unknown error',
        type: stripeError.type,
        code: stripeError.code
      });
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
      return res.json({ 
        connected: false, 
        accountId: null,
        message: 'User is not a hustler'
      });
    }

    if (!user.stripeAccountId) {
      return res.json({ 
        connected: false, 
        accountId: null,
        message: 'Stripe account not created. Call POST /stripe-connect/create-account first.'
      });
    }

    // Try to verify account exists in Stripe
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let accountValid = false;
    let accountDetails = null;

    if (!skipStripeCheck && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        accountDetails = await stripe.accounts.retrieve(user.stripeAccountId);
        accountValid = true;
      } catch (stripeError) {
        console.error('[STRIPE CONNECT] Error retrieving account:', stripeError);
        accountValid = false;
      }
    } else {
      accountValid = true; // Assume valid if skipping check
    }

    res.json({ 
      connected: accountValid,
      accountId: user.stripeAccountId,
      accountDetails: accountDetails ? {
        id: accountDetails.id,
        type: accountDetails.type,
        chargesEnabled: accountDetails.charges_enabled,
        payoutsEnabled: accountDetails.payouts_enabled,
        detailsSubmitted: accountDetails.details_submitted
      } : null
    });
  } catch (error) {
    console.error('Error checking Stripe status:', error);
    res.status(500).json({ error: 'Failed to check Stripe status' });
  }
});

module.exports = router;

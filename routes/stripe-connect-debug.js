/**
 * Stripe Connect Debug Endpoint
 * Use this to diagnose Stripe Connect issues
 */

const express = require('express');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');
const Stripe = require('stripe');

const router = express.Router();
router.use(authenticate);

// GET /stripe-connect-debug/test - Test Stripe connection and account creation
router.get('/test', async (req, res) => {
  try {
    const user = req.user;
    const results = {
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        hasStripeAccount: !!user.stripeAccountId,
        stripeAccountId: user.stripeAccountId
      },
      stripe: {
        keyConfigured: !!process.env.STRIPE_SECRET_KEY,
        keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || 'NOT SET',
        isTestMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'),
        skipStripeCheck: process.env.SKIP_STRIPE_CHECK === 'true'
      },
      tests: {}
    };

    // Test 1: Check if Stripe key is valid
    if (process.env.STRIPE_SECRET_KEY && process.env.SKIP_STRIPE_CHECK !== 'true') {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const account = await stripe.accounts.retrieve('acct_1234567890'); // This will fail but tests the key
        results.tests.stripeKeyValid = true;
      } catch (error) {
        if (error.code === 'resource_missing') {
          results.tests.stripeKeyValid = true; // Key is valid, account just doesn't exist
        } else if (error.type === 'StripeAuthenticationError') {
          results.tests.stripeKeyValid = false;
          results.tests.stripeKeyError = error.message;
        } else {
          results.tests.stripeKeyValid = true; // Key works, different error
        }
      }
    }

    // Test 2: Check if user account exists in Stripe
    if (user.stripeAccountId && process.env.SKIP_STRIPE_CHECK !== 'true') {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const account = await stripe.accounts.retrieve(user.stripeAccountId);
        results.tests.accountExists = true;
        results.tests.accountDetails = {
          id: account.id,
          type: account.type,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted
        };
      } catch (error) {
        results.tests.accountExists = false;
        results.tests.accountError = error.message;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('[STRIPE DEBUG] Error:', error);
    res.status(500).json({ 
      error: 'Debug test failed',
      message: error.message 
    });
  }
});

module.exports = router;


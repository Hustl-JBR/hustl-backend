const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { createConnectedAccount, verifyStripeAccount, createAccountLink } = require('../services/stripe');

const router = express.Router();

// Authenticate but allow any user (they can be both customer and hustler)
router.use(authenticate);

// POST /stripe-connect/create-account - Create a Stripe connected account for the hustler
router.post('/create-account', async (req, res) => {
  try {
    const user = req.user;
    
    console.log('[STRIPE CONNECT] Create account request from user:', user.id, 'Email:', user.email);

    // Check if user has HUSTLER role
    const userRoles = (user.roles || []).map(r => r.toUpperCase());
    console.log('[STRIPE CONNECT] User roles:', userRoles);
    
    if (!userRoles.includes('HUSTLER')) {
      console.log('[STRIPE CONNECT] User does not have HUSTLER role');
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a hustler to connect a Stripe account',
        userRoles: userRoles
      });
    }

    if (user.stripeAccountId) {
      // Account already exists - that's fine, just return it
      console.log('[STRIPE CONNECT] Account already exists:', user.stripeAccountId);
      return res.json({ 
        accountId: user.stripeAccountId,
        message: 'Stripe account already exists. Use GET /stripe-connect/onboarding-link to get onboarding URL.',
        alreadyExists: true
      });
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

    console.log('[STRIPE CONNECT] Account created and saved:', accountId);
    res.json({ 
      accountId,
      message: 'Stripe account created successfully. Call GET /stripe-connect/onboarding-link to get onboarding URL.'
    });
  } catch (error) {
    console.error('[STRIPE CONNECT] Error creating Stripe account:', error);
    console.error('[STRIPE CONNECT] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create Stripe account',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /stripe-connect/onboarding-link - Get a link to onboard or manage the Stripe account
// POST /stripe-connect/onboarding-link - Create account and get onboarding link (if account doesn't exist)
// Both GET and POST work the same way
const handleOnboardingLink = async (req, res) => {
  try {
    const user = req.user;
    
    console.log('[STRIPE CONNECT] Onboarding link request from user:', user.id, 'Email:', user.email);

    // Check if user has HUSTLER role
    const userRoles = (user.roles || []).map(r => r.toUpperCase());
    console.log('[STRIPE CONNECT] User roles:', userRoles);
    
    if (!userRoles.includes('HUSTLER')) {
      console.log('[STRIPE CONNECT] User does not have HUSTLER role');
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a hustler to connect a Stripe account',
        userRoles: userRoles
      });
    }

    // If account doesn't exist, create it first
    // If account exists but is invalid, delete it and create a new one
    let accountId = user.stripeAccountId;
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    if (!accountId) {
      console.log('[STRIPE CONNECT] Account not found, creating new account for user:', user.id);
      
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
            message: stripeError.message,
            type: stripeError.type,
            code: stripeError.code
          });
        }
      }

      // Save account ID
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId },
      });
      console.log('[STRIPE CONNECT] Account created and saved:', accountId);
    } else {
      console.log('[STRIPE CONNECT] User already has Stripe account:', accountId);
      
      // Verify the account actually exists in Stripe (unless we're skipping Stripe)
      if (!skipStripeCheck) {
        try {
          const account = await verifyStripeAccount(accountId);
          console.log('[STRIPE CONNECT] Account verified:', account.id);
        } catch (verifyError) {
          // Account doesn't exist or is invalid - delete it and create a new one
          if (verifyError.code === 'account_invalid' || verifyError.code === 'resource_missing') {
            console.log('[STRIPE CONNECT] Account invalid or missing, creating new account:', verifyError.message);
            
            // Delete the invalid account ID from database
            await prisma.user.update({
              where: { id: user.id },
              data: { stripeAccountId: null },
            });
            
            // Create a new account
            try {
              const newAccount = await createConnectedAccount(user.email);
              accountId = newAccount.id;
              console.log('[STRIPE CONNECT] Created new account:', accountId);
              
              // Save the new account ID
              await prisma.user.update({
                where: { id: user.id },
                data: { stripeAccountId: accountId },
              });
            } catch (createError) {
              console.error('[STRIPE CONNECT] Error creating replacement account:', createError);
              return res.status(500).json({ 
                error: 'Failed to create Stripe account',
                message: createError.message,
                type: createError.type,
                code: createError.code
              });
            }
          } else {
            // Some other error - return it
            throw verifyError;
          }
        }
      }
    }

    // Check if we should skip Stripe (only if explicitly set)
    // Even in test mode with sk_test_ key, we should create real Stripe onboarding links
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
      const accountLink = await createAccountLink(accountId, returnUrl, refreshUrl);
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
    console.error('[STRIPE CONNECT] Error creating account link:', error);
    console.error('[STRIPE CONNECT] Error stack:', error.stack);
    console.error('[STRIPE CONNECT] Error details:', {
      type: error.type,
      code: error.code,
      message: error.message,
      userId: req.user?.id
    });
    res.status(500).json({ 
      error: 'Failed to create Stripe account link',
      message: error.message || 'Unknown error',
      type: error.type,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Support both GET and POST for onboarding-link (frontend uses POST)
router.get('/onboarding-link', handleOnboardingLink);
router.post('/onboarding-link', handleOnboardingLink);

// GET /stripe-connect/status - Check the status of the connected Stripe account
// Note: authenticate is already applied via router.use(authenticate) above
router.get('/status', async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Please log in to check Stripe status'
      });
    }

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

    // Try to verify account exists in Stripe and check if onboarding is complete
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let isConnected = false;
    let accountDetails = null;

    if (!skipStripeCheck && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        accountDetails = await stripe.accounts.retrieve(user.stripeAccountId);
        
        // Account is considered "connected" if:
        // 1. Account exists in Stripe
        // 2. Details have been submitted (user completed onboarding)
        // OR charges are enabled (account is ready to receive payments)
        isConnected = accountDetails.details_submitted || accountDetails.charges_enabled;
        
        console.log('[STRIPE CONNECT] Status check:', {
          accountId: user.stripeAccountId,
          detailsSubmitted: accountDetails.details_submitted,
          chargesEnabled: accountDetails.charges_enabled,
          payoutsEnabled: accountDetails.payouts_enabled,
          isConnected
        });
      } catch (stripeError) {
        console.error('[STRIPE CONNECT] Error retrieving account:', stripeError);
        isConnected = false;
      }
    } else {
      // In skip mode, if account ID exists, consider it connected
      isConnected = !!user.stripeAccountId;
    }

    // Check if account just became connected (wasn't connected before, now is)
    // This happens when user returns from Stripe onboarding
    const wasConnectedBefore = user.requirements?.stripeConnected === true;
    const justConnected = !wasConnectedBefore && isConnected;
    
    // If account just became connected, send email and update user record
    if (justConnected) {
      console.log('[STRIPE CONNECT] Account just became connected, sending email notification');
      
      // Update user record to mark as connected
      await prisma.user.update({
        where: { id: user.id },
        data: {
          requirements: {
            ...(user.requirements || {}),
            stripeConnected: true,
            stripeConnectedAt: new Date().toISOString()
          }
        }
      });
      
      // Send email notification (non-blocking)
      try {
        const { sendStripeConnectedEmail } = require('../services/email');
        await sendStripeConnectedEmail(user.email, user.name || 'Hustler');
        console.log('[STRIPE CONNECT] Email notification sent');
      } catch (emailError) {
        console.error('[STRIPE CONNECT] Error sending email:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    // Get payoutsEnabled from account details
    const payoutsEnabled = accountDetails?.payouts_enabled || false;
    
    res.json({ 
      connected: isConnected,
      accountId: user.stripeAccountId,
      payoutsEnabled: payoutsEnabled, // Include directly for easier frontend access
      accountDetails: accountDetails ? {
        id: accountDetails.id,
        type: accountDetails.type,
        chargesEnabled: accountDetails.charges_enabled,
        payoutsEnabled: accountDetails.payouts_enabled,
        detailsSubmitted: accountDetails.details_submitted,
        email: accountDetails.email
      } : null,
      message: isConnected 
        ? 'Stripe account is connected and ready to receive payments'
        : 'Stripe account created but onboarding not completed. Complete onboarding to receive payments.',
      justConnected: justConnected // Frontend can use this to show a success message
    });
  } catch (error) {
    console.error('Error checking Stripe status:', error);
    res.status(500).json({ error: 'Failed to check Stripe status' });
  }
});

module.exports = router;

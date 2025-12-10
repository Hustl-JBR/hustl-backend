const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { capturePaymentIntent } = require('../services/stripe');
const { sendPaymentReceiptEmail } = require('../services/email');
const Stripe = require('stripe');

// Initialize Stripe with validation
let stripe;
let stripeKeyStatus = 'unknown';

if (process.env.STRIPE_SECRET_KEY) {
  // Trim and remove quotes that might have been added accidentally
  const key = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
  
  // Log key info (first 10 chars only for security)
  console.log('[STRIPE] Key detected. Length:', key.length, 'Starts with:', key.substring(0, 10));
  
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
    console.error('[STRIPE] WARNING: STRIPE_SECRET_KEY does not start with sk_test_ or sk_live_.');
    console.error('[STRIPE] Key preview (first 15 chars):', key.substring(0, 15));
    console.error('[STRIPE] This may cause authentication errors. Please check your Railway environment variables.');
    stripeKeyStatus = 'invalid_format';
  } else {
    stripeKeyStatus = key.startsWith('sk_test_') ? 'test' : 'live';
    console.log('[STRIPE] Key format looks valid. Mode:', stripeKeyStatus.toUpperCase());
  }
  
  try {
    stripe = new Stripe(key);
    console.log('[STRIPE] Stripe client initialized successfully');
  } catch (error) {
    console.error('[STRIPE] Error initializing Stripe:', error.message);
    stripeKeyStatus = 'initialization_failed';
    // Still create instance - will fail on API calls
    stripe = new Stripe(key);
  }
} else {
  console.error('[STRIPE] ERROR: STRIPE_SECRET_KEY is not set in environment variables');
  stripeKeyStatus = 'missing';
  // Create a dummy instance to prevent crashes, but it will fail on API calls
  stripe = new Stripe('sk_test_missing_key_please_set_in_environment');
}

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /payments/intent - Create payment intent (pre-auth)
router.post('/intent', requireRole('CUSTOMER'), async (req, res) => {
  try {
    // This is typically called during offer acceptance
    // See offers.js for implementation
    res.status(501).json({ error: 'Use /offers/:id/accept endpoint' });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payments/create-intent/offer/:offerId - Create payment intent for accepting an offer
router.post('/create-intent/offer/:offerId', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: {
          include: {
            customer: { select: { id: true, email: true, name: true } },
            hustler: {
              select: {
                id: true,
                stripeAccountId: true,
              },
            },
          },
        },
        hustler: {
          select: {
            id: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    // Calculate payment amounts
    const jobAmount = parseFloat(offer.job.amount || 0);
    const tipPercent = Math.min(parseFloat(offer.job.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    // Create payment intent
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let paymentIntent;

    if (skipStripeCheck) {
      // Test mode
      paymentIntent = {
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
        status: 'requires_payment_method',
      };
    } else {
      // Real Stripe payment intent - use manual capture to hold funds in escrow
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          jobId: offer.job.id,
          offerId: offer.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        capture_method: 'manual', // Hold funds in escrow until job completion
      });
    }

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: total,
    });
  } catch (error) {
    console.error('Create payment intent for offer error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      message: error.message || 'Failed to create payment intent'
    });
  }
});

// POST /jobs/:id/confirm - Capture payment (Customer confirms completion)
router.post('/jobs/:jobId/confirm', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: {
          select: { id: true, email: true, name: true, username: true },
        },
        hustler: {
          select: { id: true, email: true, name: true, username: true, stripeAccountId: true },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'COMPLETED_BY_HUSTLER' && job.status !== 'AWAITING_CUSTOMER_CONFIRM') {
      return res.status(400).json({ error: 'Job is not ready for confirmation' });
    }

    if (!job.payment) {
      return res.status(400).json({ error: 'Payment not found' });
    }

    if (job.payment.status !== 'PREAUTHORIZED') {
      return res.status(400).json({ error: 'Payment is not pre-authorized' });
    }

    // Capture payment - Skip in test mode
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let captured;
    if (skipStripeCheck) {
      console.log('[TEST MODE] Skipping Stripe payment capture');
      captured = { id: job.payment.providerId, status: 'succeeded' };
    } else {
      captured = await capturePaymentIntent(job.payment.providerId);
    }

    // Calculate hustler fee (12% platform fee)
    const hustlerFee = Number(job.payment.amount) * 0.12;

    // Update payment
    const payment = await prisma.payment.update({
      where: { id: job.payment.id },
      data: {
        status: 'CAPTURED',
        feeHustler: hustlerFee,
      },
    });

    // Update job status
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PAID' },
    });

    // Generate receipt URL (store in R2 or generate PDF)
    const receiptUrl = `${process.env.APP_BASE_URL}/payments/receipts/${payment.id}`;

    await prisma.payment.update({
      where: { id: payment.id },
      data: { receiptUrl },
    });

    // Send receipt email
    await sendPaymentReceiptEmail(
      job.customer.email,
      job.customer.name,
      payment,
      receiptUrl
    );

    // Check referral completion (non-blocking)
    if (job.hustlerId) {
      try {
        await fetch(`${process.env.APP_BASE_URL || 'http://localhost:8080'}/referrals/check-completion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.headers.authorization?.split(' ')[1] || ''}`,
          },
          body: JSON.stringify({ referredUserId: job.hustlerId }),
        });
      } catch (referralError) {
        console.error('Error checking referral completion (non-fatal):', referralError);
      }
    }

    res.json({
      job: updatedJob,
      payment: {
        ...payment,
        receiptUrl,
      },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments/jobs/:jobId - Get payment for a job
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is involved in the job
    if (job.customerId !== req.user.id && job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!job.payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(job.payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payments/checkout/offer/:offerId - Create Stripe checkout for offer acceptance
router.post('/checkout/offer/:offerId', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { offerId } = req.params;
    console.log(`[CHECKOUT] User ${req.user.id} (roles: ${req.user.roles?.join(', ')}) attempting checkout for offer ${offerId}`);
    
    // Get offer with job details
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: {
          include: {
            customer: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        hustler: {
          select: {
            id: true,
            name: true,
            email: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (!offer.job) {
      console.error(`[500] Offer ${offerId} has no associated job`);
      return res.status(500).json({ error: 'Offer has no associated job' });
    }

    if (offer.job.customerId !== req.user.id) {
      console.error(`[403] User ${req.user.id} tried to checkout offer ${offerId} for job owned by ${offer.job.customerId}`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only checkout offers for your own jobs'
      });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Offer is not pending',
        message: `Offer status is ${offer.status}, must be PENDING to checkout`
      });
    }

    if (!offer.hustler) {
      console.error(`[500] Offer ${offerId} has no associated hustler`);
      return res.status(500).json({ error: 'Offer has no associated hustler' });
    }

    // REQUIRE STRIPE ACCOUNT - Hustler must have Stripe connected
    // DISABLED FOR TESTING - Skip Stripe account requirement
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    // DISABLED FOR TESTING - Always skip Stripe check for now
    // if (!offer.hustler.stripeAccountId && !skipStripeCheck) {
    //   // Send email to hustler about needing Stripe
    //   try {
    //     const { sendStripeRequiredEmail } = require('../services/email');
    //     await sendStripeRequiredEmail(
    //       offer.hustler.email,
    //       offer.hustler.name,
    //       offer.job.title
    //     );
    //   } catch (emailError) {
    //     console.error('Error sending Stripe required email:', emailError);
    //   }
    //   
    //   return res.status(400).json({ 
    //     error: 'Hustler must connect Stripe account',
    //     requiresStripe: true,
    //     message: 'This hustler needs to connect their Stripe account before you can pay them. They have been notified via email.'
    //   });
    // }
    
    // In test mode, log that we're skipping the check
    console.log('[TEST MODE] Skipping Stripe account check for hustler:', offer.hustler.id);

    // Calculate payment amounts (3% customer fee)
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    const origin = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 
                   req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const base = origin.replace(/\/+$/, '');

    // Create Stripe checkout session - Skip in test mode
    // Always use Stripe checkout - works with test cards (4242 4242 4242 4242) if using test keys
    console.log('[PAYMENT] Creating Stripe checkout session for offer:', offerId);
    
    // Validate Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[PAYMENT] STRIPE_SECRET_KEY is not set in environment variables');
      return res.status(500).json({ 
        error: 'Payment system not configured',
        message: 'Stripe secret key is missing. Please contact support.'
      });
    }
    
    // Trim the key to remove any whitespace or quotes
    const secretKey = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
    
    // Check if key looks valid (starts with sk_test_ or sk_live_)
    // But be lenient - let Stripe API validate it if it's close
    if (!secretKey || secretKey.length < 10) {
      console.error('[PAYMENT] STRIPE_SECRET_KEY appears to be missing or too short');
      console.error('[PAYMENT] Key length:', secretKey.length);
      return res.status(500).json({ 
        error: 'Invalid Stripe configuration',
        message: 'Stripe secret key is missing or too short. Please set STRIPE_SECRET_KEY in Railway.',
        hint: 'Get your test key from https://dashboard.stripe.com/test/apikeys',
        diagnosticUrl: '/api/payments/check-key'
      });
    }
    
    if (!secretKey.startsWith('sk_')) {
      console.error('[PAYMENT] STRIPE_SECRET_KEY format appears invalid');
      console.error('[PAYMENT] Key preview (first 15 chars):', secretKey.substring(0, 15));
      console.error('[PAYMENT] Key length:', secretKey.length);
      console.error('[PAYMENT] Original key had quotes or spaces?', process.env.STRIPE_SECRET_KEY !== secretKey);
      console.error('[PAYMENT] Full original key (first 20 chars):', process.env.STRIPE_SECRET_KEY.substring(0, 20));
      
      // Still try to use it - let Stripe validate
      console.warn('[PAYMENT] Key format looks wrong but attempting to use it anyway. Stripe will validate.');
    }
    
    const isTestMode = secretKey.startsWith('sk_test_');
    console.log('[PAYMENT] Using Stripe key. Length:', secretKey.length, 'Type:', isTestMode ? 'TEST MODE' : (secretKey.startsWith('sk_live_') ? 'LIVE MODE' : 'UNKNOWN'));
    
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'link'], // Enable Apple Pay, Google Pay via card and Link
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Job: ${offer.job.title}`,
                description: `Payment for ${offer.hustler.name || 'Hustler'}`,
              },
              unit_amount: Math.round(total * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        customer_email: req.user.email,
        metadata: {
          offerId: offer.id,
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        success_url: `${base}/?payment=success&session_id={CHECKOUT_SESSION_ID}&offerId=${offerId}&jobId=${offer.job.id}`,
        cancel_url: `${base}/?payment=cancelled&offerId=${offerId}`,
        // Enable automatic tax calculation if needed
        // automatic_tax: { enabled: false },
      });

      console.log('[PAYMENT] Stripe checkout session created:', session.id);
      res.json({ url: session.url });
    } catch (stripeError) {
      console.error('[PAYMENT] Stripe API error:', stripeError);
      console.error('[PAYMENT] Error type:', stripeError.type);
      console.error('[PAYMENT] Error message:', stripeError.message);
      console.error('[PAYMENT] Error code:', stripeError.code);
      
      // Provide helpful error messages
      if (stripeError.type === 'StripeAuthenticationError' || stripeError.code === 'api_key_expired' || stripeError.code === 'invalid_api_key') {
        const secretKey = process.env.STRIPE_SECRET_KEY?.trim().replace(/^["']|["']$/g, '') || 'NOT SET';
        const keyPreview = secretKey !== 'NOT SET' ? secretKey.substring(0, 15) + '...' : 'NOT SET';
        
        return res.status(401).json({ 
          error: 'Stripe authentication failed',
          message: 'Invalid or expired Stripe API key.',
          details: 'The Stripe secret key may be incorrect, expired, or from the wrong environment (test vs live).',
          hint: `Please check your STRIPE_SECRET_KEY in Railway environment variables.\nCurrent key preview: ${keyPreview}\nKey length: ${secretKey.length}\nExpected: Starts with "sk_test_" (test) or "sk_live_" (live), length ~32-40 chars`,
          testMode: 'For testing, use test keys from https://dashboard.stripe.com/test/apikeys',
          diagnosticEndpoint: '/api/payments/check-key',
          commonIssues: [
            'Key wrapped in quotes: Remove quotes around the key value',
            'Extra spaces: Make sure no spaces before/after the key',
            'Wrong key type: Use Secret key (sk_test_...) not Publishable key (pk_test_...)',
            'Wrong environment: Test keys start with sk_test_, live keys start with sk_live_'
          ]
        });
      }
      
      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(400).json({ 
          error: 'Invalid payment request',
          message: stripeError.message || 'Invalid request to Stripe',
          details: stripeError.raw?.message
        });
      }
      
      // Generic Stripe error
      return res.status(500).json({ 
        error: 'Payment processing error',
        message: stripeError.message || 'Failed to create payment session',
        type: stripeError.type,
        code: stripeError.code
      });
    }
  } catch (error) {
    console.error('Create checkout session error:', error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'Internal server error';
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /payments/config - Get Stripe publishable key for Payment Element
router.get('/config', authenticate, async (req, res) => {
  try {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    
    res.json({ publishableKey });
  } catch (error) {
    console.error('Get Stripe config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments/check-key - Diagnostic endpoint to check Stripe key status (admin only)
router.get('/check-key', authenticate, async (req, res) => {
  try {
    // Only allow admins or in development
    if (process.env.NODE_ENV === 'production' && !req.user.roles?.includes('ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    const diagnostics = {
      secretKeyConfigured: !!secretKey,
      publishableKeyConfigured: !!publishableKey,
      secretKeyLength: secretKey ? secretKey.trim().replace(/^["']|["']$/g, '').length : 0,
      publishableKeyLength: publishableKey ? publishableKey.trim().replace(/^["']|["']$/g, '').length : 0,
      secretKeyPreview: secretKey ? secretKey.trim().replace(/^["']|["']$/g, '').substring(0, 10) + '...' : 'NOT SET',
      publishableKeyPreview: publishableKey ? publishableKey.trim().replace(/^["']|["']$/g, '').substring(0, 10) + '...' : 'NOT SET',
      secretKeyHasQuotes: secretKey ? (secretKey.trim().startsWith('"') || secretKey.trim().startsWith("'")) : false,
      publishableKeyHasQuotes: publishableKey ? (publishableKey.trim().startsWith('"') || publishableKey.trim().startsWith("'")) : false,
      secretKeyStartsWithCorrectPrefix: secretKey ? secretKey.trim().replace(/^["']|["']$/g, '').startsWith('sk_') : false,
      publishableKeyStartsWithCorrectPrefix: publishableKey ? publishableKey.trim().replace(/^["']|["']$/g, '').startsWith('pk_') : false,
    };
    
    res.json(diagnostics);
  } catch (error) {
    console.error('Check Stripe key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payments/create-intent/offer/:offerId - Create payment intent for offer acceptance
router.post('/create-intent/offer/:offerId', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { offerId } = req.params;
    
    // Get offer with job details
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: {
          include: {
            customer: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        hustler: {
          select: {
            id: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    // Calculate payment amounts
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    // Check active jobs limit
    const activeJobsCount = await prisma.job.count({
      where: {
        customerId: req.user.id,
        status: {
          in: ['ASSIGNED', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM'],
        },
      },
    });

    const maxActiveJobs = 2; // Can be made configurable
    if (activeJobsCount >= maxActiveJobs) {
      return res.status(400).json({
        error: 'Active jobs limit reached',
        message: `You can only have ${maxActiveJobs} active jobs at a time. Please complete or cancel existing jobs.`,
        currentActiveJobs: activeJobsCount,
        maxActiveJobs,
      });
    }

    // Create payment intent
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let paymentIntent;

    if (skipStripeCheck) {
      // Test mode - create fake payment intent
      paymentIntent = {
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
        status: 'requires_payment_method',
      };
    } else {
      // Real Stripe payment intent
      const transferData = offer.hustler.stripeAccountId
        ? {
            destination: offer.hustler.stripeAccountId,
            amount: Math.round(jobAmount * 100), // Amount in cents for hustler
          }
        : undefined;

      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100), // Total in cents
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          offerId: offer.id,
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        ...(transferData && { transfer_data: transferData }),
        capture_method: 'manual', // Pre-authorize, capture later
      });
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      message: error.message || 'Failed to create payment intent'
    });
  }
});

// POST /payments/create-intent/job/:jobId - Create payment intent for job completion
router.post('/create-intent/job/:jobId', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: {
          select: {
            id: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'COMPLETED_BY_HUSTLER' && job.status !== 'AWAITING_CUSTOMER_CONFIRM') {
      return res.status(400).json({ error: 'Job is not ready for payment' });
    }

    // If payment already exists and is pre-authorized, return existing client secret
    if (job.payment && job.payment.status === 'PREAUTHORIZED' && job.payment.providerId) {
      const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
      
      if (skipStripeCheck) {
        return res.json({ 
          clientSecret: `pi_test_${job.payment.providerId}_secret` 
        });
      }

      // Retrieve existing payment intent
      const existingIntent = await stripe.paymentIntents.retrieve(job.payment.providerId);
      return res.json({ clientSecret: existingIntent.client_secret });
    }

    // Calculate payment amounts
    const jobAmount = Number(job.amount);
    const tipAmount = Number(job.payment?.tip || 0);
    const customerFee = Number(job.payment?.feeCustomer || Math.min(Math.max(jobAmount * 0.03, 1), 10));
    const total = jobAmount + tipAmount + customerFee;

    // Create payment intent
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let paymentIntent;

    if (skipStripeCheck) {
      // Test mode
      paymentIntent = {
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
        status: 'requires_payment_method',
      };
    } else {
      // Real Stripe payment intent
      const transferData = job.hustler?.stripeAccountId
        ? {
            destination: job.hustler.stripeAccountId,
            amount: Math.round(jobAmount * 100),
          }
        : undefined;

      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          jobId: job.id,
          customerId: req.user.id,
          hustlerId: job.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        ...(transferData && { transfer_data: transferData }),
        capture_method: 'automatic', // Auto-capture for completion payments
      });
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      message: error.message || 'Failed to create payment intent'
    });
  }
});

// GET /payments/earnings - Get hustler earnings dashboard data
router.get('/earnings', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query; // 'day', 'week', 'month', 'year', 'all'

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Get all payments for this hustler
    const payments = await prisma.payment.findMany({
      where: {
        hustlerId: userId,
        status: 'CAPTURED',
        capturedAt: {
          gte: period !== 'all' ? startDate : undefined,
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            category: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        capturedAt: 'desc',
      },
    });

    // Get payouts
    const payouts = await prisma.payout.findMany({
      where: {
        hustlerId: userId,
        status: 'COMPLETED',
        completedAt: {
          gte: period !== 'all' ? startDate : undefined,
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Calculate totals
    const totalEarnings = payments.reduce((sum, p) => {
      return sum + Number(p.amount) + Number(p.tip || 0);
    }, 0);

    const totalPayouts = payouts.reduce((sum, p) => {
      return sum + Number(p.netAmount);
    }, 0);

    const totalFees = payments.reduce((sum, p) => {
      return sum + Number(p.platformFee || 0);
    }, 0);

    const totalTips = payments.reduce((sum, p) => {
      return sum + Number(p.tip || 0);
    }, 0);

    // Group by time period for chart data
    const chartData = [];
    const now = new Date();
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : payments.length;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      if (period === 'day') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      if (period === 'day') {
        nextDate.setHours(nextDate.getHours() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      const dayPayments = payments.filter(p => {
        const captureDate = p.capturedAt ? new Date(p.capturedAt) : null;
        if (!captureDate) return false;
        return captureDate >= date && captureDate < nextDate;
      });

      const dayEarnings = dayPayments.reduce((sum, p) => {
        return sum + Number(p.amount) + Number(p.tip || 0);
      }, 0);

      chartData.push({
        date: date.toISOString(),
        earnings: dayEarnings,
        jobs: dayPayments.length,
      });
    }

    // Calculate averages
    const avgPerJob = payments.length > 0 ? totalEarnings / payments.length : 0;
    const jobsCompleted = payments.length;

    res.json({
      period,
      totals: {
        earnings: totalEarnings,
        payouts: totalPayouts,
        fees: totalFees,
        tips: totalTips,
        jobsCompleted,
        avgPerJob,
      },
      chartData,
      recentPayments: payments.slice(0, 10).map(p => ({
        id: p.id,
        jobId: p.jobId,
        jobTitle: p.job.title,
        category: p.job.category,
        amount: Number(p.amount),
        tip: Number(p.tip || 0),
        fee: Number(p.platformFee || 0),
        total: Number(p.amount) + Number(p.tip || 0),
        date: p.capturedAt,
      })),
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments/receipts - List user's receipts
router.get('/receipts', async (req, res) => {
  try {
    const receipts = await prisma.payment.findMany({
      where: {
        OR: [
          { customerId: req.user.id },
          { hustlerId: req.user.id },
        ],
        status: 'CAPTURED',
        receiptUrl: { not: null },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        hustler: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(receipts);
  } catch (error) {
    console.error('List receipts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


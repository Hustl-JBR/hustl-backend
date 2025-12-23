/**
 * Tips Endpoint - Complete Rebuild
 * Tips go DIRECTLY to hustler's Stripe Connect account using transfer_data
 * This ensures 100% of tip goes to hustler (no platform fee)
 */

const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const Stripe = require('stripe');

// Initialize Stripe
let stripe;
let stripeKeyStatus = 'unknown';

if (process.env.STRIPE_SECRET_KEY) {
  const key = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
  
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
    console.error('[TIPS] WARNING: STRIPE_SECRET_KEY does not start with sk_test_ or sk_live_.');
    stripeKeyStatus = 'invalid_format';
  } else {
    stripeKeyStatus = key.startsWith('sk_test_') ? 'test' : 'live';
  }
  
  try {
    stripe = new Stripe(key);
    console.log('[TIPS] ✅ Stripe client initialized successfully');
  } catch (error) {
    console.error('[TIPS] ❌ Error initializing Stripe:', error.message);
    stripeKeyStatus = 'initialization_failed';
    stripe = new Stripe(key); // Still create instance - will fail on API calls
  }
} else {
  console.error('[TIPS] ❌ ERROR: STRIPE_SECRET_KEY is not set in environment variables');
  stripeKeyStatus = 'missing';
  stripe = new Stripe('sk_test_missing_key_please_set_in_environment');
}

const router = express.Router();
router.use(authenticate);

/**
 * POST /tips/create-intent/job/:jobId
 * Creates a PaymentIntent with transfer_data to send tip directly to hustler's connected account
 * Money goes DIRECTLY to hustler - never touches platform account
 */
router.post('/create-intent/job/:jobId', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tipAmount } = req.body;

    console.log(`[TIP INTENT] Creating payment intent for job ${jobId}, tip amount: $${tipAmount}`);

    // Validate tip amount
    if (!tipAmount || tipAmount <= 0) {
      return res.status(400).json({ error: 'Tip amount is required and must be greater than 0' });
    }

    const finalTipAmount = Math.min(parseFloat(tipAmount), 50); // Max $50

    // Get job with hustler's Stripe account info
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        customerId: true,
        hustlerId: true,
        status: true,
        completionCodeVerified: true,
        amount: true,
        payment: {
          select: {
            id: true,
            tip: true,
            status: true
          }
        },
        hustler: { 
          select: { 
            id: true,
            stripeAccountId: true 
          } 
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only tip for your own jobs' });
    }

    // Verify job is completed
    const isCompleted = job.status === 'PAID' || 
                       (job.status === 'COMPLETED_BY_HUSTLER' && job.completionCodeVerified === true);
    
    if (!isCompleted) {
      return res.status(400).json({ 
        error: 'Job must be completed before adding a tip',
        jobStatus: job.status,
        completionCodeVerified: job.completionCodeVerified
      });
    }

    // Check if tip already added
    if (job.payment?.tip && Number(job.payment.tip) > 0) {
      return res.status(400).json({ 
        error: 'Tip already added for this job',
        existingTip: job.payment.tip
      });
    }

    // CRITICAL: Verify hustler has connected Stripe account
    if (!job.hustler?.stripeAccountId) {
      return res.status(400).json({ 
        error: 'Hustler has not connected their Stripe account',
        message: 'The hustler must connect their payment account before receiving tips. Please contact support if this is an error.'
      });
    }

    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';

    // Validate Stripe is available
    if (!skipStripeCheck) {
      if (!stripe || stripeKeyStatus === 'missing' || stripeKeyStatus === 'initialization_failed') {
        console.error('[TIP INTENT] ❌ Stripe not properly initialized. Status:', stripeKeyStatus);
        return res.status(500).json({ 
          error: 'Payment system not configured',
          message: 'Stripe is not properly initialized. Please check server configuration.',
          stripeKeyStatus: stripeKeyStatus
        });
      }
    }

    // Create PaymentIntent with DIRECT CHARGE to hustler's connected account
    let tipPaymentIntent = null;

    if (!skipStripeCheck && stripe) {
      try {
        console.log(`[TIP INTENT] Creating payment intent for $${finalTipAmount.toFixed(2)} tip`);
        console.log(`[TIP INTENT] Destination account: ${job.hustler.stripeAccountId}`);

        // Create PaymentIntent with transfer_data - money goes DIRECTLY to hustler
        // This is a "direct charge" - customer pays directly to hustler's account
        // Platform never receives the money, so no platform fee is possible
        tipPaymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(finalTipAmount * 100), // Convert to cents
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            jobId: job.id,
            customerId: req.user.id,
            hustlerId: job.hustlerId,
            type: 'tip',
            tipAmount: finalTipAmount.toString(),
            description: `Tip for job: ${job.title || 'Completed Job'}`
          },
          // CRITICAL: transfer_data sends money DIRECTLY to hustler's connected account
          // This is a direct charge - money never touches platform account
          transfer_data: {
            destination: job.hustler.stripeAccountId,
          },
          // Automatic confirmation for Payment Elements
          confirmation_method: 'automatic',
          capture_method: 'automatic',
        });

        console.log(`[TIP INTENT] ✅ Created payment intent: ${tipPaymentIntent.id}`);
        console.log(`[TIP INTENT] Payment intent details:`, {
          id: tipPaymentIntent.id,
          amount: tipPaymentIntent.amount,
          currency: tipPaymentIntent.currency,
          status: tipPaymentIntent.status,
          transfer_data: tipPaymentIntent.transfer_data,
          destination: tipPaymentIntent.transfer_data?.destination
        });

        // Verify transfer_data was set correctly
        if (!tipPaymentIntent.transfer_data || tipPaymentIntent.transfer_data.destination !== job.hustler.stripeAccountId) {
          console.error('[TIP INTENT] ❌ WARNING: transfer_data not set correctly!');
          console.error('[TIP INTENT] Expected destination:', job.hustler.stripeAccountId);
          console.error('[TIP INTENT] Actual transfer_data:', tipPaymentIntent.transfer_data);
        }

      } catch (stripeError) {
        console.error('[TIP INTENT] ❌ Stripe API error:', stripeError);
        console.error('[TIP INTENT] Error details:', {
          type: stripeError.type,
          code: stripeError.code,
          message: stripeError.message,
          param: stripeError.param,
          hustlerStripeAccountId: job.hustler?.stripeAccountId
        });
        
        // Provide helpful error messages
        let errorMessage = 'Failed to create tip payment intent';
        if (stripeError.type === 'StripeAuthenticationError') {
          errorMessage = 'Stripe authentication failed. Please check server configuration.';
        } else if (stripeError.code === 'account_invalid' || stripeError.message?.includes('account')) {
          errorMessage = 'Hustler\'s Stripe account is not valid. They may need to complete onboarding.';
        } else if (stripeError.message) {
          errorMessage = stripeError.message;
        }
        
        return res.status(500).json({ 
          error: errorMessage,
          message: stripeError.message || 'Stripe API error',
          code: stripeError.code,
          type: stripeError.type
        });
      }
    } else {
      // Test mode
      console.log('[TIP INTENT] ⚠️ Test mode - returning fake payment intent');
      return res.json({
        clientSecret: `pi_test_tip_${Date.now()}_secret_test`,
        paymentIntentId: `pi_test_tip_${Date.now()}`,
        isTestMode: true,
        tipAmount: finalTipAmount
      });
    }

    res.json({
      clientSecret: tipPaymentIntent.client_secret,
      paymentIntentId: tipPaymentIntent.id,
      tipAmount: finalTipAmount,
      hustlerStripeAccountId: job.hustler.stripeAccountId,
      transferDestination: tipPaymentIntent.transfer_data?.destination
    });

  } catch (error) {
    console.error('[TIP INTENT] ❌ Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /tips/job/:jobId
 * Confirms tip payment and updates database
 * Payment has already been processed by Stripe Elements
 * Money has already been transferred to hustler via transfer_data
 */
router.post('/job/:jobId', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { paymentIntentId } = req.body;

    console.log(`[TIP CONFIRM] Confirming tip for job ${jobId}, payment intent: ${paymentIntentId}`);

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    // Get job with all necessary data
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: { select: { id: true, email: true, name: true, stripeAccountId: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if tip already added
    if (job.payment?.tip && Number(job.payment.tip) > 0) {
      return res.status(400).json({ 
        error: 'Tip already added for this job',
        existingTip: job.payment.tip
      });
    }

    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let tipPaymentIntent = null;
    let finalTipAmount = 0;

    // Verify payment intent with Stripe
    if (!skipStripeCheck && stripe) {
      try {
        tipPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        finalTipAmount = tipPaymentIntent.amount / 100; // Convert from cents
        
        console.log(`[TIP CONFIRM] Retrieved payment intent:`, {
          id: tipPaymentIntent.id,
          status: tipPaymentIntent.status,
          amount: finalTipAmount,
          transfer_data: tipPaymentIntent.transfer_data,
          destination: tipPaymentIntent.transfer_data?.destination,
          metadata: tipPaymentIntent.metadata
        });
        
        // Verify payment intent belongs to this job
        if (tipPaymentIntent.metadata.jobId !== jobId) {
          console.error(`[TIP CONFIRM] ❌ Payment intent jobId mismatch`);
          return res.status(400).json({ error: 'Payment intent does not match job' });
        }

        // Verify payment succeeded
        // With automatic confirmation, status should be 'succeeded' or 'processing'
        const validStatuses = ['succeeded', 'processing'];
        if (!validStatuses.includes(tipPaymentIntent.status)) {
          console.error(`[TIP CONFIRM] ❌ Invalid payment status: ${tipPaymentIntent.status}`);
          return res.status(400).json({ 
            error: 'Payment not completed',
            status: tipPaymentIntent.status,
            message: `Payment is in ${tipPaymentIntent.status} state. Expected: succeeded or processing.`
          });
        }

        // Verify transfer_data is set correctly (money going to hustler)
        if (tipPaymentIntent.transfer_data?.destination !== job.hustler.stripeAccountId) {
          console.error(`[TIP CONFIRM] ❌ Transfer destination mismatch!`);
          console.error(`[TIP CONFIRM] Expected: ${job.hustler.stripeAccountId}`);
          console.error(`[TIP CONFIRM] Actual: ${tipPaymentIntent.transfer_data?.destination}`);
          return res.status(500).json({
            error: 'Payment destination mismatch',
            message: 'Payment intent destination does not match hustler account'
          });
        }

        console.log(`[TIP CONFIRM] ✅ Payment verified: $${finalTipAmount.toFixed(2)} going to ${tipPaymentIntent.transfer_data.destination}`);
      } catch (stripeError) {
        console.error('[TIP CONFIRM] ❌ Error retrieving payment intent:', stripeError);
        return res.status(500).json({ 
          error: 'Failed to verify tip payment',
          message: stripeError.message || 'Stripe API error'
        });
      }
    } else {
      // Test mode
      finalTipAmount = 5.00;
      tipPaymentIntent = { id: paymentIntentId, status: 'succeeded' };
    }

    // IMPORTANT: With transfer_data, Stripe automatically transfers money to hustler
    // No manual transfer needed - it happens automatically when payment succeeds
    console.log(`[TIP CONFIRM] Money automatically transferred to hustler via transfer_data`);

    // Update payment record with tip
    const jobAmount = Number(job.payment?.amount || job.amount || 0);
    
    try {
      if (job.payment?.id) {
        // Update existing payment record
        const currentTotal = Number(job.payment.total) || jobAmount;
        const newTotal = currentTotal + finalTipAmount;
        
        await prisma.payment.update({
          where: { id: job.payment.id },
          data: {
            tip: finalTipAmount.toString(),
            total: newTotal.toString(),
            tipPaymentIntentId: paymentIntentId,
            tipAddedAt: new Date()
          }
        });
        console.log(`[TIP CONFIRM] ✅ Updated payment record with tip $${finalTipAmount.toFixed(2)}`);
      } else {
        // Create payment record if it doesn't exist (shouldn't happen but handle gracefully)
        console.warn(`[TIP CONFIRM] ⚠️ Payment record not found, creating new one`);
        
        await prisma.payment.create({
          data: {
            jobId: job.id,
            customerId: job.customerId,
            hustlerId: job.hustlerId,
            amount: jobAmount.toString(),
            tip: finalTipAmount.toString(),
            feeCustomer: '0',
            feeHustler: '0',
            total: (jobAmount + finalTipAmount).toString(),
            status: 'CAPTURED',
            tipPaymentIntentId: paymentIntentId,
            tipAddedAt: new Date()
          }
        });
        console.log(`[TIP CONFIRM] ✅ Created payment record with tip $${finalTipAmount.toFixed(2)}`);
      }
    } catch (dbError) {
      console.error('[TIP CONFIRM] ❌ Database error:', dbError);
      return res.status(500).json({
        error: 'Failed to save tip to database',
        message: dbError.message || 'Database error'
      });
    }

    // Send notifications (non-blocking)
    if (job.hustler?.email) {
      try {
        const { sendTipReceivedEmail } = require('../services/email');
        sendTipReceivedEmail(
          job.hustler.email,
          job.hustler.name || 'Hustler',
          job.title || 'Completed Job',
          finalTipAmount,
          job.customer?.name || 'Customer'
        ).catch(err => console.error('[TIP CONFIRM] Email error:', err));
      } catch (emailError) {
        console.error('[TIP CONFIRM] Email service error:', emailError);
      }
    }
    
    // Create in-app notification
    if (job.hustler?.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: job.hustler.id,
            type: 'TIP_RECEIVED',
            message: `You received a $${finalTipAmount.toFixed(2)} tip from ${job.customer?.name || 'a customer'} for "${job.title || 'your job'}"!`,
            link: `/jobs/${jobId}`,
            read: false,
          },
        });
        console.log(`[TIP CONFIRM] ✅ Created in-app notification`);
      } catch (notifError) {
        console.error('[TIP CONFIRM] Notification error:', notifError);
      }
    }

    res.json({
      success: true,
      tipAmount: finalTipAmount,
      message: `Tip of $${finalTipAmount.toFixed(2)} sent successfully to hustler`,
      paymentIntentId: paymentIntentId,
      transferDestination: tipPaymentIntent?.transfer_data?.destination
    });

  } catch (error) {
    console.error('[TIP CONFIRM] ❌ Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;

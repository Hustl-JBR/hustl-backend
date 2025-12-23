/**
 * Tips Endpoint
 * Tips are added AFTER job completion as a separate charge
 */

const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const Stripe = require('stripe');

const router = express.Router();
router.use(authenticate);

// POST /tips/create-checkout/job/:jobId - Create Stripe Checkout Session for tip (redirects to Stripe)
router.post('/create-checkout/job/:jobId', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tipAmount } = req.body;

    if (!tipAmount || tipAmount <= 0) {
      return res.status(400).json({ error: 'Tip amount is required and must be greater than 0' });
    }

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
            amount: true,
            tip: true,
            status: true,
            providerId: true
          }
        },
        customer: { select: { id: true, email: true, name: true } },
        hustler: { 
          select: { 
            id: true, 
            email: true, 
            name: true, 
            stripeAccountId: true 
          } 
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Job must be completed
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
    if (job.payment?.tip && job.payment.tip > 0) {
      return res.status(400).json({ 
        error: 'Tip already added for this job',
        existingTip: job.payment.tip
      });
    }

    // Calculate tip amount (max $50)
    const finalTipAmount = Math.min(parseFloat(tipAmount), 50);
    const jobAmount = Number(job.payment?.amount || job.amount || 0);
    const maxTip = Math.min(jobAmount * 0.25, 50);
    
    if (finalTipAmount > maxTip) {
      return res.status(400).json({ 
        error: `Maximum tip is $${maxTip.toFixed(2)}`,
        maxTip: maxTip
      });
    }

    if (!job.hustler?.stripeAccountId) {
      return res.status(400).json({ error: 'Hustler has not set up payment account' });
    }

    // Create Stripe Checkout Session
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    // Initialize stripe if not already done
    if (!stripe && process.env.STRIPE_SECRET_KEY) {
      const key = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
      stripe = new Stripe(key);
    }
    
    if (skipStripeCheck || !stripe) {
      return res.json({
        checkoutUrl: `${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000'}/?tip_success=true&jobId=${jobId}&test=true`,
        isTestMode: true,
        tipAmount: finalTipAmount
      });
    }

    const origin = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const base = origin.replace(/\/+$/, '');

    try {
      // Create checkout session with direct charge to hustler's Connect account
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Tip for job: ${job.title}`,
                description: `Thank you tip for completed job`
              },
              unit_amount: Math.round(finalTipAmount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        customer_email: job.customer.email,
        metadata: {
          jobId: job.id,
          customerId: req.user.id,
          hustlerId: job.hustlerId,
          type: 'tip',
          tipAmount: finalTipAmount.toString()
        },
        // Transfer 100% to hustler (no platform fee on tips)
        payment_intent_data: {
          application_fee_amount: 0, // No platform fee
          transfer_data: {
            destination: job.hustler.stripeAccountId,
          },
          metadata: {
            jobId: job.id,
            customerId: req.user.id,
            hustlerId: job.hustlerId,
            type: 'tip',
            jobAmount: jobAmount.toString(),
            tipAmount: finalTipAmount.toString(),
            description: `Tip for job: ${job.title}`
          }
        },
        success_url: `${base}/?tip_success=true&jobId=${jobId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/?tip_cancelled=true&jobId=${jobId}`,
      });

      console.log(`[TIP CHECKOUT] Created checkout session: ${session.id} for $${finalTipAmount.toFixed(2)} tip to hustler ${job.hustler.stripeAccountId}`);

      res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
        tipAmount: finalTipAmount
      });
    } catch (stripeError) {
      console.error('[TIP CHECKOUT] Error creating checkout session:', stripeError);
      return res.status(500).json({ 
        error: 'Failed to create tip checkout session',
        message: stripeError.message
      });
    }
  } catch (error) {
    console.error('Create tip checkout error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /tips/create-intent/job/:jobId - Create payment intent for tip (without confirming)
router.post('/create-intent/job/:jobId', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tipAmount, tipPercent } = req.body;

    if (!tipAmount && !tipPercent) {
      return res.status(400).json({ error: 'Tip amount or tip percent required' });
    }

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
            amount: true,
            tip: true,
            status: true,
            providerId: true
          }
        },
        customer: { select: { id: true, email: true, name: true } },
        hustler: { 
          select: { 
            id: true, 
            email: true, 
            name: true, 
            stripeAccountId: true 
          } 
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Job must be completed (PAID or COMPLETED_BY_HUSTLER with completion code verified)
    // For completed jobs, we allow tips even if payment processing is delayed
    const isCompleted = job.status === 'PAID' || 
                       (job.status === 'COMPLETED_BY_HUSTLER' && job.completionCodeVerified === true);
    
    if (!isCompleted) {
      return res.status(400).json({ 
        error: 'Job must be completed before adding a tip',
        jobStatus: job.status,
        completionCodeVerified: job.completionCodeVerified,
        paymentStatus: job.payment?.status,
        hint: 'Job must have status PAID or COMPLETED_BY_HUSTLER with completionCodeVerified=true',
        jobId: job.id
      });
    }

    // Check if tip already added
    if (job.payment?.tip && job.payment.tip > 0) {
      return res.status(400).json({ 
        error: 'Tip already added for this job',
        existingTip: job.payment.tip
      });
    }

    // Calculate tip amount
    let finalTipAmount = 0;
    const jobAmount = Number(job.payment?.amount || job.amount || 0);

    if (tipPercent) {
      // Calculate from percentage (max 25%, max $50)
      const percent = Math.min(parseFloat(tipPercent), 25);
      finalTipAmount = Math.min(jobAmount * (percent / 100), 50);
    } else if (tipAmount) {
      // Use provided amount (max $50)
      finalTipAmount = Math.min(parseFloat(tipAmount), 50);
    }

    if (finalTipAmount <= 0) {
      return res.status(400).json({ error: 'Tip amount must be greater than 0' });
    }

    // Check if hustler has Stripe account connected
    if (!job.hustler?.stripeAccountId) {
      return res.status(400).json({ 
        error: 'Hustler has not connected their Stripe account',
        message: 'The hustler must connect their payment account before receiving tips'
      });
    }

    // Create payment intent for tip (without confirming - for Stripe Elements)
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let tipPaymentIntent = null;

    if (!skipStripeCheck && stripe) {
      try {
        // Get customer's payment method from original payment (optional - we'll use Elements to collect new payment)
        const originalPaymentIntent = job.payment?.providerId 
          ? await stripe.paymentIntents.retrieve(job.payment.providerId).catch(() => null)
          : null;

        tipPaymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(finalTipAmount * 100), // Convert to cents
          currency: 'usd',
          customer: originalPaymentIntent?.customer, // Optional - can create new customer
          metadata: {
            jobId: job.id,
            customerId: req.user.id,
            hustlerId: job.hustlerId,
            type: 'tip',
            jobAmount: jobAmount.toString(),
            tipAmount: finalTipAmount.toString(),
            description: `Tip for job: ${job.title}`
          },
          // Transfer 100% to hustler (no platform fee on tips)
          application_fee_amount: 0, // No platform fee
          transfer_data: {
            destination: job.hustler.stripeAccountId,
          },
          // Don't confirm - let Stripe Elements handle confirmation
          confirmation_method: 'manual',
          capture_method: 'automatic',
        });

        console.log(`[TIP INTENT] Created tip payment intent: ${tipPaymentIntent.id} for $${finalTipAmount.toFixed(2)}`);
      } catch (stripeError) {
        console.error('[TIP INTENT] Error creating tip payment intent:', stripeError);
        console.error('[TIP INTENT] Stripe error details:', {
          type: stripeError.type,
          code: stripeError.code,
          message: stripeError.message,
          hustlerStripeAccountId: job.hustler?.stripeAccountId
        });
        return res.status(500).json({ 
          error: 'Failed to create tip payment intent',
          message: stripeError.message || 'Stripe API error',
          details: process.env.NODE_ENV === 'development' ? stripeError.message : undefined
        });
      }
    } else {
      // Test mode - return fake client secret
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
      hustlerStripeAccountId: job.hustler?.stripeAccountId
    });

  } catch (error) {
    console.error('Create tip intent error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Initialize Stripe
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  const key = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
  stripe = new Stripe(key);
} else {
  stripe = new Stripe('sk_test_missing_key');
}

// POST /tips/job/:jobId - Confirm tip payment and transfer to hustler
router.post('/job/:jobId', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true } },
        hustler: { select: { id: true, email: true, stripeAccountId: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if tip already added
    if (job.payment?.tip && job.payment.tip > 0) {
      return res.status(400).json({ 
        error: 'Tip already added for this job',
        existingTip: job.payment.tip
      });
    }

    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let tipPaymentIntent = null;
    let finalTipAmount = 0;

    // Retrieve payment intent to get amount and status
    if (!skipStripeCheck && stripe) {
      try {
        tipPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        finalTipAmount = tipPaymentIntent.amount / 100; // Convert from cents
        
        // Verify payment intent belongs to this job
        if (tipPaymentIntent.metadata.jobId !== jobId) {
          return res.status(400).json({ error: 'Payment intent does not match job' });
        }
        
        // Verify payment succeeded
        if (tipPaymentIntent.status !== 'succeeded') {
          return res.status(400).json({ 
            error: 'Payment not completed',
            status: tipPaymentIntent.status
          });
        }
        
        console.log(`[TIP] Payment intent confirmed: ${paymentIntentId} for $${finalTipAmount.toFixed(2)}`);
      } catch (stripeError) {
        console.error('[TIP] Error retrieving payment intent:', stripeError);
        return res.status(500).json({ 
          error: 'Failed to verify tip payment',
          message: stripeError.message
        });
      }
    } else {
      // Test mode
      finalTipAmount = 5.00; // Default test amount
      tipPaymentIntent = { id: paymentIntentId, status: 'succeeded' };
    }

    // Transfer tip to hustler (100% goes to hustler, no platform fee on tips)
    if (job.hustler?.stripeAccountId && !skipStripeCheck && stripe) {
      try {
        await stripe.transfers.create({
          amount: Math.round(finalTipAmount * 100),
          currency: 'usd',
          destination: job.hustler.stripeAccountId,
          metadata: {
            jobId: job.id,
            type: 'tip',
            description: `Tip for job: ${job.title}`
          },
        });
        console.log(`[TIP] Transferred $${finalTipAmount.toFixed(2)} tip to hustler ${job.hustler.stripeAccountId}`);
      } catch (transferError) {
        console.error('[TIP] Error transferring tip to hustler:', transferError);
        // Don't fail the request - tip was charged, we can retry transfer
      }
    }

    // Update payment record with tip
    const jobAmount = Number(job.payment?.amount || job.amount || 0);
    await prisma.payment.update({
      where: { id: job.payment.id },
      data: {
        tip: finalTipAmount,
        total: (Number(job.payment.total) || jobAmount) + finalTipAmount,
        tipPaymentIntentId: paymentIntentId,
        tipAddedAt: new Date()
      }
    });

    // Send notification email to hustler (non-blocking)
    const { sendTipNotificationEmail } = require('../services/email');
    if (job.hustler?.email) {
      sendTipNotificationEmail(
        job.hustler.email,
        job.hustler.name || 'Hustler',
        job.title,
        finalTipAmount
      ).catch(err => console.error('[TIP] Error sending tip notification:', err));
    }

    res.json({
      success: true,
      tipAmount: finalTipAmount,
      message: `Tip of $${finalTipAmount.toFixed(2)} added successfully`,
      tipPaymentIntentId: tipPaymentIntentId
    });

  } catch (error) {
    console.error('Add tip error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;



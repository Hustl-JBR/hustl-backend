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
      include: {
        payment: true,
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

    // Job must be completed and paid
    if (job.status !== 'PAID' && job.payment?.status !== 'CAPTURED') {
      return res.status(400).json({ 
        error: 'Job must be completed and paid before adding a tip',
        jobStatus: job.status,
        paymentStatus: job.payment?.status
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
          // Don't confirm - let Stripe Elements handle confirmation
          confirmation_method: 'manual',
          capture_method: 'automatic',
        });

        console.log(`[TIP INTENT] Created tip payment intent: ${tipPaymentIntent.id} for $${finalTipAmount.toFixed(2)}`);
      } catch (stripeError) {
        console.error('[TIP INTENT] Error creating tip payment intent:', stripeError);
        return res.status(500).json({ 
          error: 'Failed to create tip payment intent',
          message: stripeError.message
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



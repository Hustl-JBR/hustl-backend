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

// Initialize Stripe
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  const key = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
  stripe = new Stripe(key);
} else {
  stripe = new Stripe('sk_test_missing_key');
}

// POST /tips/job/:jobId - Add tip after job completion
router.post('/job/:jobId', requireRole('CUSTOMER'), async (req, res) => {
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

    // Create payment intent for tip (separate charge)
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let tipPaymentIntentId = null;

    if (!skipStripeCheck && stripe) {
      try {
        // Get customer's payment method from original payment
        const originalPaymentIntent = job.payment?.providerId 
          ? await stripe.paymentIntents.retrieve(job.payment.providerId)
          : null;

        const tipPaymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(finalTipAmount * 100), // Convert to cents
          currency: 'usd',
          customer: originalPaymentIntent?.customer,
          payment_method: originalPaymentIntent?.payment_method,
          confirm: true, // Charge immediately
          capture_method: 'automatic',
          metadata: {
            jobId: job.id,
            customerId: req.user.id,
            hustlerId: job.hustlerId,
            type: 'tip',
            jobAmount: jobAmount.toString(),
            tipAmount: finalTipAmount.toString(),
            description: `Tip for job: ${job.title}`
          },
        });

        tipPaymentIntentId = tipPaymentIntent.id;
        console.log(`[TIP] Created and charged tip payment: ${tipPaymentIntentId} for $${finalTipAmount.toFixed(2)}`);
      } catch (stripeError) {
        console.error('[TIP] Error charging tip:', stripeError);
        return res.status(500).json({ 
          error: 'Failed to process tip payment',
          message: stripeError.message
        });
      }
    } else {
      // Test mode
      tipPaymentIntentId = `pi_test_tip_${Date.now()}`;
      console.log(`[TIP] Test mode - fake tip payment: ${tipPaymentIntentId} for $${finalTipAmount.toFixed(2)}`);
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
    await prisma.payment.update({
      where: { id: job.payment.id },
      data: {
        tip: finalTipAmount,
        total: (Number(job.payment.total) || jobAmount) + finalTipAmount,
        tipPaymentIntentId: tipPaymentIntentId,
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


const express = require('express');
const Stripe = require('stripe');
const prisma = require('../db');

const router = express.Router();

// Initialize Stripe with validation
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  const key = process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, '');
  stripe = new Stripe(key);
  console.log('[WEBHOOKS] Stripe initialized successfully');
} else {
  console.error('[WEBHOOKS] ERROR: STRIPE_SECRET_KEY is not set');
  // Create dummy instance - will fail on API calls but won't crash
  stripe = new Stripe('sk_test_missing_key_please_set_in_environment');
}

// POST /webhooks/stripe - Stripe webhook handler
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;
      case 'transfer.paid':
        await handleTransferPaid(event.data.object);
        break;
      case 'transfer.failed':
        await handleTransferFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutSessionCompleted(session) {
  // Check if this is a tip payment
  if (session.metadata?.type === 'tip') {
    return await handleTipCheckoutCompleted(session);
  }

  // Handle Stripe checkout completion - accept offer if offerId is in metadata
  const offerId = session.metadata?.offerId;
  if (!offerId) return;

  try {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: true,
        hustler: { select: { id: true, email: true, name: true, stripeAccountId: true } },
      },
    });

    if (!offer || offer.status !== 'PENDING') {
      console.log('Offer not found or already processed:', offerId);
      return;
    }

    // Accept the offer (same logic as /offers/:id/accept)
    const jobAmount = Number(offer.job.amount);
    const tipAmount = Number(session.metadata?.tip || 0);
    const customerFee = Number(session.metadata?.customerFee || 0);
    const total = jobAmount + tipAmount + customerFee;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        jobId: offer.job.id,
        customerId: offer.job.customerId,
        hustlerId: offer.hustlerId,
        amount: jobAmount,
        tip: tipAmount,
        feeCustomer: customerFee,
        feeHustler: 0, // Will be calculated on capture (12% of jobAmount)
        total,
        status: 'CAPTURED', // Already paid via checkout
        providerId: session.payment_intent,
      },
    });

    // Update offer status
    await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED' },
    });

    // Decline other offers
    await prisma.offer.updateMany({
      where: {
        jobId: offer.job.id,
        id: { not: offerId },
        status: 'PENDING',
      },
      data: { status: 'DECLINED' },
    });

    // Generate verification codes (Uber-style safety)
    const generateCode = () => String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
    const startCode = generateCode();
    const completionCode = generateCode();
    const startCodeExpiresAt = new Date(Date.now() + 78 * 60 * 60 * 1000); // 78 hours from now
    
    // Update job with hustler and verification codes
    // Set status to SCHEDULED (not ASSIGNED) - job is scheduled but not started yet
    await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'SCHEDULED', // Scheduled, not active yet - waiting for Start Code
        hustlerId: offer.hustlerId,
        startCode: startCode,
        startCodeExpiresAt: startCodeExpiresAt,
        completionCode: completionCode,
        completionCodeVerified: false,
      },
    });

    // Create thread for messaging (use upsert to avoid duplicate errors)
    try {
      await prisma.thread.upsert({
        where: { jobId: offer.job.id },
        update: {}, // If exists, don't update
        create: {
          jobId: offer.job.id,
          userAId: offer.job.customerId,
          userBId: offer.hustlerId,
        },
      });
      console.log(`[THREAD] Created thread for job ${offer.job.id} via webhook`);
    } catch (error) {
      console.error(`[THREAD] Error creating thread for job ${offer.job.id}:`, error);
      // Don't fail webhook if thread creation fails
    }

    console.log('Offer accepted via Stripe checkout:', offerId);
  } catch (error) {
    console.error('Error handling checkout session completion:', error);
  }
}

async function handleTipCheckoutCompleted(session) {
  const jobId = session.metadata?.jobId;
  if (!jobId) {
    console.log('[TIP CHECKOUT] No jobId in session metadata');
    return;
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
      },
    });

    if (!job) {
      console.error('[TIP CHECKOUT] Job not found:', jobId);
      return;
    }

    // Check if tip already added
    if (job.payment?.tip && job.payment.tip > 0) {
      console.log('[TIP CHECKOUT] Tip already added for job:', jobId);
      return;
    }

    const tipAmount = Number(session.metadata?.tipAmount || session.amount_total / 100 || 0);

    // Get job with customer and hustler info for notification
    const jobWithUsers = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: {
          select: { id: true, name: true, email: true }
        },
        hustler: {
          select: { id: true, name: true, email: true }
        },
        payment: true
      }
    });

    // Update payment record with tip (or create if doesn't exist)
    // Note: Tips via checkout session with transfer_data already transfer to hustler automatically
    // No need to create a separate transfer
    let updatedPayment;
    if (job.payment) {
      updatedPayment = await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          tip: tipAmount,
          total: {
            increment: tipAmount // Add tip to total
          },
          tipPaymentIntentId: session.payment_intent, // Store tip payment intent ID
          tipAddedAt: new Date(), // Record when tip was added
          // Don't overwrite original providerId - keep job payment intent separate from tip payment intent
        },
      });
    } else {
      // Create payment record if it doesn't exist
      updatedPayment = await prisma.payment.create({
        data: {
          jobId: job.id,
          customerId: job.customerId,
          hustlerId: job.hustlerId,
          amount: Number(job.amount || 0),
          tip: tipAmount,
          total: Number(job.amount || 0) + tipAmount,
          status: 'CAPTURED',
          providerId: session.payment_intent, // For tip-only payments, use tip payment intent
          tipPaymentIntentId: session.payment_intent,
          tipAddedAt: new Date(),
        },
      });
    }

    // Send email notification to hustler
    if (jobWithUsers?.hustler) {
      try {
        const { sendTipReceivedEmail } = require('../services/email');
        await sendTipReceivedEmail(
          jobWithUsers.hustler.email,
          jobWithUsers.hustler.name,
          jobWithUsers.title,
          tipAmount,
          jobWithUsers.customer?.name || 'Customer'
        );
      } catch (emailError) {
        console.error('[TIP CHECKOUT] Error sending tip notification email:', emailError);
      }
    }

    // Create in-app notification for hustler
    if (jobWithUsers?.hustler?.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: jobWithUsers.hustler.id,
            type: 'TIP_RECEIVED',
            message: `You received a $${tipAmount.toFixed(2)} tip from ${jobWithUsers.customer?.name || 'a customer'} for "${jobWithUsers.title}"!`,
            link: `/jobs/${jobId}`,
            read: false,
          },
        });
        console.log(`[TIP CHECKOUT] Created in-app notification for hustler ${jobWithUsers.hustler.id}`);
      } catch (notifError) {
        console.error('[TIP CHECKOUT] Error creating in-app notification:', notifError);
      }
    }

    console.log(`[TIP CHECKOUT] Tip of $${tipAmount.toFixed(2)} added to job ${jobId} via checkout session ${session.id}`);
  } catch (error) {
    console.error('[TIP CHECKOUT] Error handling tip checkout completion:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const jobId = paymentIntent.metadata?.jobId;
  
  console.log(`[WEBHOOK] payment_intent.succeeded: ${paymentIntent.id}`, {
    jobId,
    amount: paymentIntent.amount / 100,
    status: paymentIntent.status,
    captured: paymentIntent.captured
  });
  
  if (!jobId) {
    console.log('[WEBHOOK] No jobId in payment intent metadata, skipping');
    return;
  }

  const payment = await prisma.payment.findFirst({
    where: { providerId: paymentIntent.id },
    include: { job: true },
  });

  if (!payment) {
    console.log(`[WEBHOOK] No payment found for providerId: ${paymentIntent.id}`);
    return;
  }

  // Idempotency: Only update if status is PREAUTHORIZED
  // If already CAPTURED or REFUNDED, webhook is duplicate (safe to ignore)
  if (payment.status === 'PREAUTHORIZED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { 
        status: 'CAPTURED',
        capturedAt: new Date(), // Record when payment was captured
      },
    });
    console.log(`[WEBHOOK] ✅ Payment ${payment.id} status synced: PREAUTHORIZED → CAPTURED`);
  } else {
    console.log(`[WEBHOOK] Payment ${payment.id} already in status: ${payment.status}, skipping update (idempotent)`);
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: { providerId: paymentIntent.id },
  });

  if (payment) {
    // Log failure, notify user
    console.error('Payment failed:', paymentIntent.id);
  }
}

async function handlePaymentIntentCanceled(paymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: { providerId: paymentIntent.id },
  });

  if (payment && payment.status === 'PREAUTHORIZED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'VOIDED' },
    });
  }
}

// Handle refund webhook
async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  const payment = await prisma.payment.findFirst({
    where: { providerId: paymentIntentId },
    include: {
      job: true,
      customer: { select: { id: true, email: true, name: true } },
      hustler: { select: { id: true, email: true, name: true, stripeAccountId: true } },
    },
  });

  if (payment && payment.status !== 'REFUNDED') {
    const refundAmount = charge.amount_refunded / 100; // Convert from cents

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        refundAmount,
        refundReason: 'Refunded via Stripe',
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        actorId: payment.customerId, // System/customer
        actionType: 'REFUND',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: {
          amount: refundAmount,
          reason: 'Stripe webhook',
          chargeId: charge.id,
        },
      },
    }).catch(err => console.error('Error creating audit log:', err));

    // Send admin notification
    const { sendAdminRefundNotification } = require('../services/email');
    try {
      await sendAdminRefundNotification(
        payment,
        refundAmount,
        'Refunded via Stripe',
        'System'
      );
    } catch (error) {
      console.error('Error sending admin refund notification:', error);
    }

    console.log(`Refund processed via webhook: ${payment.id}, amount: $${refundAmount}`);
  }
}

// Handle transfer created (payout initiated)
async function handleTransferCreated(transfer) {
  const jobId = transfer.metadata?.jobId;
  if (!jobId) return;

  const payment = await prisma.payment.findFirst({
    where: { jobId },
    include: { hustler: { select: { id: true, email: true, name: true, stripeAccountId: true } }, job: true },
  });

  if (!payment || !payment.hustlerId) return;

  const transferAmount = transfer.amount / 100; // Convert from cents
  const platformFee = transferAmount * 0.12; // 12% platform fee
  const netAmount = transferAmount - platformFee;

  // Create or update payout record
  await prisma.payout.upsert({
    where: { jobId },
    create: {
      hustlerId: payment.hustlerId,
      jobId,
      amount: transferAmount,
      platformFee,
      netAmount,
      status: 'PROCESSING',
      payoutProviderId: transfer.id,
      payoutMethod: 'STRIPE_TRANSFER',
    },
    update: {
      status: 'PROCESSING',
      payoutProviderId: transfer.id,
    },
  });

  // Send admin notification
  const payout = await prisma.payout.findUnique({
    where: { jobId },
    include: { hustler: true },
  });

  const { sendAdminPayoutNotification } = require('../services/email');
  try {
    await sendAdminPayoutNotification(payout, payment.hustler);
  } catch (error) {
    console.error('Error sending admin payout notification:', error);
  }

  console.log(`Payout initiated via webhook: ${payout.id}, amount: $${transferAmount}`);
}

// Handle transfer paid (payout completed)
async function handleTransferPaid(transfer) {
  const payout = await prisma.payout.findFirst({
    where: { payoutProviderId: transfer.id },
    include: { hustler: true },
  });

  if (payout && payout.status !== 'COMPLETED') {
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Send email to hustler
    const { sendPayoutSentEmail } = require('../services/email');
    try {
      await sendPayoutSentEmail(
        payout.hustler.email,
        payout.hustler.name,
        Number(payout.netAmount)
      );
    } catch (error) {
      console.error('Error sending payout email:', error);
    }

    // Send admin notification
    const { sendAdminPayoutNotification } = require('../services/email');
    try {
      await sendAdminPayoutNotification(payout, payout.hustler);
    } catch (error) {
      console.error('Error sending admin payout notification:', error);
    }

    console.log(`Payout completed via webhook: ${payout.id}`);
  }
}

// Handle transfer failed (payout failed)
async function handleTransferFailed(transfer) {
  const payout = await prisma.payout.findFirst({
    where: { payoutProviderId: transfer.id },
    include: { hustler: true },
  });

  if (payout && payout.status !== 'FAILED') {
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'FAILED',
      },
    });

    // Send admin notification
    const { sendAdminPayoutNotification } = require('../services/email');
    try {
      await sendAdminPayoutNotification(payout, payout.hustler);
    } catch (error) {
      console.error('Error sending admin payout notification:', error);
    }

    console.log(`Payout failed via webhook: ${payout.id}`);
  }
}

module.exports = router;


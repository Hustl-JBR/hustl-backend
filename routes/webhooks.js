const express = require('express');
const Stripe = require('stripe');
const prisma = require('../db');

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  // Handle Stripe checkout completion - accept offer if offerId is in metadata
  const offerId = session.metadata?.offerId;
  if (!offerId) return;

  try {
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: true,
        hustler: true,
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
        feeHustler: 0, // Will be calculated on capture (16% of jobAmount)
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

    // Update job
    await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'ASSIGNED',
        hustlerId: offer.hustlerId,
      },
    });

    // Create thread for messaging
    await prisma.thread.create({
      data: {
        jobId: offer.job.id,
        userAId: offer.job.customerId,
        userBId: offer.hustlerId,
      },
    });

    console.log('Offer accepted via Stripe checkout:', offerId);
  } catch (error) {
    console.error('Error handling checkout session completion:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const jobId = paymentIntent.metadata?.jobId;
  if (!jobId) return;

  const payment = await prisma.payment.findFirst({
    where: { providerId: paymentIntent.id },
    include: { job: true },
  });

  if (payment && payment.status === 'PREAUTHORIZED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED' },
    });
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

module.exports = router;


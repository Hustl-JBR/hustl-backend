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


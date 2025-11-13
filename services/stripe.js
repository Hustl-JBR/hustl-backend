const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent({ amount, customerId, jobId, metadata }) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    capture_method: 'manual', // Pre-authorize, capture later
    metadata,
    description: `Job payment for ${jobId}`,
  });

  return paymentIntent;
}

async function capturePaymentIntent(paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
  return paymentIntent;
}

async function voidPaymentIntent(paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
  return paymentIntent;
}

async function createRefund(paymentIntentId, amount) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
  });
  return refund;
}

module.exports = {
  createPaymentIntent,
  capturePaymentIntent,
  voidPaymentIntent,
  createRefund,
};

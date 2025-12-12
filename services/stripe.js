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

async function capturePaymentIntent(paymentIntentId, amountToCapture = null) {
  // If amountToCapture is provided, do partial capture
  // Otherwise, capture the full authorized amount
  if (amountToCapture !== null) {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: Math.round(amountToCapture * 100) // Convert to cents
    });
    return paymentIntent;
  } else {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    return paymentIntent;
  }
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

// Stripe Connect: Create connected account for hustler
async function createConnectedAccount(email, country = 'US') {
  const account = await stripe.accounts.create({
    type: 'express',
    country: country,
    email: email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  return account;
}

// Stripe Connect: Create account link for onboarding
async function createAccountLink(accountId, returnUrl, refreshUrl) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return accountLink;
}

// Stripe Connect: Transfer funds to hustler's connected account
async function transferToHustler(connectedAccountId, amount, jobId, description) {
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    destination: connectedAccountId,
    metadata: {
      jobId: jobId,
      description: description,
    },
  });
  return transfer;
}

module.exports = {
  createPaymentIntent,
  capturePaymentIntent,
  voidPaymentIntent,
  createRefund,
  createConnectedAccount,
  createAccountLink,
  transferToHustler,
};

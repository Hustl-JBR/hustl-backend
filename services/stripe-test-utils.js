/**
 * Stripe Test Mode Utilities
 * Helper functions for testing payments in Stripe test mode
 */

const Stripe = require('stripe');

/**
 * Check if we're in Stripe test mode
 */
function isTestMode() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_');
}

/**
 * Stripe Test Card Numbers
 */
const TEST_CARDS = {
  // Successful payments
  SUCCESS: '4242 4242 4242 4242',
  SUCCESS_VISA: '4242 4242 4242 4242',
  SUCCESS_MASTERCARD: '5555 5555 5555 4444',
  SUCCESS_AMEX: '3782 822463 10005',
  
  // Declined payments
  DECLINED: '4000 0000 0000 0002',
  INSUFFICIENT_FUNDS: '4000 0000 0000 9995',
  EXPIRED_CARD: '4000 0000 0000 0069',
  PROCESSING_ERROR: '4000 0000 0000 0119',
  
  // Requires authentication (3D Secure)
  REQUIRES_AUTH: '4000 0025 0000 3155',
};

/**
 * Create a test Stripe Connect account (hustler)
 * In test mode, this creates a fully functional test account
 */
async function createTestConnectAccount(email, country = 'US') {
  if (!isTestMode()) {
    throw new Error('createTestConnectAccount can only be used in test mode');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  // Create Express account
  const account = await stripe.accounts.create({
    type: 'express',
    country: country,
    email: email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
  });

  // In test mode, we can instantly "complete" onboarding
  await stripe.accounts.update(account.id, {
    business_profile: {
      mcc: '5734', // Computer Software Stores
      url: 'https://test.example.com',
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '127.0.0.1',
    },
  });

  return account;
}

/**
 * Get test account balance (in test mode, this is simulated)
 */
async function getTestAccountBalance(connectedAccountId) {
  if (!isTestMode()) {
    throw new Error('getTestAccountBalance can only be used in test mode');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  const balance = await stripe.balance.retrieve({
    stripeAccount: connectedAccountId,
  });

  return balance;
}

/**
 * Verify payment intent status
 */
async function verifyPaymentIntent(paymentIntentId) {
  if (!isTestMode()) {
    throw new Error('verifyPaymentIntent can only be used in test mode');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  return {
    id: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount / 100, // Convert from cents
    amountCaptured: paymentIntent.amount_capturable / 100,
    amountReceived: paymentIntent.amount_received / 100,
    metadata: paymentIntent.metadata,
  };
}

module.exports = {
  isTestMode,
  TEST_CARDS,
  createTestConnectAccount,
  getTestAccountBalance,
  verifyPaymentIntent,
};


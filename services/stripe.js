const Stripe = require('stripe');

// Initialize Stripe only if key is provided - allows server to start without Stripe for testing
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

if (!stripe) {
  console.warn('⚠️  [services/stripe.js] Stripe not initialized - STRIPE_SECRET_KEY not provided.');
}

/**
 * Create a payment intent with idempotency protection
 * @param {object} params - Payment parameters
 * @param {number} params.amount - Amount in dollars
 * @param {string} params.customerId - Customer ID
 * @param {string} params.jobId - Job ID (used for idempotency key)
 * @param {object} params.metadata - Additional metadata
 * @param {string} params.idempotencyKey - Optional idempotency key (generated if not provided)
 * @returns {Promise<object>} Payment intent
 */
async function createPaymentIntent({ amount, customerId, jobId, metadata, idempotencyKey }) {
  // Generate idempotency key if not provided
  // Pattern: create-{jobId}-{timestamp}
  const key = idempotencyKey || `create-${jobId}-${Date.now()}`;
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    capture_method: 'manual', // Pre-authorize, capture later
    metadata,
    description: `Job payment for ${jobId}`,
  }, {
    idempotencyKey: key
  });

  return paymentIntent;
}

/**
 * Capture a payment intent with idempotency protection
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number|null} amountToCapture - Amount to capture in dollars (null for full capture)
 * @param {string} idempotencyKey - Optional idempotency key (recommended for safety)
 * @returns {Promise<object>} Captured payment intent
 */
async function capturePaymentIntent(paymentIntentId, amountToCapture = null, idempotencyKey = null) {
  // Generate idempotency key if not provided
  // Pattern: capture-{paymentIntentId}-{timestamp}
  const key = idempotencyKey || `capture-${paymentIntentId}-${Date.now()}`;
  
  const options = {
    idempotencyKey: key
  };
  
  // If amountToCapture is provided, do partial capture
  // Otherwise, capture the full authorized amount
  if (amountToCapture !== null) {
    options.amount_to_capture = Math.round(amountToCapture * 100); // Convert to cents
  }
  
  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, options);
  return paymentIntent;
}

/**
 * Void/cancel a payment intent with idempotency protection
 * @param {string} paymentIntentId - Payment intent ID
 * @param {string} idempotencyKey - Optional idempotency key
 * @returns {Promise<object>} Cancelled payment intent
 */
async function voidPaymentIntent(paymentIntentId, idempotencyKey = null) {
  // Generate idempotency key if not provided
  // Pattern: void-{paymentIntentId}-{timestamp}
  const key = idempotencyKey || `void-${paymentIntentId}-${Date.now()}`;
  
  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
    idempotencyKey: key
  });
  return paymentIntent;
}

/**
 * Create a refund with idempotency protection
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number} amount - Amount to refund in dollars (optional, full refund if not specified)
 * @param {string} idempotencyKey - Optional idempotency key
 * @returns {Promise<object>} Refund object
 */
async function createRefund(paymentIntentId, amount, idempotencyKey = null) {
  // Generate idempotency key if not provided
  // Pattern: refund-{paymentIntentId}-{timestamp}
  const key = idempotencyKey || `refund-${paymentIntentId}-${Date.now()}`;
  
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
  }, {
    idempotencyKey: key
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
    // In test mode, we can set business_profile to make onboarding easier
    business_profile: {
      mcc: '5734', // Computer Software Stores
      url: 'https://hustljobs.com',
    },
  });
  
  // Note: We cannot accept TOS on behalf of Express accounts
  // The user must complete onboarding through Stripe's onboarding flow
  // This is required by Stripe for compliance reasons
  
  return account;
}

// Stripe Connect: Verify account exists
async function verifyStripeAccount(accountId) {
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account;
  } catch (error) {
    console.error('[STRIPE] Error verifying account:', accountId, error.message);
    throw error;
  }
}

// Stripe Connect: Create account link for onboarding
async function createAccountLink(accountId, returnUrl, refreshUrl) {
  try {
    console.log('[STRIPE] Creating account link for account:', accountId);
    console.log('[STRIPE] Return URL:', returnUrl);
    console.log('[STRIPE] Refresh URL:', refreshUrl);
    
    // First verify the account exists
    const account = await stripe.accounts.retrieve(accountId);
    console.log('[STRIPE] Account retrieved:', account.id, 'Type:', account.type);
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    
    console.log('[STRIPE] Account link created:', accountLink.url);
    return accountLink;
  } catch (error) {
    console.error('[STRIPE] Error creating account link:', error);
    console.error('[STRIPE] Error type:', error.type);
    console.error('[STRIPE] Error code:', error.code);
    console.error('[STRIPE] Error message:', error.message);
    throw error;
  }
}

// Stripe Connect: Transfer funds to hustler's connected account
/**
 * Transfer funds to hustler's Stripe Connect account with idempotency protection
 * @param {string} connectedAccountId - Hustler's Stripe Connect account ID
 * @param {number} amount - Amount to transfer in dollars
 * @param {string} jobId - Job ID (used for idempotency and metadata)
 * @param {string} description - Transfer description
 * @param {string} idempotencyKey - Optional idempotency key (generated if not provided)
 * @returns {Promise<object>} Transfer object
 */
async function transferToHustler(connectedAccountId, amount, jobId, description, idempotencyKey = null) {
  try {
    console.log(`[TRANSFER] Creating transfer: $${amount.toFixed(2)} to account ${connectedAccountId} for job ${jobId}`);
    
    // Generate idempotency key if not provided
    // Pattern: transfer-{jobId}-{timestamp}
    // CRITICAL: This prevents double-payments if transfer is retried
    const key = idempotencyKey || `transfer-${jobId}-${Date.now()}`;
    
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: connectedAccountId,
      metadata: {
        jobId: jobId,
        description: description,
      },
    }, {
      idempotencyKey: key
    });
    
    console.log(`[TRANSFER] Transfer created successfully: ${transfer.id}, status: ${transfer.status}, amount: $${(transfer.amount / 100).toFixed(2)}`);
    console.log(`[TRANSFER] Transfer details:`, {
      id: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
      status: transfer.status,
      created: transfer.created,
      reversable: transfer.reversable
    });
    
    return transfer;
  } catch (error) {
    console.error(`[TRANSFER] ERROR transferring $${amount.toFixed(2)} to ${connectedAccountId}:`, error);
    console.error(`[TRANSFER] Error type:`, error.type);
    console.error(`[TRANSFER] Error code:`, error.code);
    console.error(`[TRANSFER] Error message:`, error.message);
    throw error;
  }
}

module.exports = {
  createPaymentIntent,
  capturePaymentIntent,
  voidPaymentIntent,
  createRefund,
  createConnectedAccount,
  verifyStripeAccount,
  createAccountLink,
  transferToHustler,
};

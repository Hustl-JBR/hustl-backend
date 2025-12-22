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
async function transferToHustler(connectedAccountId, amount, jobId, description) {
  try {
    console.log(`[TRANSFER] Creating transfer: $${amount.toFixed(2)} to account ${connectedAccountId} for job ${jobId}`);
    
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: connectedAccountId,
      metadata: {
        jobId: jobId,
        description: description,
      },
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

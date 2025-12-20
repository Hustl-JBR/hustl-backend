/**
 * Payment Testing Endpoints
 * Use these endpoints to verify payment flows in test mode
 */

const express = require('express');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  isTestMode,
  TEST_CARDS,
  createTestConnectAccount,
  getTestAccountBalance,
  verifyPaymentIntent,
} = require('../services/stripe-test-utils');

const router = express.Router();

// Only allow in test mode
router.use((req, res, next) => {
  if (!isTestMode()) {
    return res.status(403).json({
      error: 'Test endpoints only available in Stripe test mode',
      hint: 'Set STRIPE_SECRET_KEY to a test key (sk_test_...) to use these endpoints'
    });
  }
  next();
});

// GET /test-payments/status - Check test mode status
router.get('/status', (req, res) => {
  res.json({
    testMode: true,
    message: '✅ Running in Stripe test mode - All payments are fake',
    testCards: TEST_CARDS,
    dashboard: 'https://dashboard.stripe.com/test',
  });
});

// GET /test-payments/cards - List test card numbers
router.get('/cards', (req, res) => {
  res.json({
    testMode: true,
    cards: TEST_CARDS,
    instructions: {
      expiry: 'Any future date (e.g., 12/25)',
      cvc: 'Any 3 digits (e.g., 123)',
      zip: 'Any 5 digits (e.g., 12345)'
    }
  });
});

// POST /test-payments/setup-hustler - Setup Stripe Connect for hustler
router.post('/setup-hustler', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = email || req.user.email;
    
    // Check if user already has Stripe account
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeAccountId: true, email: true }
    });

    if (user.stripeAccountId) {
      return res.json({
        success: true,
        message: 'User already has Stripe Connect account',
        accountId: user.stripeAccountId,
        dashboard: `https://dashboard.stripe.com/test/connect/accounts/${user.stripeAccountId}`
      });
    }

    const account = await createTestConnectAccount(userEmail, 'US');
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: { stripeAccountId: account.id }
    });

    res.json({
      success: true,
      accountId: account.id,
      message: 'Test Connect account created and linked',
      dashboard: `https://dashboard.stripe.com/test/connect/accounts/${account.id}`
    });
  } catch (error) {
    console.error('[TEST PAYMENTS] Error setting up hustler:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /test-payments/verify/:paymentIntentId - Verify payment intent status
router.get('/verify/:paymentIntentId', authenticate, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await verifyPaymentIntent(paymentIntentId);
    
    res.json({
      success: true,
      paymentIntent,
      dashboard: `https://dashboard.stripe.com/test/payments/${paymentIntentId}`
    });
  } catch (error) {
    console.error('[TEST PAYMENTS] Error verifying payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /test-payments/balance/:accountId - Get test account balance
router.get('/balance/:accountId', authenticate, async (req, res) => {
  try {
    const { accountId } = req.params;
    const balance = await getTestAccountBalance(accountId);

    res.json({
      success: true,
      accountId: accountId,
      balance: {
        available: balance.available.map(b => ({
          amount: b.amount / 100,
          currency: b.currency,
        })),
        pending: balance.pending.map(b => ({
          amount: b.amount / 100,
          currency: b.currency,
        })),
      },
      note: 'In test mode, balances are simulated but math is real',
      dashboard: `https://dashboard.stripe.com/test/connect/accounts/${accountId}`
    });
  } catch (error) {
    console.error('[TEST PAYMENTS] Error getting balance:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /test-payments/job/:jobId - Get payment details for a job
router.get('/job/:jobId', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: { select: { id: true, email: true, name: true, stripeAccountId: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user has access
    if (job.customerId !== req.user.id && job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let paymentIntentDetails = null;
    if (job.payment?.providerId) {
      try {
        paymentIntentDetails = await verifyPaymentIntent(job.payment.providerId);
      } catch (error) {
        console.warn('[TEST PAYMENTS] Could not fetch payment intent:', error.message);
      }
    }

    res.json({
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        payType: job.payType,
        amount: job.amount,
        hourlyRate: job.hourlyRate,
        estHours: job.estHours,
      },
      payment: job.payment ? {
        id: job.payment.id,
        status: job.payment.status,
        amount: job.payment.amount,
        tip: job.payment.tip,
        feeCustomer: job.payment.feeCustomer,
        feeHustler: job.payment.feeHustler,
        total: job.payment.total,
        providerId: job.payment.providerId,
      } : null,
      paymentIntent: paymentIntentDetails,
      hustler: job.hustler ? {
        hasStripeAccount: !!job.hustler.stripeAccountId,
        stripeAccountId: job.hustler.stripeAccountId,
      } : null,
      stripeLinks: {
        paymentIntent: job.payment?.providerId 
          ? `https://dashboard.stripe.com/test/payments/${job.payment.providerId}`
          : null,
        hustlerAccount: job.hustler?.stripeAccountId
          ? `https://dashboard.stripe.com/test/connect/accounts/${job.hustler.stripeAccountId}`
          : null,
      }
    });
  } catch (error) {
    console.error('[TEST PAYMENTS] Error getting job payment details:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

// POST /admin/grant-admin - Grant admin access to current user (one-time setup)
// This MUST be before requireRole('ADMIN') so users can grant themselves access
router.post('/grant-admin', authenticate, async (req, res) => {
  try {
    // Check if ANY user already has ADMIN role
    const existingAdmin = await prisma.user.findFirst({
      where: {
        roles: {
          has: 'ADMIN'
        }
      },
      select: { id: true, email: true }
    });

    // If no admin exists, allow anyone to grant themselves admin
    // Otherwise, require existing admin role
    if (existingAdmin) {
      const userRoles = (req.user.roles || []).map(r => r.toUpperCase());
      if (!userRoles.includes('ADMIN')) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Only existing admins can grant admin access'
        });
      }
    }

    // Grant admin to current user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        roles: {
          set: [...new Set([...(req.user.roles || []), 'ADMIN'])]
        }
      },
      select: {
        id: true,
        email: true,
        roles: true
      }
    });

    res.json({
      success: true,
      message: 'Admin access granted successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Grant admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All other admin routes require ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// GET /admin/refunds - List all refunds with details
router.get('/refunds', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['REFUNDED', 'VOIDED']),
  query('dateFrom').optional().isISO8601().toDate(),
  query('dateTo').optional().isISO8601().toDate(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { status: 'REFUNDED' },
        { status: 'VOIDED' },
      ],
    };

    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.dateFrom && req.query.dateTo) {
      where.created_at = {
        gte: req.query.dateFrom,
        lte: req.query.dateTo,
      };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          hustler: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      refunds: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('List refunds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/payouts - List all payouts with details
router.get('/payouts', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  query('dateFrom').optional().isISO8601().toDate(),
  query('dateTo').optional().isISO8601().toDate(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if Payout model exists
    let payouts = [];
    let total = 0;
    
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const skip = (page - 1) * limit;

      const where = {};

      if (req.query.status) {
        where.status = req.query.status;
      }

      if (req.query.dateFrom && req.query.dateTo) {
        where.createdAt = {
          gte: req.query.dateFrom,
          lte: req.query.dateTo,
        };
      }

      [payouts, total] = await Promise.all([
        prisma.payout.findMany({
          where,
          include: {
            hustler: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            job: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prisma.payout.count({ where }),
      ]);
    } catch (payoutError) {
      // Payout model doesn't exist - return empty results
      console.log('[ADMIN PAYOUTS] Payout model not found, returning empty results');
      payouts = [];
      total = 0;
    }

    res.json({
      payouts,
      pagination: {
        page: parseInt(req.query.page || '1', 10),
        limit: parseInt(req.query.limit || '50', 10),
        total,
        totalPages: Math.ceil(total / (parseInt(req.query.limit || '50', 10))),
        hasMore: false,
      },
    });
  } catch (error) {
    console.error('[ADMIN PAYOUTS] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GET /admin/payments - List all payments (refunded, captured, etc.)
router.get('/payments', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PREAUTHORIZED', 'CAPTURED', 'REFUNDED', 'VOIDED']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          hustler: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/stats - Get financial stats (refunds, payouts, revenue)
router.get('/stats', async (req, res) => {
  try {
    console.log('[ADMIN STATS] Fetching stats...');
    // Get all payments
    const allPayments = await prisma.payment.findMany({
      select: {
        status: true,
        total: true,
        amount: true,
        tip: true,
        feeCustomer: true,
        feeHustler: true,
        created_at: true, // Use created_at (snake_case) from schema
      },
    });

    // Get all payouts (if Payout model exists)
    let allPayouts = [];
    try {
      allPayouts = await prisma.payout.findMany({
        select: {
          status: true,
          amount: true,
          platformFee: true,
          netAmount: true,
          createdAt: true,
          completedAt: true,
        },
      });
    } catch (error) {
      // Payout model might not exist - that's okay
      console.log('[ADMIN STATS] Payout model not found, skipping payout stats');
      allPayouts = [];
    }

    // Calculate stats
    const totalRevenue = allPayments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => sum + Number(p.total), 0);

    const totalRefunds = allPayments
      .filter(p => p.status === 'REFUNDED' || p.status === 'VOIDED')
      .reduce((sum, p) => sum + Number(p.total || 0), 0);

    const totalPayouts = allPayouts
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.netAmount), 0);

    // Platform fees = 12% hustler fee + 6.5% customer fee (minus Stripe processing)
    const totalPlatformFees = allPayments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => {
        const hustlerFee = Number(p.feeHustler) || 0; // 12% platform fee
        const customerFee = Number(p.feeCustomer) || 0; // 6.5% customer fee
        // Customer fee goes to platform (Stripe processing is deducted automatically)
        return sum + hustlerFee + customerFee;
      }, 0);
    
    // Calculate estimated Stripe processing fees (2.9% + $0.30 per transaction)
    const estimatedStripeFees = allPayments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => {
        const total = Number(p.total) || 0;
        const stripeFee = (total * 0.029) + 0.30; // 2.9% + $0.30
        return sum + stripeFee;
      }, 0);
    
    // Net platform earnings (after Stripe fees)
    const netPlatformEarnings = totalPlatformFees - estimatedStripeFees;

    const pendingPayouts = allPayouts
      .filter(p => p.status === 'PENDING' || p.status === 'PROCESSING')
      .reduce((sum, p) => sum + Number(p.netAmount), 0);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRefunds = allPayments.filter(
      p => (p.status === 'REFUNDED' || p.status === 'VOIDED') &&
           p.created_at && new Date(p.created_at) >= sevenDaysAgo
    ).length;

    const recentPayouts = allPayouts.filter(
      p => p.status === 'COMPLETED' && 
           p.completedAt && new Date(p.completedAt) >= sevenDaysAgo
    ).length;

    res.json({
      revenue: {
        total: totalRevenue,
        platformFees: totalPlatformFees, // Total fees collected (12% + 6.5%)
        estimatedStripeFees: estimatedStripeFees, // Estimated Stripe processing fees
        netPlatformEarnings: netPlatformEarnings, // Net after Stripe fees
        refunds: totalRefunds,
        net: totalRevenue - totalRefunds,
      },
      payouts: {
        total: totalPayouts,
        pending: pendingPayouts,
        recent: recentPayouts,
      },
      refunds: {
        total: totalRefunds,
        count: allPayments.filter(p => p.status === 'REFUNDED' || p.status === 'VOIDED').length,
        recent: recentRefunds,
      },
      counts: {
        totalPayments: allPayments.length,
        capturedPayments: allPayments.filter(p => p.status === 'CAPTURED').length,
        totalPayouts: allPayouts.length,
        completedPayouts: allPayouts.filter(p => p.status === 'COMPLETED').length,
      },
    });
  } catch (error) {
    console.error('[ADMIN STATS] Error:', error);
    console.error('[ADMIN STATS] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /admin/jobs/:jobId/retry-transfer - Retry transfer for already-captured payments (admin only)
// Used when payment is CAPTURED but transfer failed or wasn't created
router.post('/jobs/:jobId/retry-transfer', requireRole('ADMIN'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: { 
          select: { 
            id: true, 
            email: true, 
            name: true, 
            stripeAccountId: true 
          } 
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.payment) {
      return res.status(400).json({ error: 'Payment not found for this job' });
    }

    if (job.payment.status !== 'CAPTURED') {
      return res.status(400).json({ 
        error: 'Payment must be CAPTURED to retry transfer',
        currentStatus: job.payment.status,
        message: 'Payment status is ' + job.payment.status + '. Only CAPTURED payments can have transfers retried.'
      });
    }

    if (!job.hustler?.stripeAccountId) {
      return res.status(400).json({ 
        error: 'Hustler has not connected Stripe account',
        hustlerId: job.hustlerId
      });
    }

    // Calculate amounts from payment record
    const actualJobAmount = Number(job.payment.amount || job.amount || 0);
    const platformFee = Number(job.payment.feeHustler || actualJobAmount * 0.12);
    const hustlerPayout = actualJobAmount - platformFee;

    console.log(`[ADMIN RETRY TRANSFER] Retrying transfer for job ${jobId}:`);
    console.log(`  Job Amount: $${actualJobAmount.toFixed(2)}`);
    console.log(`  Platform Fee (12%): $${platformFee.toFixed(2)}`);
    console.log(`  Hustler Payout (88%): $${hustlerPayout.toFixed(2)}`);

    // Check platform balance and payment status before transferring
    const { transferToHustler } = require('../services/stripe');
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';

    // Verify payment was actually captured in Stripe and check balance
    if (!skipStripeCheck) {
      try {
        // Check payment intent status
        const paymentIntent = await stripe.paymentIntents.retrieve(job.payment.providerId);
        console.log(`[ADMIN RETRY TRANSFER] Payment Intent Status: ${paymentIntent.status}`);
        console.log(`[ADMIN RETRY TRANSFER] Payment Intent Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
        
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ 
            error: 'Payment not captured in Stripe',
            message: `Payment intent status is ${paymentIntent.status}, not 'succeeded'. Payment must be captured before transfer.`,
            paymentIntentStatus: paymentIntent.status
          });
        }

        // Check platform balance
        const balance = await stripe.balance.retrieve();
        const availableBalance = balance.available[0]?.amount || 0; // Amount in cents
        const availableBalanceDollars = availableBalance / 100;
        const pendingBalance = balance.pending[0]?.amount || 0;
        const pendingBalanceDollars = pendingBalance / 100;
        
        console.log(`[ADMIN RETRY TRANSFER] Platform Balance:`);
        console.log(`  Available: $${availableBalanceDollars.toFixed(2)}`);
        console.log(`  Pending: $${pendingBalanceDollars.toFixed(2)}`);
        console.log(`  Transfer Amount Needed: $${hustlerPayout.toFixed(2)}`);

        if (availableBalanceDollars < hustlerPayout) {
          return res.status(400).json({ 
            error: 'Insufficient balance for transfer',
            message: `Platform account has insufficient available balance. Available: $${availableBalanceDollars.toFixed(2)}, Needed: $${hustlerPayout.toFixed(2)}. Funds may be pending.`,
            balance: {
              available: availableBalanceDollars,
              pending: pendingBalanceDollars,
              needed: hustlerPayout
            },
            paymentIntentId: job.payment.providerId,
            suggestion: 'Wait a few minutes for funds to become available, or check if payment was actually captured.'
          });
        }
      } catch (balanceError) {
        console.error('[ADMIN RETRY TRANSFER] Error checking balance:', balanceError);
        // Continue anyway - let Stripe handle the error
      }
    }

    // Transfer to hustler
    let transferResult = null;
    if (skipStripeCheck) {
      console.warn('[ADMIN RETRY TRANSFER] ⚠️ SKIP_STRIPE_CHECK enabled - skipping transfer');
    } else {
      try {
        console.log(`[ADMIN RETRY TRANSFER] Transferring $${hustlerPayout.toFixed(2)} to hustler: ${job.hustler.stripeAccountId}`);
        transferResult = await transferToHustler(
          job.hustler.stripeAccountId,
          hustlerPayout,
          job.id,
          `Payment for job: ${job.title} (Retry transfer by admin)`
        );
        console.log(`[ADMIN RETRY TRANSFER] ✅ Transfer successful: ${transferResult.id}`);
      } catch (transferError) {
        console.error('[ADMIN RETRY TRANSFER] ❌ Transfer failed:', transferError);
        console.error('[ADMIN RETRY TRANSFER] Transfer error details:', {
          errorType: transferError.type,
          errorCode: transferError.code,
          errorMessage: transferError.message,
          errorParam: transferError.param,
          errorDeclineCode: transferError.decline_code,
          stack: transferError.stack,
          transferAmount: hustlerPayout,
          hustlerAccountId: job.hustler.stripeAccountId,
          jobId: jobId
        });

        let errorMessage = transferError.message || 'Unknown transfer error';
        let helpfulMessage = errorMessage;
        
        if (transferError.code === 'account_invalid') {
          helpfulMessage = 'Hustler\'s Stripe account is invalid or not fully set up. They may need to complete onboarding.';
        } else if (transferError.code === 'insufficient_funds') {
          helpfulMessage = 'Insufficient funds in platform account to make transfer. Check Stripe balance.';
        } else if (transferError.message?.includes('account')) {
          helpfulMessage = 'Issue with hustler\'s Stripe account. Please verify their account is active and properly connected.';
        }

        return res.status(500).json({ 
          error: 'Transfer failed',
          message: helpfulMessage,
          transferFailed: true,
          details: {
            transferAmount: hustlerPayout,
            hustlerAccountId: job.hustler.stripeAccountId,
            errorType: transferError.type,
            errorCode: transferError.code,
            errorMessage: errorMessage,
            errorParam: transferError.param,
            errorDeclineCode: transferError.decline_code
          }
        });
      }
    }

    // Update job status to PAID if not already
    if (job.status !== 'PAID') {
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: 'PAID',
          completionCodeVerified: true
        }
      });
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actionType: 'RETRY_TRANSFER',
        resourceType: 'JOB',
        resourceId: jobId,
        details: {
          jobId: jobId,
          paymentId: job.payment.id,
          transferId: transferResult?.id,
          transferAmount: hustlerPayout,
          reason: 'Retry transfer by admin - original transfer failed or was not created'
        },
      },
    }).catch(err => console.error('Error creating audit log:', err));

    res.json({
      success: true,
      message: 'Transfer completed successfully',
      payment: {
        id: job.payment.id,
        status: job.payment.status,
        amount: actualJobAmount,
        platformFee: platformFee,
        hustlerPayout: hustlerPayout,
      },
      transfer: transferResult ? {
        id: transferResult.id,
        status: transferResult.status,
        amount: hustlerPayout,
        destination: transferResult.destination
      } : null,
      job: {
        id: jobId,
        status: 'PAID',
        title: job.title
      }
    });

  } catch (error) {
    console.error('[ADMIN RETRY TRANSFER] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /admin/jobs/:jobId/capture-and-transfer - Manually capture payment and transfer to hustler (admin only)
// Used for jobs where completion code verification didn't happen but job is completed
router.post('/jobs/:jobId/capture-and-transfer', requireRole('ADMIN'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: { 
          select: { 
            id: true, 
            email: true, 
            name: true, 
            stripeAccountId: true 
          } 
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.payment) {
      return res.status(400).json({ error: 'Payment not found for this job' });
    }

    if (job.payment.status !== 'PREAUTHORIZED') {
      return res.status(400).json({ 
        error: 'Payment is not pre-authorized',
        currentStatus: job.payment.status,
        message: 'This endpoint only works for PREAUTHORIZED payments. Payment is already ' + job.payment.status
      });
    }

    if (!job.hustler?.stripeAccountId) {
      return res.status(400).json({ 
        error: 'Hustler has not connected Stripe account',
        hustlerId: job.hustlerId
      });
    }

    // Calculate amounts
    const actualJobAmount = Number(job.payment.amount || job.amount || 0);
    const platformFee = actualJobAmount * 0.12; // 12% platform fee
    const hustlerPayout = actualJobAmount - platformFee; // 88% to hustler
    const customerServiceFee = actualJobAmount * 0.065; // 6.5% customer service fee
    const customerTotalCharged = actualJobAmount + customerServiceFee;

    console.log(`[ADMIN MANUAL CAPTURE] Processing payment for job ${jobId}:`);
    console.log(`  Job Amount: $${actualJobAmount.toFixed(2)}`);
    console.log(`  Platform Fee (12%): $${platformFee.toFixed(2)}`);
    console.log(`  Hustler Payout (88%): $${hustlerPayout.toFixed(2)}`);
    console.log(`  Customer Service Fee (6.5%): $${customerServiceFee.toFixed(2)}`);

    // Capture payment (or check if already captured)
    const { capturePaymentIntent, transferToHustler } = require('../services/stripe');
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';

    let captureResult;
    let alreadyCaptured = false;
    
    if (skipStripeCheck) {
      console.warn('[ADMIN MANUAL CAPTURE] ⚠️ SKIP_STRIPE_CHECK enabled - skipping capture');
      captureResult = { id: job.payment.providerId, status: 'succeeded' };
    } else {
      try {
        // First, check the current status of the payment intent in Stripe
        console.log(`[ADMIN MANUAL CAPTURE] Checking payment intent status: ${job.payment.providerId}`);
        const paymentIntent = await stripe.paymentIntents.retrieve(job.payment.providerId);
        
        console.log(`[ADMIN MANUAL CAPTURE] Payment intent status: ${paymentIntent.status}`);
        
        if (paymentIntent.status === 'succeeded') {
          // Payment is already captured in Stripe
          console.log(`[ADMIN MANUAL CAPTURE] ✅ Payment already captured in Stripe`);
          alreadyCaptured = true;
          captureResult = paymentIntent;
        } else if (paymentIntent.status === 'requires_capture') {
          // Payment is pre-authorized, needs to be captured
          console.log(`[ADMIN MANUAL CAPTURE] Capturing payment intent: ${job.payment.providerId}`);
          captureResult = await capturePaymentIntent(job.payment.providerId);
          console.log(`[ADMIN MANUAL CAPTURE] ✅ Payment captured: ${captureResult.id}`);
        } else {
          // Payment is in an unexpected state
          console.error(`[ADMIN MANUAL CAPTURE] ❌ Payment intent in unexpected state: ${paymentIntent.status}`);
          return res.status(400).json({ 
            error: 'Payment is not in a capturable state',
            currentStatus: paymentIntent.status,
            message: `Payment intent status is ${paymentIntent.status}. Expected 'requires_capture' or 'succeeded'.`
          });
        }
      } catch (stripeError) {
        console.error('[ADMIN MANUAL CAPTURE] ❌ Stripe API error:', stripeError);
        
        // If it's a "already captured" error, that's okay - proceed with transfer
        if (stripeError.code === 'payment_intent_unexpected_state' || 
            stripeError.message?.includes('already been captured') ||
            stripeError.message?.includes('already succeeded')) {
          console.log('[ADMIN MANUAL CAPTURE] ⚠️ Payment already captured (error indicates this) - proceeding with transfer');
          alreadyCaptured = true;
          // Try to retrieve it to get the status
          try {
            captureResult = await stripe.paymentIntents.retrieve(job.payment.providerId);
          } catch (retrieveError) {
            return res.status(500).json({ 
              error: 'Failed to verify payment status',
              message: retrieveError.message
            });
          }
        } else {
          return res.status(500).json({ 
            error: 'Failed to process payment',
            message: stripeError.message,
            details: {
              paymentIntentId: job.payment.providerId,
              errorType: stripeError.type,
              errorCode: stripeError.code
            }
          });
        }
      }
    }

    // Transfer to hustler
    let transferResult = null;
    if (skipStripeCheck) {
      console.warn('[ADMIN MANUAL CAPTURE] ⚠️ SKIP_STRIPE_CHECK enabled - skipping transfer');
    } else {
      try {
        console.log(`[ADMIN MANUAL CAPTURE] Transferring $${hustlerPayout.toFixed(2)} to hustler: ${job.hustler.stripeAccountId}`);
        transferResult = await transferToHustler(
          job.hustler.stripeAccountId,
          hustlerPayout,
          job.id,
          `Payment for job: ${job.title} (Manual capture by admin)`
        );
        console.log(`[ADMIN MANUAL CAPTURE] ✅ Transfer successful: ${transferResult.id}`);
      } catch (transferError) {
        console.error('[ADMIN MANUAL CAPTURE] ❌ Transfer failed:', transferError);
        console.error('[ADMIN MANUAL CAPTURE] Transfer error details:', {
          errorType: transferError.type,
          errorCode: transferError.code,
          errorMessage: transferError.message,
          errorParam: transferError.param,
          errorDeclineCode: transferError.decline_code,
          stack: transferError.stack,
          transferAmount: hustlerPayout,
          hustlerAccountId: job.hustler.stripeAccountId,
          jobId: jobId
        });
        
        // Payment was captured but transfer failed - update payment status anyway
        // Admin can retry transfer manually
        await prisma.payment.update({
          where: { id: job.payment.id },
          data: {
            status: 'CAPTURED',
            amount: actualJobAmount,
            feeHustler: platformFee,
            feeCustomer: customerServiceFee,
            total: customerTotalCharged,
            capturedAt: alreadyCaptured ? job.payment.capturedAt || new Date() : new Date(),
          }
        });

        // Provide detailed error message to help diagnose
        let errorMessage = transferError.message || 'Unknown transfer error';
        let helpfulMessage = errorMessage;
        
        if (transferError.code === 'account_invalid') {
          helpfulMessage = 'Hustler\'s Stripe account is invalid or not fully set up. They may need to complete onboarding.';
        } else if (transferError.code === 'insufficient_funds') {
          helpfulMessage = 'Insufficient funds in platform account to make transfer. This should not happen if payment was captured.';
        } else if (transferError.message?.includes('account')) {
          helpfulMessage = 'Issue with hustler\'s Stripe account. Please verify their account is active and properly connected.';
        }

        return res.status(500).json({ 
          error: 'Payment captured but transfer failed',
          message: helpfulMessage,
          paymentCaptured: true,
          transferFailed: true,
          details: {
            transferAmount: hustlerPayout,
            hustlerAccountId: job.hustler.stripeAccountId,
            errorType: transferError.type,
            errorCode: transferError.code,
            errorMessage: errorMessage,
            errorParam: transferError.param,
            errorDeclineCode: transferError.decline_code
          }
        });
      }
    }

      // Update payment record (only if not already updated)
      // If payment was already captured, we still need to update the database
      const updatedPayment = await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          status: 'CAPTURED',
          amount: actualJobAmount,
          feeHustler: platformFee,
          feeCustomer: customerServiceFee,
          total: customerTotalCharged,
          capturedAt: alreadyCaptured ? job.payment.capturedAt || new Date() : new Date(), // Keep existing capturedAt if already captured
        }
      });
      
      if (alreadyCaptured) {
        console.log('[ADMIN MANUAL CAPTURE] ℹ️ Payment was already captured in Stripe - database updated to match');
      }

    // Update job status to PAID
    await prisma.job.update({
      where: { id: jobId },
      data: { 
        status: 'PAID',
        completionCodeVerified: true // Mark as verified since we're manually processing
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actionType: 'MANUAL_CAPTURE_AND_TRANSFER',
        resourceType: 'JOB',
        resourceId: jobId,
        details: {
          jobId: jobId,
          paymentId: job.payment.id,
          capturedAmount: actualJobAmount,
          platformFee: platformFee,
          hustlerPayout: hustlerPayout,
          transferId: transferResult?.id,
          reason: 'Manual capture and transfer by admin - completion code verification was skipped'
        },
      },
    }).catch(err => console.error('Error creating audit log:', err));

    res.json({
      success: true,
      message: 'Payment captured and transferred successfully',
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        amount: actualJobAmount,
        platformFee: platformFee,
        hustlerPayout: hustlerPayout,
        customerServiceFee: customerServiceFee,
      },
      transfer: transferResult ? {
        id: transferResult.id,
        status: transferResult.status,
        amount: hustlerPayout,
        destination: transferResult.destination
      } : null,
      job: {
        id: jobId,
        status: 'PAID',
        title: job.title
      }
    });

  } catch (error) {
    console.error('[ADMIN MANUAL CAPTURE] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /admin/refunds/:paymentId - Manually process a refund (admin only)
router.post('/refunds/:paymentId', [
  body('amount').optional().isFloat({ min: 0.01 }),
  body('reason').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: { select: { id: true, email: true, name: true } },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'CAPTURED') {
      return res.status(400).json({ error: 'Can only refund captured payments' });
    }

    const refundAmount = amount ? Number(amount) : Number(payment.total);
    const refundAmountCents = Math.round(refundAmount * 100);

    // Process refund via Stripe
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    if (!skipStripeCheck && payment.providerId) {
      try {
        const { createRefund } = require('../services/stripe');
        await createRefund(payment.providerId, refundAmountCents);
      } catch (error) {
        console.error('Error processing Stripe refund:', error);
        return res.status(400).json({ error: 'Failed to process refund: ' + error.message });
      }
    }

    // Update payment record
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundAmount,
        refundReason: reason,
        refundedByAdminId: req.user.id,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actionType: 'REFUND',
        resourceType: 'PAYMENT',
        resourceId: paymentId,
        details: {
          amount: refundAmount,
          reason,
          jobId: payment.jobId,
          customerId: payment.customerId,
          hustlerId: payment.hustlerId,
        },
        ipAddress: req.ip,
      },
    }).catch(err => console.error('Error creating audit log:', err));

    // Send email notifications
    const { sendRefundEmail, sendAdminRefundNotification } = require('../services/email');
    
    try {
      await sendRefundEmail(
        payment.customer.email,
        payment.customer.name,
        payment.job.title,
        refundAmount,
        reason || 'Refund processed by admin',
        payment
      );
    } catch (emailError) {
      console.error('Error sending refund email:', emailError);
    }

    // Notify admin (optional - can be sent to admin email)
    try {
      if (sendAdminRefundNotification) {
        await sendAdminRefundNotification(
          payment,
          refundAmount,
          reason,
          req.user.name
        );
      }
    } catch (adminEmailError) {
      console.error('Error sending admin notification:', adminEmailError);
    }

    res.json({
      payment: updatedPayment,
      message: 'Refund processed successfully',
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/transfers - List all Stripe transfers (for debugging)
router.get('/transfers', async (req, res) => {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const limit = parseInt(req.query.limit || '50', 10);
    
    // List transfers from Stripe
    const transfers = await stripe.transfers.list({
      limit: limit,
    });
    
    // Also get balance to see what's in the platform account
    const balance = await stripe.balance.retrieve();
    
    res.json({
      transfers: transfers.data.map(t => ({
        id: t.id,
        amount: t.amount / 100,
        currency: t.currency,
        destination: t.destination,
        status: t.status,
        created: new Date(t.created * 1000).toISOString(),
        metadata: t.metadata,
        reversable: t.reversable,
        reversed: t.reversed,
      })),
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
      hasMore: transfers.has_more,
    });
  } catch (error) {
    console.error('List transfers error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GET /admin/tips - List all tips
router.get('/tips', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    // Get all payments with tips > 0
    const where = {
      tip: {
        gt: 0
      }
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          hustler: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      tips: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[ADMIN TIPS] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;


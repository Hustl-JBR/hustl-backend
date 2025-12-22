const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

// All admin routes require ADMIN role
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
      where.updatedAt = {
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
        orderBy: { updatedAt: 'desc' },
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

    const [payouts, total] = await Promise.all([
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payout.count({ where }),
    ]);

    res.json({
      payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('List payouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
        orderBy: { createdAt: 'desc' },
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
    // Get all payments
    const allPayments = await prisma.payment.findMany({
      select: {
        status: true,
        total: true,
        amount: true,
        tip: true,
        feeCustomer: true,
        feeHustler: true,
        refundAmount: true,
        createdAt: true,
        capturedAt: true,
      },
    });

    // Get all payouts
    const allPayouts = await prisma.payout.findMany({
      select: {
        status: true,
        amount: true,
        platformFee: true,
        netAmount: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // Calculate stats
    const totalRevenue = allPayments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => sum + Number(p.total), 0);

    const totalRefunds = allPayments
      .filter(p => p.status === 'REFUNDED' || p.status === 'VOIDED')
      .reduce((sum, p) => sum + (Number(p.refundAmount) || Number(p.total)), 0);

    const totalPayouts = allPayouts
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.netAmount), 0);

    const totalPlatformFees = allPayments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => sum + (Number(p.feeHustler) || 0), 0);

    const pendingPayouts = allPayouts
      .filter(p => p.status === 'PENDING' || p.status === 'PROCESSING')
      .reduce((sum, p) => sum + Number(p.netAmount), 0);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRefunds = allPayments.filter(
      p => (p.status === 'REFUNDED' || p.status === 'VOIDED') &&
           new Date(p.updatedAt || p.createdAt) >= sevenDaysAgo
    ).length;

    const recentPayouts = allPayouts.filter(
      p => p.status === 'COMPLETED' && 
           new Date(p.completedAt || p.createdAt) >= sevenDaysAgo
    ).length;

    res.json({
      revenue: {
        total: totalRevenue,
        platformFees: totalPlatformFees,
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
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
        refundAmount
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

module.exports = router;


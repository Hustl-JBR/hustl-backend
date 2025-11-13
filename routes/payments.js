const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { capturePaymentIntent } = require('../services/stripe');
const { sendPaymentReceiptEmail } = require('../services/email');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /payments/intent - Create payment intent (pre-auth)
router.post('/intent', requireRole('CUSTOMER'), async (req, res) => {
  try {
    // This is typically called during offer acceptance
    // See offers.js for implementation
    res.status(501).json({ error: 'Use /offers/:id/accept endpoint' });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/confirm - Capture payment (Customer confirms completion)
router.post('/jobs/:jobId/confirm', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: true,
        hustler: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'COMPLETED_BY_HUSTLER' && job.status !== 'AWAITING_CUSTOMER_CONFIRM') {
      return res.status(400).json({ error: 'Job is not ready for confirmation' });
    }

    if (!job.payment) {
      return res.status(400).json({ error: 'Payment not found' });
    }

    if (job.payment.status !== 'PREAUTHORIZED') {
      return res.status(400).json({ error: 'Payment is not pre-authorized' });
    }

    // Capture payment
    const captured = await capturePaymentIntent(job.payment.providerId);

    // Calculate hustler fee (10% platform fee)
    const hustlerFee = Number(job.payment.amount) * 0.1;

    // Update payment
    const payment = await prisma.payment.update({
      where: { id: job.payment.id },
      data: {
        status: 'CAPTURED',
        feeHustler: hustlerFee,
      },
    });

    // Update job status
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PAID' },
    });

    // Generate receipt URL (store in R2 or generate PDF)
    const receiptUrl = `${process.env.APP_BASE_URL}/payments/receipts/${payment.id}`;

    await prisma.payment.update({
      where: { id: payment.id },
      data: { receiptUrl },
    });

    // Send receipt email
    await sendPaymentReceiptEmail(
      job.customer.email,
      job.customer.name,
      payment,
      receiptUrl
    );

    res.json({
      job: updatedJob,
      payment: {
        ...payment,
        receiptUrl,
      },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments/receipts - List user's receipts
router.get('/receipts', async (req, res) => {
  try {
    const receipts = await prisma.payment.findMany({
      where: {
        OR: [
          { customerId: req.user.id },
          { hustlerId: req.user.id },
        ],
        status: 'CAPTURED',
        receiptUrl: { not: null },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        hustler: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(receipts);
  } catch (error) {
    console.error('List receipts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


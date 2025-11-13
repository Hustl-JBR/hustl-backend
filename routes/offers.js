const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { createPaymentIntent } = require('../services/stripe');

const router = express.Router();

// POST /jobs/:id/offers - Create an offer (Hustler only)
router.post('/jobs/:jobId/offers', authenticate, requireRole('HUSTLER'), [
  body('note').optional().trim().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId } = req.params;
    const { note } = req.body;

    // Check if hustler is verified
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { idVerified: true },
    });

    if (!user.idVerified) {
      return res.status(403).json({ error: 'ID verification required to request jobs' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'OPEN') {
      return res.status(400).json({ error: 'Job is not available' });
    }

    if (job.customerId === req.user.id) {
      return res.status(400).json({ error: 'Cannot offer on your own job' });
    }

    // Check if offer already exists
    const existing = await prisma.offer.findFirst({
      where: {
        jobId,
        hustlerId: req.user.id,
        status: 'PENDING',
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Offer already exists' });
    }

    const offer = await prisma.offer.create({
      data: {
        jobId,
        hustlerId: req.user.id,
        note: note || null,
        status: 'PENDING',
      },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
            username: true,
            ratingAvg: true,
            ratingCount: true,
            photoUrl: true,
          },
        },
        job: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Send email to customer
    const { sendOfferReceivedEmail } = require('../services/email');
    await sendOfferReceivedEmail(
      offer.job.customer.email,
      offer.job.customer.name,
      offer.job.title,
      offer.note
    );

    res.status(201).json(offer);
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:id/accept - Accept an offer (Customer only)
router.post('/:id/accept', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          include: {
            customer: true,
            hustler: true,
          },
        },
        hustler: true,
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    if (offer.job.status !== 'OPEN' && offer.job.status !== 'REQUESTED') {
      return res.status(400).json({ error: 'Job is not available' });
    }

    // Calculate payment amounts
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25); // Max 25%
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50); // Max $50 tip
    const serviceFee = Math.min(Math.max(jobAmount * 0.075, 2), 25); // 7.5% min $2, max $25
    const total = jobAmount + tipAmount + serviceFee;

    // Create Stripe payment intent (pre-auth)
    const paymentIntent = await createPaymentIntent({
      amount: Math.round(total * 100), // Convert to cents
      customerId: req.user.id,
      jobId: offer.job.id,
      metadata: {
        jobId: offer.job.id,
        customerId: req.user.id,
        hustlerId: offer.hustlerId,
        amount: jobAmount.toString(),
        tip: tipAmount.toString(),
        serviceFee: serviceFee.toString(),
      },
    });

    // Update offer status
    await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'ACCEPTED' },
    });

    // Decline other offers
    await prisma.offer.updateMany({
      where: {
        jobId: offer.job.id,
        id: { not: req.params.id },
        status: 'PENDING',
      },
      data: { status: 'DECLINED' },
    });

    // Update job
    const job = await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'ASSIGNED',
        hustlerId: offer.hustlerId,
      },
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        jobId: offer.job.id,
        customerId: req.user.id,
        hustlerId: offer.hustlerId,
        amount: jobAmount,
        tip: tipAmount,
        feeCustomer: serviceFee,
        feeHustler: 0, // Will be calculated on capture
        total,
        status: 'PREAUTHORIZED',
        providerId: paymentIntent.id,
      },
    });

    // Create thread for messaging
    await prisma.thread.create({
      data: {
        jobId: offer.job.id,
        userAId: req.user.id,
        userBId: offer.hustlerId,
      },
    });

    // Send email to hustler
    const { sendJobAssignedEmail } = require('../services/email');
    await sendJobAssignedEmail(
      offer.hustler.email,
      offer.hustler.name,
      job.title
    );

    res.json({
      job,
      offer,
      payment: {
        ...payment,
        clientSecret: paymentIntent.client_secret,
      },
    });
  } catch (error) {
    console.error('Accept offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:id/decline - Decline an offer (Customer only)
router.post('/:id/decline', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { job: true },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    const updated = await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'DECLINED' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Decline offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


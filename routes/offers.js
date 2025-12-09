const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { createPaymentIntent } = require('../services/stripe');

const router = express.Router();

// GET /offers/:jobId - List offers for a job
router.get('/:jobId', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Allow customer to see all offers for their job
    // Allow assigned hustler to see offers
    // Allow users with HUSTLER role to see offers (to check competition before applying)
    if (job.customerId !== req.user.id && job.hustlerId !== req.user.id) {
      // Check if user has HUSTLER role
      const hasHustlerRole = req.user.roles?.some(r => r.toUpperCase() === 'HUSTLER');
      
      if (!hasHustlerRole) {
        // If not a hustler, check if they have an offer for this job
        const userOffer = await prisma.offer.findFirst({
          where: {
            jobId,
            hustlerId: req.user.id,
          },
        });

        if (!userOffer) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    }

    let offers;
    try {
      offers = await prisma.offer.findMany({
        where: { jobId },
        include: {
          hustler: {
            select: {
              id: true,
              name: true,
              username: true,
              ratingAvg: true,
              ratingCount: true,
              photoUrl: true,
              bio: true,
              tools: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (toolsError) {
      // If tools column doesn't exist, query without it
      if (toolsError.message && toolsError.message.includes('tools')) {
        offers = await prisma.offer.findMany({
          where: { jobId },
          include: {
            hustler: {
              select: {
                id: true,
                name: true,
                username: true,
                ratingAvg: true,
                ratingCount: true,
                photoUrl: true,
                bio: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        // Add null tools to each hustler
        offers.forEach(offer => {
          if (offer.hustler) {
            offer.hustler.tools = null;
          }
        });
      } else {
        throw toolsError;
      }
    }

    res.json(offers);
  } catch (error) {
    console.error('List offers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:jobId - Create an offer (Hustler only)
router.post('/:jobId', authenticate, requireRole('HUSTLER'), [
  body('note').optional().trim().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId } = req.params;
    const { note, proposedAmount } = req.body;
    // Note: proposedPriceType is sent from frontend but not stored in DB (used for display only)

    // Check if hustler is verified (optional for now - can be enabled later)
    // const user = await prisma.user.findUnique({
    //   where: { id: req.user.id },
    //   select: { idVerified: true },
    // });

    // if (!user.idVerified) {
    //   return res.status(403).json({ error: 'ID verification required to request jobs' });
    // }

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
        proposedAmount: proposedAmount ? parseFloat(proposedAmount) : null,
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

    // Create thread for messaging (as soon as hustler applies) - use upsert to handle unique constraint
    try {
      await prisma.thread.upsert({
        where: { jobId },
        update: {}, // If exists, don't update anything
        create: {
          jobId,
          userAId: offer.job.customerId,
          userBId: req.user.id,
        },
      });
    } catch (threadError) {
      // If thread creation fails (e.g., unique constraint), log but don't fail the offer
      console.error('Thread creation error (non-fatal):', threadError);
      // Continue - the offer is still created successfully
    }

    // Send email to customer about new offer (non-blocking - don't fail offer if email fails)
    try {
      const { sendOfferReceivedEmail } = require('../services/email');
      await sendOfferReceivedEmail(
        offer.job.customer.email,
        offer.job.customer.name,
        offer.job.title,
        offer.note
      );
    } catch (emailError) {
      console.error('Email sending error (non-fatal):', emailError);
      // Continue - the offer is still created successfully
    }

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
            customer: { select: { id: true, email: true, name: true } },
            hustler: { select: { id: true, email: true, name: true } },
          },
        },
        hustler: {
          select: {
            id: true,
            name: true,
            email: true,
            stripeAccountId: true,
          },
        },
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

    // CHECK ACTIVE JOBS LIMIT - Hustlers can only have 2 active jobs at once
    // Active = ASSIGNED status where hustler has received start code (status = PAID) OR status = ASSIGNED
    const activeJobsCount = await prisma.job.count({
      where: {
        hustlerId: offer.hustlerId,
        status: {
          in: ['ASSIGNED', 'PAID', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM']
        }
      }
    });
    
    const MAX_ACTIVE_JOBS = 2;
    if (activeJobsCount >= MAX_ACTIVE_JOBS) {
      return res.status(400).json({ 
        error: `You already have ${MAX_ACTIVE_JOBS} active jobs. Complete one to take another.`,
        maxActiveJobs: MAX_ACTIVE_JOBS,
        currentActiveJobs: activeJobsCount
      });
    }

    // REQUIRE STRIPE ACCOUNT - Hustler must have Stripe connected to be accepted
    // Skip in test mode (when SKIP_STRIPE_CHECK=true)
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    const hustler = await prisma.user.findUnique({
      where: { id: offer.hustlerId },
      select: { stripeAccountId: true, email: true, name: true },
    });

    if (!hustler.stripeAccountId && !skipStripeCheck) {
      // Send email to hustler about needing Stripe
      try {
        const { sendStripeRequiredEmail } = require('../services/email');
        await sendStripeRequiredEmail(
          hustler.email,
          hustler.name,
          offer.job.title
        );
      } catch (emailError) {
        console.error('Error sending Stripe required email:', emailError);
      }
      
      return res.status(400).json({ 
        error: 'Cannot accept offer: Hustler must connect their Stripe account first. They have been notified via email.',
        requiresStripe: true 
      });
    }
    
    // In test mode, log that we're skipping the check
    if (skipStripeCheck && !hustler.stripeAccountId) {
      console.log('[TEST MODE] Skipping Stripe account check for hustler:', offer.hustlerId);
    }

    // Payment is required when accepting an offer (industry standard)
    // Check if payment intent is provided
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId && process.env.SKIP_STRIPE_CHECK !== 'true') {
      // Calculate payment amounts from job
      const jobAmount = parseFloat(offer.job.amount || 0);
      const tipPercent = Math.min(parseFloat(offer.job.tipPercent || 0), 25);
      const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
      const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
      const total = jobAmount + tipAmount + customerFee;
      
      return res.status(400).json({ 
        error: 'Payment required to accept this offer. Please complete payment to proceed.',
        requiresPayment: true,
        amount: total,
        jobId: offer.job.id,
        offerId: offer.id,
      });
    }

    // Check if payment already exists (from previous attempt)
    let existingPayment = await prisma.payment.findUnique({
      where: { jobId: offer.job.id },
    });

    let paymentIntent;
    
    if (process.env.SKIP_STRIPE_CHECK === 'true') {
      // Test mode - create fake payment
      paymentIntent = {
        id: paymentIntentId || `pi_test_${Date.now()}`,
        status: 'requires_capture',
      };
    } else {
      // Verify payment intent exists and is pre-authorized
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ 
          error: 'Payment not authorized. Please complete payment to accept this offer.',
          paymentStatus: paymentIntent.status,
        });
      }
    }

    // Calculate payment amounts
    const jobAmount = parseFloat(offer.job.amount || 0);
    const tipPercent = Math.min(parseFloat(offer.job.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    // Create or update payment record with PREAUTHORIZED status (held in escrow)
    if (existingPayment) {
      // Update existing payment
      existingPayment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          hustlerId: offer.hustlerId,
          amount: jobAmount,
          tip: tipAmount,
          feeCustomer: customerFee,
          feeHustler: 0, // Will be calculated on release (12% of jobAmount)
          total,
          status: 'PREAUTHORIZED',
          providerId: paymentIntent.id,
        },
      });
    } else {
      // Create new payment
      existingPayment = await prisma.payment.create({
        data: {
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount,
          tip: tipAmount,
          feeCustomer: customerFee,
          feeHustler: 0, // Will be calculated on release (12% of jobAmount)
          total,
          status: 'PREAUTHORIZED',
          providerId: paymentIntent.id,
        },
      });
    }

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

    // Generate 6-digit verification codes
    const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));
    const startCode = generateCode(); // Customer gives this to hustler to start job
    const completionCode = generateCode(); // Hustler gives this to customer to complete
    
    // Set expiration: 78 hours from now
    const startCodeExpiresAt = new Date();
    startCodeExpiresAt.setHours(startCodeExpiresAt.getHours() + 78);

    // Update job with hustler and verification codes
    const job = await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'ASSIGNED',
        hustlerId: offer.hustlerId,
        startCode,
        startCodeExpiresAt,
        completionCode,
        // Update payment with hustler info
      },
    });

    // Update payment with hustler ID (payment was created when job was posted)
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        hustlerId: offer.hustlerId,
      },
    });

    // Payment already exists, just update hustler ID
    const payment = await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        hustlerId: offer.hustlerId,
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

    // Send notification email to hustler
    const { sendJobAssignedEmail } = require('../services/email');
    try {
      await sendJobAssignedEmail(
        offer.hustler.email,
        offer.hustler.name,
        job.title,
        job.id,
        req.user.name // Customer name
      );
    } catch (emailError) {
      console.error('Error sending job assigned email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      job,
      offer,
      payment,
      startCode, // Customer needs to give this to hustler
      startCodeExpiresAt, // 78 hours from now
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

// POST /offers/:id/unaccept - Unaccept a hustler (customer only, before start code)
router.post('/:id/unaccept', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          include: {
            payment: true,
            customer: { select: { id: true, email: true, name: true } },
            hustler: { select: { id: true, email: true, name: true } }
          }
        },
        hustler: { select: { id: true, email: true, name: true } }
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (offer.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'Offer is not accepted' });
    }

    // Check if start code has been used - cannot unaccept if it has
    if (offer.job.startCodeVerified) {
      return res.status(400).json({ 
        error: 'Cannot unaccept: Start code has already been entered. Job is active.',
        startCodeUsed: true
      });
    }

    // Update offer status back to PENDING
    await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'PENDING' }
    });

    // Update job - remove hustler, set back to OPEN
    await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'OPEN',
        hustlerId: null,
        acceptedHustlerId: null,
        startCode: null,
        startCodeExpiresAt: null
      }
    });

    // Payment stays in hold (not refunded) - customer can accept another hustler

    // Send notification email to hustler
    const { sendJobUnacceptedEmail } = require('../services/email');
    try {
      await sendJobUnacceptedEmail(
        offer.hustler.email,
        offer.hustler.name,
        offer.job.title,
        offer.job.id
      );
    } catch (emailError) {
      console.error('Error sending unaccept email:', emailError);
    }

    res.json({
      success: true,
      message: 'Hustler unaccepted. Job is now open for other applicants.',
      job: await prisma.job.findUnique({
        where: { id: offer.job.id }
      })
    });
  } catch (error) {
    console.error('Unaccept offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


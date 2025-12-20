const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { createPaymentIntent } = require('../services/stripe');

const router = express.Router();

// GET /offers/user/me - Get all offers for the current user (hustler)
router.get('/user/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    let offers;
    try {
      offers = await prisma.offer.findMany({
        where: { hustlerId: userId },
        include: {
          job: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  photoUrl: true,
                  ratingAvg: true,
                  ratingCount: true,
                },
              },
              hustler: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  photoUrl: true,
                },
              },
              payment: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      // If tools column error, retry without it
      if (error.message && error.message.includes('tools')) {
        offers = await prisma.offer.findMany({
          where: { hustlerId: userId },
          include: {
            job: {
              include: {
                customer: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    photoUrl: true,
                    ratingAvg: true,
                    ratingCount: true,
                  },
                },
                hustler: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    photoUrl: true,
                  },
                },
                payment: {
                  select: {
                    id: true,
                    amount: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } else {
        throw error;
      }
    }
    
    res.json(offers);
  } catch (error) {
    console.error('Get user offers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Check if this is a private rehire job
    const requirements = job.requirements || {};
    const isPrivate = requirements.isPrivate === true;
    const rehireHustlerId = requirements.rehireHustlerId;
    
    // If it's a private rehire job, only the specified hustler can create an offer
    if (isPrivate && rehireHustlerId && rehireHustlerId !== req.user.id) {
      return res.status(403).json({ error: 'This job is a private rehire request for a specific worker' });
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
    // Active = IN_PROGRESS only (jobs where Start Code has been entered)
    // SCHEDULED jobs (hustler accepted, waiting for Start Code) do NOT count as active
    const activeJobsCount = await prisma.job.count({
      where: {
        hustlerId: offer.hustlerId,
        status: 'IN_PROGRESS' // Only started jobs count toward the limit
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
    // DISABLED FOR TESTING - Skip in test mode (when SKIP_STRIPE_CHECK=true)
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    const hustler = await prisma.user.findUnique({
      where: { id: offer.hustlerId },
      select: { stripeAccountId: true, email: true, name: true },
    });

    // DISABLED FOR TESTING - Always skip Stripe check for now
    // if (!hustler.stripeAccountId && !skipStripeCheck) {
    //   // Send email to hustler about needing Stripe
    //   try {
    //     const { sendStripeRequiredEmail } = require('../services/email');
    //     await sendStripeRequiredEmail(
    //       hustler.email,
    //       hustler.name,
    //       offer.job.title
    //     );
    //   } catch (emailError) {
    //     console.error('Error sending Stripe required email:', emailError);
    //   }
    //   
    //   return res.status(400).json({ 
    //     error: 'Cannot accept offer: Hustler must connect their Stripe account first. They have been notified via email.',
    //     requiresStripe: true 
    //   });
    // }
    
    // In test mode, log that we're skipping the check
    console.log('[TEST MODE] Skipping Stripe account check for hustler:', offer.hustlerId);

    // Payment is required when accepting an offer (industry standard)
    // Check if payment intent is provided
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId && process.env.SKIP_STRIPE_CHECK !== 'true') {
      // Calculate payment amounts from job
      // TIPS ARE NOT INCLUDED IN AUTHORIZATION - They happen after completion
      const jobAmount = parseFloat(offer.job.amount || 0);
      const tipAmount = 0; // Tips happen after completion, not in authorization
      const customerFee = jobAmount * 0.065; // 6.5% customer fee (no min/max cap)
      const total = jobAmount + customerFee;
      
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
    // For hourly jobs: authorize max amount (hourlyRate × maxHours)
    // For flat jobs: use the flat amount
    let jobAmount = 0;
    let maxAmount = 0; // For hourly jobs, this is the max possible charge
    
    if (offer.job.payType === 'hourly' && offer.job.hourlyRate && offer.job.estHours) {
      const hourlyRate = parseFloat(offer.job.hourlyRate);
      const maxHours = parseInt(offer.job.estHours);
      maxAmount = hourlyRate * maxHours; // Max possible charge
      jobAmount = maxAmount; // Authorize the max amount, but we'll capture actual amount later
      console.log(`[HOURLY JOB] Authorizing max amount: $${maxAmount} ($${hourlyRate}/hr × ${maxHours} hrs)`);
    } else {
      jobAmount = parseFloat(offer.job.amount || 0);
      maxAmount = jobAmount; // For flat jobs, max = actual
    }
    
    // TIPS ARE NOT INCLUDED IN AUTHORIZATION - They happen after completion
    // Customer fee is 6.5% (no min/max cap)
    const customerFee = jobAmount * 0.065;
    const total = jobAmount + customerFee;

    // Create or update payment record with PREAUTHORIZED status (held in escrow)
    if (existingPayment) {
      // Update existing payment
      existingPayment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          hustlerId: offer.hustlerId,
          amount: jobAmount,
          tip: 0, // Tips happen after completion, not in authorization
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
          tip: 0, // Tips happen after completion, not in authorization
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

    // Check if job has keepOpenUntilAccepted setting - if so, close it now that we accepted
    const jobRequirements = offer.job.requirements || {};
    const shouldAutoClose = jobRequirements.keepOpenUntilAccepted === true;
    
    // Update job with hustler and verification codes
    // Set status to SCHEDULED (not ASSIGNED) - job is scheduled but not started yet
    // Job only becomes active (IN_PROGRESS) when Start Code is entered
    const job = await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'SCHEDULED', // Scheduled, not active yet - waiting for Start Code
        hustlerId: offer.hustlerId,
        startCode,
        startCodeExpiresAt,
        completionCode,
        // If keepOpenUntilAccepted was set, job auto-closes now (status stays ASSIGNED, but we clear the flag)
        ...(shouldAutoClose ? {
          requirements: {
            ...jobRequirements,
            keepOpenUntilAccepted: false, // Clear the flag
          }
        } : {}),
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

    // Create thread for messaging (use upsert to avoid duplicate errors)
    try {
      await prisma.thread.upsert({
        where: { jobId: offer.job.id },
        update: {}, // If exists, don't update
        create: {
          jobId: offer.job.id,
          userAId: req.user.id, // Customer
          userBId: offer.hustlerId, // Hustler
        },
      });
      console.log(`[THREAD] Created thread for job ${offer.job.id} between customer ${req.user.id} and hustler ${offer.hustlerId}`);
    } catch (error) {
      console.error(`[THREAD] Error creating thread for job ${offer.job.id}:`, error);
      // Don't fail offer acceptance if thread creation fails
    }

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

// POST /offers/:id/cancel - Cancel a pending application (Hustler only)
router.post('/:id/cancel', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          include: {
            customer: { select: { id: true, email: true, name: true } },
          },
        },
        hustler: { select: { id: true, email: true, name: true } },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify hustler owns this offer
    if (offer.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only cancel your own applications' });
    }

    // Only allow cancellation if offer is PENDING
    if (offer.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Can only cancel pending applications',
        currentStatus: offer.status 
      });
    }

    // Update offer status to DECLINED (hustler cancelled)
    await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'DECLINED' }
    });

    // Send notification email to customer (non-blocking)
    try {
      const emailService = require('../services/email');
      // Note: You may want to add a specific email for hustler cancellation
      // For now, we'll just log it
      console.log(`[OFFER CANCELLED] Hustler ${req.user.id} cancelled application for job ${offer.job.id}`);
    } catch (emailError) {
      console.error('Error sending cancellation email (non-fatal):', emailError);
    }

    res.json({
      success: true,
      message: 'Application cancelled successfully.',
      offer: {
        id: offer.id,
        status: 'DECLINED',
      },
    });
  } catch (error) {
    console.error('Cancel application error:', error);
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

// POST /offers/:id/negotiate - Negotiate price with hustler (Customer only)
router.post('/:id/negotiate', authenticate, requireRole('CUSTOMER'), [
  body('proposedAmount').isFloat({ min: 0.01 }).withMessage('Proposed amount must be greater than 0'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { proposedAmount } = req.body;
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          include: {
            customer: { select: { id: true, email: true, name: true } },
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
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Verify customer owns the job
    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only negotiate on your own jobs' });
    }

    // Only allow negotiation on pending offers
    if (offer.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Can only negotiate on pending offers',
        currentStatus: offer.status 
      });
    }

    // Update the offer with the new proposed amount
    const updatedOffer = await prisma.offer.update({
      where: { id: req.params.id },
      data: {
        proposedAmount: parseFloat(proposedAmount),
      },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Send notification email to hustler about price negotiation (non-blocking)
    // Note: Email function may not exist yet, so we wrap in try-catch
    try {
      const emailService = require('../services/email');
      if (emailService.sendPriceNegotiationEmail) {
        await emailService.sendPriceNegotiationEmail(
          offer.hustler.email,
          offer.hustler.name,
          offer.job.title,
          parseFloat(proposedAmount),
          offer.job.id
        );
      }
    } catch (emailError) {
      console.error('Error sending price negotiation email (non-fatal):', emailError);
      // Continue - the negotiation is still successful
    }

    res.json({
      success: true,
      message: 'Price negotiation sent to hustler',
      offer: updatedOffer,
    });
  } catch (error) {
    console.error('Negotiate price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:id/hustler-counter - Hustler counter-offers customer's negotiation (HUSTLER only)
router.post('/:id/hustler-counter', authenticate, requireRole('HUSTLER'), [
  body('proposedAmount').isFloat({ min: 0.01 }).withMessage('Proposed amount must be greater than 0'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { proposedAmount } = req.body;
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          include: {
            customer: { select: { id: true, email: true, name: true } },
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
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Verify hustler owns this offer
    if (offer.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only counter-offer on your own offers' });
    }

    // Only allow counter-offer on pending offers
    if (offer.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Can only counter-offer on pending offers',
        currentStatus: offer.status 
      });
    }

    // Update the offer with the new proposed amount (hustler's counter-offer)
    const updatedOffer = await prisma.offer.update({
      where: { id: req.params.id },
      data: {
        proposedAmount: parseFloat(proposedAmount),
      },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Send notification email to customer about counter-offer (non-blocking)
    try {
      const emailService = require('../services/email');
      if (emailService.sendPriceNegotiationEmail) {
        await emailService.sendPriceNegotiationEmail(
          offer.job.customer.email,
          offer.job.customer.name,
          offer.job.title,
          parseFloat(proposedAmount),
          offer.job.id
        );
      }
    } catch (emailError) {
      console.error('Error sending counter-offer email (non-fatal):', emailError);
      // Continue - the counter-offer is still successful
    }

    res.json({
      success: true,
      message: 'Counter-offer sent to customer',
      offer: updatedOffer,
    });
  } catch (error) {
    console.error('Hustler counter-offer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:id/accept-negotiation - Hustler accepts customer's counter-offer (HUSTLER only)
router.post('/:id/accept-negotiation', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        job: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Verify hustler owns this offer
    if (offer.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only accept on your own offers' });
    }

    // Only allow accept on pending offers
    if (offer.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Can only accept negotiation on pending offers',
        currentStatus: offer.status 
      });
    }

    // CRITICAL: Check if job was already accepted by another hustler
    if ((offer.job.status === 'SCHEDULED' || offer.job.status === 'ASSIGNED' || offer.job.status === 'IN_PROGRESS') && 
        offer.job.hustlerId && 
        offer.job.hustlerId !== offer.hustlerId) {
      return res.status(400).json({ 
        error: 'This job has already been accepted by another hustler. The customer accepted a different applicant.',
        jobStatus: offer.job.status,
        acceptedHustlerId: offer.job.hustlerId
      });
    }

    // Check if job is still available (not already accepted/in progress)
    if (offer.job.status !== 'OPEN' && offer.job.status !== 'REQUESTED') {
      if (offer.job.hustlerId && offer.job.hustlerId !== offer.hustlerId) {
        return res.status(400).json({ 
          error: 'This job has already been accepted by another hustler. The customer accepted a different applicant.',
          jobStatus: offer.job.status
        });
      }
      return res.status(400).json({ 
        error: 'Job is no longer available for acceptance',
        jobStatus: offer.job.status 
      });
    }

    // Check if customer has actually countered (proposedAmount should exist)
    if (!offer.proposedAmount) {
      return res.status(400).json({ 
        error: 'No counter-offer found. Customer must suggest a price first.' 
      });
    }

    // CHECK ACTIVE JOBS LIMIT - Hustlers can only have 2 active jobs at once
    const activeJobsCount = await prisma.job.count({
      where: {
        hustlerId: offer.hustlerId,
        status: 'IN_PROGRESS'
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

    // Update offer status to ACCEPTED
    await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'ACCEPTED' },
    });

    // Decline other offers for this job
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
    const startCode = generateCode();
    const completionCode = generateCode();
    
    // Set expiration: 78 hours from now
    const startCodeExpiresAt = new Date();
    startCodeExpiresAt.setHours(startCodeExpiresAt.getHours() + 78);

    // Update job with hustler and move to SCHEDULED (active, ready to start)
    const jobRequirements = offer.job.requirements || {};
    const shouldAutoClose = jobRequirements.keepOpenUntilAccepted === true;

    const updatedJob = await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'SCHEDULED', // Job is now active and scheduled - hustler accepted customer's counter-offer
        hustlerId: offer.hustlerId,
        startCode,
        startCodeExpiresAt,
        completionCode,
        // Update job amount to the negotiated price
        amount: offer.proposedAmount,
        requirements: {
          ...jobRequirements,
          negotiationAccepted: {
            offerId: offer.id,
            acceptedAt: new Date().toISOString(),
            acceptedAmount: offer.proposedAmount?.toString(),
          },
          ...(shouldAutoClose ? {
            keepOpenUntilAccepted: false,
          } : {}),
        },
      },
    });

    // Create or update payment record (use negotiated amount)
    const jobAmount = parseFloat(offer.proposedAmount);
    // TIPS ARE NOT INCLUDED IN AUTHORIZATION - They happen after completion
    // Customer fee is 6.5% (no min/max cap)
    const customerFee = jobAmount * 0.065;
    const total = jobAmount + customerFee;

    let existingPayment = await prisma.payment.findUnique({
      where: { jobId: offer.job.id },
    });

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          hustlerId: offer.hustlerId,
          amount: jobAmount,
          tip: 0, // Tips happen after completion, not in authorization
          feeCustomer: customerFee,
          total,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          jobId: offer.job.id,
          customerId: offer.job.customerId,
          hustlerId: offer.hustlerId,
          amount: jobAmount,
          tip: 0, // Tips happen after completion, not in authorization
          feeCustomer: customerFee,
          feeHustler: 0,
          total,
          status: 'PREAUTHORIZED',
        },
      });
    }

    // Create thread for messaging
    try {
      await prisma.thread.upsert({
        where: { jobId: offer.job.id },
        update: {},
        create: {
          jobId: offer.job.id,
          userAId: offer.job.customerId,
          userBId: offer.hustlerId,
        },
      });
    } catch (error) {
      console.error(`[THREAD] Error creating thread for job ${offer.job.id}:`, error);
    }

    // Send notification email to customer that hustler accepted their price
    try {
      const emailService = require('../services/email');
      if (emailService.sendJobAssignedEmail) {
        await emailService.sendJobAssignedEmail(
          offer.job.customer.email,
          offer.job.customer.name,
          updatedJob.title,
          updatedJob.id,
          offer.hustler.name
        );
      }
    } catch (emailError) {
      console.error('Error sending job assigned email:', emailError);
    }

    res.json({
      success: true,
      message: 'You accepted the customer\'s price. The job is now active and you can start working!',
      job: updatedJob,
      offer: {
        ...offer,
        status: 'ACCEPTED',
      },
      startCode,
      completionCode,
      startCodeExpiresAt,
    });
  } catch (error) {
    console.error('Hustler accept negotiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:id/hustler-cancel - Hustler cancels after being accepted (HUSTLER only)
router.post('/:id/hustler-cancel', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: {
        job: {
          include: {
            customer: { select: { id: true, email: true, name: true } },
            payment: true,
          },
        },
        hustler: { select: { id: true, email: true, name: true } },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Verify hustler owns this offer
    if (offer.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only cancel your own offers' });
    }

    // Only allow cancellation if offer is ACCEPTED
    if (offer.status !== 'ACCEPTED') {
      return res.status(400).json({ 
        error: 'Can only cancel accepted offers',
        currentStatus: offer.status 
      });
    }

    // Allow cancellation if job is SCHEDULED or ASSIGNED (before start code entered)
    // BUSINESS RULE: Hustlers can cancel accepted jobs BEFORE start code is entered
    if (offer.job.status !== 'SCHEDULED' && offer.job.status !== 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Can only cancel scheduled jobs (before start code is entered)',
        jobStatus: offer.job.status 
      });
    }

    // BUSINESS RULE: Cannot cancel after start code is entered - job must be completed
    if (offer.job.startCodeVerified) {
      return res.status(400).json({ 
        error: 'Cannot cancel: Job has already started. Once the start code is entered, the job must be completed.',
        jobStarted: true
      });
    }

    // Update offer status to DECLINED
    await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: 'DECLINED' }
    });

    // Reset job back to OPEN status, clear hustler assignment
    const updatedJob = await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'OPEN',
        hustlerId: null,
        startCode: null,
        startCodeExpiresAt: null,
        completionCode: null,
        startCodeVerified: false,
        completionCodeVerified: false,
      },
    });

    // Payment stays in hold (customer can accept another hustler)

    // Send notification email to customer (non-blocking)
    try {
      const emailService = require('../services/email');
      if (emailService.sendHustlerCancelledEmail) {
        await emailService.sendHustlerCancelledEmail(
          offer.job.customer.email,
          offer.job.customer.name,
          offer.job.title,
          offer.hustler.name,
          offer.job.id
        );
      }
    } catch (emailError) {
      console.error('Error sending cancellation email (non-fatal):', emailError);
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully. The job is now open for other applicants.',
      job: updatedJob,
      offer: {
        id: offer.id,
        status: 'DECLINED',
      },
    });
  } catch (error) {
    console.error('Hustler cancel error:', error);
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


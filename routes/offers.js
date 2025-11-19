const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { createPaymentIntent } = require('../services/stripe');
const { validateTennesseeZip } = require('../services/zipcode');

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

    const offers = await prisma.offer.findMany({
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(offers);
  } catch (error) {
    console.error('List offers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /offers/:jobId - Create an offer (Hustler only)
router.post('/:jobId', authenticate, requireRole('HUSTLER'), async (req, res, next) => {
  // Check email verification before allowing offers
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email verification required',
        message: 'Please verify your email address before applying to jobs. Check your email for a verification code.',
        requiresEmailVerification: true,
      });
    }
  } catch (error) {
    console.error('Email verification check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
  next();
}, [
  body('note').optional().trim().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { jobId } = req.params;
    const { note, proposedAmount } = req.body;

    // REQUIRE STRIPE ACCOUNT - Hustler must have Stripe connected to apply
    // TEMPORARILY DISABLED FOR TESTING - Uncomment to re-enable
    // This prevents customers from getting blocked later
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    // TEMPORARILY DISABLED - Uncomment to re-enable Stripe requirement
    /*
    const hustler = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeAccountId: true, email: true, name: true },
    });

    if (!hustler.stripeAccountId && !skipStripeCheck) {
      return res.status(400).json({ 
        error: 'Stripe account required',
        requiresStripe: true,
        message: 'You must connect your Stripe account before applying to jobs. Go to your Profile to set it up.'
      });
    }
    */
    
    // TEMPORARY: Allow applying without Stripe for testing
    console.log('[TESTING] Allowing job application without Stripe check');

    // Get the job first to check its location
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // PRIORITY 1: Validate that the JOB is in Tennessee (check pickupZip from requirements)
    const jobRequirements = job.requirements || {};
    const jobPickupZip = jobRequirements.pickupZip || '';
    
    if (!jobPickupZip || jobPickupZip.toString().trim() === '') {
      return res.status(400).json({ 
        error: 'This job does not have a valid Tennessee location. Jobs must have a pickup zip code in Tennessee (37000-38999).',
        requiresLocationUpdate: false
      });
    }
    
    const isJobInTennessee = await validateTennesseeZip(jobPickupZip.toString());
    if (!isJobInTennessee) {
      return res.status(400).json({ 
        error: `This job is not in Tennessee. The job's pickup zip code (${jobPickupZip}) is not a valid Tennessee zip code (37000-38999). You can only apply to jobs in Tennessee.`,
        requiresLocationUpdate: false
      });
    }

    // NOTE: We do NOT validate the hustler's profile zip code
    // Hustlers can apply to any job in Tennessee, regardless of where they live
    // The job's pickupZip is what matters - it must be in Tennessee (already validated above)

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
            customer: true,
            hustler: true,
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

    // REQUIRE STRIPE ACCOUNT - Hustler must have Stripe connected to be accepted
    // TEMPORARILY DISABLED FOR TESTING - Remove this comment and uncomment below to re-enable
    // Skip in test mode (when SKIP_STRIPE_CHECK=true)
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    const hustler = await prisma.user.findUnique({
      where: { id: offer.hustlerId },
      select: { stripeAccountId: true, email: true, name: true },
    });

    // TEMPORARILY DISABLED - Uncomment to re-enable Stripe requirement
    /*
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
    */
    
    // In test mode, log that we're skipping the check
    if (skipStripeCheck && !hustler.stripeAccountId) {
      console.log('[TEST MODE] Skipping Stripe account check for hustler:', offer.hustlerId);
    }
    
    // TEMPORARY: Allow accepting without Stripe for testing
    if (!hustler.stripeAccountId) {
      console.log('[TESTING] Allowing offer acceptance without Stripe account for testing');
    }

    // Calculate payment amounts
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25); // Max 25%
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50); // Max $50 tip
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10); // 3% customer fee min $1, max $10
    const total = jobAmount + tipAmount + customerFee;

    // TEMPORARILY BYPASSING STRIPE - Always use test mode logic for testing
    // Create Stripe payment intent (pre-auth) - TEMPORARILY ALWAYS SKIP
    // TEMPORARY: Always bypass Stripe for testing
    const forceTestMode = true; // Set to false to re-enable Stripe
    let paymentIntent;
    if (skipStripeCheck || forceTestMode) {
      // In test mode, create a fake payment intent
      console.log('[TEST MODE] Skipping Stripe payment intent creation');
      paymentIntent = {
        id: `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        client_secret: `pi_test_${Date.now()}_secret`,
        status: 'requires_capture',
        amount: Math.round(total * 100),
      };
    } else {
      paymentIntent = await createPaymentIntent({
        amount: Math.round(total * 100), // Convert to cents
        customerId: req.user.id,
        jobId: offer.job.id,
        metadata: {
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
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

    // Update job with assignment timestamp
    const requirements = offer.job.requirements || {};
    requirements.assignedAt = new Date().toISOString();
    // Generate 4-digit start code for customer to provide to hustler
    if (!requirements.startCode) {
      requirements.startCode = String(Math.floor(1000 + Math.random() * 9000));
      console.log(`Generated start code: ${requirements.startCode} for job ${offer.job.id}`);
    }
    
    const job = await prisma.job.update({
      where: { id: offer.job.id },
      data: {
        status: 'ASSIGNED',
        hustlerId: offer.hustlerId,
        requirements,
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
        feeCustomer: customerFee,
        feeHustler: 0, // Will be calculated on capture (16% of jobAmount)
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


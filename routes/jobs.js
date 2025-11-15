const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { geocodeAddress } = require('../services/mapbox');

const router = express.Router();

// Optional auth middleware
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          roles: true,
          idVerified: true,
        },
      });
      if (user) req.user = user;
    }
    next();
  } catch (error) {
    // If auth fails, continue without user
    next();
  }
};

// POST /jobs - Create a job (Customer only)
router.post('/', authenticate, requireRole('CUSTOMER'), [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('category').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('address').trim().notEmpty(),
  body('date').isISO8601(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('payType').isIn(['flat', 'hourly']),
  body('amount').isFloat({ min: 0 }),
  body('hourlyRate').optional().isFloat({ min: 0 }),
  body('estHours').optional().isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      const errorMessages = errors.array().map(e => `${e.param}: ${e.msg}`).join(', ');
      return res.status(400).json({ 
        error: 'Validation failed: ' + errorMessages,
        details: errors.array() 
      });
    }

    const {
      title,
      category,
      description,
      photos = [],
      address,
      date,
      startTime,
      endTime,
      payType,
      amount,
      hourlyRate,
      estHours,
      teamSize = 1,
      requirements = {},
    } = req.body;

    // Geocode address (with error handling)
    let lat = null, lng = null;
    try {
      const coords = await geocodeAddress(address);
      lat = coords.lat;
      lng = coords.lng;
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
      // Continue without coordinates - address will still be stored
    }

    const job = await prisma.job.create({
      data: {
        customerId: req.user.id,
        title,
        category,
        description,
        photos,
        address,
        lat,
        lng,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        payType,
        amount: parseFloat(amount),
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        estHours: estHours ? parseInt(estHours) : null,
        requirements: {
          ...requirements,
          teamSize: parseInt(teamSize) || 1,
        },
        status: 'OPEN',
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs - List jobs with filters (public, optional auth)
router.get('/', optionalAuth, [
  query('category').optional().trim(),
  query('minPay').optional().isFloat({ min: 0 }),
  query('payType').optional().isIn(['flat', 'hourly']),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('lat').optional().isFloat(),
  query('lng').optional().isFloat(),
  query('radius').optional().isFloat({ min: 0 }), // in miles
  query('zip').optional().trim(),
  query('city').optional().trim(),
  query('status').optional().isIn(['OPEN', 'ASSIGNED', 'COMPLETED_BY_HUSTLER']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      category,
      minPay,
      payType,
      dateFrom,
      dateTo,
      lat,
      lng,
      radius = 25, // default 25 miles
      zip,
      city,
      status = 'OPEN',
      page = 1,
      limit = 20,
    } = req.query;

    const where = {
      status,
    };

    if (category) where.category = category;
    if (payType) where.payType = payType;
    if (minPay) where.amount = { gte: parseFloat(minPay) };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }
    
    // Location filters (zip/city) - filter by customer location
    if (zip || city) {
      const customerWhere = {};
      if (zip) {
        customerWhere.zip = zip;
      }
      if (city) {
        customerWhere.city = { contains: city, mode: 'insensitive' };
      }
      // Note: This requires the customer relation to be included in the query
      // We'll filter client-side if needed, or use a subquery
      // For now, we'll include customer in the query and filter after
    }

    // Distance filter (if lat/lng provided)
    if (lat && lng) {
      // Simple bounding box approximation (for MVP)
      // In production, use PostGIS for proper distance queries
      const latFloat = parseFloat(lat);
      const lngFloat = parseFloat(lng);
      const radiusFloat = parseFloat(radius);
      
      // Approximate: 1 degree lat ≈ 69 miles, 1 degree lng ≈ 69 * cos(lat) miles
      const latDelta = radiusFloat / 69;
      const lngDelta = radiusFloat / (69 * Math.cos(latFloat * Math.PI / 180));
      
      where.lat = { gte: latFloat - latDelta, lte: latFloat + latDelta };
      where.lng = { gte: lngFloat - lngDelta, lte: lngFloat + lngDelta };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Auto-remove jobs where customer hasn't been active in 72 hours
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    await prisma.job.updateMany({
      where: {
        status: 'OPEN',
        updatedAt: { lt: seventyTwoHoursAgo },
        hustlerId: null, // Only remove unassigned jobs
      },
      data: {
        status: 'CANCELLED',
      },
    });
    
    // Auto-completion: If job date has passed and job is ASSIGNED, auto-complete after 24 hours
    // This ensures hustlers get paid even if they forget to mark complete
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const jobsToAutoComplete = await prisma.job.findMany({
      where: {
        status: 'ASSIGNED',
        date: { lt: twentyFourHoursAgo }, // Job date was more than 24 hours ago
        hustlerId: { not: null },
        payment: {
          status: 'PREAUTHORIZED', // Payment is pre-authorized
        },
      },
      include: {
        payment: true,
        customer: {
          select: {
            email: true,
            name: true,
          },
        },
        hustler: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    
    // Auto-complete these jobs and process payment
    for (const job of jobsToAutoComplete) {
      try {
        // Mark as completed by hustler (auto)
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'COMPLETED_BY_HUSTLER' },
        });
        
        // Auto-confirm and capture payment (since customer already paid)
        const { capturePaymentIntent } = require('../services/stripe');
        await capturePaymentIntent(job.payment.providerId);
        
        // Calculate hustler fee (16% platform fee)
        const hustlerFee = Number(job.payment.amount) * 0.16;
        const hustlerAmount = Number(job.payment.amount) - hustlerFee;
        
        // Update payment
        await prisma.payment.update({
          where: { id: job.payment.id },
          data: {
            status: 'CAPTURED',
            feeHustler: hustlerFee,
          },
        });
        
        // Update job to PAID
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'PAID' },
        });
        
        // Send email to hustler
        const { sendPaymentCompleteEmail } = require('../services/email');
        await sendPaymentCompleteEmail(
          job.hustler.email,
          job.hustler.name,
          job.title,
          hustlerAmount
        );
        
        // Send email to customer
        const { sendAutoCompleteEmail } = require('../services/email');
        await sendAutoCompleteEmail(
          job.customer.email,
          job.customer.name,
          job.title
        );
      } catch (error) {
        console.error(`Error auto-completing job ${job.id}:`, error);
        // Continue with other jobs even if one fails
      }
    }

    let [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              username: true,
              ratingAvg: true,
              ratingCount: true,
              city: true,
              zip: true,
            },
          },
          _count: {
            select: { offers: true },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);
    
    // Filter by location (zip/city) if provided (client-side filtering)
    if (zip || city) {
      jobs = jobs.filter(job => {
        if (!job.customer) return false;
        if (zip && job.customer.zip !== zip) return false;
        if (city && !job.customer.city?.toLowerCase().includes(city.toLowerCase())) return false;
        return true;
      });
      total = jobs.length; // Update total after filtering
    }

    res.json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs/:id (public, optional auth)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // Optional auth - if user is logged in, show more details
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [];

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            city: true,
            zip: true,
            ratingAvg: true,
            ratingCount: true,
            photoUrl: true,
          },
        },
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
        offers: userId ? {
          where: userRoles.includes('HUSTLER') ? { hustlerId: userId } : undefined,
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
        } : false,
        _count: {
          select: { offers: true },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/cancel
router.post('/:id/cancel', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        payment: true,
        hustler: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Job already cancelled' });
    }

    // Protection: Can't cancel after job date has passed (prevents last-minute cancellations)
    const now = new Date();
    const jobDate = new Date(job.date);
    if (jobDate <= now) {
      return res.status(400).json({ 
        error: 'Cannot cancel job after the scheduled date. Please contact support if there is an issue.' 
      });
    }

    // Protection: Can't cancel if hustler has already started (within 2 hours of start time)
    const startTime = new Date(job.startTime);
    const twoHoursBeforeStart = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
    if (now >= twoHoursBeforeStart && job.hustlerId) {
      return res.status(400).json({ 
        error: 'Cannot cancel job within 2 hours of start time. Please contact support if there is an emergency.' 
      });
    }

    // Handle refunds based on payment status
    if (job.payment) {
      const { voidPaymentIntent, createRefund } = require('../services/stripe');
      
      if (job.payment.status === 'PREAUTHORIZED') {
        // Payment is pre-authorized but not captured - void it
        try {
          await voidPaymentIntent(job.payment.providerId);
          await prisma.payment.update({
            where: { id: job.payment.id },
            data: { status: 'VOIDED' },
          });
        } catch (error) {
          console.error('Error voiding payment:', error);
          // Continue with cancellation even if void fails
        }
      } else if (job.payment.status === 'CAPTURED') {
        // Payment was captured - issue full refund
        try {
          const refundAmount = Math.round(Number(job.payment.total) * 100); // Convert to cents
          await createRefund(job.payment.providerId, refundAmount);
          await prisma.payment.update({
            where: { id: job.payment.id },
            data: { status: 'REFUNDED' },
          });
          
          // Send email to customer about refund
          const { sendRefundEmail } = require('../services/email');
          await sendRefundEmail(
            req.user.email,
            req.user.name,
            job.title,
            Number(job.payment.total)
          );
        } catch (error) {
          console.error('Error processing refund:', error);
          // Continue with cancellation even if refund fails
        }
      }
    }

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/complete - Mark job complete (Hustler only)
router.post('/:id/complete', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        payment: true,
        customer: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Job is not assigned' });
    }

    // Protection: Can't mark complete before job date (prevents premature completion scams)
    const now = new Date();
    const jobDate = new Date(job.date);
    const oneDayBefore = new Date(jobDate.getTime() - 24 * 60 * 60 * 1000);
    
    if (now < oneDayBefore) {
      return res.status(400).json({ 
        error: 'Cannot mark job complete before the scheduled date' 
      });
    }

    // Generate verification code (6-digit code)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update job with verification code and status
    const requirements = job.requirements || {};
    requirements.verificationCode = verificationCode;
    requirements.completedAt = new Date().toISOString();
    
    // Only store photos if provided (optional)
    const { completionPhotos } = req.body;
    if (completionPhotos && Array.isArray(completionPhotos) && completionPhotos.length > 0) {
      requirements.completionPhotos = completionPhotos;
    }
    
    const updateData = { 
      status: 'COMPLETED_BY_HUSTLER',
      requirements,
    };

    await prisma.job.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Fetch updated job to return
    const updated = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    // Send email to customer with verification code
    const { sendJobCompleteEmail } = require('../services/email');
    await sendJobCompleteEmail(
      job.customer.email,
      job.customer.name,
      job.title,
      verificationCode
    );

    // Return job with verification code for hustler to see
    res.json({
      ...updated,
      requirements: updateData.requirements,
      verificationCode: verificationCode, // Include in response for frontend
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/confirm-complete - Customer confirms job completion (Customer only)
router.post('/:id/confirm-complete', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        payment: true,
        hustler: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'COMPLETED_BY_HUSTLER') {
      return res.status(400).json({ error: 'Job has not been marked complete by hustler yet' });
    }

    // Verify the verification code
    const { verificationCode } = req.body;
    const jobVerificationCode = job.requirements?.verificationCode;
    
    if (!verificationCode || verificationCode !== jobVerificationCode) {
      return res.status(400).json({ 
        error: 'Invalid verification code. Please enter the code provided by the hustler.' 
      });
    }

    // Check test mode once at the top
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';

    // Update job status to AWAITING_CUSTOMER_CONFIRM (or PAID if payment already captured)
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'AWAITING_CUSTOMER_CONFIRM' },
    });

    // If payment exists and is pre-authorized, capture it
    if (job.payment && job.payment.status === 'PREAUTHORIZED') {
      if (skipStripeCheck) {
        console.log('[TEST MODE] Skipping Stripe payment capture');
      } else {
        const { capturePaymentIntent } = require('../services/stripe');
        await capturePaymentIntent(job.payment.providerId);
      }

      // Calculate hustler fee (16% platform fee)
      const hustlerFee = Number(job.payment.amount) * 0.16;
      const hustlerAmount = Number(job.payment.amount) - hustlerFee;

      // Update payment
      await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          status: 'CAPTURED',
          feeHustler: hustlerFee,
        },
      });

      // Update job to PAID
      await prisma.job.update({
        where: { id: req.params.id },
        data: { status: 'PAID' },
      });

      // Transfer payment to hustler via Stripe Connect (if they have account set up)
      // Skip in test mode
      if (!skipStripeCheck) {
        try {
          const hustler = await prisma.user.findUnique({
            where: { id: job.hustlerId },
          });

          if (hustler && hustler.stripeAccountId) {
            const { transferToHustler } = require('../services/stripe');
            await transferToHustler(
              hustler.stripeAccountId,
              hustlerAmount,
              job.id,
              `Payment for job: ${job.title}`
            );
          } else {
            console.log(`Hustler ${job.hustlerId} does not have Stripe Connect account set up yet`);
            // In production, you might want to queue this for later or notify the hustler
          }
        } catch (transferError) {
          console.error('Error transferring payment to hustler:', transferError);
          // Don't fail the confirmation if transfer fails - can retry later
        }
      }

      // Send email to hustler
      const { sendPaymentCompleteEmail } = require('../services/email');
      await sendPaymentCompleteEmail(
        job.hustler.email,
        job.hustler.name,
        job.title,
        hustlerAmount
      );
      
      // Return updated job with payment info
      const finalJob = await prisma.job.findUnique({
        where: { id: req.params.id },
        include: {
          payment: true,
          hustler: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      
      return res.json({
        ...finalJob,
        message: 'Job confirmed and payment released to hustler',
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Confirm complete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

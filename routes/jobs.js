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

// GET /jobs/my-jobs - Get jobs for the current user (optimized for profile page)
router.get('/my-jobs', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50 } = req.query;
    
    // Build where clause for user's jobs
    const where = {
      OR: [
        { customerId: userId },
        { hustlerId: userId },
      ],
    };
    
    // Filter by status if provided
    if (status) {
      where.status = status;
    }
    
    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
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
        _count: {
          select: {
            offers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent jobs first
      take: parseInt(limit, 10),
    });
    
    // Filter out archived jobs (unless includeArchived is true)
    let filteredJobs = jobs;
    if (!req.query.includeArchived) {
      filteredJobs = jobs.filter(job => {
        const requirements = job.requirements || {};
        return requirements.archived !== true;
      });
    }
    
    // Log performance for debugging
    console.log(`[Jobs] Fetched ${filteredJobs.length} jobs for user in ${Date.now() - (req.startTime || Date.now())}ms`);
    
    res.json(filteredJobs);
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs - Create a job (Customer only)
router.post('/', authenticate, requireRole('CUSTOMER'), async (req, res, next) => {
  // Check email verification before allowing job posting
  // TEMPORARILY DISABLED: Email verification field doesn't exist in production database yet
  // TODO: Re-enable after running migration to add emailVerified field
  try {
    if (!req.user || !req.user.id) {
      console.error('[POST /jobs] req.user is missing:', req.user);
      return res.status(401).json({ error: 'Unauthorized - user not found' });
    }

    // Check if emailVerified field exists in schema (skip check if it doesn't exist)
    const emailVerificationRequired = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    
    if (emailVerificationRequired) {
      try {
        // Try to check email verification - if field doesn't exist, this will fail gracefully
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          // Don't select specific fields - get all and check if emailVerified exists
        });

        if (!user) {
          console.error('[POST /jobs] User not found in database:', req.user.id);
          return res.status(401).json({ error: 'User not found' });
        }

        // Check if emailVerified exists and is false
        if (user.emailVerified !== undefined && !user.emailVerified) {
          return res.status(403).json({ 
            error: 'Email verification required',
            message: 'Please verify your email address before posting jobs. Check your email for a verification code.',
            requiresEmailVerification: true,
          });
        }
      } catch (schemaError) {
        // If emailVerified field doesn't exist, log warning and continue
        if (schemaError.message && schemaError.message.includes('emailVerified')) {
          console.warn('[POST /jobs] emailVerified field not found in schema, skipping verification check');
          // Continue without email verification check
        } else {
          throw schemaError; // Re-throw other errors
        }
      }
    }
  } catch (error) {
    console.error('[POST /jobs] Email verification check error:', error);
    console.error('[POST /jobs] Error details:', error.message, error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    });
  }
  next();
}, [
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

    // BUSINESS RULE: Hustler max 2 active jobs
    // Check if user is a Hustler and count their active jobs
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { roles: true },
    });
    
    const isHustler = user && user.roles && user.roles.includes('HUSTLER');
    if (isHustler) {
      const activeJobsCount = await prisma.job.count({
        where: {
          hustlerId: req.user.id,
          status: {
            in: ['ASSIGNED', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM'],
          },
        },
      });
      
      if (activeJobsCount >= 2) {
        return res.status(400).json({ 
          error: 'You can only have 2 active jobs at a time. Please complete or cancel an existing job before posting a new one.',
          field: 'activeJobs'
        });
      }
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
      recurrenceType,
      recurrenceEndDate,
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

    // Calculate next recurrence date if recurring
    let nextRecurrenceDate = null;
    if (recurrenceType && (recurrenceType === 'weekly' || recurrenceType === 'monthly')) {
      const baseDate = new Date(date);
      if (recurrenceType === 'weekly') {
        nextRecurrenceDate = new Date(baseDate);
        nextRecurrenceDate.setDate(nextRecurrenceDate.getDate() + 7);
      } else if (recurrenceType === 'monthly') {
        nextRecurrenceDate = new Date(baseDate);
        nextRecurrenceDate.setMonth(nextRecurrenceDate.getMonth() + 1);
      }
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
        // Recurring job fields
        recurrenceType: recurrenceType || null,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        recurrencePaused: false,
        nextRecurrenceDate: nextRecurrenceDate,
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
], async (req, res) => {
  try {
    const { status, category, lat, lng, radius = 25, zip, city, page = 1, limit = 20, sortBy = 'newest', search } = req.query;
    const userId = req.user?.id;

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await prisma.job.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            total: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
        hustler: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
    
    // Calculate distance for each job and add to response
    let filteredJobs = jobs;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius) || 25;
    
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      filteredJobs = filteredJobs.map(job => {
        // Only calculate distance if job has valid coordinates
        let distance = null;
        if (job.lat && job.lng && !isNaN(job.lat) && !isNaN(job.lng)) {
          try {
            distance = calculateDistance(userLat, userLng, job.lat, job.lng);
            
            // Validate distance is reasonable (not NaN or Infinity)
            if (isNaN(distance) || !isFinite(distance)) {
              distance = null;
            }
          } catch (error) {
            console.warn(`[Jobs] Error calculating distance for job ${job.id}:`, error.message);
            distance = null;
          }
        }
        
        // Filter out jobs beyond radius (double-check, since bounding box is approximate)
        if (distance !== null && distance > searchRadius) {
          return null; // Will be filtered out
        }
        
        return {
          ...job,
          distance,
          distanceFormatted: formatDistance(distance),
        };
      }).filter(job => job !== null); // Remove jobs beyond radius
      
      // Sort by newest first (default) or by distance/pay
      if (sortBy === 'newest' || !sortBy) {
        // Default: Newest first (like major apps)
        filteredJobs.sort((a, b) => {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      } else if (sortBy === 'distance') {
        // Sort by distance (closest first)
        filteredJobs.sort((a, b) => {
          if (a.distance === null && b.distance === null) {
            // Both have no distance - sort by creation date (newest first)
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          }
          if (a.distance === null) return 1; // Jobs without distance go to end
          if (b.distance === null) return -1;
          return a.distance - b.distance; // Closest first
        });
      } else if (sortBy === 'pay') {
        // Sort by highest pay first
        filteredJobs.sort((a, b) => {
          const aAmount = Number(a.amount || 0);
          const bAmount = Number(b.amount || 0);
          if (aAmount === bAmount) {
            // If same pay, sort by newest
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          }
          return bAmount - aAmount; // Highest first
        });
      }
    } else {
      // No location - just add null distances and sort by date
      filteredJobs = filteredJobs.map(job => ({
        ...job,
        distance: null,
        distanceFormatted: 'Distance unknown',
      }));
      
      // Sort by newest first (default) or by pay if requested
      if (sortBy === 'pay') {
        filteredJobs.sort((a, b) => {
          const aAmount = Number(a.amount || 0);
          const bAmount = Number(b.amount || 0);
          if (aAmount === bAmount) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          }
          return bAmount - aAmount;
        });
      } else {
        // Default: Newest first
        filteredJobs.sort((a, b) => {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      }
    }

    // Return jobs with pagination
    res.json({
      jobs: filteredJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredJobs.length,
        hasMore: filteredJobs.length === parseInt(limit)
      }
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

    // BUSINESS RULE: Customer cannot delete after Hustler is assigned (ASSIGNED)
    if (job.status === 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Cannot cancel job that is in progress. The hustler is already on the way or working. Please contact support if there is an emergency.' 
      });
    }
    
    // Protection: Can't cancel if hustler has already started (within 2 hours of start time)
    const startTime = new Date(job.startTime);
    const twoHoursBeforeStart = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
    if (now >= twoHoursBeforeStart && job.hustlerId && job.status === 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Cannot cancel job within 2 hours of start time when hustler is assigned. Please contact support if there is an emergency.' 
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
          data: { 
            status: 'VOIDED',
            refundReason: 'Job cancelled - payment voided',
          },
        });

        // Log audit
        await prisma.auditLog.create({
          data: {
            actorId: req.user.id,
            actionType: 'VOID',
            resourceType: 'PAYMENT',
            resourceId: job.payment.id,
            details: {
              reason: 'Job cancelled - payment voided',
              jobId: job.id,
            },
            ipAddress: req.ip,
          },
        }).catch(err => console.error('Error creating audit log:', err));
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
          data: { 
            status: 'REFUNDED',
            refundAmount: Number(job.payment.total),
            refundReason: 'Job cancelled by customer',
          },
        });

        // Log audit
        await prisma.auditLog.create({
          data: {
            actorId: req.user.id,
            actionType: 'REFUND',
            resourceType: 'PAYMENT',
            resourceId: job.payment.id,
            details: {
              amount: Number(job.payment.total),
              reason: 'Job cancelled by customer',
              jobId: job.id,
            },
            ipAddress: req.ip,
          },
        }).catch(err => console.error('Error creating audit log:', err));
        
        // Send email to customer about refund
        const { sendRefundEmail, sendAdminRefundNotification } = require('../services/email');
        await sendRefundEmail(
          req.user.email,
          req.user.name,
          job.title,
          Number(job.payment.total)
        );

        // Send admin notification
        try {
          const payment = await prisma.payment.findUnique({
            where: { id: job.payment.id },
            include: { customer: { select: { id: true, email: true, name: true } }, hustler: { select: { id: true, email: true, name: true } }, job: true },
          });
          await sendAdminRefundNotification(
            payment,
            Number(job.payment.total),
            'Job cancelled by customer',
            req.user.name
          );
        } catch (adminError) {
          console.error('Error sending admin refund notification:', adminError);
        }
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

    
    if (!verificationCode || verificationCode !== jobVerificationCode) {
      return res.status(400).json({ 
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
          // Stripe transfer logic would go here
        } catch (stripeError) {
          console.error('Stripe transfer error:', stripeError);
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

// DELETE /jobs/:id - Delete a job (Customer only, only if OPEN)
router.delete('/:id', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        offers: true,
        payment: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own jobs' });
    }

    if (job.status !== 'OPEN') {
      return res.status(400).json({ 
        error: 'Can only delete open jobs that have not been assigned',
        message: `Job status is ${job.status}. Only OPEN jobs can be deleted.`
      });
    }

    if (job.offers && job.offers.some(o => o.status === 'ACCEPTED')) {
      return res.status(400).json({ 
        error: 'Cannot delete job with accepted offer',
        message: 'This job has an accepted offer and cannot be deleted.'
      });
    }

    // Delete the job (cascade will handle offers, threads, etc.)
    await prisma.job.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

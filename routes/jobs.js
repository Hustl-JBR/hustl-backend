const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { geocodeAddress } = require('../services/mapbox');

const router = express.Router();

// GET /jobs/mapbox-token - Get Mapbox token for frontend (public endpoint)
router.get('/mapbox-token', (req, res) => {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return res.status(404).json({ error: 'Mapbox token not configured' });
  }
  // Return only the public token (safe to expose)
  res.json({ token });
});

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

// GET /jobs/user-posted - Get jobs posted by the current user (Customer only)
router.get('/user-posted', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    const jobs = await prisma.job.findMany({
      where: {
        customerId: userId,
        status: {
          notIn: ['PAID', 'CANCELLED', 'EXPIRED', 'ASSIGNED', 'SCHEDULED']
        },
        // Exclude jobs where completion code has been verified (these are completed)
        completionCodeVerified: false,
        // Also exclude jobs where expiresAt has passed (even if status is still OPEN)
        AND: [
          {
            OR: [
              { expiresAt: null }, // Jobs without expiration
              { expiresAt: { gt: now } } // Jobs that haven't expired yet
            ]
          }
        ]
      },
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
            ratingAvg: true,
            ratingCount: true,
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
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(jobs);
  } catch (error) {
    console.error('Get user posted jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs/active - Get active jobs for the current user (both customer and hustler)
router.get('/active', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[GET /jobs/active] Fetching active jobs for user: ${userId}`);
    
    // Active jobs are:
    // 1. SCHEDULED - Hustler accepted, can message, waiting for Start Code (does NOT count toward 2-job limit)
    // 2. IN_PROGRESS - Start code verified, job actively being worked on (DOES count toward 2-job limit)
    // Note: COMPLETED_BY_HUSTLER and AWAITING_CUSTOMER_CONFIRM are intermediate states
    // that should move to Completed Jobs once completion code is verified
    // Also include ASSIGNED for backwards compatibility during migration
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { customerId: userId },
          { hustlerId: userId }
        ],
        status: {
          in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM']
        },
        // Exclude jobs where completion code has been verified (these are completed)
        completionCodeVerified: false
      },
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
            ratingAvg: true,
            ratingCount: true,
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
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`[GET /jobs/active] Found ${jobs.length} active jobs for user ${userId}`);
    res.json(jobs);
  } catch (error) {
    console.error('[GET /jobs/active] Error:', error);
    console.error('[GET /jobs/active] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      userId: req.user?.id
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Failed to fetch active jobs'
    });
  }
});

// GET /jobs/completed - Get completed jobs for the current user
router.get('/completed', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Only show jobs that are truly completed:
    // 1. Status is PAID (escrow released) OR COMPLETED_BY_HUSTLER with completion code verified
    // 2. completionCodeVerified is true (completion code submitted)
    // Note: Payment status check is optional - jobs can be completed even if payment processing is delayed
    const jobs = await prisma.job.findMany({
      where: {
        AND: [
          {
            OR: [
              { customerId: userId },
              { hustlerId: userId }
            ]
          },
          {
            OR: [
              { 
                status: 'PAID',
                completionCodeVerified: true
              },
              { 
                status: 'COMPLETED_BY_HUSTLER',
                completionCodeVerified: true
              }
            ]
          }
        ]
      },
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
            ratingAvg: true,
            ratingCount: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
        reviews: {
          select: {
            id: true,
            reviewerId: true,
            revieweeId: true,
            stars: true,
            text: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    // Add empty reviews array for frontend compatibility
    const jobsWithReviews = jobs.map(job => ({
      ...job,
      reviews: []
    }));
    
    res.json(jobsWithReviews);
  } catch (error) {
    console.error('Get completed jobs error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /jobs - Create a job (Customer only)
router.post('/', authenticate, requireRole('CUSTOMER'), async (req, res, next) => {
  // Check email verification before allowing job posting (controlled by env var)
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
      // BUSINESS RULE: Hustlers can only have ONE job in progress at a time
      // A job is only "in progress" when start code is entered (status = IN_PROGRESS)
      // SCHEDULED/ASSIGNED jobs (waiting for start code) do NOT count toward this limit
      const activeJobsCount = await prisma.job.count({
        where: {
          hustlerId: req.user.id,
          status: 'IN_PROGRESS', // Only jobs where start code has been entered
        },
      });
      
      if (activeJobsCount >= 1) {
        return res.status(400).json({ 
          error: 'You can only have one job in progress at a time. Complete your current job before starting another.',
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
      keepActiveFor, // Days to keep job active (1, 3, 7, 14, 30)
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

    // Calculate expiration date based on keepActiveFor (days)
    // Default to 3 days if not specified
    const days = keepActiveFor ? parseInt(keepActiveFor) : 3;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    expiresAt.setHours(23, 59, 59, 999); // End of day in UTC

    // Get preferred time from request (morning, afternoon, evening, anytime)
    const preferredTime = req.body.preferredTime || requirements.preferredTime || 'anytime';

    // Build job data object
    const jobData = {
      customerId: req.user.id,
      title,
      category,
      description,
      photos: Array.isArray(photos) ? photos : [],
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
      expiresAt: expiresAt, // Store as DateTime field (UTC)
      requirements: {
        ...requirements,
        teamSize: parseInt(teamSize) || 1,
        keepActiveFor: keepActiveFor ? parseInt(keepActiveFor) : null,
        expiresAt: expiresAt.toISOString(), // Also keep in requirements for backward compatibility
        preferredTime: preferredTime, // morning, afternoon, evening, anytime
      },
      status: 'OPEN',
      recurrencePaused: false,
    };
    
    // Only add recurrence fields if they exist
    if (recurrenceType) {
      jobData.recurrenceType = recurrenceType;
    }
    if (recurrenceEndDate) {
      jobData.recurrenceEndDate = new Date(recurrenceEndDate);
    }
    if (nextRecurrenceDate) {
      jobData.nextRecurrenceDate = nextRecurrenceDate;
    }
    
    console.log('[POST /jobs] Creating job with data:', JSON.stringify(jobData, null, 2));
    
    // Calculate payment amounts (will be required when accepting an offer)
    const jobAmount = parseFloat(amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25); // Max 25%
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50); // Max $50 tip
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10); // 3% customer fee min $1, max $10
    const total = jobAmount + tipAmount + customerFee;

    // NO PAYMENT REQUIRED UPFRONT - Jobs can be posted for free
    // Payment will be required when accepting an offer (industry standard)
    // This allows customers to:
    // 1. Post jobs without paying (lower barrier to entry)
    // 2. Compare offers before committing
    // 3. Payment is still protected (held in escrow when accepting)

    // Create job WITHOUT payment (payment created when accepting offer)
    const job = await prisma.job.create({
      data: jobData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            ratingAvg: true,
            ratingCount: true,
          },
        },
      },
    });

    // Send job posting success email
    try {
      const { sendJobPostedEmail } = require('../services/email');
      await sendJobPostedEmail(
        job.customer.email,
        job.customer.name,
        job.title,
        job.id,
        job.date,
        job.amount,
        job.payType,
        job.hourlyRate,
        job.estHours
      );
    } catch (emailError) {
      console.error('[POST /jobs] Error sending job posted email:', emailError);
      // Don't fail job creation if email fails
    }

    // Store payment amounts in job metadata for later use when accepting offer
    // Payment will be created when customer accepts an offer

    res.status(201).json({
      ...job,
      paymentAmounts: {
        amount: jobAmount,
        tip: tipAmount,
        fee: customerFee,
        total: total,
      },
      message: 'Job posted successfully! Hustlers nearby will begin applying soon.',
    });
  } catch (error) {
    console.error('Create job error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('User ID:', req.user?.id);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    
    // Exclude expired jobs from browse (unless specifically requesting expired status)
    // Also exclude jobs where expiresAt has passed (even if status is still OPEN)
    if (!status || status !== 'EXPIRED') {
      const now = new Date();
      // Exclude EXPIRED status
      where.status = {
        not: 'EXPIRED'
      };
      // Also check expiresAt field - exclude jobs that have expired
      where.AND = [
        {
          OR: [
            { expiresAt: null }, // Jobs without expiration
            { expiresAt: { gt: now } } // Jobs that haven't expired yet
          ]
        }
      ];
    } else if (status === 'EXPIRED') {
      // If explicitly requesting EXPIRED, show all expired jobs
      where.status = 'EXPIRED';
    }
    
    // Filter by ZIP code if provided (searches in address field)
    if (zip && zip.trim().length > 0) {
      where.address = {
        contains: zip.trim(),
        mode: 'insensitive'
      };
    }

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
    const { keepOpenUntilAccepted } = req.body || {};
    
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

    // Check if this is just updating the setting (not actually canceling)
    const justUpdatingSetting = req.body.justUpdatingSetting === true;
    
    // If justUpdatingSetting is true, update the requirements without canceling
    if (justUpdatingSetting) {
      const requirements = job.requirements || {};
      
      if (keepOpenUntilAccepted === true) {
        // Setting it to true
        requirements.keepOpenUntilAccepted = true;
      } else {
        // Setting it to false - remove the setting
        delete requirements.keepOpenUntilAccepted;
      }
      
      const updated = await prisma.job.update({
        where: { id: req.params.id },
        data: {
          requirements: requirements,
        },
      });
      
      return res.json({
        ...updated,
        keepOpenUntilAccepted: keepOpenUntilAccepted === true,
        message: keepOpenUntilAccepted 
          ? 'Job will automatically close when you assign a hustler'
          : 'Setting removed. Job will stay open until manually cancelled.',
      });
    }
    
    // If keepOpenUntilAccepted is true (but not justUpdatingSetting), just update the job requirements
    // Don't actually cancel - job will auto-close when hustler is assigned
    if (keepOpenUntilAccepted === true) {
      const requirements = job.requirements || {};
      requirements.keepOpenUntilAccepted = true;
      
      const updated = await prisma.job.update({
        where: { id: req.params.id },
        data: {
          requirements: requirements,
        },
      });
      
      return res.json({
        ...updated,
        keepOpenUntilAccepted: true,
        message: 'Job will automatically close when you assign a hustler',
      });
    }

    // BUSINESS RULE: Customer cannot cancel after start code is entered
    // Customers can cancel OPEN/REQUESTED jobs, and SCHEDULED/ASSIGNED jobs (before start code)
    // But once start code is entered (IN_PROGRESS), job must be completed
    if (job.startCodeVerified || job.status === 'IN_PROGRESS' || 
        job.status === 'COMPLETED_BY_HUSTLER' || job.status === 'AWAITING_CUSTOMER_CONFIRM' ||
        job.status === 'PAID') {
      return res.status(400).json({ 
        error: 'Cannot cancel job that is in progress. Once the start code is entered, the job must be completed. Please contact support if there is an emergency.' 
      });
    }
    
    // For OPEN jobs, allow cancellation but warn if job date has passed
    const now = new Date();
    const jobDate = new Date(job.date);
    if (job.status === 'OPEN' && jobDate <= now) {
      // Still allow cancellation for OPEN jobs, just log it
      console.warn(`[JOB CANCEL] Job ${job.id} cancelled after scheduled date by customer ${req.user.id}`);
    }
    
    // Protection: Can't cancel if hustler has already started (within 2 hours of start time)
    // This is only relevant if status is ASSIGNED, which we already check above

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

// PATCH /jobs/:id - Update a job (Customer only, only for OPEN jobs)
router.patch('/:id', authenticate, requireRole('CUSTOMER'), [
  body('title').optional().trim().isLength({ max: 200 }),
  body('category').optional().trim(),
  body('description').optional().trim(),
  body('address').optional().trim(),
  body('date').optional().isISO8601(),
  body('startTime').optional().isISO8601(),
  body('endTime').optional().isISO8601(),
  body('payType').optional().isIn(['flat', 'hourly']),
  body('amount').optional().isFloat({ min: 0 }),
  body('hourlyRate').optional().isFloat({ min: 0 }),
  body('estHours').optional().isInt({ min: 1 }),
  body('teamSize').optional().isInt({ min: 0, max: 20 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { payment: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only allow editing OPEN jobs
    if (job.status !== 'OPEN') {
      return res.status(400).json({ 
        error: 'Can only edit jobs that are currently open' 
      });
    }

    // Build update data
    const updateData = {};
    const {
      title,
      category,
      description,
      address,
      date,
      startTime,
      endTime,
      payType,
      amount,
      hourlyRate,
      estHours,
      teamSize,
      keepActiveFor,
      requirements
    } = req.body;

    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    if (date !== undefined) updateData.date = new Date(date);
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (payType !== undefined) updateData.payType = payType;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (hourlyRate !== undefined) {
      updateData.hourlyRate = hourlyRate ? parseFloat(hourlyRate) : null;
    }
    if (estHours !== undefined) {
      updateData.estHours = estHours ? parseInt(estHours) : null;
    }
    // teamSize is stored in requirements, not as a direct field
    // We'll handle it in the requirements merge below

    // Handle requirements merge
    if (requirements !== undefined) {
      const existingRequirements = job.requirements || {};
      // Deep merge to preserve nested properties
      updateData.requirements = {
        ...existingRequirements,
        ...requirements
      };
    }
    
    // Handle teamSize - it's stored in requirements, not as a direct field
    if (teamSize !== undefined) {
      const existingRequirements = updateData.requirements || job.requirements || {};
      updateData.requirements = {
        ...existingRequirements,
        teamSize: parseInt(teamSize) || 1
      };
    }

    // Handle keepActiveFor - recalculate expiration
    if (keepActiveFor !== undefined) {
      const days = parseInt(keepActiveFor) || 3;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      expiresAt.setHours(23, 59, 59, 999); // End of day in UTC
      
      // Set expiresAt field (new way)
      updateData.expiresAt = expiresAt;
      
      // Get existing requirements (either from updateData or job)
      const existingRequirements = updateData.requirements || job.requirements || {};
      updateData.requirements = {
        ...existingRequirements,
        keepActiveFor: days,
        expiresAt: expiresAt.toISOString() // Also keep in requirements for backward compatibility
      };
    }
    
    // Log update data for debugging
    console.log('[PATCH /jobs/:id] Update data:', JSON.stringify(updateData, null, 2));

    // Geocode address if it changed
    if (address && address !== job.address) {
      try {
        const coords = await geocodeAddress(address);
        updateData.lat = coords.lat;
        updateData.lng = coords.lng;
      } catch (geocodeError) {
        console.error('Geocoding error during edit:', geocodeError);
        // Continue without coordinates
      }
    }

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: updateData,
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
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update job error:', error);
    console.error('Update job error stack:', error.stack);
    console.error('Update job error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /jobs/:id/close - Close a job (Customer only)
router.post('/:id/close', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only allow closing OPEN jobs
    if (job.status !== 'OPEN') {
      return res.status(400).json({ error: 'Job can only be closed if it is currently open' });
    }

    // Update job status to CANCELLED
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Close job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/repost - Repost a closed/cancelled job (Customer only)
router.post('/:id/repost', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only allow reposting if job is CANCELLED or EXPIRED
    if (job.status !== 'CANCELLED' && job.status !== 'EXPIRED') {
      return res.status(400).json({ error: 'Job can only be reposted if it was cancelled or expired' });
    }

    // Create a new job with the same details
    const repostedJob = await prisma.job.create({
      data: {
        customerId: job.customerId,
        title: job.title,
        category: job.category,
        description: job.description,
        photos: job.photos,
        address: job.address,
        lat: job.lat,
        lng: job.lng,
        date: job.date,
        startTime: job.startTime,
        endTime: job.endTime,
        payType: job.payType,
        amount: job.amount,
        hourlyRate: job.hourlyRate,
        estHours: job.estHours,
        teamSize: job.teamSize,
        requirements: job.requirements,
        status: 'OPEN',
      },
      include: {
        customer: { select: { id: true, name: true, username: true, photoUrl: true } },
      },
    });

    res.json(repostedJob);
  } catch (error) {
    console.error('Repost job error:', error);
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

    // Allow SCHEDULED or ASSIGNED (for backwards compatibility during migration)
    if (job.status !== 'SCHEDULED' && job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Job is not scheduled or assigned' });
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

      // Calculate hustler fee (12% platform fee)
      const hustlerFee = Number(job.payment.amount) * 0.12;
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

// DELETE /jobs/:id - Delete a job (Customer only, only if not in progress)
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

    // BUSINESS RULE: Cannot delete if job is in progress (start code verified)
    if (job.startCodeVerified || job.status === 'IN_PROGRESS') {
      return res.status(400).json({ 
        error: 'Cannot delete job that is in progress. Once the start code is entered, the job must be completed.',
        message: 'Job is currently in progress and cannot be deleted.'
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

// POST /jobs/:id/unassign - Unassign hustler (Customer only, before start code)
router.post('/:id/unassign', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        offers: {
          where: { status: 'ACCEPTED' },
        },
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: { select: { id: true, email: true, name: true } }
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // BUSINESS RULE: Cannot unassign if job is in progress
    if (job.startCodeVerified || job.status === 'IN_PROGRESS') {
      return res.status(400).json({ 
        error: 'Cannot unassign: Job is in progress. Once the start code is entered, the job must be completed.',
        startCodeUsed: true
      });
    }

    // Find accepted offer
    const acceptedOffer = job.offers && job.offers.length > 0 ? job.offers[0] : null;
    
    if (acceptedOffer) {
      // Update offer status back to PENDING
      await prisma.offer.update({
        where: { id: acceptedOffer.id },
        data: { status: 'PENDING' }
      });
    }

    // Update job - remove hustler, set back to OPEN
    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        status: 'OPEN',
        hustlerId: null,
        startCode: null,
        startCodeExpiresAt: null
      }
    });

    // Send notification email to hustler (non-blocking)
    if (job.hustler) {
      try {
        const { sendJobUnacceptedEmail } = require('../services/email');
        await sendJobUnacceptedEmail(
          job.hustler.email,
          job.hustler.name,
          job.title,
          job.id
        );
      } catch (emailError) {
        console.error('Error sending unaccept email:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Hustler unassigned. Job is now open for other applicants.',
      job: updatedJob
    });
  } catch (error) {
    console.error('Unassign job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/leave - Leave job (Hustler only, before start code)
router.post('/:id/leave', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        offers: {
          where: {
            hustlerId: req.user.id,
            status: 'ACCEPTED'
          },
        },
        customer: { select: { id: true, email: true, name: true } },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'You are not assigned to this job' });
    }

    // BUSINESS RULE: Cannot leave if job is in progress
    if (job.startCodeVerified || job.status === 'IN_PROGRESS') {
      return res.status(400).json({ 
        error: 'Cannot leave: Job is in progress. Once the start code is entered, the job must be completed.',
        jobStarted: true
      });
    }

    // Find accepted offer
    const acceptedOffer = job.offers && job.offers.length > 0 ? job.offers[0] : null;
    
    if (acceptedOffer) {
      // Update offer status to DECLINED
      await prisma.offer.update({
        where: { id: acceptedOffer.id },
        data: { status: 'DECLINED' }
      });
    }

    // Update job - remove hustler, set back to OPEN
    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        status: 'OPEN',
        hustlerId: null,
        startCode: null,
        startCodeExpiresAt: null
      }
    });

    // Send notification email to customer (non-blocking)
    if (job.customer) {
      try {
        const emailService = require('../services/email');
        if (emailService.sendHustlerCancelledEmail) {
          await emailService.sendHustlerCancelledEmail(
            job.customer.email,
            job.customer.name,
            job.title,
            req.user.name || 'Hustler',
            job.id
          );
        }
      } catch (emailError) {
        console.error('Error sending cancellation email (non-fatal):', emailError);
      }
    }

    res.json({
      success: true,
      message: 'You have left the job. The job is now open for other applicants.',
      job: updatedJob
    });
  } catch (error) {
    console.error('Leave job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

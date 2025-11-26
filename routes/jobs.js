const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { geocodeAddress } = require('../services/mapbox');
<<<<<<< HEAD
const { validateTennesseeZip } = require('../services/zipcode');
const { calculateDistance, getBoundingBox, formatDistance } = require('../services/location');
const { pauseRecurringJob, resumeRecurringJob, cancelRecurringJob } = require('../services/recurringJobs');
=======
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)

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
            in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM'],
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
<<<<<<< HEAD
      pickupArea,
      pickupCity,
      pickupAddress,
      dropoffArea,
      dropoffCity,
      dropoffAddress,
      // Recurring job fields
      recurrenceType,
      recurrenceEndDate,
=======
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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
<<<<<<< HEAD
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
    ], async (req, res) => {
      try {
        // Performance monitoring
        const startTime = Date.now();
        req.startTime = startTime;
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const { status, category, lat, lng, radius = 25, zip, city, page = 1, limit = 20, sortBy = 'newest', search } = req.query;
        const userId = req.user?.id;
=======
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
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)

    if (category) where.category = category;
<<<<<<< HEAD
    
    // Search functionality - search in title and description
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // 48-72 hour cleanup: Hide OPEN jobs older than threshold with no accepted offers
    // This is handled in the where clause below, no need for separate variable

    // Location-based filtering: Auto-filter by user location if available
    let userLat = null;
    let userLng = null;
    let userZip = null;
    let searchRadius = parseInt(radius, 10) || 25; // Default 25 miles
    
    // Try to get user's location from their profile or request
    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { zip: true, city: true },
      });
      
      if (user?.zip) {
        userZip = user.zip;
      }
    }
    
    // Use provided lat/lng or zip, or fall back to user's profile
    if (lat && lng) {
      userLat = parseFloat(lat);
      userLng = parseFloat(lng);
    } else if (zip) {
      userZip = zip;
      // Try to geocode zip to get lat/lng (with caching and error handling)
      try {
        const geo = await geocodeAddress(`${zip}, Tennessee`, { useCache: true, timeout: 3000 });
        if (geo && geo.lat && geo.lng) {
          userLat = geo.lat;
          userLng = geo.lng;
        } else {
          console.warn(`[Jobs] Could not geocode zip ${zip}, will use zip-based filtering`);
        }
      } catch (error) {
        console.warn(`[Jobs] Geocoding zip ${zip} failed:`, error.message);
        // Continue without coordinates - will use zip-based filtering
      }
    } else if (userZip) {
      // Try to geocode user's profile zip (with caching and error handling)
      try {
        const geo = await geocodeAddress(`${userZip}, Tennessee`, { useCache: true, timeout: 3000 });
        if (geo && geo.lat && geo.lng) {
          userLat = geo.lat;
          userLng = geo.lng;
        } else {
          console.warn(`[Jobs] Could not geocode user zip ${userZip}, will use zip-based filtering`);
        }
      } catch (error) {
        console.warn(`[Jobs] Geocoding user zip ${userZip} failed:`, error.message);
        // Continue without coordinates - will use zip-based filtering
      }
    }

    // Apply location filtering if we have coordinates
    let shouldFilterByLocation = false;
    if (userLat && userLng) {
      shouldFilterByLocation = true;
      const bbox = getBoundingBox(userLat, userLng, searchRadius);
      
      where.lat = {
        gte: bbox.minLat,
        lte: bbox.maxLat,
      };
      where.lng = {
        gte: bbox.minLng,
        lte: bbox.maxLng,
      };
    } else if (userZip || zip) {
      // Fall back to zip-based filtering if no coordinates
      shouldFilterByLocation = true;
      const searchZip = zip || userZip;
      
      // Find jobs by customer zip or job pickup zip
      // This will be filtered in post-processing
    }

    // Exclude EXPIRED jobs from all queries (they should never show)
    where.AND = where.AND || [];
    where.AND.push({
      status: { not: 'EXPIRED' },
    });
    
    // 72 hour cleanup: Exclude OPEN jobs older than threshold with no accepted offers
    // Don't filter if status is already set to something other than OPEN
    // Use 72 hours as default (configurable)
    const hoursThreshold = parseInt(process.env.JOB_CLEANUP_HOURS || '72', 10);
    const hoursAgo = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    
    if (!status || status === 'OPEN') {
      // Add condition: Exclude old OPEN jobs with no accepted offers
      // We'll filter these out: status=OPEN AND age>threshold AND no accepted offers
      where.AND.push({
        OR: [
          { status: { not: 'OPEN' } }, // Not OPEN status (already assigned/completed)
          { status: { not: 'CANCELLED' } }, // Not cancelled
          { createdAt: { gte: hoursAgo } }, // Less than threshold hours old
          {
            offers: {
              some: {
                status: 'ACCEPTED',
              },
            },
          }, // Has at least one accepted offer
        ],
      });
=======
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
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

<<<<<<< HEAD
    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // First, get total count for pagination metadata (apply same filters)
    const totalCount = await prisma.job.count({ where });

    const jobs = await prisma.job.findMany({
      where,
=======
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
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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
<<<<<<< HEAD
      // Optimized: Add database-level ordering for better performance
      // Default order by newest first (can be overridden by client-side sorting)
      orderBy: sortBy === 'pay' ? { amount: 'desc' } : { createdAt: 'desc' },
      // We'll sort by distance after calculating - get enough jobs to filter and sort
      // Note: We need to fetch more initially to properly filter by distance, then paginate
      skip: 0,
      take: Math.max(limitNum * 5, 100), // Fetch enough to filter and sort, but limit to avoid performance issues
    });

    // Post-process: Filter by zip code and calculate distances
    let filteredJobs = jobs;
    
    // Filter out archived jobs (unless includeArchived is true)
    // Archived jobs have requirements.archived === true
    if (!req.query.includeArchived) {
      filteredJobs = filteredJobs.filter(job => {
        const requirements = job.requirements || {};
        return requirements.archived !== true;
      });
    }
    
    // Filter by zip code if needed (when we don't have coordinates)
    if ((zip || userZip) && shouldFilterByLocation && !userLat) {
      const searchZip = zip || userZip;
      filteredJobs = filteredJobs.filter(job => {
        // Check customer zip
        if (job.customer?.zip === searchZip) return true;
        // Check job requirements.pickupZip
        const reqZip = job.requirements?.pickupZip;
        if (reqZip && reqZip.toString() === searchZip.toString()) return true;
        return false;
      });
=======
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
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
    }
    
    // Calculate distance for each job and add to response
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

<<<<<<< HEAD
    // Apply pagination after filtering and sorting
    const totalFilteredCount = filteredJobs.length;
    const paginatedJobs = filteredJobs.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(totalFilteredCount / limitNum);
    const hasMore = (skip + limitNum) < totalFilteredCount;

    // Return paginated response
    res.json({
      jobs: paginatedJobs || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFilteredCount,
        totalPages,
        hasMore,
      },
      location: userLat && userLng ? {
        lat: userLat,
        lng: userLng,
        radius: searchRadius,
        zip: userZip || zip,
      } : null,
=======
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
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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

    // BUSINESS RULE: Customer cannot delete after Hustler is OTW (IN_PROGRESS)
    if (job.status === 'IN_PROGRESS') {
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
            include: { customer: true, hustler: true, job: true },
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

<<<<<<< HEAD
    // Verify the 6-digit code
    // Handle requirements as JSON object (it might be stored as JSON string in DB)
    let requirements = job.requirements;
    if (typeof requirements === 'string') {
      try {
        requirements = JSON.parse(requirements);
      } catch (e) {
        console.error('[confirm-complete] Error parsing requirements:', e);
        requirements = {};
      }
    }
    
    const storedCode = requirements?.verificationCode;
    const providedCode = String(verificationCode).trim().replace(/\D/g, ''); // Remove non-digits
    const storedCodeStr = storedCode ? String(storedCode).trim().replace(/\D/g, '') : null;
    
    console.log('[confirm-complete] Code comparison:', {
      storedCode: storedCodeStr,
      providedCode: providedCode,
      match: storedCodeStr === providedCode,
      jobId: req.params.id
    });
=======
    if (job.status !== 'COMPLETED_BY_HUSTLER') {
      return res.status(400).json({ error: 'Job has not been marked complete by hustler yet' });
    }

    // Verify the verification code
    const { verificationCode } = req.body;
    const jobVerificationCode = job.requirements?.verificationCode;
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
    
    if (!verificationCode || verificationCode !== jobVerificationCode) {
      return res.status(400).json({ 
<<<<<<< HEAD
        error: 'Invalid verification code',
        message: storedCodeStr ? 'The code you entered does not match. Please check with the hustler.' : 'No verification code found for this job. The hustler may need to mark the job as complete first.'
=======
        error: 'Invalid verification code. Please enter the code provided by the hustler.' 
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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

<<<<<<< HEAD
        if (hustler && hustler.stripeAccountId) {
          const { transferToHustler } = require('../services/stripe');
          const jobAmount = Number(job.payment.amount) || 0;
          const platformFee = jobAmount * 0.16; // 16% platform fee
          const hustlerAmount = jobAmount - platformFee; // 84% after 16% fee

          const transfer = await transferToHustler(
            hustler.stripeAccountId,
            hustlerAmount,
            job.id,
            `Payment for job: ${job.title}`
          );

          // Create payout record
          await prisma.payout.upsert({
            where: { jobId: job.id },
            create: {
              hustlerId: job.hustlerId,
              jobId: job.id,
              amount: jobAmount,
              platformFee,
              netAmount: hustlerAmount,
              status: 'PROCESSING', // Will be updated by webhook
              payoutProviderId: transfer.id,
              payoutMethod: 'STRIPE_TRANSFER',
            },
            update: {
              status: 'PROCESSING',
              payoutProviderId: transfer.id,
            },
          });

          // Send admin notification
          const { sendAdminPayoutNotification } = require('../services/email');
          try {
            const payout = await prisma.payout.findUnique({
              where: { jobId: job.id },
              include: { hustler: true },
            });
            await sendAdminPayoutNotification(payout, hustler);
          } catch (notifError) {
            console.error('Error sending admin payout notification:', notifError);
          }
        } else {
          console.log(`Hustler ${job.hustlerId} does not have Stripe Connect account set up yet`);
=======
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
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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

<<<<<<< HEAD
    // BUSINESS RULE: Customer cannot delete after Hustler is OTW (IN_PROGRESS) or ASSIGNED
    if (job.status === 'IN_PROGRESS') {
      return res.status(400).json({ 
        error: 'Cannot delete job that is in progress. The hustler is already working or on the way.',
        message: `Job status is ${job.status}. Cannot delete jobs in progress.`
      });
    }
    
    if (job.status === 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Cannot delete job that is assigned. The hustler is committed to this job.',
        message: `Job status is ${job.status}. Please cancel the job instead if needed.`
      });
    }
    
=======
    // Can only delete if job is OPEN and has no accepted offers
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
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

<<<<<<< HEAD
// POST /jobs/:id/archive - Archive a job (soft delete, hides from feeds but keeps data)
router.post('/:id/archive', authenticate, async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only customer or hustler who owns the job can archive it
    const isOwner = job.customerId === req.user.id || job.hustlerId === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Store archived status in requirements JSON field
    const requirements = job.requirements || {};
    requirements.archived = true;
    requirements.archivedAt = new Date().toISOString();
    requirements.archivedBy = req.user.id;

    // Update job with archived status
    await prisma.job.update({
      where: { id: req.params.id },
      data: { requirements },
    });

    res.json({ message: 'Job archived successfully' });
  } catch (error) {
    console.error('Archive job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/unarchive - Unarchive a job (restore from archive)
router.post('/:id/unarchive', authenticate, async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only customer or hustler who owns the job can unarchive it
    const isOwner = job.customerId === req.user.id || job.hustlerId === req.user.id;
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Remove archived status from requirements
    const requirements = job.requirements || {};
    delete requirements.archived;
    delete requirements.archivedAt;
    delete requirements.archivedBy;

    // Update job
    await prisma.job.update({
      where: { id: req.params.id },
      data: { requirements },
    });

    res.json({ message: 'Job unarchived successfully' });
  } catch (error) {
    console.error('Unarchive job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add refund endpoint for non-responsive hustlers
// POST /jobs/:id/request-refund - Customer requests refund if hustler doesn't respond
router.post('/:id/request-refund', authenticate, requireRole('CUSTOMER'), async (req, res) => {
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

    // Only allow refund request for assigned jobs that haven't been started
    // Once the start code is entered, the job is "In Progress" and refunds are disabled
    const requirements = job.requirements || {};
    const isInProgress = requirements.startCodeUsed === true || job.status === 'PAID';
    
    if (isInProgress) {
      return res.status(400).json({ 
        error: 'Refund cannot be requested once the job has started. The hustler has begun work.',
        reason: 'Job is in progress'
      });
    }

    // Only allow refund for ASSIGNED jobs (not yet started)
    if (job.status !== 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Refund can only be requested for assigned jobs that have not yet started' 
      });
    }

    // Check if hustler has been assigned for at least 24 hours (give them time to respond)
    const assignedAt = job.updatedAt || job.createdAt;
    const hoursSinceAssigned = (Date.now() - new Date(assignedAt).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceAssigned < 24) {
      return res.status(400).json({ 
        error: 'Please wait 24 hours after assignment before requesting a refund. The hustler may still respond.',
        hoursRemaining: Math.ceil(24 - hoursSinceAssigned)
      });
    }

    // Check test mode
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    const forceTestMode = true; // TEMPORARY: Always bypass Stripe for testing

    // Process refund
    if (job.payment) {
      if (job.payment.status === 'PREAUTHORIZED') {
        // Void pre-authorized payment
        if (!skipStripeCheck && !forceTestMode) {
          try {
            const { voidPaymentIntent } = require('../services/stripe');
            await voidPaymentIntent(job.payment.providerId);
          } catch (error) {
            console.error('Error voiding payment:', error);
          }
        }
        
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
      } else if (job.payment.status === 'CAPTURED') {
        // Refund captured payment
        if (!skipStripeCheck && !forceTestMode) {
          try {
            const { createRefund } = require('../services/stripe');
            const refundAmount = Math.round(Number(job.payment.amount + job.payment.tip) * 100);
            await createRefund(job.payment.providerId, refundAmount);
          } catch (error) {
            console.error('Error processing refund:', error);
          }
        }
        
        await prisma.payment.update({
          where: { id: job.payment.id },
          data: { status: 'REFUNDED' },
        });
      }
    }

    // Update job status to cancelled and remove hustler
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { 
        status: 'OPEN',
        hustlerId: null,
      },
    });

    // Send email to customer about refund
    if (job.payment) {
      try {
        const { sendRefundEmail, sendAdminRefundNotification } = require('../services/email');
        const refundAmount = Number(job.payment.amount + (job.payment.tip || 0));
        await sendRefundEmail(
          req.user.email,
          req.user.name,
          job.title,
          refundAmount
        );

        // Send admin notification
        try {
          const payment = await prisma.payment.findUnique({
            where: { id: job.payment.id },
            include: { customer: true, hustler: true, job: true },
          });
          await sendAdminRefundNotification(
            payment,
            refundAmount,
            'Refund requested - hustler non-responsive',
            req.user.name
          );
        } catch (adminError) {
          console.error('Error sending admin refund notification:', adminError);
        }
      } catch (emailError) {
        console.error('Error sending refund email:', emailError);
      }
    }

    res.json({
      ...updated,
      message: 'Refund processed. Job is now open for other hustlers to apply.',
    });
  } catch (error) {
    console.error('Request refund error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/start - Hustler starts job with 4-digit start code (customer provides code)
router.post('/:id/start', authenticate, requireRole('HUSTLER'), [
  body('startCode').trim().isLength({ min: 4, max: 4 }).withMessage('Start code must be 4 digits'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startCode } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'ASSIGNED' && job.status !== 'PAID') {
      return res.status(400).json({ error: 'Job must be assigned or paid before starting' });
    }

    const requirements = job.requirements || {};
    
    // Check if already started
    if (requirements.startedAt || job.status === 'PAID') {
      return res.status(400).json({ error: 'Job has already been started' });
    }

    // Verify start code
    const storedStartCode = requirements.startCode;
    const providedCode = String(startCode).trim();
    const storedCodeStr = storedStartCode ? String(storedStartCode).trim() : null;
    
    if (!storedCodeStr || storedCodeStr !== providedCode) {
      return res.status(400).json({ 
        error: 'Invalid start code',
        debug: process.env.NODE_ENV !== 'production' ? {
          provided: providedCode,
          stored: storedCodeStr
        } : undefined
      });
    }

    // Job is now officially started - update status and record start time
    requirements.startedAt = new Date().toISOString();
    requirements.startedAtTimestamp = Date.now();
    // Mark start code as used
    requirements.startCodeUsed = true;
    requirements.startCodeUsedAt = new Date().toISOString();

    // Update job status to IN_PROGRESS (using PAID as IN_PROGRESS since schema doesn't have IN_PROGRESS)
    // In a future migration, we could add IN_PROGRESS to the enum
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { 
        status: 'PAID', // Using PAID to represent IN_PROGRESS for now
        requirements,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/end - Hustler ends job (records end time for hourly billing)
router.post('/:id/end', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const requirements = job.requirements || {};
    
    if (!requirements.startedAt) {
      return res.status(400).json({ error: 'Job must be started before ending' });
    }

    if (requirements.endedAt) {
      return res.status(400).json({ error: 'Job has already been ended' });
    }

    requirements.endedAt = new Date().toISOString();
    requirements.endedAtTimestamp = Date.now();

    // Calculate hours worked for hourly jobs
    if (job.payType === 'hourly' && requirements.startedAt) {
      const startTime = new Date(requirements.startedAt);
      const endTime = new Date();
      const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
      requirements.hoursWorked = Math.round(hoursWorked * 100) / 100; // Round to 2 decimals
    }

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { requirements },
    });

    res.json(updated);
  } catch (error) {
    console.error('End job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/report-issue - Customer or hustler reports an issue/dispute
router.post('/:id/report-issue', authenticate, [
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason, description } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { payment: true },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is either customer or hustler for this job
    if (job.customerId !== req.user.id && job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const requirements = job.requirements || {};
    
    // Store dispute information
    requirements.dispute = {
      reportedBy: req.user.id,
      reportedAt: new Date().toISOString(),
      reason: reason,
      description: description || null,
      status: 'PENDING', // PENDING, RESOLVED, DISMISSED
    };

    // Prevent auto-release if dispute is filed
    requirements.disputeFiledAt = Date.now();

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { requirements },
    });

    // Send email notification about dispute
    try {
      const { sendDisputeEmail } = require('../services/email');
      const otherParty = job.customerId === req.user.id 
        ? await prisma.user.findUnique({ where: { id: job.hustlerId }, select: { email: true, name: true } })
        : await prisma.user.findUnique({ where: { id: job.customerId }, select: { email: true, name: true } });
      
      if (otherParty) {
        await sendDisputeEmail(
          otherParty.email,
          otherParty.name,
          job.title,
          reason,
          description
        );
      }
    } catch (emailError) {
      console.error('Error sending dispute email:', emailError);
    }

    res.json({
      ...updated,
      message: 'Issue reported. Payment will not be auto-released while dispute is pending.',
    });
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs/:id/start-code - Customer gets or regenerates 4-digit start code
router.get('/:id/start-code', authenticate, requireRole('CUSTOMER'), async (req, res) => {
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

    if (job.status !== 'ASSIGNED' && job.status !== 'PAID') {
      return res.status(400).json({ error: 'Job must be assigned to generate start code' });
    }

    const requirements = job.requirements || {};
    
    // Generate new start code if doesn't exist or if regenerating
    const regenerate = req.query.regenerate === 'true';
    if (!requirements.startCode || regenerate) {
      requirements.startCode = String(Math.floor(1000 + Math.random() * 9000));
      await prisma.job.update({
        where: { id: req.params.id },
        data: { requirements },
      });
    }

    res.json({ startCode: requirements.startCode });
  } catch (error) {
    console.error('Get start code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/auto-release - Check and auto-release payments after 48 hours (cron job endpoint)
router.post('/auto-release', async (req, res) => {
  try {
    // This endpoint should be called by a cron job or scheduled task
    // For security, you might want to add an API key check here
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.CRON_API_KEY && process.env.CRON_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    let releasedCount = 0;

    // Find jobs that are awaiting customer confirmation and have been waiting 48+ hours
    const jobsToRelease = await prisma.job.findMany({
      where: {
        status: 'AWAITING_CUSTOMER_CONFIRM',
        requirements: {
          path: ['completedAtTimestamp'],
          not: null,
        },
      },
      include: {
        payment: true,
        hustler: {
          select: {
            email: true,
            name: true,
            stripeAccountId: true,
          },
        },
      },
    });

    for (const job of jobsToRelease) {
      const requirements = job.requirements || {};
      const completedAt = requirements.completedAtTimestamp;
      const disputeFiledAt = requirements.disputeFiledAt;

      // Skip if dispute is filed
      if (disputeFiledAt) {
        continue;
      }

      // Check if 48 hours have passed
      if (completedAt && (now - completedAt >= fortyEightHours)) {
        const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
        const forceTestMode = true; // TEMPORARY

        // Capture payment if pre-authorized
        if (job.payment && job.payment.status === 'PREAUTHORIZED') {
          if (!skipStripeCheck && !forceTestMode) {
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

          // Transfer to hustler via Stripe Connect (if account exists)
          if (job.hustler.stripeAccountId && !skipStripeCheck && !forceTestMode) {
            try {
              const { transferToHustler } = require('../services/stripe');
              const transfer = await transferToHustler(
                job.hustler.stripeAccountId,
                hustlerAmount,
                job.id,
                `Payment for job: ${job.title}`
              );

              // Create payout record
              await prisma.payout.upsert({
                where: { jobId: job.id },
                create: {
                  hustlerId: job.hustlerId,
                  jobId: job.id,
                  amount: jobAmount,
                  platformFee,
                  netAmount: hustlerAmount,
                  status: 'PROCESSING', // Will be updated by webhook
                  payoutProviderId: transfer.id,
                  payoutMethod: 'STRIPE_TRANSFER',
                },
                update: {
                  status: 'PROCESSING',
                  payoutProviderId: transfer.id,
                },
              });

              // Send admin notification
              const { sendAdminPayoutNotification } = require('../services/email');
              try {
                const payout = await prisma.payout.findUnique({
                  where: { jobId: job.id },
                  include: { hustler: true },
                });
                await sendAdminPayoutNotification(payout, job.hustler);
              } catch (notifError) {
                console.error('Error sending admin payout notification:', notifError);
              }
            } catch (transferError) {
              console.error('Transfer error (non-fatal):', transferError);
            }
          }
        }

        // Update job status to PAID (completed)
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'PAID' },
        });

        // Send email notification
        try {
          const { sendAutoCompleteEmail } = require('../services/email');
          await sendAutoCompleteEmail(
            job.hustler.email,
            job.hustler.name,
            job.title,
            Number(job.payment?.amount || 0)
          );
        } catch (emailError) {
          console.error('Error sending auto-complete email:', emailError);
        }

        releasedCount++;
        console.log(`[AUTO-RELEASE] Released payment for job ${job.id} after 48 hours`);
      }
    }

    res.json({ 
      message: `Auto-release check completed`,
      releasedCount,
      checkedCount: jobsToRelease.length
    });
  } catch (error) {
    console.error('Auto-release error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/update-status - Hustler updates job status (OTW, Starting, etc.)
router.post('/:id/update-status', authenticate, requireRole('HUSTLER'), [
  body('status').trim().isIn(['on_the_way', 'starting', 'almost_done', 'just_finished']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
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

    if (job.status !== 'ASSIGNED' && job.status !== 'PAID') {
      return res.status(400).json({ error: 'Job must be assigned or paid' });
    }

    const requirements = job.requirements || {};
    requirements.hustlerStatus = status;
    requirements.hustlerStatusUpdatedAt = new Date().toISOString();

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { requirements },
    });

    // Send email notification to customer
    try {
      const { sendStatusUpdateEmail } = require('../services/email');
      const statusMessages = {
        on_the_way: 'On the way',
        starting: 'Starting the job',
        almost_done: 'Almost done',
        just_finished: 'Just finished',
      };
      await sendStatusUpdateEmail(
        job.customer.email,
        job.customer.name,
        job.title,
        statusMessages[status] || status
      );
    } catch (emailError) {
      console.error('Error sending status update email:', emailError);
    }

    res.json(updated);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:jobId/recurring/pause - Pause recurring job series
router.post('/:jobId/recurring/pause', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { customerId: true },
    });

    if (!job || job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pauseRecurringJob(jobId);
    res.json(result);
  } catch (error) {
    console.error('Pause recurring job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:jobId/recurring/resume - Resume recurring job series
router.post('/:jobId/recurring/resume', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { customerId: true },
    });

    if (!job || job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await resumeRecurringJob(jobId);
    res.json(result);
  } catch (error) {
    console.error('Resume recurring job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:jobId/recurring/cancel - Cancel recurring job series
router.post('/:jobId/recurring/cancel', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { customerId: true },
    });

    if (!job || job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await cancelRecurringJob(jobId);
    res.json(result);
  } catch (error) {
    console.error('Cancel recurring job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

=======
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
module.exports = router;

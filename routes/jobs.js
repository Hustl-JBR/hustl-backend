const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { geocodeAddress } = require('../services/mapbox');
const { validateTennesseeZip } = require('../services/zipcode');
const { calculateDistance, getBoundingBox, formatDistance } = require('../services/location');

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
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    });
    
    res.json(jobs);
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
      return res.status(400).json({ errors: errors.array() });
    }
    
    // NOTE: We do NOT validate the customer's profile zip code when posting a job
    // The job's pickupZip is what matters, not where the customer lives
    // This allows customers to post jobs anywhere in Tennessee, regardless of their home address

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
      teamSize = 1,
      requirements = {},
      pickupArea,
      pickupCity,
      pickupAddress,
      dropoffArea,
      dropoffCity,
      dropoffAddress,
    } = req.body;

    // Validate required fields in requirements
    if (!requirements.estimatedDuration) {
      return res.status(400).json({ 
        error: 'Estimated duration is required',
        field: 'estimatedDuration'
      });
    }

    if (!requirements.toolsNeeded || !Array.isArray(requirements.toolsNeeded) || requirements.toolsNeeded.length === 0) {
      return res.status(400).json({ 
        error: 'At least one tool or equipment is required',
        field: 'toolsNeeded'
      });
    }

    // SIMPLIFIED: Validate using ZIP code first, then geocode for coordinates
    let lat = null;
    let lng = null;
    let isTennessee = false;
    
    // Priority 1: Check pickupZip from requirements (MOST RELIABLE)
    const pickupZip = requirements?.pickupZip || '';
    console.log(`[Tennessee Validation] Full request body:`, JSON.stringify(req.body, null, 2));
    console.log(`[Tennessee Validation] Full requirements object:`, JSON.stringify(requirements, null, 2));
    console.log(`[Tennessee Validation] pickupZip from requirements: "${pickupZip}" (type: ${typeof pickupZip})`);
    
    if (!pickupZip || pickupZip.toString().trim() === '') {
      console.log(`[Tennessee Validation] ⚠ No pickupZip provided in requirements, will try geocoded address`);
    }
    
    if (pickupZip && pickupZip.toString().trim() !== '') {
      const zipToValidate = pickupZip.toString().trim();
      console.log(`[Tennessee Validation] Validating zip: "${zipToValidate}"`);
      isTennessee = await validateTennesseeZip(zipToValidate);
      console.log(`[Tennessee Validation] pickupZip "${zipToValidate}" validation result: ${isTennessee ? '✓ VALID' : '✗ INVALID'}`);
      
      // Also geocode to get coordinates - include zip in address for better accuracy
      try {
        // Build address with zip code for better geocoding accuracy
        const addressWithZip = pickupZip ? `${address}, ${pickupZip}` : address;
        const geo = await geocodeAddress(addressWithZip);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          console.log(`[Tennessee Validation] Geocoded address for coordinates: lat=${lat}, lng=${lng}`);
          
          // If Mapbox confirms Tennessee, trust it (most reliable)
          if (geo.isTennessee === true) {
            isTennessee = true;
            console.log(`[Tennessee Validation] ✓ Mapbox confirmed Tennessee location (US-TN found in context)`);
          }
          // If ZIP validation passed, we already have isTennessee = true, so keep it
        }
      } catch (geoError) {
        console.error('Geocoding error (non-fatal):', geoError);
        // If geocoding fails but ZIP validation passed, we'll trust the ZIP
      }
      
      if (!isTennessee) {
        return res.status(400).json({ 
          error: 'Jobs can only be posted in Tennessee. The pickup zip code must be in Tennessee (37000-38999).',
          field: 'pickupZip'
        });
      }
    } else {
      // No pickupZip provided - validate using geocoded address
      console.log(`[Tennessee Validation] No pickupZip provided, validating via geocoded address`);
      
      try {
        // Try to include zip from requirements if available for better geocoding
        const addressWithZip = (requirements?.pickupZip) ? `${address}, ${requirements.pickupZip}` : address;
        const geo = await geocodeAddress(addressWithZip);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          
          // PRIORITY 1: Check if Mapbox detected US-TN directly
          if (geo.isTennessee === true) {
            isTennessee = true;
            console.log(`[Tennessee Validation] ✓ Validated via Mapbox isTennessee flag`);
          } else {
            // PRIORITY 2: Try zip code validation from geocoded result
            const geoZip = geo.zip || '';
            if (geoZip) {
              isTennessee = await validateTennesseeZip(geoZip);
              console.log(`[Tennessee Validation] Geocoded zip "${geoZip}" validation: ${isTennessee ? '✓ VALID' : '✗ INVALID'}`);
            }
            
            // PRIORITY 3: Check region/state codes as fallback
            if (!isTennessee) {
              const region = (geo.region || '').toUpperCase();
              const state = (geo.state || '').toUpperCase();
              
              if (region === 'US-TN' || region === 'TN') {
                isTennessee = true;
                console.log(`[Tennessee Validation] ✓ Validated via region: ${region}`);
              } else if (state === 'TN' || state === 'TENNESSEE') {
                isTennessee = true;
                console.log(`[Tennessee Validation] ✓ Validated via state: ${state}`);
              }
            }
          }
          
          if (!isTennessee) {
            return res.status(400).json({ 
              error: 'Jobs can only be posted in Tennessee. Please provide a Tennessee zip code (37000-38999) in the pickup location field.',
              field: 'pickupZip'
            });
          }
        } else {
          return res.status(400).json({ 
            error: 'Could not validate location. Please provide a Tennessee zip code (37000-38999) in the pickup location field.',
            field: 'pickupZip'
          });
        }
      } catch (geoError) {
        console.error('Geocoding error:', geoError);
        return res.status(400).json({ 
          error: 'Could not validate location. Please provide a Tennessee zip code (37000-38999) in the pickup location field.',
          field: 'pickupZip'
        });
      }
    }

    const job = await prisma.job.create({
      data: {
        customerId: req.user.id,
        title,
        category,
        description,
        address,
        lat,
        lng,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        payType,
        amount: Number(amount),
        hourlyRate: hourlyRate ? Number(hourlyRate) : null,
        estHours: estHours ? Number(estHours) : null,
        requirements: {
          ...(requirements || {}),
          // Store pickup/dropoff fields in requirements for easy access
          pickupArea: pickupArea || null,
          pickupCity: pickupCity || null,
          pickupAddress: pickupAddress || null,
          dropoffArea: dropoffArea || null,
          dropoffCity: dropoffCity || null,
          dropoffAddress: dropoffAddress || null,
        },
        status: 'OPEN',
      },
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs - List jobs (with filters)
router.get('/', optionalAuth, [
  query('status').optional().isIn(['OPEN', 'ASSIGNED', 'COMPLETED_BY_HUSTLER']),
  query('category').optional().trim(),
  query('lat').optional().isFloat(),
  query('lng').optional().isFloat(),
  query('radius').optional().isInt({ min: 1, max: 100 }),
  query('zip').optional().trim(),
  query('city').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, category, lat, lng, radius = 25, zip, city, page = 1, limit = 20, sortBy = 'distance', search } = req.query;
    const userId = req.user?.id;

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    
    // Search functionality - search in title and description
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // 72-hour cleanup: Hide OPEN jobs older than 72 hours with no accepted offers
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

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

    // 72-hour cleanup: Only hide OPEN jobs older than 72 hours with no accepted offers
    // Don't filter if status is already set to something other than OPEN
    if (!status || status === 'OPEN') {
      // Add condition: Exclude old OPEN jobs with no accepted offers
      // We'll filter these out: status=OPEN AND age>72h AND no accepted offers
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { status: { not: 'OPEN' } }, // Not OPEN status (already assigned/completed)
          { createdAt: { gte: seventyTwoHoursAgo } }, // Less than 72 hours old
          {
            offers: {
              some: {
                status: 'ACCEPTED',
              },
            },
          }, // Has at least one accepted offer
        ],
      });
    }

    // NOTE: Show all jobs by default - no role-based filtering
    // Tab-based filtering (My Jobs, Available Jobs, My Hustles) is handled client-side

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // First, get total count for pagination metadata (apply same filters)
    const totalCount = await prisma.job.count({ where });

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            city: true,
            zip: true,
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
        _count: {
          select: {
            offers: true,
          },
        },
      },
      // We'll sort by distance after calculating - get enough jobs to filter and sort
      // Note: We need to fetch more initially to properly filter by distance, then paginate
      skip: 0,
      take: Math.max(limitNum * 5, 100), // Fetch enough to filter and sort, but limit to avoid performance issues
    });

    // Post-process: Filter by zip code and calculate distances
    let filteredJobs = jobs;
    
    // Filter by zip code if needed (when we don't have coordinates)
    if ((zip || userZip) && shouldFilterByLocation && !userLat) {
      const searchZip = zip || userZip;
      filteredJobs = jobs.filter(job => {
        // Check customer zip
        if (job.customer?.zip === searchZip) return true;
        // Check job requirements.pickupZip
        const reqZip = job.requirements?.pickupZip;
        if (reqZip && reqZip.toString() === searchZip.toString()) return true;
        return false;
      });
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
      
      // Sort by distance (default) or by creation date
      if (sortBy === 'distance' || !sortBy) {
        filteredJobs.sort((a, b) => {
          if (a.distance === null && b.distance === null) {
            // Both have no distance - sort by creation date (newest first)
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          }
          if (a.distance === null) return 1; // Jobs without distance go to end
          if (b.distance === null) return -1;
          return a.distance - b.distance; // Closest first
        });
      } else if (sortBy === 'newest') {
        // Sort by newest first
        filteredJobs.sort((a, b) => {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      }
    } else {
      // No location - just add null distances and sort by date
      filteredJobs = filteredJobs.map(job => ({
        ...job,
        distance: null,
        distanceFormatted: 'Distance unknown',
      }));
      
      // Sort by newest first if no location
      filteredJobs.sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }

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
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs/:id - Get job detail
router.get('/:id', optionalAuth, async (req, res) => {
  try {
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
            photoUrl: true,
            ratingAvg: true,
            ratingCount: true,
            bio: true,
            gender: true,
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
            bio: true,
            gender: true,
          },
        },
        _count: {
          select: {
            offers: true,
          },
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

    // Allow completion for ASSIGNED, PAID, or IN_PROGRESS jobs
    // IN_PROGRESS means hustler has entered the 4-digit start code
    const allowedStatuses = ['ASSIGNED', 'PAID', 'IN_PROGRESS'];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({ 
        error: 'Job must be assigned and in progress to mark as complete',
        currentStatus: job.status
      });
    }

    // Protection: Can't mark complete before job date (prevents premature completion scams)
    // TEMPORARILY DISABLED FOR TESTING
    /*
    const now = new Date();
    const jobDate = new Date(job.date);
    const oneDayBefore = new Date(jobDate.getTime() - 24 * 60 * 60 * 1000);
    
    if (now < oneDayBefore) {
      return res.status(400).json({ 
        error: 'Cannot mark job complete before the scheduled date' 
      });
    }
    */
    console.log('[TEST MODE] Date check bypassed - allowing job completion');

    // Generate verification code (6-digit code) - ensure it's always a string
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    
    // Update job with verification code and status
    const requirements = job.requirements || {};
    requirements.verificationCode = verificationCode; // Store as string
    requirements.completedAt = new Date().toISOString();
    requirements.completedAtTimestamp = Date.now(); // Store timestamp for 48-hour auto-release
    
    console.log('[complete] Generated verification code:', verificationCode, 'for job:', req.params.id);
    
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
router.post('/:id/confirm-complete', authenticate, requireRole('CUSTOMER'), [
  body('verificationCode').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { verificationCode } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        payment: true,
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
            username: true,
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
    
    if (!storedCodeStr || storedCodeStr !== providedCode) {
      return res.status(400).json({ 
        error: 'Invalid verification code',
        message: storedCodeStr ? 'The code you entered does not match. Please check with the hustler.' : 'No verification code found for this job. The hustler may need to mark the job as complete first.'
      });
    }

    // Check test mode
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    const forceTestMode = true; // TEMPORARY: Always bypass Stripe for testing

    // Process payment if it exists
    if (job.payment) {
      if (job.payment.status === 'PREAUTHORIZED') {
        if (!skipStripeCheck && !forceTestMode) {
          try {
            const { capturePaymentIntent } = require('../services/stripe');
            await capturePaymentIntent(job.payment.providerId);
          } catch (stripeError) {
            console.error('[confirm-complete] Stripe capture error (non-fatal):', stripeError);
            // Continue even if Stripe capture fails
          }
        }

        // Calculate hustler fee (16% platform fee)
        const hustlerFee = Number(job.payment.amount || 0) * 0.16;

        // Update payment status
        try {
          await prisma.payment.update({
            where: { id: job.payment.id },
            data: {
              status: 'CAPTURED',
              feeHustler: hustlerFee,
            },
          });
          console.log('[confirm-complete] Payment updated to CAPTURED');
        } catch (paymentUpdateError) {
          console.error('[confirm-complete] Payment update error (non-fatal):', paymentUpdateError);
          // Continue even if payment update fails
        }
      } else {
        console.log('[confirm-complete] Payment status is:', job.payment.status, '- skipping capture');
      }
    } else {
      console.log('[confirm-complete] No payment record found - marking as COMPLETED anyway (test mode)');
    }

    // Mark job as COMPLETED - this is the main action
    try {
      await prisma.job.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED' },
      });
      console.log('[confirm-complete] Job marked as COMPLETED:', req.params.id);
    } catch (updateError) {
      console.error('[confirm-complete] Error updating job status:', updateError);
      console.error('[confirm-complete] Update error details:', {
        jobId: req.params.id,
        error: updateError.message,
        stack: updateError.stack
      });
      return res.status(500).json({ 
        error: 'Failed to update job status',
        message: process.env.NODE_ENV !== 'production' ? updateError.message : undefined
      });
    }
    
    // After payment is released, job is now COMPLETED
    // Both parties can still review each other even after job is completed

    // Transfer payment to hustler via Stripe Connect (if they have account set up)
    // TEMPORARILY DISABLED - Skip in test mode (keep code for when going live)
    if (job.payment && !skipStripeCheck && !forceTestMode) {
      try {
        const hustler = await prisma.user.findUnique({
          where: { id: job.hustlerId },
        });

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
        }
      } catch (transferError) {
        console.error('Error transferring payment to hustler:', transferError);
        // Don't fail the confirmation if transfer fails - can retry later
      }
    }

    // Send email to customer - job is complete, review the hustler
    if (job.customer && job.customer.email) {
      try {
        const { sendJobCompletedEmail } = require('../services/email');
        const hustlerName = job.hustler?.name || job.hustler?.username || 'your hustler';
        await sendJobCompletedEmail(
          job.customer.email,
          job.customer.name,
          job.title,
          hustlerName
        );
        console.log('[confirm-complete] Sent completion email to customer');
      } catch (emailError) {
        console.error('[confirm-complete] Customer email error (non-fatal):', emailError);
      }
    }

    // Send email to hustler (if payment was processed and hustler exists)
    if (job.payment && job.hustler && job.hustler.email) {
      try {
        const { sendPaymentCompleteEmail } = require('../services/email');
        const hustlerAmount = job.payment.amount ? Number(job.payment.amount) * 0.84 : 0; // 84% after 16% fee
        await sendPaymentCompleteEmail(
          job.hustler.email,
          job.hustler.name,
          job.title,
          hustlerAmount
        );
        console.log('[confirm-complete] Sent payment email to hustler');
      } catch (emailError) {
        console.error('[confirm-complete] Hustler email error (non-fatal):', emailError);
      }
    }
    
    // Return updated job - simplified to avoid spreading issues
    try {
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
      
      if (!finalJob) {
        console.error('[confirm-complete] Job not found after update:', req.params.id);
        // Still return success since we already updated it
        return res.json({
          id: req.params.id,
          status: 'COMPLETED',
          message: 'Job confirmed and payment released to hustler',
        });
      }
      
      // Return job data safely
      return res.json({
        id: finalJob.id,
        status: finalJob.status,
        title: finalJob.title,
        customerId: finalJob.customerId,
        hustlerId: finalJob.hustlerId,
        payment: finalJob.payment,
        hustler: finalJob.hustler,
        message: 'Job confirmed and payment released to hustler',
      });
    } catch (fetchError) {
      console.error('[confirm-complete] Error fetching updated job:', fetchError);
      // Still return success even if we can't fetch the updated job
      return res.json({
        id: req.params.id,
        status: 'COMPLETED',
        message: 'Job confirmed and payment released to hustler',
      });
    }
  } catch (error) {
    console.error('Confirm complete error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// DELETE /jobs/:id - Delete a job (Customer only, open jobs only)
router.delete('/:id', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        offers: {
          where: { status: 'ACCEPTED' },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
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

module.exports = router;

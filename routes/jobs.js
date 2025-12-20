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
    
    // Return jobs with reviews (reviews are already included in the query)
    res.json(jobs);
  } catch (error) {
    console.error('Get completed jobs error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /jobs - Create a job (Customer only)
// Email verification is enforced in authenticate middleware - no need for additional checks
router.post('/', authenticate, requireRole('CUSTOMER'), [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('category').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('address').optional().trim(), // Address is now optional (generic string)
  body('approximateLat').isFloat({ min: -90, max: 90 }), // Required approximate location
  body('approximateLng').isFloat({ min: -180, max: 180 }), // Required approximate location
  body('date').isISO8601(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('payType').isIn(['flat', 'hourly']),
  body('amount').isFloat({ min: 0 }),
  body('hourlyRate').optional().isFloat({ min: 0 }),
  body('estHours').optional().isInt({ min: 1 }),
], async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error('[POST /jobs] req.user is missing:', req.user);
      return res.status(401).json({ error: 'Unauthorized - user not found' });
    }
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
      approximateLat,
      approximateLng,
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
    
    // Parse requirements if it's a string
    let parsedRequirements = requirements;
    if (typeof requirements === 'string') {
      try {
        parsedRequirements = JSON.parse(requirements);
      } catch (e) {
        console.error('[POST /jobs] Error parsing requirements:', e);
        parsedRequirements = {};
      }
    }
    
    // Ensure equipmentNeeded is preserved from request body
    // Check both camelCase and snake_case versions - check requirements object first, then direct body
    let equipmentNeeded = parsedRequirements.equipmentNeeded || parsedRequirements.equipment_needed || [];
    let customEquipment = parsedRequirements.customEquipment || parsedRequirements.custom_equipment || null;
    
    // Also check direct body fields (in case they're sent separately)
    if ((!equipmentNeeded || (Array.isArray(equipmentNeeded) && equipmentNeeded.length === 0)) && req.body.equipmentNeeded) {
      equipmentNeeded = req.body.equipmentNeeded;
    }
    if ((!equipmentNeeded || (Array.isArray(equipmentNeeded) && equipmentNeeded.length === 0)) && req.body.equipment_needed) {
      equipmentNeeded = req.body.equipment_needed;
    }
    if (!customEquipment && req.body.customEquipment) {
      customEquipment = req.body.customEquipment;
    }
    if (!customEquipment && req.body.custom_equipment) {
      customEquipment = req.body.custom_equipment;
    }
    
    // Default to empty array if still null/undefined
    if (!equipmentNeeded) {
      equipmentNeeded = [];
    }
    
    console.log('[POST /jobs] Equipment data - equipmentNeeded:', equipmentNeeded, 'Type:', typeof equipmentNeeded, 'IsArray:', Array.isArray(equipmentNeeded));
    console.log('[POST /jobs] Custom equipment:', customEquipment);
    console.log('[POST /jobs] Parsed requirements keys:', Object.keys(parsedRequirements || {}));
    console.log('[POST /jobs] Request body keys:', Object.keys(req.body || {}));

    // Content moderation - check for prohibited content
    const notes = requirements.notes || '';
    const allContent = `${title} ${description} ${notes}`.toLowerCase();
    
    const prohibitedPatterns = [
      { pattern: /\b(sex|sexual|hookup|escort|prostitute|nude|naked|porn|xxx|adult services)\b/i, category: 'sexual content' },
      { pattern: /\b(drug|marijuana|weed|cocaine|heroin|meth|pills|prescription|illegal substance|dealer)\b/i, category: 'drug-related content' },
      { pattern: /\b(illegal|steal|theft|robbery|fraud|scam|counterfeit|black market)\b/i, category: 'illegal activities' },
      { pattern: /\b(cash only|venmo|cashapp|zelle|paypal|pay outside|off app|direct payment|avoid fee|skip fee|no fee|pay me directly|pay outside app|pay cash|under the table|bypass platform)\b/i, category: 'off-app payment requests' }
    ];
    
    const violations = [];
    prohibitedPatterns.forEach(({ pattern, category }) => {
      if (pattern.test(allContent)) {
        violations.push(category);
      }
    });
    
    if (violations.length > 0) {
      const violationText = [...new Set(violations)].join(', ');
      return res.status(400).json({ 
        error: `Your post contains prohibited content: ${violationText}. Please remove this content and try again. All payments must go through Hustl for your protection.` 
      });
    }

    // Use approximate location (no geocoding needed)
    const lat = approximateLat ? parseFloat(approximateLat) : null;
    const lng = approximateLng ? parseFloat(approximateLng) : null;

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
      address: address || 'Approximate location (exact address shared after acceptance)',
      lat, // Use approximate location for lat/lng (for backward compatibility)
      lng,
      approximateLat: lat, // Store approximate location
      approximateLng: lng,
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      payType,
      amount: parseFloat(amount),
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      estHours: estHours ? parseInt(estHours) : null,
      expiresAt: expiresAt, // Store as DateTime field (UTC)
      requirements: {
        ...parsedRequirements,
        teamSize: parseInt(teamSize) || 1,
        keepActiveFor: keepActiveFor ? parseInt(keepActiveFor) : null,
        expiresAt: expiresAt.toISOString(), // Also keep in requirements for backward compatibility
        preferredTime: preferredTime, // morning, afternoon, evening, anytime
        // Ensure equipment is saved
        equipmentNeeded: Array.isArray(equipmentNeeded) && equipmentNeeded.length > 0 ? equipmentNeeded : null,
        equipment_needed: Array.isArray(equipmentNeeded) && equipmentNeeded.length > 0 ? equipmentNeeded : null, // Also include snake_case for compatibility
        customEquipment: customEquipment || null,
        custom_equipment: customEquipment || null, // Also include snake_case for compatibility
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
    // TIPS ARE NOT INCLUDED IN AUTHORIZATION - They happen after completion
    // Customer fee is 6.5% (no min/max cap)
    const customerFee = jobAmount * 0.065;
    const total = jobAmount + customerFee;

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
        tip: 0, // Tips happen after completion, not in authorization
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
    
    // Handle status filter - default to OPEN for Browse Jobs if not specified
    if (status) {
      if (status === 'EXPIRED') {
        where.status = 'EXPIRED';
      } else {
        where.status = status; // Use provided status (e.g., 'OPEN')
      }
    } else {
      // Default to OPEN status for Browse Jobs when no status specified
      where.status = 'OPEN';
    }
    
    if (category) where.category = category;
    
    // Exclude expired jobs from browse (unless specifically requesting expired status)
    // Also exclude jobs where expiresAt has passed (even if status is still OPEN)
    if (status !== 'EXPIRED') {
      const now = new Date();
      // Also check expiresAt field - exclude jobs that have expired
      if (!where.AND) {
        where.AND = [];
      }
      where.AND.push({
        OR: [
          { expiresAt: null }, // Jobs without expiration
          { expiresAt: { gt: now } } // Jobs that haven't expired yet
        ]
      });
    }
    
    // Filter by ZIP code if provided (searches in address field)
    if (zip && zip.trim().length > 0) {
      where.address = {
        contains: zip.trim(),
        mode: 'insensitive'
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter out private/rehire jobs from Browse Jobs (they should only appear in user's active jobs)
    // Private jobs have requirements.isPrivate === true
    const allJobs = await prisma.job.findMany({
      where,
      skip,
      take: parseInt(limit) * 2, // Get more to account for filtering
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
        _count: {
          select: {
            offers: true,
          },
        },
      },
    });
    
    // Filter out private/rehire jobs (they should not appear in Browse Jobs)
    const publicJobs = allJobs.filter(job => {
      const requirements = job.requirements || {};
      return requirements.isPrivate !== true;
    });
    
    // Limit to requested amount after filtering
    const jobs = publicJobs.slice(0, parseInt(limit));
    
    // Calculate distance for each job and add to response
    let filteredJobs = jobs;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius) || 25;
    
    if (userLat && userLng && !isNaN(userLat) && !isNaN(userLng)) {
      filteredJobs = filteredJobs.map(job => {
        // Use approximate location for distance calculation (privacy-first)
        // Priority: approximateLat/approximateLng, fallback to lat/lng for backward compatibility
        const jobLat = job.approximateLat !== null && job.approximateLat !== undefined 
          ? parseFloat(job.approximateLat) 
          : (job.lat ? parseFloat(job.lat) : null);
        const jobLng = job.approximateLng !== null && job.approximateLng !== undefined 
          ? parseFloat(job.approximateLng) 
          : (job.lng ? parseFloat(job.lng) : null);
        
        // Only calculate distance if job has valid coordinates
        let distance = null;
        if (jobLat && jobLng && !isNaN(jobLat) && !isNaN(jobLng)) {
          try {
            distance = calculateDistance(userLat, userLng, jobLat, jobLng);
            
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
          distanceFormatted: distance !== null ? `~${formatDistance(distance)}` : null, // Add ~ to indicate approximate
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

    // PRICE LOCK: Once start code is entered, price is locked
    if (job.startCodeVerified) {
      // Check if trying to change price-related fields
      const isPriceChange = ['amount', 'hourlyRate', 'estHours'].some(key => req.body[key] !== undefined);
      if (isPriceChange) {
        return res.status(400).json({ 
          error: 'Price is locked. Cannot change price after job has started. Use the price change proposal flow before starting the job.' 
        });
      }
    }
    
    // For SCHEDULED/ASSIGNED jobs (before start), price changes must go through proposal flow
    if ((job.status === 'SCHEDULED' || job.status === 'ASSIGNED') && !job.startCodeVerified) {
      const isPriceChange = ['amount', 'hourlyRate', 'estHours'].some(key => req.body[key] !== undefined);
      if (isPriceChange) {
        return res.status(400).json({ 
          error: 'Price changes for scheduled jobs must be proposed using the price change proposal endpoint. The hustler must accept the change before it takes effect.',
          useProposalFlow: true
        });
      }
    }
    
    // Allow editing OPEN jobs, or non-price adjustments for SCHEDULED/ASSIGNED jobs (before start)
    if (job.status !== 'OPEN' && job.status !== 'SCHEDULED' && job.status !== 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Can only edit open or scheduled jobs' 
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
      // Parse requirements if it's a string
      let parsedRequirements = requirements;
      if (typeof requirements === 'string') {
        try {
          parsedRequirements = JSON.parse(requirements);
        } catch (e) {
          console.error('[PATCH /jobs/:id] Error parsing requirements:', e);
          parsedRequirements = {};
        }
      }
      
      const existingRequirements = job.requirements || {};
      // Parse existing requirements if it's a string
      let parsedExisting = existingRequirements;
      if (typeof existingRequirements === 'string') {
        try {
          parsedExisting = JSON.parse(existingRequirements);
        } catch (e) {
          parsedExisting = {};
        }
      }
      
      // Ensure equipmentNeeded is preserved
      const equipmentNeeded = parsedRequirements.equipmentNeeded || parsedRequirements.equipment_needed || parsedExisting.equipmentNeeded || parsedExisting.equipment_needed || null;
      const customEquipment = parsedRequirements.customEquipment || parsedRequirements.custom_equipment || parsedExisting.customEquipment || parsedExisting.custom_equipment || null;
      
      // Deep merge to preserve nested properties
      updateData.requirements = {
        ...parsedExisting,
        ...parsedRequirements,
        // Ensure equipment is always included if it exists
        equipmentNeeded: Array.isArray(equipmentNeeded) && equipmentNeeded.length > 0 ? equipmentNeeded : (equipmentNeeded || null),
        equipment_needed: Array.isArray(equipmentNeeded) && equipmentNeeded.length > 0 ? equipmentNeeded : (equipmentNeeded || null),
        customEquipment: customEquipment || null,
        custom_equipment: customEquipment || null,
      };
      
      console.log('[PATCH /jobs/:id] Equipment preserved - equipmentNeeded:', equipmentNeeded, 'customEquipment:', customEquipment);
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

// POST /jobs/:id/propose-price-change - Hustler proposes price change (before start code)
router.post('/:id/propose-price-change', authenticate, requireRole('HUSTLER'), [
  body('amount').optional().isFloat({ min: 0 }),
  body('hourlyRate').optional().isFloat({ min: 0 }),
  body('estHours').optional().isInt({ min: 1 }),
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
      include: { 
        payment: true,
        customer: { select: { id: true, name: true, email: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only propose price changes for jobs assigned to you' });
    }

    // Price changes only allowed before start code
    if (job.startCodeVerified) {
      return res.status(400).json({ 
        error: 'Price is locked. Cannot change price after job has started.' 
      });
    }

    // Only allow for SCHEDULED or ASSIGNED jobs (hustler already assigned)
    if (job.status !== 'SCHEDULED' && job.status !== 'ASSIGNED') {
      return res.status(400).json({ 
        error: 'Can only propose price changes for scheduled jobs with an assigned hustler' 
      });
    }

    if (!job.hustlerId) {
      return res.status(400).json({ 
        error: 'No hustler assigned to this job' 
      });
    }

    const { amount, hourlyRate, estHours } = req.body;
    const proposedPrice = {
      amount: amount !== undefined ? parseFloat(amount) : null,
      hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : null,
      estHours: estHours !== undefined ? parseInt(estHours) : null,
      proposedAt: new Date().toISOString(),
      status: 'PENDING', // PENDING = waiting for hustler acceptance
    };

    // Store in job requirements
    const existingRequirements = job.requirements || {};
    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        requirements: {
          ...existingRequirements,
          proposedPriceChange: proposedPrice
        }
      },
      include: {
        customer: { select: { id: true, name: true, email: true } }
      }
    });

    // Send notification email to customer (non-blocking)
    const { sendPriceChangeProposalEmail } = require('../services/email');
    try {
      await sendPriceChangeProposalEmail(
        job.customer.email,
        job.customer.name,
        job.title,
        job.id,
        proposedPrice
      );
    } catch (emailError) {
      console.error('Error sending price change proposal email:', emailError);
    }

    res.json({ 
      success: true,
      job: updatedJob,
      proposedPrice 
    });
  } catch (error) {
    console.error('Propose price change error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /jobs/:id/accept-price-change - Customer accepts price change
// If price increases, customer must authorize additional payment
// If price decreases, customer gets refund notification
router.post('/:id/accept-price-change', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        payment: true,
        hustler: { select: { id: true, name: true, email: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only accept price changes for your own jobs' });
    }

    // Price changes only allowed before start code
    if (job.startCodeVerified) {
      return res.status(400).json({ 
        error: 'Price is locked. Cannot change price after job has started.' 
      });
    }

    const requirements = job.requirements || {};
    const proposedPrice = requirements.proposedPriceChange;

    if (!proposedPrice || proposedPrice.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'No pending price change proposal found' 
      });
    }

    // Calculate new job amount
    let newJobAmount = job.amount;
    if (job.payType === 'hourly') {
      const newRate = proposedPrice.hourlyRate !== null ? proposedPrice.hourlyRate : job.hourlyRate;
      const newHours = proposedPrice.estHours !== null ? proposedPrice.estHours : job.estHours;
      newJobAmount = newRate * newHours;
    } else {
      newJobAmount = proposedPrice.amount !== null ? proposedPrice.amount : job.amount;
    }

    const oldJobAmount = job.payType === 'hourly' 
      ? (Number(job.hourlyRate || 0) * Number(job.estHours || 0))
      : Number(job.amount || 0);

    const priceDifference = newJobAmount - oldJobAmount;
    const customerFee = newJobAmount * 0.065;
    const oldCustomerFee = oldJobAmount * 0.065;
    const feeDifference = customerFee - oldCustomerFee;
    const totalDifference = priceDifference + feeDifference;

    // If price increased, customer needs to authorize additional payment
    if (totalDifference > 0.01 && job.payment && job.payment.providerId) {
      // Create a new PaymentIntent for the difference
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      
      try {
        const differencePaymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalDifference * 100), // Convert to cents
          currency: 'usd',
          payment_method_types: ['card'],
          capture_method: 'manual',
          metadata: {
            jobId: job.id,
            type: 'price_increase',
            originalAmount: oldJobAmount.toString(),
            newAmount: newJobAmount.toString(),
            difference: priceDifference.toString(),
            customerFeeDifference: feeDifference.toString(),
            totalDifference: totalDifference.toString()
          }
        });

        // Store the difference payment intent ID in requirements
        const existingRequirements = job.requirements || {};
        let parsedRequirements = existingRequirements;
        if (typeof parsedRequirements === 'string') {
          try {
            parsedRequirements = JSON.parse(parsedRequirements);
          } catch (e) {
            parsedRequirements = {};
          }
        }

        // Mark price change as accepted but pending payment
        await prisma.job.update({
          where: { id: req.params.id },
          data: {
            requirements: {
              ...parsedRequirements,
              proposedPriceChange: {
                ...proposedPrice,
                status: 'ACCEPTED_PENDING_PAYMENT',
                acceptedAt: new Date().toISOString(),
                differencePaymentIntentId: differencePaymentIntent.id,
                priceDifference: priceDifference,
                feeDifference: feeDifference,
                totalDifference: totalDifference
              }
            }
          }
        });

        return res.json({
          success: true,
          requiresPayment: true,
          paymentIntentId: differencePaymentIntent.id,
          clientSecret: differencePaymentIntent.client_secret,
          amount: {
            jobAmount: priceDifference,
            customerFee: feeDifference,
            total: totalDifference
          },
          message: `Price increased by $${totalDifference.toFixed(2)}. Please authorize additional payment to accept this price change.`
        });
      } catch (stripeError) {
        console.error('[PRICE CHANGE] Error creating difference payment intent:', stripeError);
        return res.status(500).json({
          error: 'Failed to create payment authorization',
          message: stripeError.message
        });
      }
    }

    // Price decreased or no change - update PaymentIntent directly (Stripe handles refund automatically)
    if (job.payment && job.payment.providerId) {
      try {
        if (!process.env.STRIPE_SECRET_KEY) {
          console.warn('[PRICE CHANGE] Stripe secret key not configured, skipping payment intent update');
        } else {
          const Stripe = require('stripe');
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          
          const existingIntent = await stripe.paymentIntents.retrieve(job.payment.providerId);
          const existingMetadata = existingIntent.metadata || {};
          
          const newTotal = newJobAmount + customerFee;

          // Update payment intent amount (Stripe automatically refunds if decreased)
          if (existingIntent.status === 'requires_capture' || existingIntent.status === 'requires_payment_method') {
            await stripe.paymentIntents.update(job.payment.providerId, {
              amount: Math.round(newTotal * 100),
              metadata: {
                ...existingMetadata,
                amount: newJobAmount.toString(),
                tip: '0',
                customerFee: customerFee.toString(),
                priceUpdatedAt: new Date().toISOString()
              }
            });
            console.log(`[PRICE CHANGE] Updated Stripe payment intent ${job.payment.providerId} to $${newTotal}`);
          }
        }
      } catch (stripeError) {
        console.error('[PRICE CHANGE] Stripe update error:', stripeError);
        // Continue with job update even if Stripe update fails
      }
    }

    // Update job with new price
    const updateData = {
      amount: newJobAmount
    };
    
    if (job.payType === 'hourly') {
      if (proposedPrice.hourlyRate !== null) {
        updateData.hourlyRate = proposedPrice.hourlyRate;
      }
      if (proposedPrice.estHours !== null) {
        updateData.estHours = proposedPrice.estHours;
      }
    }

    // Mark price change as accepted
    let existingRequirements = job.requirements || {};
    if (typeof existingRequirements === 'string') {
      try {
        existingRequirements = JSON.parse(existingRequirements);
      } catch (e) {
        existingRequirements = {};
      }
    }
    
    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        requirements: {
          ...existingRequirements,
          proposedPriceChange: {
            ...proposedPrice,
            status: 'ACCEPTED',
            acceptedAt: new Date().toISOString()
          }
        }
      },
      include: {
        customer: { select: { id: true, name: true, email: true } }
      }
    });

    // Update payment record
    if (job.payment) {
      const total = newJobAmount + customerFee;
      await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          amount: newJobAmount,
          tip: 0,
          feeCustomer: customerFee,
          total
        }
      });
    }

    // Send notification email to hustler
    const { sendPriceChangeAcceptedEmail } = require('../services/email');
    try {
      await sendPriceChangeAcceptedEmail(
        job.hustler.email,
        job.hustler.name,
        job.title,
        job.id,
        newJobAmount
      );
    } catch (emailError) {
      console.error('Error sending price change accepted email:', emailError);
    }

    // If price decreased, return refund info
    const refundInfo = priceDifference < -0.01 ? {
      refunded: true,
      amount: Math.abs(totalDifference),
      message: `You'll be refunded $${Math.abs(totalDifference).toFixed(2)}. The refund will appear in your account within 5-10 business days.`
    } : null;

    res.json({ 
      success: true,
      job: updatedJob,
      newAmount: newJobAmount,
      requiresPayment: false,
      refund: refundInfo
    });
  } catch (error) {
    console.error('[PRICE CHANGE] Accept price change error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /jobs/:id/decline-price-change - Hustler declines price change
router.post('/:id/decline-price-change', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        hustler: { select: { id: true, name: true, email: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden - You can only decline price changes for your own jobs' });
    }

    if (job.startCodeVerified) {
      return res.status(400).json({ 
        error: 'Price is locked. Cannot change price after job has started.' 
      });
    }

    let requirements = job.requirements || {};
    if (typeof requirements === 'string') {
      try {
        requirements = JSON.parse(requirements);
      } catch (e) {
        requirements = {};
      }
    }
    
    const proposedPrice = requirements.proposedPriceChange;

    if (!proposedPrice || proposedPrice.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'No pending price change proposal found' 
      });
    }

    // Mark price change as declined
    let existingRequirements = job.requirements || {};
    if (typeof existingRequirements === 'string') {
      try {
        existingRequirements = JSON.parse(existingRequirements);
      } catch (e) {
        existingRequirements = {};
      }
    }
    
    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        requirements: {
          ...existingRequirements,
          proposedPriceChange: {
            ...proposedPrice,
            status: 'DECLINED',
            declinedAt: new Date().toISOString()
          }
        }
      }
    });

    // Send notification email to hustler
    const { sendPriceChangeDeclinedEmail } = require('../services/email');
    try {
      await sendPriceChangeDeclinedEmail(
        job.hustler.email,
        job.hustler.name,
        job.title,
        job.id
      );
    } catch (emailError) {
      console.error('Error sending price change declined email:', emailError);
    }

    res.json({ 
      success: true,
      job: updatedJob
    });
  } catch (error) {
    console.error('Decline price change error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /jobs/:id/finalize-price-change - Customer finalizes price change after authorizing additional payment
router.post('/:id/finalize-price-change', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { 
        payment: true,
        hustler: { select: { id: true, name: true, email: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const requirements = job.requirements || {};
    let parsedRequirements = requirements;
    if (typeof parsedRequirements === 'string') {
      try {
        parsedRequirements = JSON.parse(parsedRequirements);
      } catch (e) {
        parsedRequirements = {};
      }
    }

    const proposedPrice = parsedRequirements.proposedPriceChange;
    if (!proposedPrice || proposedPrice.status !== 'ACCEPTED_PENDING_PAYMENT') {
      return res.status(400).json({ 
        error: 'No pending price change payment found' 
      });
    }

    if (proposedPrice.differencePaymentIntentId !== paymentIntentId) {
      return res.status(400).json({ 
        error: 'Payment intent ID does not match' 
      });
    }

    // Verify payment intent is authorized
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'requires_capture') {
      return res.status(400).json({ 
        error: 'Payment not authorized',
        status: paymentIntent.status
      });
    }

    // Calculate new job amount
    let newJobAmount = job.amount;
    if (job.payType === 'hourly') {
      const newRate = proposedPrice.hourlyRate !== null ? proposedPrice.hourlyRate : job.hourlyRate;
      const newHours = proposedPrice.estHours !== null ? proposedPrice.estHours : job.estHours;
      newJobAmount = newRate * newHours;
    } else {
      newJobAmount = proposedPrice.amount !== null ? proposedPrice.amount : job.amount;
    }

    const customerFee = newJobAmount * 0.065;
    const newTotal = newJobAmount + customerFee;

    // Update original payment intent to new total
    if (job.payment && job.payment.providerId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(job.payment.providerId);
        if (existingIntent.status === 'requires_capture' || existingIntent.status === 'requires_payment_method') {
          await stripe.paymentIntents.update(job.payment.providerId, {
            amount: Math.round(newTotal * 100),
            metadata: {
              ...existingIntent.metadata,
              amount: newJobAmount.toString(),
              tip: '0',
              customerFee: customerFee.toString(),
              priceUpdatedAt: new Date().toISOString(),
              differencePaymentIntentId: paymentIntentId
            }
          });
        }
      } catch (stripeError) {
        console.error('[PRICE CHANGE] Error updating original payment intent:', stripeError);
      }
    }

    // Update job with new price
    const updateData = {
      amount: newJobAmount
    };
    
    if (job.payType === 'hourly') {
      if (proposedPrice.hourlyRate !== null) {
        updateData.hourlyRate = proposedPrice.hourlyRate;
      }
      if (proposedPrice.estHours !== null) {
        updateData.estHours = proposedPrice.estHours;
      }
    }

    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        requirements: {
          ...parsedRequirements,
          proposedPriceChange: {
            ...proposedPrice,
            status: 'ACCEPTED',
            acceptedAt: new Date().toISOString()
          }
        }
      },
      include: {
        customer: { select: { id: true, name: true, email: true } }
      }
    });

    // Update payment record
    if (job.payment) {
      await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          amount: newJobAmount,
          tip: 0,
          feeCustomer: customerFee,
          total: newTotal
        }
      });
    }

    // Send notification email
    const { sendPriceChangeAcceptedEmail } = require('../services/email');
    try {
      await sendPriceChangeAcceptedEmail(
        job.customer.email,
        job.customer.name,
        job.title,
        job.id,
        newJobAmount
      );
    } catch (emailError) {
      console.error('Error sending price change accepted email:', emailError);
    }

    res.json({ 
      success: true,
      job: updatedJob,
      newAmount: newJobAmount
    });
  } catch (error) {
    console.error('[PRICE CHANGE] Finalize price change error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
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

// POST /jobs/rehire - Create a private rehire job and send request to specific hustler
router.post('/rehire', authenticate, requireRole('CUSTOMER'), [
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
  body('hustlerId').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
      hustlerId,
    } = req.body;

    // Geocode address
    let lat = null, lng = null;
    try {
      const coords = await geocodeAddress(address);
      lat = coords.lat;
      lng = coords.lng;
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
    }

    // Verify hustler exists
    const hustler = await prisma.user.findUnique({
      where: { id: hustlerId },
      select: { id: true, name: true, email: true, roles: true },
    });

    if (!hustler) {
      return res.status(404).json({ error: 'Hustler not found' });
    }

    if (!hustler.roles || !hustler.roles.includes('HUSTLER')) {
      return res.status(400).json({ error: 'User is not a hustler' });
    }

    // Create private rehire job
    const jobData = {
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
      amount: parseFloat(amount),
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      estHours: estHours ? parseInt(estHours) : null,
      requirements: {
        ...requirements,
        teamSize: parseInt(teamSize) || 1,
        isPrivate: true, // Mark as private - won't appear in Browse Jobs
        rehireHustlerId: hustlerId,
      },
      status: 'OPEN',
    };

    const job = await prisma.job.create({
      data: jobData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create offer automatically for the specified hustler
    const offer = await prisma.offer.create({
      data: {
        jobId: job.id,
        hustlerId: hustlerId,
        status: 'PENDING',
        note: 'Private rehire request',
      },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create thread for messaging
    let thread = null;
    try {
      thread = await prisma.thread.upsert({
        where: { jobId: job.id },
        update: {},
        create: {
          jobId: job.id,
          userAId: req.user.id,
          userBId: hustlerId,
        },
      });
    } catch (threadError) {
      console.error('Thread creation error (non-fatal):', threadError);
    }

    // Send rehire message to hustler
    if (thread) {
      try {
        await prisma.message.create({
          data: {
            threadId: thread.id,
            senderId: req.user.id,
            body: `You've been invited to a rehire job by ${req.user.name || 'a customer'}.`,
          },
        });
      } catch (msgError) {
        console.error('Message creation error (non-fatal):', msgError);
      }
    }

    // Send email notification
    try {
      const { sendRehireRequestEmail } = require('../services/email');
      await sendRehireRequestEmail(
        hustler.email,
        hustler.name,
        job.title,
        req.user.name
      );
    } catch (emailError) {
      console.error('Email sending error (non-fatal):', emailError);
    }

    res.status(201).json({
      ...job,
      offer,
      message: 'Rehire request sent successfully',
    });
  } catch (error) {
    console.error('Create rehire job error:', error);
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

      // Send email receipts to both customer and hustler
      const { sendPaymentReceiptEmail, sendHustlerPaymentReceiptEmail } = require('../services/email');
      const receiptUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}/payments/receipts/${job.payment.id}`;
      
      // Send customer receipt
      if (job.customer?.email) {
        sendPaymentReceiptEmail(
          job.customer.email,
          job.customer.name,
          job.payment,
          receiptUrl
        ).catch(emailError => {
          console.error('[CONFIRM COMPLETE] Error sending customer receipt email:', emailError);
        });
      }
      
      // Send hustler receipt
      if (job.hustler?.email) {
        const actualHours = job.requirements?.actualHours || null;
        sendHustlerPaymentReceiptEmail(
          job.hustler.email,
          job.hustler.name,
          job.title,
          req.params.id,
          job.payment,
          actualHours
        ).catch(emailError => {
          console.error('[CONFIRM COMPLETE] Error sending hustler receipt email:', emailError);
        });
      }
      
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
      
      // Calculate actual amounts for completion modal
      const actualJobAmount = finalJob.payment.amount || 0;
      const platformFee = finalJob.payment.feeHustler || (actualJobAmount * 0.12);
      const hustlerPayout = actualJobAmount - platformFee;
      const actualHours = finalJob.requirements?.actualHours || null;
      
      return res.json({
        ...finalJob,
        message: 'Job confirmed and payment released to hustler',
        success: true,
        paymentReleased: true,
        actualJobAmount: actualJobAmount,
        hustlerPayout: hustlerPayout,
        actualHours: actualHours,
        platformFee: platformFee,
        customerId: finalJob.customerId,
        hustlerId: finalJob.hustlerId
      });
    }

    // Even if no payment, return success response for completion modal
    const finalJobNoPayment = await prisma.job.findUnique({
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
      ...finalJobNoPayment,
      success: true,
      paymentReleased: false,
      customerId: finalJobNoPayment.customerId,
      hustlerId: finalJobNoPayment.hustlerId
    });
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
        offers: {
          include: {
            hustler: { select: { id: true, email: true, name: true } }
          }
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
      return res.status(403).json({ error: 'You can only delete your own jobs' });
    }

    // BUSINESS RULE: Cannot delete if job is in progress (start code verified)
    if (job.startCodeVerified || job.status === 'IN_PROGRESS') {
      return res.status(400).json({ 
        error: 'Cannot delete job that is in progress. Once the start code is entered, the job must be completed. Please contact support.',
        message: 'Job is currently in progress and cannot be deleted.'
      });
    }

    // Store info for email before deleting
    const jobTitle = job.title;
    const hustlerEmail = job.hustler?.email;
    const hustlerName = job.hustler?.name;
    const customerEmail = job.customer?.email || req.user.email;
    const customerName = job.customer?.name || req.user.name;

    // Process refund (automatic if before start code)
    const refundInfo = await processRefundIfNeeded(job, 'Job deleted by customer', req.user.id, req.user.name, req.ip);

    // Delete payment first (if exists) - Payment has ON DELETE RESTRICT constraint
    // Note: Refund should have already been processed above, but we still need to delete the payment record
    if (job.payment) {
      try {
        await prisma.payment.delete({
          where: { id: job.payment.id },
        });
      } catch (paymentError) {
        console.error('Error deleting payment:', paymentError);
        // If payment deletion fails, try to continue with job deletion
        // The error might be that payment doesn't exist or is already deleted
      }
    }

    // Delete the job (cascade will handle offers, threads, etc.)
    await prisma.job.delete({
      where: { id: req.params.id },
    });

    // Send notification emails (non-blocking)
    try {
      const emailService = require('../services/email');
      
      // Notify hustler if they were assigned
      if (hustlerEmail && hustlerName) {
        if (emailService.sendJobDeletedEmail) {
          await emailService.sendJobDeletedEmail(
            hustlerEmail,
            hustlerName,
            jobTitle,
            customerName || 'Customer'
          );
        }
      }
      
      // Notify customer (confirmation)
      if (customerEmail && customerName && emailService.sendJobDeletedConfirmationEmail) {
        await emailService.sendJobDeletedConfirmationEmail(
          customerEmail,
          customerName,
          jobTitle
        );
      }
    } catch (emailError) {
      console.error('Error sending delete notification emails (non-fatal):', emailError);
    }

    res.json({ 
      message: 'Job deleted successfully',
      refund: refundInfo.refunded ? {
        processed: true,
        amount: refundInfo.amount,
        message: refundInfo.message
      } : null
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to process refunds (only if start code not verified)
// Returns: { refunded: boolean, amount: number, message: string }
async function processRefundIfNeeded(job, reason, actorId, actorName, ipAddress = 'system') {
  // Only refund if job hasn't started (start code not verified)
  if (job.startCodeVerified || job.status === 'IN_PROGRESS') {
    return { refunded: false, amount: 0, message: 'No refund: Job has already started' };
  }

  if (!job.payment) {
    return { refunded: false, amount: 0, message: 'No payment to refund' };
  }

  const { voidPaymentIntent, createRefund } = require('../services/stripe');
  const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';

  try {
    if (job.payment.status === 'PREAUTHORIZED') {
      // Payment is on hold - void it
      if (!skipStripeCheck && job.payment.providerId) {
        try {
          await voidPaymentIntent(job.payment.providerId);
        } catch (voidError) {
          console.error('Error voiding payment intent:', voidError);
          // Continue even if void fails
        }
      }

      await prisma.payment.update({
        where: { id: job.payment.id },
        data: { 
          status: 'VOIDED',
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          actorId: actorId,
          actionType: 'VOID',
          resourceType: 'PAYMENT',
          resourceId: job.payment.id,
          details: {
            reason: reason,
            jobId: job.id,
          },
          ipAddress: ipAddress,
        },
      }).catch(err => console.error('Error creating audit log:', err));
      
      return { 
        refunded: true, 
        amount: Number(job.payment.total), 
        message: `Payment authorization voided. $${Number(job.payment.total).toFixed(2)} will not be charged.`
      };
    } else if (job.payment.status === 'CAPTURED') {
      // Payment was captured - issue full refund
      const refundAmount = Number(job.payment.total);
      if (!skipStripeCheck && job.payment.providerId) {
        const refundAmountCents = Math.round(refundAmount * 100);
        await createRefund(job.payment.providerId, refundAmountCents);
      }

      await prisma.payment.update({
        where: { id: job.payment.id },
        data: { 
          status: 'REFUNDED',
          refundAmount: refundAmount,
          refundReason: reason,
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          actorId: actorId,
          actionType: 'REFUND',
          resourceType: 'PAYMENT',
          resourceId: job.payment.id,
          details: {
            amount: refundAmount,
            reason: reason,
            jobId: job.id,
          },
          ipAddress: ipAddress,
        },
      }).catch(err => console.error('Error creating audit log:', err));
      
      // Send email to customer about refund
      const { sendRefundEmail, sendAdminRefundNotification } = require('../services/email');
      try {
        const customer = await prisma.user.findUnique({
          where: { id: job.customerId },
          select: { email: true, name: true }
        });
        
        if (customer) {
          await sendRefundEmail(
            customer.email,
            customer.name,
            job.title,
            Number(job.payment.total)
          );
        }
      } catch (emailError) {
        console.error('Error sending refund email:', emailError);
      }

      return { 
        refunded: true, 
        amount: refundAmount, 
        message: `Full refund of $${refundAmount.toFixed(2)} has been processed. It may take 5-10 business days to appear in your account.`
      };
    }
    
    // No refund needed (payment already processed or no payment)
    return { refunded: false, amount: 0, message: 'No refund processed' };
  } catch (error) {
    console.error('Error processing refund:', error);
    return { refunded: false, amount: 0, message: 'Error processing refund' };
  }
}
        await sendAdminRefundNotification(
          payment,
          Number(job.payment.total),
          reason,
          actorName || 'System'
        );
      } catch (adminError) {
        console.error('Error sending admin refund notification:', adminError);
      }
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    // Continue even if refund fails - don't block the operation
  }
}

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
        error: 'Cannot unassign: Job is in progress. Once the start code is entered, the job must be completed. Please contact support.',
        startCodeUsed: true
      });
    }

    // Process refund (automatic if before start code)
    const refundInfo = await processRefundIfNeeded(job, 'Job unassigned by customer', req.user.id, req.user.name, req.ip);

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
        const emailService = require('../services/email');
        if (emailService.sendJobUnacceptedEmail) {
          await emailService.sendJobUnacceptedEmail(
            job.hustler.email,
            job.hustler.name,
            job.title,
            job.id,
            job.customer?.name || 'Customer'
          );
        }
      } catch (emailError) {
        console.error('Error sending unaccept email:', emailError);
      }
    }
    
    // Send notification email to customer (confirmation)
    if (job.customer) {
      try {
        const emailService = require('../services/email');
        if (emailService.sendHustlerUnassignedConfirmationEmail) {
          await emailService.sendHustlerUnassignedConfirmationEmail(
            job.customer.email,
            job.customer.name,
            job.title,
            job.hustler?.name || 'Hustler'
          );
        }
      } catch (emailError) {
        console.error('Error sending unassign confirmation email:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Hustler unassigned. Job is now open for other applicants.',
      job: updatedJob,
      refund: refundInfo.refunded ? {
        processed: true,
        amount: refundInfo.amount,
        message: refundInfo.message
      } : null
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
        payment: true,
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
        error: 'Cannot leave: Job is in progress. Once the start code is entered, the job must be completed. Please contact support.',
        jobStarted: true
      });
    }

    // Process refund (automatic if before start code)
    await processRefundIfNeeded(job, 'Hustler left job', req.user.id, req.user.name, req.ip);

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
    
    // Send notification email to hustler (confirmation)
    try {
      const emailService = require('../services/email');
      if (emailService.sendHustlerLeftConfirmationEmail) {
        await emailService.sendHustlerLeftConfirmationEmail(
          req.user.email,
          req.user.name,
          job.title,
          job.customer?.name || 'Customer'
        );
      }
    } catch (emailError) {
      console.error('Error sending leave confirmation email:', emailError);
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

const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { geocodeAddress } = require('../services/mapbox');
const { validateTennesseeZip } = require('../services/zipcode');

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
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, category, lat, lng, radius = 10, zip, city } = req.query;
    const userId = req.user?.id;

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    // Location-based filtering: Only apply if explicitly requested (zip or lat/lng provided)
    // Don't auto-filter by user location - show all jobs by default, filter only when user requests it
    let locationFilter = null;
    let shouldFilterByLocation = false;
    
    if (zip) {
      // User explicitly provided zip code - filter by it
      shouldFilterByLocation = true;
      const usersWithZip = await prisma.user.findMany({
        where: { zip: zip },
        select: { id: true },
      });
      const userIds = usersWithZip.map(u => u.id);
      
      if (userIds.length > 0) {
        locationFilter = { customerId: { in: userIds } };
      } else {
        // No users with this zip - will filter in post-processing by requirements.pickupZip
        locationFilter = null;
      }
    } else if (lat && lng) {
      // User explicitly provided lat/lng - filter by radius
      shouldFilterByLocation = true;
      // Use lat/lng with radius (in miles, convert to approximate degrees)
      // 1 degree latitude ≈ 69 miles
      // 1 degree longitude ≈ 69 * cos(latitude) miles
      const latDelta = radius / 69;
      const lngDelta = radius / (69 * Math.cos(parseFloat(lat) * Math.PI / 180));
      
      where.lat = {
        gte: parseFloat(lat) - latDelta,
        lte: parseFloat(lat) + latDelta,
      };
      where.lng = {
        gte: parseFloat(lng) - lngDelta,
        lte: parseFloat(lng) + lngDelta,
      };
    }
    // NOTE: Removed auto-filtering by user profile location - show all jobs by default
    // Users can manually filter using zip code or location if they want

    // Only apply location filter if user explicitly requested it
    if (shouldFilterByLocation && locationFilter) {
      // Merge location filter into where clause
      Object.assign(where, locationFilter);
    }

    // NOTE: Show all jobs by default - no role-based filtering
    // Tab-based filtering (My Jobs, Available Jobs, My Hustles) is handled client-side

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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Post-process: Filter by zip code in job requirements if zip filter was provided
    let filteredJobs = jobs;
    if (zip && shouldFilterByLocation) {
      filteredJobs = jobs.filter(job => {
        // Check customer zip
        if (job.customer?.zip === zip) return true;
        // Check job requirements.pickupZip
        const reqZip = job.requirements?.pickupZip;
        if (reqZip && reqZip.toString() === zip.toString()) return true;
        return false;
      });
    }

    // Always return array, even if empty
    res.json(filteredJobs || []);
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
    const storedCode = job.requirements?.verificationCode;
    const providedCode = String(verificationCode).trim();
    const storedCodeStr = storedCode ? String(storedCode).trim() : null;
    
    if (!storedCodeStr || storedCodeStr !== providedCode) {
      return res.status(400).json({ 
        error: 'Invalid verification code'
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
          const hustlerAmount = job.payment.amount ? Number(job.payment.amount) * 0.84 : 0; // 84% after 16% fee
          await transferToHustler(
            hustler.stripeAccountId,
            hustlerAmount,
            job.id,
            `Payment for job: ${job.title}`
          );
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
          data: { status: 'VOIDED' },
        });
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
        const { sendRefundEmail } = require('../services/email');
        await sendRefundEmail(
          req.user.email,
          req.user.name,
          job.title,
          Number(job.payment.amount + (job.payment.tip || 0))
        );
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
              await transferToHustler(
                job.hustler.stripeAccountId,
                hustlerAmount,
                job.id,
                `Payment for job: ${job.title}`
              );
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

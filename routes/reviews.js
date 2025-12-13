const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /reviews - Get reviews with optional userId query parameter
// Single source of truth for reviews - used everywhere in the app
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    // Default to 6 reviews for initial load, allow up to 50
    const { limit = 6, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 6, 50);
    const offsetNum = parseInt(offset) || 0;

    const reviews = await prisma.review.findMany({
      where: {
        revieweeId: userId,
        isHidden: false,
      },
      include: {
        reviewer: {
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
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limitNum,
      skip: offsetNum,
    });

    // Return reviews with total count for pagination
    const totalCount = await prisma.review.count({
      where: {
        revieweeId: userId,
        isHidden: false,
      },
    });

    res.json({
      reviews,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < totalCount,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /reviews - Create a review (after job is paid)
router.post('/', authenticate, [
  body('jobId').trim().notEmpty(),
  body('revieweeId').trim().notEmpty(),
  body('stars').isInt({ min: 1, max: 5 }),
  body('text').trim().isLength({ min: 10, max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { jobId, revieweeId, stars, text, photos = [] } = req.body;
    const reviewerId = req.user.id;

    // Verify the job exists and is paid
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        reviews: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Allow reviews for completed jobs - payment capture is not required for review
    // Jobs can be completed (COMPLETED_BY_HUSTLER with completion code verified) even if payment processing is delayed
    const isPaid = job.status === 'PAID' && job.payment && job.payment.status === 'CAPTURED';
    const isCompleted = job.status === 'COMPLETED_BY_HUSTLER'; // Allow reviews for completed jobs regardless of payment status
    const isAwaitingConfirm = job.status === 'AWAITING_CUSTOMER_CONFIRM'; // Also allow reviews when awaiting customer confirmation
    
    if (!isPaid && !isCompleted && !isAwaitingConfirm) {
      return res.status(400).json({ 
        error: 'Can only review jobs that have been completed. Job status must be PAID, COMPLETED_BY_HUSTLER, or AWAITING_CUSTOMER_CONFIRM' 
      });
    }

    // Verify the reviewer is either the customer or hustler
    if (job.customerId !== reviewerId && job.hustlerId !== reviewerId) {
      return res.status(403).json({ 
        error: 'You can only review jobs you are involved in' 
      });
    }

    // Verify the reviewee is the other party
    const expectedRevieweeId = job.customerId === reviewerId 
      ? job.hustlerId 
      : job.customerId;
    
    if (expectedRevieweeId !== revieweeId) {
      return res.status(400).json({ 
        error: 'Invalid reviewee' 
      });
    }

    // Check if reviewer already left a review for this job
    const existingReview = await prisma.review.findFirst({
      where: {
        jobId,
        reviewerId,
      },
    });

    if (existingReview) {
      return res.status(400).json({ 
        error: 'You have already reviewed this job' 
      });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        reviewerId,
        revieweeId,
        jobId,
        stars: parseInt(stars),
        text: text.trim(),
        photos: Array.isArray(photos) ? photos : [],
      },
      include: {
        reviewer: {
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

    // Update reviewee's rating average and count
    const allReviews = await prisma.review.findMany({
      where: {
        revieweeId,
        isHidden: false,
      },
      select: { stars: true },
    });

    const avgRating = allReviews.reduce((sum, r) => sum + r.stars, 0) / allReviews.length;
    
    await prisma.user.update({
      where: { id: revieweeId },
      data: {
        ratingAvg: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        ratingCount: allReviews.length,
      },
    });

    res.status(201).json(review);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reviews/user/:userId - Get all reviews for a user (alternative route)
// Same as GET /reviews?userId=:userId but with path parameter
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    // Default to 6 reviews for initial load, allow up to 50
    const { limit = 6, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 6, 50);
    const offsetNum = parseInt(offset) || 0;

    const reviews = await prisma.review.findMany({
      where: {
        revieweeId: userId,
        isHidden: false,
      },
      include: {
        reviewer: {
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
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limitNum,
      skip: offsetNum,
    });

    // Return reviews with total count for pagination
    const totalCount = await prisma.review.count({
      where: {
        revieweeId: userId,
        isHidden: false,
      },
    });

    res.json({
      reviews,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < totalCount,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reviews/job/:jobId - Get reviews for a specific job
router.get('/job/:jobId', optionalAuth, async (req, res) => {
  try {
    const { jobId } = req.params;

    const reviews = await prisma.review.findMany({
      where: {
        jobId,
        isHidden: false,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(reviews);
  } catch (error) {
    console.error('Get job reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


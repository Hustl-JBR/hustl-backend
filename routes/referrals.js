const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Generate unique referral code
function generateReferralCode(userId) {
  // Use first 4 chars of user ID + random 4 chars
  const prefix = userId.substring(0, 4).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${random}`;
}

// GET /referrals/me - Get current user's referral code and stats
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create referral code
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user.referralCode) {
      // Generate unique referral code
      let code = generateReferralCode(userId);
      let exists = await prisma.user.findUnique({ where: { referralCode: code } });
      
      // Ensure uniqueness
      while (exists) {
        code = generateReferralCode(userId + Date.now());
        exists = await prisma.user.findUnique({ where: { referralCode: code } });
      }

      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
    }

    // Get referral stats
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referredUser: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalReferrals: referrals.length,
      completedJobs: referrals.filter(r => r.referredUserCompletedJob).length,
      totalRewards: referrals.reduce((sum, r) => sum + Number(r.rewardAmount), 0),
      pendingRewards: referrals
        .filter(r => r.rewardStatus === 'PENDING' && r.referredUserCompletedJob)
        .reduce((sum, r) => sum + Number(r.rewardAmount), 0),
      earnedRewards: referrals
        .filter(r => r.rewardStatus === 'EARNED')
        .reduce((sum, r) => sum + Number(r.rewardAmount), 0),
      paidRewards: referrals
        .filter(r => r.rewardStatus === 'PAID')
        .reduce((sum, r) => sum + Number(r.rewardAmount), 0),
    };

    const referralUrl = `${process.env.APP_BASE_URL || process.env.FRONTEND_BASE_URL || 'http://localhost:8080'}/?ref=${user.referralCode}`;

    res.json({
      referralCode: user.referralCode,
      referralUrl,
      stats,
      referrals: referrals.map(r => ({
        id: r.id,
        referredUser: r.referredUser,
        rewardAmount: Number(r.rewardAmount),
        rewardStatus: r.rewardStatus,
        completedJob: r.referredUserCompletedJob,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      })),
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /referrals/track - Track a referral signup (called during signup)
router.post('/track', async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    if (!referralCode || !userId) {
      return res.status(400).json({ error: 'Referral code and user ID required' });
    }

    // Find referrer by code
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // Don't allow self-referral
    if (referrer.id === userId) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Check if referral already exists
    const existing = await prisma.referral.findUnique({
      where: { referredUserId: userId },
    });

    if (existing) {
      return res.json({ message: 'Referral already tracked', referral: existing });
    }

    // Create referral record
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredUserId: userId,
        rewardAmount: 10.00, // $10 reward for referrer when referred user completes first job
        rewardStatus: 'PENDING',
      },
    });

    // Update referred user
    await prisma.user.update({
      where: { id: userId },
      data: { referredByUserId: referrer.id },
    });

    res.json({ referral, message: 'Referral tracked successfully' });
  } catch (error) {
    console.error('Track referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /referrals/check-completion - Check if referred user completed a job (called when job is paid)
router.post('/check-completion', authenticate, async (req, res) => {
  try {
    const { referredUserId } = req.body;

    if (!referredUserId) {
      return res.status(400).json({ error: 'Referred user ID required' });
    }

    // Find referral
    const referral = await prisma.referral.findUnique({
      where: { referredUserId },
      include: {
        referredUser: {
          include: {
            jobsAsHustler: {
              where: {
                status: 'PAID',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    // Check if referred user has completed at least one paid job
    const paidJobsCount = await prisma.job.count({
      where: {
        OR: [
          { hustlerId: referredUserId, status: 'PAID' },
          { customerId: referredUserId, status: 'PAID' },
        ],
      },
    });
    
    const hasCompletedJob = paidJobsCount > 0;

    if (hasCompletedJob && !referral.referredUserCompletedJob) {
      // Update referral to mark job as completed and award reward
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: {
          referredUserCompletedJob: true,
          rewardStatus: 'EARNED',
          rewardedAt: new Date(),
        },
      });

      res.json({ 
        referral: updated,
        message: 'Reward earned! Referred user completed their first job.',
      });
    } else {
      res.json({ 
        referral,
        message: referral.referredUserCompletedJob ? 'Reward already earned' : 'Referred user has not completed a job yet',
      });
    }
  } catch (error) {
    console.error('Check referral completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


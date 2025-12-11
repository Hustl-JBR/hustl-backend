const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

// Generate a random 6-digit code
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ============================================
// GET /verification/job/:jobId/codes
// Get verification codes for a job (role-based)
// ============================================
router.get('/job/:jobId/codes', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: { select: { id: true, name: true } },
        hustler: { select: { id: true, name: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const isCustomer = job.customerId === userId;
    const isHustler = job.hustlerId === userId;

    if (!isCustomer && !isHustler) {
      return res.status(403).json({ error: 'Not authorized to view this job' });
    }

    // Role-based code visibility
    // Customer sees: their arrival code (to give to hustler), completion verification status
    // Hustler sees: their completion code (to give to customer), arrival verification status
    
    if (isCustomer) {
      return res.json({
        role: 'customer',
        jobId: job.id,
        jobStatus: job.status,
        // Customer has the arrival code to give to hustler
        arrivalCode: job.arrivalCode,
        arrivalCodeVerified: job.arrivalCodeVerified,
        // Customer can see if completion was verified (not the actual code)
        completionCodeVerified: job.completionCodeVerified,
        hustler: job.hustler,
        instructions: job.arrivalCodeVerified 
          ? 'Hustler has arrived! When job is done, enter the code they give you.'
          : 'Give this code to the hustler when they arrive to confirm identity.'
      });
    }

    if (isHustler) {
      return res.json({
        role: 'hustler',
        jobId: job.id,
        jobStatus: job.status,
        // Hustler can see if arrival was verified (not the actual code)
        arrivalCodeVerified: job.arrivalCodeVerified,
        // Hustler has the completion code to give to customer
        completionCode: job.completionCode,
        completionCodeVerified: job.completionCodeVerified,
        customer: job.customer,
        instructions: job.arrivalCodeVerified
          ? 'When job is complete, give this code to the customer to release payment.'
          : 'Ask the customer for their arrival code when you arrive.'
      });
    }

  } catch (error) {
    console.error('Error getting verification codes:', error);
    res.status(500).json({ error: 'Failed to get verification codes' });
  }
});

// ============================================
// POST /verification/job/:jobId/verify-start
// Hustler enters the 6-digit start code (from customer) to activate the job
// ============================================
router.post('/job/:jobId/verify-start', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { code } = req.body;
    const userId = req.user.id;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Start code must be 6 digits' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { payment: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the assigned hustler can verify start code
    if (job.hustlerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned hustler can verify start code' });
    }

    if (job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Job must be in ASSIGNED status to verify start code' });
    }

    // Check if code has expired (78 hours)
    if (job.startCodeExpiresAt && new Date() > new Date(job.startCodeExpiresAt)) {
      // Job expired - refund customer
      const { voidPaymentIntent } = require('../services/stripe');
      try {
        if (job.payment && job.payment.providerId) {
          await voidPaymentIntent(job.payment.providerId);
          await prisma.payment.update({
            where: { id: job.payment.id },
            data: { status: 'REFUNDED' }
          });
        }
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'EXPIRED' }
        });
      } catch (refundError) {
        console.error('Error processing expiration refund:', refundError);
      }
      return res.status(400).json({ 
        error: 'Start code has expired (78 hours). Job has been cancelled and customer refunded.',
        expired: true 
      });
    }

    if (job.startCodeVerified) {
      return res.status(400).json({ error: 'Start code already verified' });
    }

    // Check the code (use startCode, fallback to arrivalCode for migration)
    const expectedCode = job.startCode || job.arrivalCode;
    if (code.trim() !== expectedCode) {
      return res.status(400).json({ error: 'Incorrect code. Ask the customer for the correct 6-digit start code.' });
    }

    // Generate completion code if it doesn't exist
    let completionCode = job.completionCode;
    if (!completionCode) {
      completionCode = generateCode();
    }

    // Mark start code as verified - job is now IN_PROGRESS
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { 
        startCodeVerified: true,
        status: 'IN_PROGRESS', // Job is now in progress
        completionCode: completionCode // Ensure completion code exists
      }
    });

    res.json({
      success: true,
      message: 'Start code verified! Job is now active. You can begin work.',
      startCodeVerified: true,
      jobStatus: 'IN_PROGRESS'
    });

  } catch (error) {
    console.error('Error verifying start code:', error);
    res.status(500).json({ error: 'Failed to verify start code' });
  }
});

// Legacy endpoint - redirect to verify-start
router.post('/job/:jobId/verify-arrival', authenticate, async (req, res) => {
  req.url = req.url.replace('/verify-arrival', '/verify-start');
  return require('./verification').router.handle(req, res);
});

// ============================================
// POST /verification/job/:jobId/verify-completion
// Hustler enters the completion code to complete the job
// ============================================
router.post('/job/:jobId/verify-completion', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { payment: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the assigned hustler can verify completion
    if (job.hustlerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned hustler can verify completion code' });
    }

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Completion code must be 6 digits' });
    }

    // Job must be IN_PROGRESS (start code verified) to complete
    if (job.status !== 'IN_PROGRESS' && !job.startCodeVerified && !job.arrivalCodeVerified) {
      return res.status(400).json({ error: 'Job must be started (start code verified) before completion can be verified' });
    }

    if (job.completionCodeVerified) {
      return res.status(400).json({ error: 'Completion already verified' });
    }

    // Check the code
    if (code.trim() !== job.completionCode) {
      return res.status(400).json({ error: 'Incorrect code. Ask the hustler for the correct 6-digit completion code.' });
    }

    // Calculate 12% platform fee
    const platformFee = Number(job.payment.amount) * 0.12;
    const hustlerPayout = Number(job.payment.amount) - platformFee;

    // Release payment to hustler (capture payment intent and transfer to hustler)
    const { capturePaymentIntent, transferToHustler } = require('../services/stripe');
    
    try {
      // Capture the payment intent
      if (job.payment.providerId) {
        await capturePaymentIntent(job.payment.providerId);
      }

      // Transfer to hustler's Stripe Connect account (minus 12% fee)
      const jobWithHustler = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          hustler: {
            select: { stripeAccountId: true, email: true, name: true }
          }
        }
      });

      if (jobWithHustler.hustler.stripeAccountId) {
        await transferToHustler(
          jobWithHustler.hustler.stripeAccountId,
          hustlerPayout,
          job.id,
          `Payment for job: ${job.title}`
        );
      }

      // Update payment record
      await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          status: 'CAPTURED',
          feeHustler: platformFee,
        }
      });

      // Mark completion as verified and update job status to PAID (allows reviews)
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { 
          completionCodeVerified: true,
          status: 'PAID' // Job is completed and paid, ready for reviews
        }
      });

      res.json({
        success: true,
        message: 'Job completed successfully! Please leave a review.',
        completionCodeVerified: true,
        jobStatus: updatedJob.status,
        paymentReleased: true,
        hustlerPayout: hustlerPayout,
        platformFee: platformFee,
        jobId: jobId,
        customerId: job.customerId,
        hustlerId: job.hustlerId
      });
    } catch (paymentError) {
      console.error('Error releasing payment:', paymentError);
      // Still mark completion as verified even if payment fails (can be retried)
      // But don't set to PAID if payment failed
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          completionCodeVerified: true,
          status: 'COMPLETED_BY_HUSTLER' // Keep as completed but not paid if payment failed
        }
      });
      return res.status(500).json({ 
        error: 'Completion verified but payment release failed. Please contact support.',
        job: updatedJob
      });
    }

  } catch (error) {
    console.error('Error verifying completion:', error);
    res.status(500).json({ error: 'Failed to verify completion' });
  }
});

// ============================================
// POST /verification/job/:jobId/regenerate-start-code
// Customer regenerates the start code (invalidates old one)
// ============================================
router.post('/job/:jobId/regenerate-start-code', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the customer can regenerate codes
    if (job.customerId !== userId) {
      return res.status(403).json({ error: 'Only the customer can regenerate codes' });
    }

    // Can only regenerate if start code hasn't been verified yet
    if (job.startCodeVerified) {
      return res.status(400).json({ error: 'Cannot regenerate start code after it has been verified' });
    }

    // Generate new start code
    const newStartCode = generateCode();
    const startCodeExpiresAt = new Date(Date.now() + 78 * 60 * 60 * 1000); // 78 hours

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        startCode: newStartCode,
        startCodeExpiresAt: startCodeExpiresAt,
        startCodeVerified: false // Reset verification status
      }
    });

    res.json({
      success: true,
      startCode: updatedJob.startCode,
      message: 'Start code regenerated. Old code is no longer valid.'
    });

  } catch (error) {
    console.error('Error regenerating start code:', error);
    res.status(500).json({ error: 'Failed to regenerate start code' });
  }
});

// ============================================
// POST /verification/job/:jobId/regenerate-completion-code
// Customer regenerates the completion code (invalidates old one)
// ============================================
router.post('/job/:jobId/regenerate-completion-code', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the customer can regenerate codes
    if (job.customerId !== userId) {
      return res.status(403).json({ error: 'Only the customer can regenerate codes' });
    }

    // Can only regenerate if completion code hasn't been verified yet
    if (job.completionCodeVerified) {
      return res.status(400).json({ error: 'Cannot regenerate completion code after it has been verified' });
    }

    // Job must be started (IN_PROGRESS) to regenerate completion code
    if (!job.startCodeVerified && job.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Job must be started before completion code can be regenerated' });
    }

    // Generate new completion code
    const newCompletionCode = generateCode();

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        completionCode: newCompletionCode,
        completionCodeVerified: false // Reset verification status
      }
    });

    res.json({
      success: true,
      completionCode: updatedJob.completionCode,
      message: 'Completion code regenerated. Old code is no longer valid.'
    });

  } catch (error) {
    console.error('Error regenerating completion code:', error);
    res.status(500).json({ error: 'Failed to regenerate completion code' });
  }
});

module.exports = router;


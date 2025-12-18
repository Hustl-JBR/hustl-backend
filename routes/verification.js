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

    // Job must be SCHEDULED (hustler accepted, waiting for Start Code) to verify start code
    // Also allow ASSIGNED for backwards compatibility during migration
    if (job.status !== 'SCHEDULED' && job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Job must be in SCHEDULED status to verify start code' });
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

    // BUSINESS RULE: Hustler lock - can only have ONE job in progress at a time
    // Check if hustler already has a job in progress
    const activeJobCount = await prisma.job.count({
      where: {
        hustlerId: userId,
        status: 'IN_PROGRESS',
        id: { not: jobId } // Exclude current job
      }
    });

    if (activeJobCount >= 1) {
      return res.status(400).json({ 
        error: 'You already have a job in progress. Complete that job before starting another.',
        hasActiveJob: true
      });
    }

    // Generate completion code if it doesn't exist
    let completionCode = job.completionCode;
    if (!completionCode) {
      completionCode = generateCode();
    }

    // Mark start code as verified - job is now IN_PROGRESS
    // ⚠️ IMPORTANT: For hourly jobs, this is when the hourly payment timer STARTS
    // The customer authorized the max amount (hourlyRate × maxHours) when accepting the offer
    // But the actual charge will be calculated based on actual hours worked (from startedAt to completion)
    // Store startedAt timestamp for hourly jobs to calculate actual hours worked
    const startedAt = new Date();
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { 
        startCodeVerified: true,
        status: 'IN_PROGRESS', // Job is now in progress
        completionCode: completionCode, // Ensure completion code exists
        // Store start time in requirements JSON for hourly calculation
        requirements: {
          ...(job.requirements || {}),
          startedAt: startedAt.toISOString() // Store when job actually started
        }
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

    // For hourly jobs: Calculate actual hours worked and actual charge
    // For flat jobs: Use the pre-authorized amount
    let actualJobAmount = 0;
    let actualHours = 0;
    const completionTime = new Date();
    
    if (job.payType === 'hourly' && job.hourlyRate) {
      // Get start time from requirements
      const requirements = job.requirements || {};
      const startedAtStr = requirements.startedAt;
      
      if (!startedAtStr) {
        return res.status(400).json({ 
          error: 'Job start time not found. Cannot calculate hours worked.' 
        });
      }
      
      const startedAt = new Date(startedAtStr);
      const timeDiffMs = completionTime - startedAt;
      actualHours = timeDiffMs / (1000 * 60 * 60); // Convert to hours
      
      // Round to 2 decimal places (e.g., 1.67 hours)
      actualHours = Math.round(actualHours * 100) / 100;
      
      // Calculate actual charge: actualHours × hourlyRate
      const hourlyRate = Number(job.hourlyRate);
      actualJobAmount = actualHours * hourlyRate;
      
      // Ensure we don't charge more than the max authorized amount
      const maxAmount = Number(job.payment.amount);
      if (actualJobAmount > maxAmount) {
        console.warn(`[HOURLY JOB] Actual amount ($${actualJobAmount}) exceeds max ($${maxAmount}). Capping to max.`);
        actualJobAmount = maxAmount;
        actualHours = maxAmount / hourlyRate; // Recalculate hours based on cap
      }
      
      console.log(`[HOURLY JOB] Worked ${actualHours} hrs × $${hourlyRate}/hr = $${actualJobAmount.toFixed(2)}`);
    } else {
      // Flat job: use the pre-authorized amount
      actualJobAmount = Number(job.payment.amount);
    }

    // Calculate 12% platform fee on actual amount
    const platformFee = actualJobAmount * 0.12;
    const hustlerPayout = actualJobAmount - platformFee;
    
    // For hourly jobs with multiple workers, split evenly
    const teamSize = job.teamSize || job.requirements?.teamSize || job.requirements?.team_size || 1;
    let perWorkerPayout = 0;
    if (teamSize > 1 && job.payType === 'hourly') {
      perWorkerPayout = hustlerPayout / teamSize;
      console.log(`[HOURLY JOB] ${teamSize} workers → $${perWorkerPayout.toFixed(2)} each (total: $${hustlerPayout.toFixed(2)})`);
    }

    // Release payment to hustler (capture payment intent and transfer to hustler)
    const { capturePaymentIntent, transferToHustler } = require('../services/stripe');
    
    try {
      // Capture the payment intent (partial capture for hourly jobs)
      if (job.payment.providerId) {
        if (job.payType === 'hourly') {
          // Partial capture: only capture the actual amount worked
          await capturePaymentIntent(job.payment.providerId, actualJobAmount);
          console.log(`[HOURLY JOB] Captured $${actualJobAmount.toFixed(2)} (authorized $${Number(job.payment.amount).toFixed(2)})`);
        } else {
          // Full capture for flat jobs
          await capturePaymentIntent(job.payment.providerId);
        }
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

      // Update payment record with actual amount (for hourly jobs)
      await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          status: 'CAPTURED',
          amount: actualJobAmount, // Update to actual amount charged
          feeHustler: platformFee,
        }
      });
      
      // Update job requirements with actual hours worked (for hourly jobs)
      if (job.payType === 'hourly') {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            requirements: {
              ...(job.requirements || {}),
              actualHours: actualHours,
              completedAt: completionTime.toISOString()
            }
          }
        });
      }

      // Mark completion as verified and update job status to PAID (allows reviews)
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { 
          completionCodeVerified: true,
          status: 'PAID' // Job is completed and paid, ready for reviews
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          hustler: { select: { id: true, name: true, email: true } }
        }
      });

      // Send congratulations emails to both customer and hustler
      try {
        const { sendJobCompletionCongratsEmail } = require('../services/email');
        
        // Send to customer
        if (updatedJob.customer && updatedJob.customer.email) {
          await sendJobCompletionCongratsEmail(
            updatedJob.customer.email,
            updatedJob.customer.name,
            updatedJob.title,
            updatedJob.hustler?.name || 'your hustler'
          );
        }
        
        // Send to hustler
        if (updatedJob.hustler && updatedJob.hustler.email) {
          await sendJobCompletionCongratsEmail(
            updatedJob.hustler.email,
            updatedJob.hustler.name,
            updatedJob.title,
            updatedJob.customer?.name || 'your customer'
          );
        }
      } catch (emailError) {
        console.error('Error sending completion congrats emails:', emailError);
        // Don't fail the request if emails fail
      }

      res.json({
        success: true,
        message: 'Job completed successfully! Please leave a review.',
        completionCodeVerified: true,
        jobStatus: updatedJob.status,
        paymentReleased: true,
        actualJobAmount: actualJobAmount,
        actualHours: job.payType === 'hourly' ? actualHours : null,
        hustlerPayout: hustlerPayout,
        perWorkerPayout: teamSize > 1 && job.payType === 'hourly' ? perWorkerPayout : null,
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


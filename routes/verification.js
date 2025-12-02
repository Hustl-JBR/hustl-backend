const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Generate a random 4-digit code
function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ============================================
// GET /verification/job/:jobId/codes
// Get verification codes for a job (role-based)
// ============================================
router.get('/job/:jobId/codes', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

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
// POST /verification/job/:jobId/verify-arrival
// Hustler enters the arrival code (from customer)
// ============================================
router.post('/job/:jobId/verify-arrival', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { code } = req.body;
    const userId = req.user.userId;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the assigned hustler can verify arrival
    if (job.hustlerId !== userId) {
      return res.status(403).json({ error: 'Only the assigned hustler can verify arrival' });
    }

    if (job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Job must be in ASSIGNED status to verify arrival' });
    }

    if (job.arrivalCodeVerified) {
      return res.status(400).json({ error: 'Arrival already verified' });
    }

    // Check the code
    if (code.trim() !== job.arrivalCode) {
      return res.status(400).json({ error: 'Incorrect code. Ask the customer for the correct code.' });
    }

    // Mark arrival as verified
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { arrivalCodeVerified: true }
    });

    res.json({
      success: true,
      message: 'Arrival verified! You can now start the job.',
      arrivalCodeVerified: true,
      completionCode: updatedJob.completionCode
    });

  } catch (error) {
    console.error('Error verifying arrival:', error);
    res.status(500).json({ error: 'Failed to verify arrival' });
  }
});

// ============================================
// POST /verification/job/:jobId/verify-completion
// Customer enters the completion code (from hustler) to release payment
// ============================================
router.post('/job/:jobId/verify-completion', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { code } = req.body;
    const userId = req.user.userId;

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

    // Only the customer can verify completion
    if (job.customerId !== userId) {
      return res.status(403).json({ error: 'Only the customer can verify completion' });
    }

    if (!job.arrivalCodeVerified) {
      return res.status(400).json({ error: 'Arrival must be verified first' });
    }

    if (job.completionCodeVerified) {
      return res.status(400).json({ error: 'Completion already verified' });
    }

    // Check the code
    if (code.trim() !== job.completionCode) {
      return res.status(400).json({ error: 'Incorrect code. Ask the hustler for the correct code.' });
    }

    // Mark completion as verified and update job status
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { 
        completionCodeVerified: true,
        status: 'AWAITING_CUSTOMER_CONFIRM'
      }
    });

    res.json({
      success: true,
      message: 'Job completion verified! Payment will be released to the hustler.',
      completionCodeVerified: true,
      jobStatus: updatedJob.status
    });

  } catch (error) {
    console.error('Error verifying completion:', error);
    res.status(500).json({ error: 'Failed to verify completion' });
  }
});

// ============================================
// POST /verification/job/:jobId/generate-codes
// Generate codes when job is assigned (internal use)
// ============================================
router.post('/job/:jobId/generate-codes', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the customer can generate codes
    if (job.customerId !== userId) {
      return res.status(403).json({ error: 'Only the customer can generate codes' });
    }

    // Don't regenerate if codes already exist
    if (job.arrivalCode && job.completionCode) {
      return res.json({
        arrivalCode: job.arrivalCode,
        completionCode: job.completionCode,
        message: 'Codes already generated'
      });
    }

    const arrivalCode = generateCode();
    const completionCode = generateCode();

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        arrivalCode,
        completionCode
      }
    });

    res.json({
      success: true,
      arrivalCode: updatedJob.arrivalCode,
      completionCode: updatedJob.completionCode
    });

  } catch (error) {
    console.error('Error generating codes:', error);
    res.status(500).json({ error: 'Failed to generate codes' });
  }
});

module.exports = router;


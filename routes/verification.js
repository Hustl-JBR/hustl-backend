const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { calculateFees } = require('../services/pricing');
const { Errors, ErrorCodes } = require('../services/errors');

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
      return Errors.notFound('Job', jobId).send(res);
    }

    const isCustomer = job.customerId === userId;
    const isHustler = job.hustlerId === userId;

    if (!isCustomer && !isHustler) {
      return Errors.forbidden('Not authorized to view this job').send(res);
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
    return Errors.internal('Failed to get verification codes').send(res);
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
      return res.status(400).json({
        error: {
          code: ErrorCodes.INVALID_INPUT,
          message: 'Start code must be 6 digits'
        }
      });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { payment: true }
    });

    if (!job) {
      return Errors.notFound('Job', jobId).send(res);
    }

    // Only the assigned hustler can verify start code
    if (job.hustlerId !== userId) {
      return Errors.forbidden('Only the assigned hustler can verify start code').send(res);
    }

    // Job must be SCHEDULED (hustler accepted, waiting for Start Code) to verify start code
    // Also allow ASSIGNED for backwards compatibility during migration
    if (job.status !== 'SCHEDULED' && job.status !== 'ASSIGNED') {
      return res.status(400).json({
        error: {
          code: ErrorCodes.INVALID_JOB_STATUS,
          message: 'Job must be in SCHEDULED status to verify start code',
          details: { currentStatus: job.status }
        }
      });
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
      return Errors.codeExpired('start').send(res);
    }

    if (job.startCodeVerified) {
      return res.status(400).json({
        error: {
          code: ErrorCodes.CODE_ALREADY_USED,
          message: 'Start code already verified'
        }
      });
    }

    // Check the code (use startCode, fallback to arrivalCode for migration)
    const expectedCode = job.startCode || job.arrivalCode;
    if (code.trim() !== expectedCode) {
      return Errors.invalidCode('start').send(res);
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
      },
      include: {
        customer: { select: { id: true, email: true, name: true } },
        hustler: { select: { id: true, email: true, name: true } },
        payment: true
      }
    });

    // Send email notifications (non-blocking)
    try {
      const { sendStartCodeActivatedEmail, sendPaymentInEscrowEmail } = require('../services/email');
      
      // Email to customer: Start code activated, payment in escrow
      if (updatedJob.customer?.email) {
        const receiptUrl = `${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || req.protocol + '://' + req.get('host')}/payments/receipts/${updatedJob.payment?.id || ''}`;
        sendStartCodeActivatedEmail(
          updatedJob.customer.email,
          updatedJob.customer.name,
          updatedJob.title,
          updatedJob.id,
          Number(updatedJob.payment?.amount || updatedJob.amount || 0),
          Number(updatedJob.payment?.feeCustomer || 0),
          Number(updatedJob.payment?.total || 0),
          receiptUrl,
          updatedJob.hustler?.name || 'Hustler'
        ).catch(emailError => {
          console.error('[START CODE] Error sending customer email:', emailError);
        });
      }
      
      // Email to hustler: Payment is in escrow
      if (updatedJob.hustler?.email) {
        sendPaymentInEscrowEmail(
          updatedJob.hustler.email,
          updatedJob.hustler.name,
          updatedJob.title,
          updatedJob.id,
          Number(updatedJob.payment?.amount || updatedJob.amount || 0)
        ).catch(emailError => {
          console.error('[START CODE] Error sending hustler email:', emailError);
        });
      }
    } catch (emailError) {
      console.error('[START CODE] Error setting up email notifications:', emailError);
      // Don't fail the request if emails fail
    }

    res.json({
      success: true,
      message: 'Start code verified! Job is now active. You can begin work.',
      startCodeVerified: true,
      jobStatus: 'IN_PROGRESS'
    });

  } catch (error) {
    console.error('Error verifying start code:', error);
    return Errors.internal('Failed to verify start code').send(res);
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
      return res.status(400).json({
        error: {
          code: ErrorCodes.MISSING_FIELD,
          message: 'Code is required'
        }
      });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { payment: true }
    });

    if (!job) {
      return Errors.notFound('Job', jobId).send(res);
    }

    // Only the assigned hustler can verify completion
    if (job.hustlerId !== userId) {
      return Errors.forbidden('Only the assigned hustler can verify completion code').send(res);
    }

    if (!code || code.length !== 6) {
      return res.status(400).json({
        error: {
          code: ErrorCodes.INVALID_INPUT,
          message: 'Completion code must be 6 digits'
        }
      });
    }

    // Job must be IN_PROGRESS (start code verified) to complete
    if (job.status !== 'IN_PROGRESS' && !job.startCodeVerified && !job.arrivalCodeVerified) {
      return res.status(400).json({
        error: {
          code: ErrorCodes.INVALID_JOB_STATUS,
          message: 'Job must be started (start code verified) before completion can be verified',
          details: { currentStatus: job.status }
        }
      });
    }

    if (job.completionCodeVerified) {
      return res.status(400).json({
        error: {
          code: ErrorCodes.CODE_ALREADY_USED,
          message: 'Completion already verified'
        }
      });
    }

    // Check the code
    if (code.trim() !== job.completionCode) {
      return Errors.invalidCode('completion').send(res);
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
      
      // Ensure minimum of 0.01 hours (36 seconds) to prevent zero charges
      if (actualHours < 0.01) {
        actualHours = 0.01;
        console.log(`[HOURLY JOB] Time worked (${timeDiffMs}ms) is less than 0.01 hours, setting to minimum 0.01 hours`);
      }
      
      // Round to 2 decimal places (e.g., 1.67 hours)
      actualHours = Math.round(actualHours * 100) / 100;
      
      console.log(`[HOURLY JOB] Time calculation - startedAt: ${startedAt.toISOString()}, completionTime: ${completionTime.toISOString()}, timeDiffMs: ${timeDiffMs}ms (${(timeDiffMs/1000).toFixed(2)}s), actualHours: ${actualHours}`);
      
      // Calculate actual charge: actualHours × hourlyRate
      const hourlyRate = Number(job.hourlyRate);
      actualJobAmount = actualHours * hourlyRate;
      
      console.log(`[HOURLY JOB] Amount calculation - actualHours: ${actualHours}, hourlyRate: $${hourlyRate}, actualJobAmount: $${actualJobAmount.toFixed(2)}`);
      
      // Get current max hours (may have been extended)
      const currentMaxHours = job.estHours || 0;
      
      // HARD LIMIT: Block completion if max hours exceeded without extension
      if (actualHours > currentMaxHours) {
        return res.status(400).json({ 
          error: `Cannot complete job: ${actualHours.toFixed(2)} hours worked exceeds max ${currentMaxHours} hours. Customer must extend hours first.`,
          actualHours: actualHours,
          maxHours: currentMaxHours,
          exceeded: true
        });
      }
      
      // Calculate total authorized amount (original + extensions)
      let totalAuthorizedAmount = Number(job.payment.amount);
      const extensionPaymentIntents = requirements.extensionPaymentIntents || [];
      
      // Sum up all extension amounts
      extensionPaymentIntents.forEach(ext => {
        totalAuthorizedAmount += Number(ext.amount || 0);
      });
      
      // Ensure we don't charge more than the total authorized amount
      if (actualJobAmount > totalAuthorizedAmount) {
        console.warn(`[HOURLY JOB] Actual amount ($${actualJobAmount}) exceeds total authorized ($${totalAuthorizedAmount}). Capping to authorized.`);
        actualJobAmount = totalAuthorizedAmount;
        actualHours = totalAuthorizedAmount / hourlyRate; // Recalculate hours based on cap
      }
      
      console.log(`[HOURLY JOB] Worked ${actualHours} hrs × $${hourlyRate}/hr = $${actualJobAmount.toFixed(2)} (max authorized: $${totalAuthorizedAmount.toFixed(2)})`);
    } else {
      // Flat job: use the payment amount (which should be the negotiated price if price was negotiated)
      // This is the amount that was actually authorized/paid, not the original job.amount
      actualJobAmount = Number(job.payment?.amount || job.amount || 0);
      const originalJobAmount = Number(job.amount || 0);
      const paymentAmount = Number(job.payment?.amount || 0);
      
      if (paymentAmount !== originalJobAmount) {
        console.log(`[FLAT JOB] Price was negotiated: Original job amount $${originalJobAmount.toFixed(2)} → Negotiated amount $${paymentAmount.toFixed(2)}`);
      }
      console.log(`[FLAT JOB] Using payment amount: $${actualJobAmount.toFixed(2)} (payment.amount: ${job.payment?.amount}, job.amount: ${job.amount})`);
    }

    // Calculate fees using centralized pricing service
    const fees = calculateFees(actualJobAmount);
    const hustlerPayout = fees.hustlerPayout;
    
    console.log(`[JOB COMPLETION] Payment breakdown for job ${job.id}:`);
    console.log(`[JOB COMPLETION]   Job Amount: $${actualJobAmount.toFixed(2)}`);
    console.log(`[JOB COMPLETION]   Platform Fee (12%): $${fees.platformFee.toFixed(2)}`);
    console.log(`[JOB COMPLETION]   Hustler Payout: $${hustlerPayout.toFixed(2)}`);
    
    // For hourly jobs with multiple workers, split evenly
    const teamSize = job.teamSize || job.requirements?.teamSize || job.requirements?.team_size || 1;
    let perWorkerPayout = 0;
    if (teamSize > 1 && job.payType === 'hourly') {
      perWorkerPayout = hustlerPayout / teamSize;
      console.log(`[HOURLY JOB] ${teamSize} workers → $${perWorkerPayout.toFixed(2)} each (total: $${hustlerPayout.toFixed(2)})`);
    }

    // Release payment to hustler (capture payment intent and transfer to hustler)
    const { capturePaymentIntent, transferToHustler } = require('../services/stripe');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    try {
      // For hourly jobs: Capture ONLY the actual amount worked (actualHours × hourlyRate)
      // Stripe will automatically release the remaining authorized amount - no refund needed
      if (job.payType === 'hourly' && job.payment.providerId) {
        const requirements = job.requirements || {};
        const extensionPaymentIntents = requirements.extensionPaymentIntents || [];
        const hourlyRate = Number(job.hourlyRate); // Get hourly rate for logging
        
        // Calculate how much to capture from original payment intent
        const originalAuthorized = Number(job.payment.amount);
        let remainingToCapture = actualJobAmount;
        let totalCaptured = 0;
        
        // First, capture from original payment intent (up to its authorized amount)
        if (remainingToCapture > 0 && originalAuthorized > 0) {
          const capturedFromOriginal = Math.min(remainingToCapture, originalAuthorized);
          await capturePaymentIntent(job.payment.providerId, capturedFromOriginal);
          remainingToCapture -= capturedFromOriginal;
          totalCaptured += capturedFromOriginal;
          console.log(`[HOURLY JOB] Captured $${capturedFromOriginal.toFixed(2)} from original payment intent (authorized: $${originalAuthorized.toFixed(2)})`);
          
          // Note: Stripe automatically releases the unused portion back to customer
          const unusedFromOriginal = originalAuthorized - capturedFromOriginal;
          if (unusedFromOriginal > 0.01) {
            console.log(`[HOURLY JOB] Stripe will automatically release $${unusedFromOriginal.toFixed(2)} unused amount from original payment intent`);
          }
        }
        
        // Then capture from extension payment intents if needed
        for (const ext of extensionPaymentIntents) {
          if (remainingToCapture <= 0) break;
          
          const extAmount = Number(ext.amount || 0);
          const extPaymentIntentId = ext.paymentIntentId;
          
          if (extPaymentIntentId && extAmount > 0) {
            // Calculate proportional capture from this extension
            const captureFromExt = Math.min(remainingToCapture, extAmount);
            await capturePaymentIntent(extPaymentIntentId, captureFromExt);
            remainingToCapture -= captureFromExt;
            totalCaptured += captureFromExt;
            console.log(`[HOURLY JOB] Captured $${captureFromExt.toFixed(2)} from extension payment intent ${extPaymentIntentId} (authorized: $${extAmount.toFixed(2)})`);
            
            // Note: Stripe automatically releases the unused portion
            const unusedFromExt = extAmount - captureFromExt;
            if (unusedFromExt > 0.01) {
              console.log(`[HOURLY JOB] Stripe will automatically release $${unusedFromExt.toFixed(2)} unused amount from extension payment intent`);
            }
          }
        }
        
        // Verify we captured exactly the actual amount (within rounding tolerance)
        const captureDifference = Math.abs(totalCaptured - actualJobAmount);
        if (captureDifference > 0.01) {
          console.warn(`[HOURLY JOB] Warning: Captured amount ($${totalCaptured.toFixed(2)}) differs from calculated amount ($${actualJobAmount.toFixed(2)}) by $${captureDifference.toFixed(2)}`);
        }
        
        console.log(`[HOURLY JOB] Total captured: $${totalCaptured.toFixed(2)} (actual work: ${actualHours} hrs × $${hourlyRate}/hr = $${actualJobAmount.toFixed(2)})`);
        
        // Update actualJobAmount to match what was actually captured (in case of rounding differences)
        if (Math.abs(totalCaptured - actualJobAmount) < 0.01) {
          actualJobAmount = totalCaptured;
        }
      } else if (job.payment.providerId) {
        // Full capture for flat jobs
        await capturePaymentIntent(job.payment.providerId);
        console.log(`[JOB COMPLETION] ✅ Payment captured successfully: ${job.payment.providerId}`);
      }

      // Calculate customer charges and refunds BEFORE transfer (so we can update payment record even if transfer fails)
      const originalAuthorizedAmount = Number(job.payment.amount);
      const customerChargedAmount = actualJobAmount; // What customer is actually charged
      const customerRefundAmount = job.payType === 'hourly' ? (originalAuthorizedAmount - actualJobAmount) : 0; // What customer gets back (only for hourly)
      const customerServiceFee = customerChargedAmount * 0.065; // 6.5% service fee on actual amount
      const customerTotalCharged = customerChargedAmount + customerServiceFee;

      // CRITICAL: Update payment record + job hours in TRANSACTION
      // This ensures database consistency even if later steps fail
      await prisma.$transaction(async (tx) => {
        // Update payment record to CAPTURED
        await tx.payment.update({
          where: { id: job.payment.id },
          data: {
            status: 'CAPTURED',
            amount: actualJobAmount, // Update to actual amount charged
            feeHustler: fees.platformFee, // 12% platform fee
            feeCustomer: customerServiceFee, // 6.5% customer service fee
            total: customerTotalCharged, // Update total to match actual charge + service fee
            capturedAt: new Date(), // Record when payment was captured
          }
        });
        
        // For hourly jobs: update actual hours worked
        if (job.payType === 'hourly') {
          await tx.job.update({
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
        
        console.log(`[JOB COMPLETION] ✅ Payment and job records updated in transaction`);
      });
      // Transaction committed - database is now consistent

      // Transfer to hustler's Stripe Connect account (minus 12% fee)
      // CRITICAL: This transfer MUST happen - hustler must receive their payment
      const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
      const jobWithHustler = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          hustler: {
            select: { stripeAccountId: true, email: true, name: true }
          }
        }
      });

      // Verify calculation is correct
      console.log(`[JOB COMPLETION] Transfer Calculation:`);
      console.log(`  Job Amount: $${actualJobAmount.toFixed(2)}`);
      console.log(`  Platform Fee (12%): $${platformFee.toFixed(2)} → STAYS IN PLATFORM`);
      console.log(`  Hustler Payout (88%): $${hustlerPayout.toFixed(2)} → MUST BE TRANSFERRED TO HUSTLER`);

      if (skipStripeCheck) {
        console.warn(`[JOB COMPLETION] ⚠️ SKIP_STRIPE_CHECK enabled - skipping transfer. Would transfer $${hustlerPayout.toFixed(2)} to hustler`);
        console.warn(`[JOB COMPLETION] ⚠️ IN TEST MODE - Transfer not executed. In production, this MUST transfer $${hustlerPayout.toFixed(2)} to hustler account.`);
      } else if (!jobWithHustler.hustler.stripeAccountId) {
        console.error(`[JOB COMPLETION] ❌ CRITICAL: Hustler ${jobWithHustler.hustler.id} has no Stripe account ID - cannot transfer payment`);
        console.error(`[JOB COMPLETION] ❌ Hustler must connect Stripe account before receiving payment`);
        throw new Error('Hustler has not connected a Stripe account. Payment cannot be transferred.');
      } else {
        // Transfer MUST succeed - this is critical
        try {
          console.log(`[JOB COMPLETION] 🚀 Initiating transfer: $${hustlerPayout.toFixed(2)} to hustler account: ${jobWithHustler.hustler.stripeAccountId}`);
          console.log(`[JOB COMPLETION] Transfer details:`, {
            hustlerAccountId: jobWithHustler.hustler.stripeAccountId,
            transferAmount: hustlerPayout,
            jobId: job.id,
            jobAmount: actualJobAmount,
            platformFee: platformFee
          });
          
          const transferResult = await transferToHustler(
            jobWithHustler.hustler.stripeAccountId,
            hustlerPayout,
            job.id,
            `Payment for job: ${job.title}`
          );
          
          console.log(`[JOB COMPLETION] ✅ Transfer successful!`);
          console.log(`[JOB COMPLETION] Transfer ID: ${transferResult.id}`);
          console.log(`[JOB COMPLETION] Transfer Status: ${transferResult.status}`);
          console.log(`[JOB COMPLETION] Amount Transferred: $${(transferResult.amount / 100).toFixed(2)}`);
          console.log(`[JOB COMPLETION] Destination: ${transferResult.destination}`);
          
          // Verify transfer amount matches expected payout
          const transferredAmount = transferResult.amount / 100;
          if (Math.abs(transferredAmount - hustlerPayout) > 0.01) {
            console.error(`[JOB COMPLETION] ⚠️ WARNING: Transfer amount mismatch!`);
            console.error(`[JOB COMPLETION] Expected: $${hustlerPayout.toFixed(2)}, Actual: $${transferredAmount.toFixed(2)}`);
          }
        } catch (transferError) {
          console.error(`[JOB COMPLETION] ❌ Transfer failed for job ${job.id}`);
          console.error(`[JOB COMPLETION] Transfer error details:`, {
            errorType: transferError.type,
            errorCode: transferError.code,
            errorMessage: transferError.message,
            errorStack: transferError.stack,
            hustlerAccountId: jobWithHustler.hustler.stripeAccountId,
            transferAmount: hustlerPayout,
            jobAmount: actualJobAmount,
            platformFee: platformFee
          });
          
          // Check if it's a balance issue (funds pending) vs other error
          const isBalanceIssue = transferError.code === 'balance_insufficient' || 
                                 transferError.message?.includes('insufficient') ||
                                 transferError.message?.includes('balance');
          
          if (isBalanceIssue) {
            // Funds are pending - this is expected for new Stripe accounts
            // Create a pending payout record that will be retried automatically
            console.warn(`[JOB COMPLETION] ⚠️ Transfer failed due to pending funds (normal for new accounts)`);
            console.warn(`[JOB COMPLETION] Payment captured but transfer will happen when funds become available (typically 2-7 days)`);
            
            try {
              await prisma.payout.create({
                data: {
                  hustlerId: job.hustlerId,
                  jobId: job.id,
                  amount: actualJobAmount,
                  platformFee: platformFee,
                  netAmount: hustlerPayout,
                  status: 'PENDING', // Will be retried when funds available
                  payoutMethod: 'STRIPE_TRANSFER',
                  payoutProviderId: null, // No transfer created yet
                }
              });
              console.log(`[JOB COMPLETION] ✅ Created pending payout record for automatic retry`);
            } catch (payoutError) {
              console.error('[JOB COMPLETION] Error creating payout record:', payoutError);
            }
            
            // Don't throw error - payment is captured, transfer will happen later
            // Job completion continues successfully
          } else {
            // Other error - this is more serious
            console.error(`[JOB COMPLETION] ❌ Transfer failed with non-balance error`);
            
            // Create failed payout record
            try {
              await prisma.payout.create({
                data: {
                  hustlerId: job.hustlerId,
                  jobId: job.id,
                  amount: actualJobAmount,
                  platformFee: platformFee,
                  netAmount: hustlerPayout,
                  status: 'FAILED',
                  payoutMethod: 'STRIPE_TRANSFER',
                  payoutProviderId: null,
                }
              });
            } catch (payoutError) {
              console.error('[JOB COMPLETION] Error creating failed payout record:', payoutError);
            }
            
            // Still don't throw - payment is captured, admin can retry transfer
            // But log it as a warning that needs attention
            console.error(`[JOB COMPLETION] ⚠️ WARNING: Transfer failed. Payment captured but hustler needs manual transfer via admin dashboard.`);
          }
        }
      }

      // Log payment breakdown for ALL jobs
      console.log(`[JOB COMPLETION] Payment Breakdown for ${job.payType} job:`);
      console.log(`  Job Amount (actual charged): $${actualJobAmount.toFixed(2)}`);
      console.log(`  Platform Fee (12%): $${platformFee.toFixed(2)} → STAYS IN PLATFORM ACCOUNT`);
      console.log(`  Hustler Payout: $${hustlerPayout.toFixed(2)} → TRANSFERRED TO HUSTLER`);
      console.log(`  Customer Service Fee (6.5%): $${customerServiceFee.toFixed(2)} → STAYS IN PLATFORM ACCOUNT`);
      console.log(`  Customer Total Charged: $${customerTotalCharged.toFixed(2)}`);
      
      // For hourly jobs: additional logging
      if (job.payType === 'hourly') {
        console.log(`  Original Authorized: $${originalAuthorizedAmount.toFixed(2)}`);
        console.log(`  Actual Hours Worked: ${actualHours.toFixed(2)} hrs`);
        console.log(`  Customer Refund (unused): $${customerRefundAmount.toFixed(2)}`);
      }
      
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

      // Send email receipts to both customer and hustler (non-blocking)
      const { sendPaymentReceiptEmail, sendHustlerPaymentReceiptEmail, sendPaymentReleasedEmail } = require('../services/email');
      const jobWithUsers = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          customer: { select: { id: true, email: true, name: true } },
          hustler: { select: { id: true, email: true, name: true } },
          payment: true
        }
      });
      
      // Email to customer: Payment released from escrow
      if (jobWithUsers?.payment && jobWithUsers?.customer?.email) {
        const receiptUrl = `${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || req.protocol + '://' + req.get('host')}/payments/receipts/${jobWithUsers.payment.id}`;
        // Get original authorized amount for hourly jobs
        const originalAuthorized = job.payType === 'hourly' ? Number(job.payment.amount) : null;
        sendPaymentReleasedEmail(
          jobWithUsers.customer.email,
          jobWithUsers.customer.name,
          jobWithUsers.title,
          jobId,
          jobWithUsers.payment,
          receiptUrl,
          jobWithUsers.hustler?.name || 'Hustler',
          job.payType === 'hourly' ? actualHours : null,
          originalAuthorized
        ).catch(emailError => {
          console.error('[JOB COMPLETION] Error sending payment released email:', emailError);
        });
      }
      
      // Email to hustler: Payment receipt
      if (jobWithUsers?.payment && jobWithUsers?.hustler?.email) {
        sendHustlerPaymentReceiptEmail(
          jobWithUsers.hustler.email,
          jobWithUsers.hustler.name,
          jobWithUsers.title,
          jobId,
          jobWithUsers.payment,
          job.payType === 'hourly' ? actualHours : null
        ).catch(emailError => {
          console.error('[JOB COMPLETION] Error sending hustler receipt email:', emailError);
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

      // Log the response data for debugging
      console.log(`[JOB COMPLETION] Response data - actualJobAmount: $${actualJobAmount.toFixed(2)}, actualHours: ${actualHours || 'N/A'}, hustlerPayout: $${hustlerPayout.toFixed(2)}`);
      
      // Get tip amount from payment record if available
      const tipAmount = job.payment?.tip ? Number(job.payment.tip) : 0;
      
      res.json({
        success: true,
        message: 'Job completed successfully! Please leave a review.',
        completionCodeVerified: true,
        jobStatus: updatedJob.status,
        paymentReleased: true,
        actualJobAmount: Number(actualJobAmount.toFixed(2)), // Ensure it's a number with 2 decimals
        actualHours: job.payType === 'hourly' ? Number(actualHours.toFixed(2)) : null,
        hustlerPayout: Number(hustlerPayout.toFixed(2)), // Ensure it's a number with 2 decimals
        perWorkerPayout: teamSize > 1 && job.payType === 'hourly' ? Number(perWorkerPayout.toFixed(2)) : null,
        platformFee: Number(platformFee.toFixed(2)),
        tipAmount: Number(tipAmount.toFixed(2)), // Include tip amount if available
        teamSize: teamSize, // Include team size for team payment responsibility message
        jobId: jobId,
        customerId: job.customerId,
        hustlerId: job.hustlerId
      });
    } catch (paymentError) {
      console.error('[JOB COMPLETION] ❌ CRITICAL ERROR in payment processing:', paymentError);
      console.error('[JOB COMPLETION] Error details:', {
        message: paymentError.message,
        stack: paymentError.stack,
        jobId: jobId,
        actualJobAmount: typeof actualJobAmount !== 'undefined' ? actualJobAmount : 'NOT CALCULATED',
        hustlerPayout: typeof hustlerPayout !== 'undefined' ? hustlerPayout : 'NOT CALCULATED'
      });
      
      // Check if this is a transfer error specifically
      // If payment was captured but transfer failed, payment record should already be updated to CAPTURED
      if (paymentError.message && paymentError.message.includes('transfer')) {
        console.error('[JOB COMPLETION] ❌ TRANSFER FAILED - Hustler did not receive payment!');
        console.error('[JOB COMPLETION] ❌ Payment was captured and database updated, but transfer failed');
        console.error('[JOB COMPLETION] ❌ Use admin endpoint to retry transfer: POST /admin/jobs/:jobId/capture-and-transfer');
        
        // Payment record should already be CAPTURED (updated before transfer attempt)
        // Job should be marked as completed but transfer needs to be retried
        await prisma.job.update({
          where: { id: jobId },
          data: { 
            completionCodeVerified: true,
            status: 'COMPLETED_BY_HUSTLER' // Keep as completed - transfer can be retried
          }
        });
        
        return res.status(500).json({ 
          error: 'Payment captured but transfer failed. Transfer will be retried.',
          message: paymentError.message,
          transferFailed: true,
          paymentCaptured: true, // Payment was captured before transfer failed
          jobId: jobId,
          retryEndpoint: `/admin/jobs/${jobId}/capture-and-transfer`
        });
      }
      
      // If capture itself failed, payment is still PREAUTHORIZED
      // Mark completion as verified but don't set to PAID
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          completionCodeVerified: true,
          status: 'COMPLETED_BY_HUSTLER' // Keep as completed but not paid if payment failed
        }
      });
      
      return res.status(500).json({ 
        error: 'Completion verified but payment processing failed. Please contact support.',
        message: paymentError.message,
        transferFailed: false,
        paymentCaptured: false,
        jobId: jobId
      });
    }

  } catch (error) {
    console.error('Error verifying completion:', error);
    return Errors.internal('Failed to verify completion').send(res);
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

// ============================================
// POST /verification/job/:jobId/extend-hours
// Customer extends max hours for hourly job (before reaching limit)
// ============================================
router.post('/job/:jobId/extend-hours', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { hours } = req.body; // Number of hours to add (default 1)
    const userId = req.user.id;

    if (!hours || hours <= 0 || !Number.isInteger(Number(hours))) {
      return res.status(400).json({ error: 'Hours must be a positive integer' });
    }

    const hoursToAdd = parseInt(hours);

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { payment: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the customer can extend hours
    if (job.customerId !== userId) {
      return res.status(403).json({ error: 'Only the customer can extend hours' });
    }

    // Job must be hourly
    if (job.payType !== 'hourly') {
      return res.status(400).json({ error: 'Can only extend hours for hourly jobs' });
    }

    // Job must be IN_PROGRESS (start code verified)
    if (job.status !== 'IN_PROGRESS' || !job.startCodeVerified) {
      return res.status(400).json({ error: 'Job must be in progress to extend hours' });
    }

    // Check current hours worked
    const requirements = job.requirements || {};
    const startedAtStr = requirements.startedAt;
    
    if (!startedAtStr) {
      return res.status(400).json({ error: 'Job start time not found' });
    }

    const startedAt = new Date(startedAtStr);
    const now = new Date();
    const currentHours = (now - startedAt) / (1000 * 60 * 60);
    const currentMaxHours = job.estHours || 0;

    // Check if we're approaching or at max hours (allow extension if within 0.5 hours of max)
    if (currentHours >= currentMaxHours - 0.5) {
      // Calculate additional amount needed
      const hourlyRate = Number(job.hourlyRate);
      const additionalAmount = hoursToAdd * hourlyRate;
      // TIPS ARE NOT INCLUDED IN EXTENSIONS - They happen after completion
      // Customer fee is 6.5% (no min/max cap)
      const customerFee = additionalAmount * 0.065;
      const totalAdditional = additionalAmount + customerFee;

      // Create new payment intent for extension amount
      const { createPaymentIntent } = require('../services/stripe');
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
      let extensionPaymentIntentId = null;

      if (!skipStripeCheck) {
        if (!process.env.STRIPE_SECRET_KEY) {
          return res.status(500).json({ error: 'Payment system not configured' });
        }

        try {
          const extensionPaymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAdditional * 100),
            currency: 'usd',
            capture_method: 'manual',
            automatic_payment_methods: { enabled: true },
            metadata: {
              jobId: job.id,
              customerId: userId,
              hustlerId: job.hustlerId,
              amount: additionalAmount.toString(),
              tip: '0', // Tips happen after completion, not in extensions
              customerFee: customerFee.toString(),
              payType: 'hourly',
              extension: 'true',
              hoursAdded: hoursToAdd.toString(),
            },
          });

          extensionPaymentIntentId = extensionPaymentIntent.id;
          console.log(`[HOURLY EXTENSION] Created payment intent: ${extensionPaymentIntentId} for ${hoursToAdd} hours ($${totalAdditional.toFixed(2)})`);
        } catch (stripeError) {
          console.error('[HOURLY EXTENSION] Stripe error:', stripeError);
          return res.status(500).json({ error: 'Failed to authorize extension payment: ' + stripeError.message });
        }
      } else {
        // Test mode
        extensionPaymentIntentId = `pi_test_ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[HOURLY EXTENSION] Test mode - fake payment intent: ${extensionPaymentIntentId}`);
      }

      // Store extension payment intent IDs in requirements
      const extensionPaymentIntents = requirements.extensionPaymentIntents || [];
      extensionPaymentIntents.push({
        paymentIntentId: extensionPaymentIntentId,
        hours: hoursToAdd,
        amount: additionalAmount,
        tip: 0, // Tips happen after completion, not in extensions
        customerFee: customerFee,
        total: totalAdditional,
        createdAt: new Date().toISOString()
      });

      // Update job with new max hours and extension payment intents
      const newMaxHours = currentMaxHours + hoursToAdd;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          estHours: newMaxHours,
          requirements: {
            ...requirements,
            extensionPaymentIntents: extensionPaymentIntents,
            lastExtendedAt: new Date().toISOString()
          }
        }
      });

      // Update payment record total (for reference, actual capture happens on completion)
      // Note: Tips are NOT included in extensions - they happen after completion
      await prisma.payment.update({
        where: { id: job.payment.id },
        data: {
          amount: Number(job.payment.amount) + additionalAmount,
          tip: Number(job.payment.tip) || 0, // Keep existing tip, don't add to extension
          feeCustomer: Number(job.payment.feeCustomer) + customerFee,
          total: Number(job.payment.total) + totalAdditional,
        }
      });

      // Send email notification to hustler
      if (job.hustler && job.hustler.email && job.hustler.name && job.customer && job.customer.name) {
        const { sendHoursExtendedEmail } = require('../services/email');
        sendHoursExtendedEmail(
          job.hustler.email,
          job.hustler.name,
          job.title,
          job.id,
          hoursToAdd,
          newMaxHours,
          job.customer.name
        ).catch((emailError) => {
          console.error('[HOURLY EXTENSION] Error sending email notification:', emailError);
          // Don't fail the request if email fails
        });
      }

      res.json({
        success: true,
        message: `Hours extended by ${hoursToAdd}. New max: ${newMaxHours} hours.`,
        newMaxHours: newMaxHours,
        additionalAmount: additionalAmount,
        totalAdditional: totalAdditional,
        paymentIntentId: extensionPaymentIntentId
      });
    } else {
      return res.status(400).json({ 
        error: `Cannot extend hours yet. Current: ${currentHours.toFixed(2)}h, Max: ${currentMaxHours}h. Extend when within 0.5 hours of max.` 
      });
    }

  } catch (error) {
    console.error('Error extending hours:', error);
    res.status(500).json({ error: 'Failed to extend hours' });
  }
});

module.exports = router;


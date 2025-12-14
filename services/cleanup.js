// Cleanup service for old jobs
// 1. Hides/deletes OPEN jobs older than 72 hours with no accepted offers
// 2. Deletes jobs older than 2 weeks regardless of status

const prisma = require('../db');
const { sendJobExpiringEmail } = require('./email');

/**
 * Clean up old OPEN jobs that have no accepted offers (72 hour rule)
 * This sets their status to EXPIRED so they don't show in feeds
 * Uses 72 hours as default, but can be configured
 * Also sends email warning 24 hours before expiration
 */
async function cleanup72HourJobs() {
  try {
    // Use 72 hours (configurable via env, default 72)
    const hoursThreshold = parseInt(process.env.JOB_CLEANUP_HOURS || '72', 10);
    const hoursAgo = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    
    // Also check for jobs expiring in 24 hours (48 hours old) to send warning
    const warningHoursThreshold = hoursThreshold - 24; // 24 hours before expiration
    const warningHoursAgo = new Date(Date.now() - warningHoursThreshold * 60 * 60 * 1000);
    
    // Find OPEN jobs older than threshold hours with no accepted offers
    // Exclude fields that might not exist yet (like parentJobId) to avoid migration errors
    const oldOpenJobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
        createdAt: {
          lt: hoursAgo,
        },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        requirements: true,
        offers: {
          where: {
            status: 'ACCEPTED',
          },
          select: {
            id: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Filter to only jobs with no accepted offers
    const jobsToCancel = oldOpenJobs.filter(job => job.offers.length === 0);

    if (jobsToCancel.length === 0) {
      console.log(`[Cleanup ${hoursThreshold}h] No old OPEN jobs to cancel`);
      return { cancelled: 0 };
    }

    console.log(`[Cleanup ${hoursThreshold}h] Found ${jobsToCancel.length} old OPEN jobs with no accepted offers`);

    // Send email warning for jobs expiring soon (24 hours before)
    const jobsToWarn = jobsToCancel.filter(job => {
      const jobAge = Date.now() - job.createdAt.getTime();
      const warningThresholdMs = warningHoursThreshold * 60 * 60 * 1000;
      const expirationThresholdMs = hoursThreshold * 60 * 60 * 1000;
      // Warn if job is between warning threshold and expiration threshold
      return jobAge >= warningThresholdMs && jobAge < expirationThresholdMs;
    });
    
    let warningsSent = 0;
    for (const job of jobsToWarn) {
      try {
        // Check if we already sent warning (to avoid spamming)
        const requirements = job.requirements || {};
        if (!requirements.expirationWarningSent && job.customer && job.customer.email) {
          await sendJobExpiringEmail(
            job.customer.email,
            job.customer.name,
            job.title,
            job.id
          );
          // Mark warning as sent
          await prisma.job.update({
            where: { id: job.id },
            data: {
              requirements: {
                ...requirements,
                expirationWarningSent: true,
                expirationWarningSentAt: new Date().toISOString(),
              },
            },
          });
          warningsSent++;
          console.log(`[Cleanup] Sent expiration warning for job ${job.id}`);
        }
      } catch (emailError) {
        console.error(`[Cleanup] Error sending expiration warning for job ${job.id}:`, emailError);
        // Continue with expiration even if email fails
      }
    }
    
    // Expire jobs older than threshold (set status to EXPIRED)
    const jobsToExpire = jobsToCancel.filter(job => {
      const jobAge = Date.now() - job.createdAt.getTime();
      const expirationThresholdMs = hoursThreshold * 60 * 60 * 1000;
      return jobAge >= expirationThresholdMs;
    });
    
    const jobIds = jobsToExpire.map(j => j.id);
    if (jobIds.length > 0) {
      const result = await prisma.job.updateMany({
        where: {
          id: { in: jobIds },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      console.log(`[Cleanup ${hoursThreshold}h] Expired ${result.count} old OPEN jobs with no activity`);
    }
    
    return { 
      expired: jobIds.length,
      warningsSent: warningsSent
    };
  } catch (error) {
    console.error('[Cleanup 72h] Error cleaning up 72-hour jobs:', error);
    throw error;
  }
}

/**
 * Clean up jobs that have passed their expiration date (based on keepActiveFor)
 * Checks expiresAt field and requirements.expiresAt, sets status to EXPIRED if date has passed
 * Also sends email warnings 1 hour before expiration
 */
async function cleanupExpiredJobs() {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    
    // Find OPEN jobs where expiresAt has passed or is within 1 hour
    // Check both the expiresAt field and requirements.expiresAt for backward compatibility
    const allOpenJobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
      },
      select: {
        id: true,
        title: true,
        expiresAt: true, // Check the new expiresAt field
        requirements: true,
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Helper function to get expiration date from job
    const getExpirationDate = (job) => {
      // First check the expiresAt field (new way)
      if (job.expiresAt) {
        try {
          return new Date(job.expiresAt);
        } catch (e) {
          // Invalid date, check requirements as fallback
        }
      }
      
      // Fallback to requirements.expiresAt (old way, for backward compatibility)
      const requirements = job.requirements || {};
      const expiresAt = requirements.expiresAt;
      
      if (!expiresAt) return null;
      
      try {
        return new Date(expiresAt);
      } catch (e) {
        return null; // Invalid date
      }
    };

    // Find jobs expiring in 1 hour (for email warning)
    const jobsExpiringSoon = allOpenJobs.filter(job => {
      const expirationDate = getExpirationDate(job);
      if (!expirationDate) return false;
      
      // Check if expires between now and 1 hour from now
      const timeUntilExpiration = expirationDate - now;
      const oneHourInMs = 60 * 60 * 1000;
      
      return timeUntilExpiration > 0 && timeUntilExpiration <= oneHourInMs;
    });

    // Send email warnings for jobs expiring in 1 hour
    let warningsSent = 0;
    for (const job of jobsExpiringSoon) {
      try {
        // Check if we already sent warning (to avoid spamming)
        const requirements = job.requirements || {};
        const warningKey = `expirationWarning1hSent_${job.id}`;
        
        if (!requirements[warningKey] && job.customer && job.customer.email) {
          await sendJobExpiringEmail(
            job.customer.email,
            job.customer.name,
            job.title,
            job.id
          );
          // Mark warning as sent
          await prisma.job.update({
            where: { id: job.id },
            data: {
              requirements: {
                ...requirements,
                [warningKey]: true,
                expirationWarning1hSentAt: new Date().toISOString(),
              },
            },
          });
          warningsSent++;
          console.log(`[Cleanup Expired] Sent 1-hour expiration warning for job ${job.id}`);
        }
      } catch (emailError) {
        console.error(`[Cleanup Expired] Error sending expiration warning for job ${job.id}:`, emailError);
        // Continue with expiration even if email fails
      }
    }

    // Filter jobs where expiresAt has passed
    const expiredJobs = allOpenJobs.filter(job => {
      const expirationDate = getExpirationDate(job);
      if (!expirationDate) return false;
      return expirationDate <= now;
    });

    if (expiredJobs.length === 0) {
      console.log('[Cleanup Expired] No expired jobs found');
      return { expired: 0, warningsSent };
    }

    console.log(`[Cleanup Expired] Found ${expiredJobs.length} jobs past expiration date`);

    const jobIds = expiredJobs.map(j => j.id);
    
    // Set status to EXPIRED
    const result = await prisma.job.updateMany({
      where: {
        id: { in: jobIds },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    console.log(`[Cleanup Expired] Expired ${result.count} jobs past their expiration date`);
    
    return { expired: result.count, warningsSent };
  } catch (error) {
    console.error('[Cleanup Expired] Error cleaning up expired jobs:', error);
    throw error;
  }
}

/**
 * Clean up jobs with expired start codes (78 hours from acceptance)
 * If start code not verified within 78 hours, refund customer and expire job
 */
async function cleanupExpiredStartCodes() {
  try {
    const now = new Date();
    
    // Find ASSIGNED jobs where start code has expired
    const expiredJobs = await prisma.job.findMany({
      where: {
        status: 'ASSIGNED',
        startCodeExpiresAt: {
          lt: now
        },
        startCodeVerified: false
      },
      include: {
        payment: true,
        customer: {
          select: { email: true, name: true }
        }
      }
    });

    if (expiredJobs.length === 0) {
      console.log('[Cleanup Start Codes] No expired start codes found');
      return { expired: 0, refunded: 0 };
    }

    console.log(`[Cleanup Start Codes] Found ${expiredJobs.length} jobs with expired start codes`);

    const { voidPaymentIntent } = require('./stripe');
    let refunded = 0;

    for (const job of expiredJobs) {
      try {
        // Refund customer
        if (job.payment && job.payment.providerId && job.payment.status === 'PREAUTHORIZED') {
          await voidPaymentIntent(job.payment.providerId);
          await prisma.payment.update({
            where: { id: job.payment.id },
            data: { status: 'REFUNDED' }
          });
          refunded++;
        }

        // Mark job as expired
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'EXPIRED' }
        });

        console.log(`[Cleanup Start Codes] Expired and refunded job ${job.id}`);
      } catch (error) {
        console.error(`[Cleanup Start Codes] Error processing job ${job.id}:`, error);
      }
    }

    return { expired: expiredJobs.length, refunded };
  } catch (error) {
    console.error('[Cleanup Start Codes] Error:', error);
    throw error;
  }
}

/**
 * Clean up very old jobs (older than 2 weeks regardless of status)
 * Optimized with better error handling
 */
async function cleanupOldJobs() {
  try {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    // First, find old jobs
    const oldJobs = await prisma.job.findMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo,
        },
      },
      select: { id: true },
    });

    if (oldJobs.length === 0) {
      console.log('[Cleanup 2w] No very old jobs to delete');
      return { deleted: 0 };
    }

    const jobIds = oldJobs.map(j => j.id);

    // Delete ALL related records first (in order of dependencies)
    // Wrap each in try-catch in case table doesn't exist yet
    const safeDelete = async (model, where) => {
      try {
        await model.deleteMany({ where });
      } catch (e) {
        if (e.code !== 'P2021') console.error(`[Cleanup] Delete error (non-fatal):`, e.message);
      }
    };

    // Delete in correct order (deepest dependencies first)
    console.log(`[Cleanup 2w] Deleting related records for ${jobIds.length} jobs...`);
    
    // Messages depend on threads
    const threads = await prisma.thread.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true }
    }).catch(() => []);
    const threadIds = threads.map(t => t.id);
    if (threadIds.length > 0) {
      await safeDelete(prisma.message, { threadId: { in: threadIds } });
    }
    
    // Now delete other related records
    await safeDelete(prisma.thread, { jobId: { in: jobIds } });
    await safeDelete(prisma.review, { jobId: { in: jobIds } });
    await safeDelete(prisma.locationUpdate, { jobId: { in: jobIds } });
    await safeDelete(prisma.offer, { jobId: { in: jobIds } });
    await safeDelete(prisma.payment, { jobId: { in: jobIds } });

    // Now delete the jobs
    const result = await prisma.job.deleteMany({
      where: {
        id: { in: jobIds },
      },
    });

    console.log(`[Cleanup 2w] Deleted ${result.count} very old jobs (older than 2 weeks)`);
    
    return { deleted: result.count };
  } catch (error) {
    console.error('[Cleanup 2w] Error cleaning up old jobs:', error);
    throw error;
  }
}

/**
 * Clean up unverified user accounts
 * Deletes users who:
 * 1. Have emailVerified = false
 * 2. Have an expired verification code (emailVerificationExpiry < now)
 * OR
 * 3. Have emailVerified = false and were created more than 10 minutes ago (abandoned signup)
 */
async function cleanupUnverifiedAccounts() {
  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
    
    // Find unverified users with expired codes OR abandoned signups
    const unverifiedUsers = await prisma.user.findMany({
      where: {
        emailVerified: false,
        OR: [
          // Expired verification codes
          {
            emailVerificationExpiry: {
              lt: now
            }
          },
          // Abandoned signups (created more than 10 minutes ago, no verification code or expired)
          {
            createdAt: {
              lt: tenMinutesAgo
            },
            OR: [
              { emailVerificationCode: null },
              { emailVerificationExpiry: { lt: now } }
            ]
          }
        ]
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        emailVerificationExpiry: true
      }
    });

    if (unverifiedUsers.length === 0) {
      console.log('[Cleanup Unverified] No unverified accounts to delete');
      return { deleted: 0 };
    }

    console.log(`[Cleanup Unverified] Found ${unverifiedUsers.length} unverified accounts to delete`);

    const userIds = unverifiedUsers.map(u => u.id);
    
    // Delete related data first (in order of dependencies)
    const safeDelete = async (model, where) => {
      try {
        await model.deleteMany({ where });
      } catch (e) {
        if (e.code !== 'P2021') console.error(`[Cleanup Unverified] Delete error (non-fatal):`, e.message);
      }
    };

    // Delete user's related data
    await safeDelete(prisma.message, { senderId: { in: userIds } });
    await safeDelete(prisma.thread, { OR: [{ userAId: { in: userIds } }, { userBId: { in: userIds } }] });
    await safeDelete(prisma.offer, { hustlerId: { in: userIds } });
    await safeDelete(prisma.review, { OR: [{ reviewerId: { in: userIds } }, { revieweeId: { in: userIds } }] });
    await safeDelete(prisma.payment, { OR: [{ customerId: { in: userIds } }, { hustlerId: { in: userIds } }] });
    await safeDelete(prisma.job, { OR: [{ customerId: { in: userIds } }, { hustlerId: { in: userIds } }] });
    await safeDelete(prisma.locationUpdate, { hustlerId: { in: userIds } });
    await safeDelete(prisma.referral, { OR: [{ referrerId: { in: userIds } }, { referredUserId: { in: userIds } }] });

    // Finally delete the users
    const result = await prisma.user.deleteMany({
      where: {
        id: { in: userIds }
      }
    });

    console.log(`[Cleanup Unverified] Deleted ${result.count} unverified accounts`);
    
    return { deleted: result.count };
  } catch (error) {
    console.error('[Cleanup Unverified] Error cleaning up unverified accounts:', error);
    throw error;
  }
}

/**
 * Run all cleanup tasks
 */
async function runAllCleanup() {
  try {
    // First, verify database is accessible by checking if tables exist
    await prisma.user.count();
  } catch (dbError) {
    // Database not ready or migrations not run yet
    if (dbError.code === 'P2021' || dbError.message?.includes('does not exist')) {
      console.log('[Startup] Cleanup skipped - database migrations not run yet');
      return { skipped: true };
    }
    throw dbError;
  }
  
  const results = {
    'expired': await cleanupExpiredJobs().catch(e => ({ error: e.message })),
    '72h': await cleanup72HourJobs().catch(e => ({ error: e.message })),
    'startCodes': await cleanupExpiredStartCodes().catch(e => ({ error: e.message })),
    '2w': await cleanupOldJobs().catch(e => ({ error: e.message })),
    'unverified': await cleanupUnverifiedAccounts().catch(e => ({ error: e.message })),
  };
  return results;
}

module.exports = {
  cleanupOldJobs,
  cleanup72HourJobs,
  cleanupExpiredJobs,
  cleanupExpiredStartCodes,
  cleanupUnverifiedAccounts,
  runAllCleanup,
};


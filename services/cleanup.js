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
    '72h': await cleanup72HourJobs().catch(e => ({ error: e.message })),
    '2w': await cleanupOldJobs().catch(e => ({ error: e.message })),
  };
  return results;
}

module.exports = {
  cleanupOldJobs,
  cleanup72HourJobs,
  runAllCleanup,
};


// Cleanup service for old jobs
// 1. Hides/deletes OPEN jobs older than 72 hours with no accepted offers
// 2. Deletes jobs older than 2 weeks regardless of status

const prisma = require('../db');

/**
 * Clean up old OPEN jobs that have no accepted offers (48-72 hour rule)
 * This sets their status to CANCELLED so they don't show in feeds
 * Uses 48 hours as default, but can be configured
 */
async function cleanup72HourJobs() {
  try {
    // Use 48 hours (configurable via env, default 48)
    const hoursThreshold = parseInt(process.env.JOB_CLEANUP_HOURS || '48', 10);
    const hoursAgo = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    
    // Find OPEN jobs older than threshold hours with no accepted offers
    const oldOpenJobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
        createdAt: {
          lt: hoursAgo,
        },
      },
      include: {
        offers: {
          where: {
            status: 'ACCEPTED',
          },
          select: {
            id: true,
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

    // Cancel these jobs (set status to CANCELLED)
    const jobIds = jobsToCancel.map(j => j.id);
    const result = await prisma.job.updateMany({
      where: {
        id: { in: jobIds },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    console.log(`[Cleanup ${hoursThreshold}h] Cancelled ${result.count} old OPEN jobs`);
    
    return { cancelled: result.count };
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
    
    // Optimized: Direct delete without counting first (faster)
    const result = await prisma.job.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo,
        },
      },
    });

    if (result.count === 0) {
      console.log('[Cleanup 2w] No very old jobs to delete');
      return { deleted: 0 };
    }

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
  const results = {
    '72h': await cleanup72HourJobs(),
    '2w': await cleanupOldJobs(),
  };
  return results;
}

module.exports = {
  cleanupOldJobs,
  cleanup72HourJobs,
  runAllCleanup,
};


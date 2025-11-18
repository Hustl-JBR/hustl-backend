// Cleanup service for old jobs
// Deletes jobs older than 2 weeks regardless of status

const prisma = require('../db');

/**
 * Clean up old jobs regardless of status
 * Deletes jobs that are older than 2 weeks (14 days)
 */
async function cleanupOldJobs() {
  try {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    // Find all jobs older than 2 weeks (regardless of status)
    const oldJobs = await prisma.job.findMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    if (oldJobs.length === 0) {
      console.log('[Cleanup] No old jobs to delete');
      return { deleted: 0 };
    }

    console.log(`[Cleanup] Found ${oldJobs.length} old jobs to delete (older than 2 weeks)`);

    // Delete the old jobs (regardless of status)
    // Note: Cascade deletes will handle related offers, threads, etc.
    const result = await prisma.job.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo,
        },
      },
    });

    console.log(`[Cleanup] Deleted ${result.count} old jobs`);
    
    return { deleted: result.count };
  } catch (error) {
    console.error('[Cleanup] Error cleaning up old jobs:', error);
    throw error;
  }
}

module.exports = {
  cleanupOldJobs,
};


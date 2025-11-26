const prisma = require('../db');

/**
 * Generate recurring job instances
 * This should be called by a cron job or scheduled task daily
 */
async function generateRecurringJobs() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Find all parent jobs that need recurring instances created
    // Conditions:
    // 1. Has recurrenceType set (weekly or monthly)
    // 2. Not paused (recurrencePaused = false)
    // 3. nextRecurrenceDate is today or in the past
    // 4. Either no recurrenceEndDate, or recurrenceEndDate is in the future
    const parentJobs = await prisma.job.findMany({
      where: {
        recurrenceType: {
          in: ['weekly', 'monthly'],
        },
        recurrencePaused: false,
        parentJobId: null, // Only parent jobs (not instances)
        nextRecurrenceDate: {
          lte: today,
        },
        OR: [
          { recurrenceEndDate: null },
          { recurrenceEndDate: { gte: today } },
        ],
      },
    });

    console.log(`[Recurring Jobs] Found ${parentJobs.length} jobs to process`);

    const createdJobs = [];

    for (const parentJob of parentJobs) {
      try {
        // Calculate the next occurrence date
        const nextDate = new Date(parentJob.nextRecurrenceDate || parentJob.date);
        let newDate = new Date(nextDate);
        
        if (parentJob.recurrenceType === 'weekly') {
          newDate.setDate(newDate.getDate() + 7);
        } else if (parentJob.recurrenceType === 'monthly') {
          newDate.setMonth(newDate.getMonth() + 1);
        }

        // Calculate new start/end times (same time, new date)
        const originalStartTime = new Date(parentJob.startTime);
        const originalEndTime = new Date(parentJob.endTime);
        const timeDiff = originalEndTime.getTime() - originalStartTime.getTime();
        
        const newStartTime = new Date(newDate);
        newStartTime.setHours(originalStartTime.getHours(), originalStartTime.getMinutes(), 0, 0);
        
        const newEndTime = new Date(newStartTime);
        newEndTime.setTime(newStartTime.getTime() + timeDiff);

        // Check if we've reached the end date
        if (parentJob.recurrenceEndDate && newDate > new Date(parentJob.recurrenceEndDate)) {
          // Update parent job to remove nextRecurrenceDate (series ended)
          await prisma.job.update({
            where: { id: parentJob.id },
            data: { nextRecurrenceDate: null },
          });
          console.log(`[Recurring Jobs] Series ended for job ${parentJob.id}`);
          continue;
        }

        // Create the new job instance
        const newJob = await prisma.job.create({
          data: {
            customerId: parentJob.customerId,
            title: parentJob.title,
            category: parentJob.category,
            description: parentJob.description,
            address: parentJob.address,
            lat: parentJob.lat,
            lng: parentJob.lng,
            date: newDate,
            startTime: newStartTime,
            endTime: newEndTime,
            payType: parentJob.payType,
            amount: parentJob.amount,
            hourlyRate: parentJob.hourlyRate,
            estHours: parentJob.estHours,
            requirements: parentJob.requirements,
            status: 'OPEN',
            // Link to parent job
            parentJobId: parentJob.id,
            // Don't copy recurrence fields - this is an instance, not a parent
            recurrenceType: null,
            recurrenceEndDate: null,
            recurrencePaused: false,
            nextRecurrenceDate: null,
          },
        });

        // Update parent job's nextRecurrenceDate
        await prisma.job.update({
          where: { id: parentJob.id },
          data: { nextRecurrenceDate: newDate },
        });

        createdJobs.push(newJob);
        console.log(`[Recurring Jobs] Created job ${newJob.id} from parent ${parentJob.id}`);
      } catch (error) {
        console.error(`[Recurring Jobs] Error creating job for parent ${parentJob.id}:`, error);
      }
    }

    return {
      processed: parentJobs.length,
      created: createdJobs.length,
      jobs: createdJobs,
    };
  } catch (error) {
    console.error('[Recurring Jobs] Error generating recurring jobs:', error);
    throw error;
  }
}

/**
 * Pause a recurring job series
 */
async function pauseRecurringJob(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // If this is a child job, find the parent
  const parentJobId = job.parentJobId || jobId;

  await prisma.job.updateMany({
    where: {
      OR: [
        { id: parentJobId },
        { parentJobId: parentJobId },
      ],
    },
    data: {
      recurrencePaused: true,
    },
  });

  return { message: 'Recurring job series paused' };
}

/**
 * Resume a recurring job series
 */
async function resumeRecurringJob(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // If this is a child job, find the parent
  const parentJobId = job.parentJobId || jobId;

  await prisma.job.updateMany({
    where: {
      OR: [
        { id: parentJobId },
        { parentJobId: parentJobId },
      ],
    },
    data: {
      recurrencePaused: false,
    },
  });

  return { message: 'Recurring job series resumed' };
}

/**
 * Cancel a recurring job series (delete future instances)
 */
async function cancelRecurringJob(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // If this is a child job, find the parent
  const parentJobId = job.parentJobId || jobId;

  // Delete all future instances (OPEN status, future date)
  const now = new Date();
  await prisma.job.deleteMany({
    where: {
      parentJobId: parentJobId,
      status: 'OPEN',
      date: {
        gt: now,
      },
    },
  });

  // Update parent to stop recurring
  await prisma.job.update({
    where: { id: parentJobId },
    data: {
      recurrenceType: null,
      recurrenceEndDate: null,
      nextRecurrenceDate: null,
      recurrencePaused: false,
    },
  });

  return { message: 'Recurring job series cancelled' };
}

module.exports = {
  generateRecurringJobs,
  pauseRecurringJob,
  resumeRecurringJob,
  cancelRecurringJob,
};




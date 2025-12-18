#!/usr/bin/env node
/**
 * Cleanup Tennessee Test Jobs Script
 * 
 * Deletes all jobs created by the test customer (test-customer-tn@hustl.test)
 * 
 * Usage:
 *   node scripts/cleanup-tn-jobs.js [--confirm]
 */

require('dotenv').config();
const prisma = require('../db');

async function cleanupTNJobs(confirm = false) {
  console.log('\n🔍 Searching for Tennessee test jobs...\n');

  try {
    // Find the test customer
    const testCustomer = await prisma.user.findFirst({
      where: {
        email: 'test-customer-tn@hustl.test'
      },
      include: {
        jobsAsCustomer: {
          select: {
            id: true,
            title: true,
            category: true,
            status: true
          }
        }
      }
    });

    if (!testCustomer) {
      console.log('✅ No test customer found. No jobs to delete.\n');
      await prisma.$disconnect();
      return;
    }

    const jobsCount = testCustomer.jobsAsCustomer.length;

    if (jobsCount === 0) {
      console.log('✅ No test jobs found. Nothing to delete.\n');
      await prisma.$disconnect();
      return;
    }

    console.log(`📊 Found ${jobsCount} job(s) created by test customer:\n`);
    testCustomer.jobsAsCustomer.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.title} (${job.category}) - ${job.status}`);
    });
    console.log('');

    if (!confirm) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise((resolve) => {
        readline.question('⚠️  Are you sure you want to delete all these jobs? (yes/no): ', async (answer) => {
          readline.close();

          if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('❌ Cancelled. No jobs were deleted.\n');
            await prisma.$disconnect();
            resolve();
            return;
          }

          await deleteJobs(testCustomer.id, jobsCount);
          resolve();
        });
      });
    } else {
      await deleteJobs(testCustomer.id, jobsCount);
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteJobs(customerId, expectedCount) {
  console.log('\n🗑️  Deleting jobs...\n');

  try {
    // Get all job IDs first
    const jobs = await prisma.job.findMany({
      where: { customerId },
      select: { id: true }
    });

    const jobIds = jobs.map(j => j.id);

    if (jobIds.length === 0) {
      console.log('✅ No jobs found to delete.\n');
      return;
    }

    // Delete related data first (messages, threads, payments, offers, reviews, location updates)
    await prisma.message.deleteMany({
      where: {
        thread: {
          jobId: { in: jobIds }
        }
      }
    });

    await prisma.thread.deleteMany({
      where: { jobId: { in: jobIds } }
    });

    await prisma.payment.deleteMany({
      where: { jobId: { in: jobIds } }
    });

    await prisma.offer.deleteMany({
      where: { jobId: { in: jobIds } }
    });

    await prisma.review.deleteMany({
      where: { jobId: { in: jobIds } }
    });

    await prisma.locationUpdate.deleteMany({
      where: { jobId: { in: jobIds } }
    });

    // Finally, delete the jobs
    const result = await prisma.job.deleteMany({
      where: { customerId }
    });

    console.log(`✅ Successfully deleted ${result.count} job(s)!\n`);

  } catch (error) {
    console.error('❌ Error deleting jobs:', error);
    throw error;
  }
}

// Main execution
const args = process.argv.slice(2);
const confirm = args.includes('--confirm');

cleanupTNJobs(confirm)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




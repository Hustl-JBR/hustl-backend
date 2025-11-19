#!/usr/bin/env node
/**
 * Cleanup Test Data Script
 * 
 * This script removes fake test users and jobs from the database.
 * It identifies test data by:
 * - Fake email addresses (test*, fake*, demo*, example.com, test.com, etc.)
 * - Test usernames (test*, fake*, demo*)
 * - Jobs created by test users
 * 
 * Usage:
 *   node scripts/cleanup-test-data.js [--dry-run] [--confirm]
 * 
 * Options:
 *   --dry-run: Show what would be deleted without actually deleting
 *   --confirm: Skip confirmation prompt (use with caution!)
 */

require('dotenv').config();
const prisma = require('../db');

// Patterns to identify test data
const TEST_EMAIL_PATTERNS = [
  /^test/i,
  /^fake/i,
  /^demo/i,
  /^temp/i,
  /example\.com$/i,
  /test\.com$/i,
  /fake\.com$/i,
  /demo\.com$/i,
  /temp\.com$/i,
  /@test\./i,
  /@fake\./i,
  /@demo\./i,
];

const TEST_USERNAME_PATTERNS = [
  /^test/i,
  /^fake/i,
  /^demo/i,
  /^temp/i,
];

function isTestEmail(email) {
  if (!email) return false;
  return TEST_EMAIL_PATTERNS.some(pattern => pattern.test(email));
}

function isTestUsername(username) {
  if (!username) return false;
  return TEST_USERNAME_PATTERNS.some(pattern => pattern.test(username));
}

async function findTestUsers() {
  const allUsers = await prisma.user.findMany({
    include: {
      jobsAsCustomer: {
        select: { id: true, title: true },
      },
      jobsAsHustler: {
        select: { id: true, title: true },
      },
      offers: {
        select: { id: true },
      },
      reviewsGiven: {
        select: { id: true },
      },
      reviewsReceived: {
        select: { id: true },
      },
    },
  });

  const testUsers = allUsers.filter(user => 
    isTestEmail(user.email) || isTestUsername(user.username)
  );

  return testUsers;
}

async function cleanupTestData(dryRun = false) {
  console.log('\n🔍 Searching for test data...\n');

  const testUsers = await findTestUsers();

  if (testUsers.length === 0) {
    console.log('✅ No test data found. Database is clean!');
    return;
  }

  console.log(`📊 Found ${testUsers.length} test user(s):\n`);

  let totalJobs = 0;
  let totalOffers = 0;
  let totalReviews = 0;

  testUsers.forEach((user, index) => {
    const jobsCount = user.jobsAsCustomer.length + user.jobsAsHustler.length;
    const offersCount = user.offers.length;
    const reviewsCount = user.reviewsGiven.length + user.reviewsReceived.length;

    totalJobs += jobsCount;
    totalOffers += offersCount;
    totalReviews += reviewsCount;

    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Created: ${user.createdAt.toISOString()}`);
    console.log(`   Jobs: ${jobsCount} | Offers: ${offersCount} | Reviews: ${reviewsCount}`);
    console.log('');
  });

  console.log('📈 Summary:');
  console.log(`   - Test Users: ${testUsers.length}`);
  console.log(`   - Test Jobs: ${totalJobs}`);
  console.log(`   - Test Offers: ${totalOffers}`);
  console.log(`   - Test Reviews: ${totalReviews}`);
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data was deleted.');
    console.log('   Run without --dry-run to actually delete the data.\n');
    return;
  }

  // Confirm deletion
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question('⚠️  Are you sure you want to delete all this test data? (yes/no): ', async (answer) => {
      readline.close();

      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Cancelled. No data was deleted.\n');
        resolve();
        return;
      }

      console.log('\n🗑️  Deleting test data...\n');

      try {
        // Delete in order to respect foreign key constraints
        for (const user of testUsers) {
          console.log(`Deleting user: ${user.email}...`);

          // Delete reviews (both given and received)
          if (user.reviewsGiven.length > 0) {
            await prisma.review.deleteMany({
              where: { reviewerId: user.id },
            });
            console.log(`  - Deleted ${user.reviewsGiven.length} review(s)`);
          }

          if (user.reviewsReceived.length > 0) {
            await prisma.review.deleteMany({
              where: { revieweeId: user.id },
            });
            console.log(`  - Deleted ${user.reviewsReceived.length} received review(s)`);
          }

          // Delete offers
          if (user.offers.length > 0) {
            await prisma.offer.deleteMany({
              where: { hustlerId: user.id },
            });
            console.log(`  - Deleted ${user.offers.length} offer(s)`);
          }

          // Delete jobs (as customer and hustler)
          if (user.jobsAsCustomer.length > 0) {
            // Delete related data first (messages, threads, payments, etc.)
            const jobIds = user.jobsAsCustomer.map(j => j.id);
            
            await prisma.message.deleteMany({
              where: {
                thread: {
                  jobId: { in: jobIds },
                },
              },
            });
            
            await prisma.thread.deleteMany({
              where: { jobId: { in: jobIds } },
            });

            await prisma.payment.deleteMany({
              where: { jobId: { in: jobIds } },
            });

            await prisma.job.deleteMany({
              where: { customerId: user.id },
            });
            console.log(`  - Deleted ${user.jobsAsCustomer.length} job(s) as customer`);
          }

          if (user.jobsAsHustler.length > 0) {
            const jobIds = user.jobsAsHustler.map(j => j.id);
            
            await prisma.message.deleteMany({
              where: {
                thread: {
                  jobId: { in: jobIds },
                },
              },
            });
            
            await prisma.thread.deleteMany({
              where: { jobId: { in: jobIds } },
            });

            await prisma.payment.deleteMany({
              where: { jobId: { in: jobIds } },
            });

            await prisma.job.deleteMany({
              where: { hustlerId: user.id },
            });
            console.log(`  - Deleted ${user.jobsAsHustler.length} job(s) as hustler`);
          }

          // Finally, delete the user
          await prisma.user.delete({
            where: { id: user.id },
          });
          console.log(`  ✅ Deleted user: ${user.email}`);
        }

        console.log('\n✅ Cleanup complete!');
        console.log(`   Deleted ${testUsers.length} user(s), ${totalJobs} job(s), ${totalOffers} offer(s), ${totalReviews} review(s)\n`);

      } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        console.error('Some data may have been partially deleted.\n');
        process.exit(1);
      } finally {
        await prisma.$disconnect();
        resolve();
      }
    });
  });
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const confirm = args.includes('--confirm');

if (dryRun) {
  cleanupTestData(true).then(() => process.exit(0));
} else if (confirm) {
  cleanupTestData(false).then(() => process.exit(0));
} else {
  cleanupTestData(false).then(() => process.exit(0));
}


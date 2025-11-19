#!/usr/bin/env node

/**
 * Cleanup Test Users Script
 * 
 * This script helps identify and delete test/fake users from the database.
 * It's designed to be safe - it lists users first and asks for confirmation.
 * 
 * Usage:
 *   node scripts/cleanup-test-users.js --list    # List test users (dry run)
 *   node scripts/cleanup-test-users.js --delete  # Actually delete test users
 */

require('dotenv').config();
const prisma = require('../db');
const readline = require('readline');

// Patterns to identify test users
const TEST_EMAIL_PATTERNS = [
  /test/i,
  /fake/i,
  /demo/i,
  /example/i,
  /@hustl\.com$/i,  // admin@hustl.com, customer@hustl.com, etc.
  /@example\.com$/i,
  /@test\.com$/i,
  /temp/i,
  /dummy/i,
];

const TEST_USERNAME_PATTERNS = [
  /^test/i,
  /^fake/i,
  /^demo/i,
  /^example/i,
  /^temp/i,
  /^dummy/i,
  /^admin$/i,
  /^johndoe$/i,
  /^janehustler$/i,
];

const TEST_NAME_PATTERNS = [
  /test/i,
  /fake/i,
  /demo/i,
  /example/i,
  /temp/i,
  /dummy/i,
  /^Admin User$/i,
  /^John Customer$/i,
  /^Jane Hustler$/i,
];

/**
 * Check if a user looks like a test user
 */
function isTestUser(user) {
  // Check email
  if (TEST_EMAIL_PATTERNS.some(pattern => pattern.test(user.email))) {
    return { isTest: true, reason: 'email pattern' };
  }

  // Check username
  if (TEST_USERNAME_PATTERNS.some(pattern => pattern.test(user.username))) {
    return { isTest: true, reason: 'username pattern' };
  }

  // Check name
  if (TEST_NAME_PATTERNS.some(pattern => pattern.test(user.name))) {
    return { isTest: true, reason: 'name pattern' };
  }

  return { isTest: false, reason: null };
}

/**
 * List all test users
 */
async function listTestUsers() {
  console.log('🔍 Scanning for test users...\n');

  try {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        roles: true,
        createdAt: true,
        _count: {
          select: {
            jobsAsCustomer: true,
            jobsAsHustler: true,
            offers: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const testUsers = [];
    const realUsers = [];

    for (const user of allUsers) {
      const { isTest, reason } = isTestUser(user);
      if (isTest) {
        testUsers.push({ ...user, testReason: reason });
      } else {
        realUsers.push(user);
      }
    }

    console.log(`📊 Total users: ${allUsers.length}`);
    console.log(`🧪 Test users found: ${testUsers.length}`);
    console.log(`✅ Real users: ${realUsers.length}\n`);

    if (testUsers.length > 0) {
      console.log('🧪 TEST USERS TO DELETE:\n');
      console.log('─'.repeat(80));
      
      for (const user of testUsers) {
        console.log(`📧 Email: ${user.email}`);
        console.log(`👤 Username: ${user.username}`);
        console.log(`📛 Name: ${user.name}`);
        console.log(`🎭 Roles: ${user.roles.join(', ')}`);
        console.log(`📅 Created: ${user.createdAt.toISOString()}`);
        console.log(`📊 Activity: ${user._count.jobsAsCustomer} jobs as customer, ${user._count.jobsAsHustler} jobs as hustler, ${user._count.offers} offers`);
        console.log(`🔍 Reason: ${user.testReason}`);
        console.log(`🆔 ID: ${user.id}`);
        console.log('─'.repeat(80));
        console.log();
      }

      // Calculate impact
      let totalJobs = 0;
      let totalOffers = 0;
      for (const user of testUsers) {
        totalJobs += user._count.jobsAsCustomer + user._count.jobsAsHustler;
        totalOffers += user._count.offers;
      }

      console.log(`⚠️  WARNING: Deleting these users will also delete:`);
      console.log(`   - ${totalJobs} jobs (created by or assigned to test users)`);
      console.log(`   - ${totalOffers} offers (from test users)`);
      console.log(`   - All related messages, threads, reviews, and payments\n`);
    } else {
      console.log('✅ No test users found! Database is clean.\n');
    }

    if (realUsers.length > 0 && realUsers.length <= 10) {
      console.log('✅ REAL USERS (will be kept):\n');
      for (const user of realUsers) {
        console.log(`   - ${user.email} (${user.username}) - ${user.name}`);
      }
      console.log();
    }

    return { testUsers, realUsers };
  } catch (error) {
    console.error('❌ Error listing users:', error);
    throw error;
  }
}

/**
 * Delete test users
 */
async function deleteTestUsers() {
  const { testUsers } = await listTestUsers();

  if (testUsers.length === 0) {
    console.log('✅ No test users to delete.\n');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log('⚠️  WARNING: This will permanently delete all test users and their related data!');
  console.log(`   - ${testUsers.length} users`);
  
  // Count related data
  let totalJobs = 0;
  let totalOffers = 0;
  for (const user of testUsers) {
    totalJobs += user._count.jobsAsCustomer + user._count.jobsAsHustler;
    totalOffers += user._count.offers;
  }
  console.log(`   - ${totalJobs} jobs`);
  console.log(`   - ${totalOffers} offers`);
  console.log(`   - All related messages, threads, reviews, and payments\n`);

  const answer = await question('Are you sure you want to proceed? Type "DELETE" to confirm: ');

  rl.close();

  if (answer !== 'DELETE') {
    console.log('❌ Deletion cancelled.\n');
    return;
  }

  console.log('\n🗑️  Deleting test users...\n');

  let deletedCount = 0;
  let errorCount = 0;

  for (const user of testUsers) {
    try {
      // Prisma will cascade delete related data (jobs, offers, messages, etc.)
      await prisma.user.delete({
        where: { id: user.id },
      });
      
      console.log(`✅ Deleted: ${user.email} (${user.username})`);
      deletedCount++;
    } catch (error) {
      console.error(`❌ Error deleting ${user.email}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`✅ Successfully deleted: ${deletedCount} users`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} users`);
  }
  console.log('─'.repeat(80) + '\n');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === '--list' || !command) {
      await listTestUsers();
    } else if (command === '--delete') {
      await deleteTestUsers();
    } else {
      console.log('Usage:');
      console.log('  node scripts/cleanup-test-users.js --list    # List test users (default)');
      console.log('  node scripts/cleanup-test-users.js --delete  # Delete test users');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { listTestUsers, deleteTestUsers, isTestUser };


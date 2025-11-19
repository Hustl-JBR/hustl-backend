#!/usr/bin/env node
/**
 * Run Database Migration Script
 * 
 * This script runs the email verification migration SQL file.
 * It uses your DATABASE_URL from environment variables.
 * 
 * Usage:
 *   node scripts/run-migration.js
 * 
 * This is easier than using psql directly!
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('\n🔄 Running database migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_email_verification.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      console.error('   Make sure migrations/add_email_verification.sql exists');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (by semicolon, but handle carefully)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statement(s) to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--')) continue;

      try {
        console.log(`   ${i + 1}. Executing statement...`);
        
        // Use Prisma's $executeRawUnsafe for raw SQL
        await prisma.$executeRawUnsafe(statement + ';');
        
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Check if it's a "already exists" error (that's OK)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('IF NOT EXISTS')
        )) {
          console.log(`   ⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📋 What was added:');
    console.log('   - email_verified (boolean)');
    console.log('   - email_verification_code (varchar 6)');
    console.log('   - email_verification_expiry (timestamp)');
    console.log('   - Indexes for performance');
    console.log('\n   All existing users have been set to email_verified = true\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Done! You can now use email verification.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


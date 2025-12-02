#!/usr/bin/env node
/**
 * Migration and startup script
 * Handles failed migrations gracefully and starts the server
 */

const { execSync, spawn } = require('child_process');

async function main() {
  console.log('🔄 Running database migrations...');
  
  try {
    // List of all migrations that might be in a failed state
    const allMigrations = [
      '20251113172230_',
      '20251114002549_add_proposed_amount_to_offers',
      '20251114012607_add_stripe_connect',
      '20251115211639_add_gender_bionpx',
      '20250120_add_expired_job_status',
      '20250120_add_email_verification_fields',
      '20250120_add_message_read_status',
      '20251202_add_verification_codes',
      '20251202_fix_all_missing',
    ];
    
    // First, try to mark any failed migrations as rolled back
    console.log('🔄 Checking for failed migrations...');
    for (const migration of allMigrations) {
      try {
        execSync(`npx prisma migrate resolve --rolled-back ${migration}`, {
          stdio: 'pipe',
          timeout: 30000
        });
        console.log(`✅ Rolled back failed: ${migration}`);
      } catch (e) {
        // Migration might not be in failed state, that's fine
      }
    }
    
    // Now try to deploy migrations
    console.log('🔄 Applying migrations...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 180000
    });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('⚠️  Migration deploy failed:', error.message);
    
    // Try to mark problematic migrations as applied and skip them
    console.log('ℹ️  Attempting to force-apply failed migrations...');
    const problematicMigrations = [
      '20250120_add_expired_job_status',
      '20250120_add_email_verification_fields', 
      '20250120_add_message_read_status',
      '20251202_fix_all_missing',
    ];
    
    for (const migration of problematicMigrations) {
      try {
        execSync(`npx prisma migrate resolve --applied ${migration}`, { stdio: 'pipe', timeout: 30000 });
        console.log(`✅ Force-applied: ${migration}`);
      } catch (e) {
        // Already applied or doesn't exist
      }
    }
    
    console.log('ℹ️  Starting server anyway - some features may not work');
  }
  
  // Generate Prisma client (in case schema changed)
  try {
    execSync('npx prisma generate', {
      stdio: 'inherit',
      timeout: 30000
    });
  } catch (e) {
    console.log('ℹ️  Prisma client generation skipped');
  }
  
  // Start the server
  console.log('🚀 Starting server...');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  server.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});


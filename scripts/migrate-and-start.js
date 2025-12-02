#!/usr/bin/env node
/**
 * Migration and startup script
 * Handles failed migrations gracefully and starts the server
 */

const { execSync, spawn } = require('child_process');

async function main() {
  console.log('🔄 Running database migrations...');
  
  try {
    // First, try to resolve any failed migrations by marking them as rolled back
    const failedMigrations = [
      '20250120_add_expired_job_status',
      '20250120_add_email_verification_fields',
      '20250120_add_message_read_status',
    ];
    
    for (const migration of failedMigrations) {
      try {
        execSync(`npx prisma migrate resolve --rolled-back ${migration}`, {
          stdio: 'pipe',
          timeout: 30000
        });
        console.log(`✅ Resolved failed migration: ${migration}`);
      } catch (e) {
        // Migration might not be in failed state, that's fine
      }
    }
    
    // Now try to deploy migrations
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 120000
    });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('⚠️  Migration had issues:', error.message);
    
    // Try to mark all as applied and continue
    console.log('ℹ️  Attempting to mark migrations as applied...');
    try {
      execSync('npx prisma migrate resolve --applied 20250120_add_expired_job_status', { stdio: 'pipe', timeout: 30000 });
      console.log('✅ Marked migration as applied');
    } catch (e) {
      // Already applied or doesn't exist
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


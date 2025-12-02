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
    try {
      execSync('npx prisma migrate resolve --rolled-back 20250120_add_expired_job_status', {
        stdio: 'inherit',
        timeout: 30000
      });
      console.log('✅ Resolved failed migration');
    } catch (e) {
      // Migration might not be in failed state, that's fine
      console.log('ℹ️  No failed migrations to resolve (or already resolved)');
    }
    
    // Now try to deploy migrations
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 60000
    });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('⚠️  Migration had issues:', error.message);
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


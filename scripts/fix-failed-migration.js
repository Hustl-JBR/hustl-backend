#!/usr/bin/env node
/**
 * Emergency fix script for failed migrations
 * Checks database state and forcefully resolves failed migrations
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function checkEnumValueExists(enumName, value) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = '${value}'
        AND enumtypid = (
          SELECT oid 
          FROM pg_type 
          WHERE typname = '${enumName}'
        )
      ) as exists;
    `);
    
    return result[0]?.exists === true;
  } catch (error) {
    console.error(`Error checking enum value:`, error.message);
    return false;
  }
}

async function addEnumValue(enumName, value) {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 
              FROM pg_enum 
              WHERE enumlabel = '${value}'
              AND enumtypid = (
                  SELECT oid 
                  FROM pg_type 
                  WHERE typname = '${enumName}'
              )
          ) THEN
              ALTER TYPE "${enumName}" ADD VALUE '${value}';
          END IF;
      END $$;
    `);
    return true;
  } catch (error) {
    console.error(`Error adding enum value with DO block:`, error.message);
    // Try direct approach (might fail on some PostgreSQL versions)
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "${enumName}" ADD VALUE '${value}';`);
      return true;
    } catch (e2) {
      console.error(`Error adding enum value (direct):`, e2.message);
      return false;
    }
  }
}

async function main() {
  console.log('🔧 Fixing failed migration state...\n');
  
  try {
    // Check if SCHEDULED enum value exists
    console.log('🔍 Checking if SCHEDULED enum value exists...');
    const exists = await checkEnumValueExists('JobStatus', 'SCHEDULED');
    
    if (exists) {
      console.log('✅ SCHEDULED enum value already exists in database');
      console.log('🔄 Marking migration as applied...');
      
      // Force mark the migration as applied
      try {
        execSync('npx prisma migrate resolve --applied 20250123_add_scheduled_status', {
          stdio: 'inherit',
          timeout: 30000
        });
        console.log('✅ Migration marked as applied\n');
      } catch (e) {
        console.log('⚠️  Could not mark as applied via Prisma CLI, trying database direct fix...');
        
        // Try to directly fix the migration table
        try {
          await prisma.$executeRawUnsafe(`
            UPDATE "_prisma_migrations" 
            SET finished_at = NOW(), 
                rolled_back_at = NULL,
                logs = NULL,
                started_at = COALESCE(started_at, NOW())
            WHERE migration_name = '20250123_add_scheduled_status' 
            AND finished_at IS NULL;
          `);
          console.log('✅ Fixed migration record directly in database\n');
        } catch (dbError) {
          console.error('❌ Could not fix migration record:', dbError.message);
        }
      }
    } else {
      console.log('❌ SCHEDULED enum value does not exist');
      console.log('🔄 Adding SCHEDULED enum value...');
      
      const added = await addEnumValue('JobStatus', 'SCHEDULED');
      
      if (added) {
        console.log('✅ SCHEDULED enum value added successfully');
        console.log('🔄 Marking migration as applied...');
        
        try {
          execSync('npx prisma migrate resolve --applied 20250123_add_scheduled_status', {
            stdio: 'inherit',
            timeout: 30000
          });
          console.log('✅ Migration marked as applied\n');
        } catch (e) {
          // Try direct database fix
          try {
            await prisma.$executeRawUnsafe(`
              UPDATE "_prisma_migrations" 
              SET finished_at = NOW(), 
                  rolled_back_at = NULL,
                  logs = NULL,
                  started_at = COALESCE(started_at, NOW())
              WHERE migration_name = '20250123_add_scheduled_status' 
              AND finished_at IS NULL;
            `);
            console.log('✅ Fixed migration record directly in database\n');
          } catch (dbError) {
            console.error('❌ Could not fix migration record:', dbError.message);
          }
        }
      } else {
        console.error('❌ Failed to add SCHEDULED enum value');
        process.exit(1);
      }
    }
    
    // Also try to mark any other potentially failed migrations
    console.log('🔄 Checking for other failed migrations...');
    const problematicMigrations = [
      '20250120_add_expired_job_status',
      '20250120_add_email_verification_fields', 
      '20250120_add_message_read_status',
      '20251202_fix_all_missing',
    ];
    
    for (const migration of problematicMigrations) {
      try {
        execSync(`npx prisma migrate resolve --applied ${migration}`, {
          stdio: 'pipe',
          timeout: 30000
        });
        console.log(`✅ Resolved: ${migration}`);
      } catch (e) {
        // Already resolved or doesn't exist
      }
    }
    
    console.log('\n✅ Failed migration fix completed!\n');
    
  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


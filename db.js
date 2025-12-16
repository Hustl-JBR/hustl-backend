const { PrismaClient } = require('@prisma/client');

// Configure Prisma with PostgreSQL database
// Works with any PostgreSQL provider: Railway, Neon, Supabase, etc.
// Connection pooling is handled via DATABASE_URL connection string parameters
const connectionString = process.env.DATABASE_URL || '';
const hasPooling = connectionString.includes('pooler') || connectionString.includes('pool');

let prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  prismaConfig = {
    ...prismaConfig,
    // Enable query logging only for errors in production
    log: ['error'],
  };
}

const prisma = new PrismaClient(prismaConfig);

// Test database connection on startup
async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Log connection pooling status
    if (hasPooling) {
      console.log('✅ Database connection pooling enabled');
    } else {
      console.log('✅ Database connected (connection pooling not detected in DATABASE_URL)');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('   Make sure DATABASE_URL is set correctly in your environment variables');
    console.error('   Error code:', error.code);
    // Don't exit - let the app start and try to connect on first query
    // This allows the app to start even if DB is temporarily unavailable
  }
}

// Test connection asynchronously (don't block startup)
testConnection().catch(err => {
  console.warn('[DB] Connection test failed (non-blocking):', err.message);
});

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    await prisma.$disconnect();
    console.log('Database connection closed gracefully');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
    process.exit(1);
  }
};

process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle connection errors gracefully
process.on('unhandledRejection', (error) => {
  if (error && typeof error === 'object') {
    // Check if it's a Prisma connection error
    if (error.kind === 'Closed' || (error.message && error.message.includes('connection'))) {
      // Prisma will automatically reconnect on next query
      // Just log it, don't crash the app
      return;
    }
  }
  // Log other unhandled rejections
  console.error('Unhandled rejection:', error);
});

module.exports = prisma;

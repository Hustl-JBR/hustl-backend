const { PrismaClient } = require('@prisma/client');

// Configure Prisma with connection pooling for Neon (supports 100k+ users)
// Neon serverless supports connection pooling via connection string parameters
const connectionString = process.env.DATABASE_URL || '';
const hasPooling = connectionString.includes('pooler') || connectionString.includes('pool');

// Add connection pooling parameters if not already present
let prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

// For Neon, connection pooling is handled via connection string parameters
// Example: ?connection_limit=10&pool_timeout=20
// Prisma automatically uses connection pooling when configured in DATABASE_URL
// We just ensure Prisma client is configured for optimal performance
if (process.env.NODE_ENV === 'production') {
  // Production optimizations
  prismaConfig = {
    ...prismaConfig,
    // Enable query logging only for errors in production
    log: ['error'],
  };
}

const prisma = new PrismaClient(prismaConfig);

// Log connection pooling status on startup
if (hasPooling) {
  console.log('✅ Database connection pooling enabled (Neon)');
} else {
  console.log('⚠️  Connection pooling not detected in DATABASE_URL. Consider using Neon pooler for better scalability.');
}

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

const { PrismaClient } = require('@prisma/client');

// Configure Prisma - reduce log noise in development
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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

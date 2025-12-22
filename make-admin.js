// make-admin.js
// Simple script to make yourself admin in the database
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeAdmin() {
  // ⚠️ CHANGE THIS to your actual email
  const yourEmail = 'team.hustljobs@outlook.com';
  
  // Email is set, proceed with granting admin
  
  try {
    console.log('🔄 Looking for user:', yourEmail);
    
    // Check if user exists first
    const existingUser = await prisma.user.findUnique({
      where: { email: yourEmail },
      select: { email: true, roles: true },
    });
    
    if (!existingUser) {
      console.error('❌ ERROR: User not found with email:', yourEmail);
      console.error('   Make sure you\'re using the correct email address.');
      process.exit(1);
    }
    
    console.log('✅ Found user:', existingUser.email);
    console.log('   Current roles:', existingUser.roles);
    
    // Update to admin (keep existing roles too)
    const updatedUser = await prisma.user.update({
      where: { email: yourEmail },
      data: {
        roles: {
          set: [...new Set([...existingUser.roles, 'ADMIN'])] // Add ADMIN, keep others
        },
      },
      select: { email: true, roles: true },
    });
    
    console.log('');
    console.log('✅ SUCCESS! User is now admin:');
    console.log('   Email:', updatedUser.email);
    console.log('   Roles:', updatedUser.roles);
    console.log('');
    console.log('🎉 Next steps:');
    console.log('   1. Log out and log back in to your website');
    console.log('   2. Go to: https://hustljobs.com/admin.html');
    console.log('   3. You should see the admin dashboard!');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    if (error.code === 'P2025') {
      console.error('   User not found! Check your email address.');
    } else if (error.message.includes('DATABASE_URL')) {
      console.error('   Database connection error!');
      console.error('   Make sure DATABASE_URL is set correctly.');
      console.error('   Get it from Railway → Database → Variables → DATABASE_URL');
    } else {
      console.error('   Full error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();


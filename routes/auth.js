const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { sendSignupEmail, sendEmailVerificationEmail, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

// POST /auth/signup
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  body('username').trim().isAlphanumeric().isLength({ min: 3, max: 20 }),
  body('city').trim().notEmpty(),
  body('zip').trim().matches(/^\d{5}(-\d{4})?$/),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Signup validation errors:', errors.array());
      const errorMessages = errors.array().map(e => `${e.param}: ${e.msg}`).join(', ');
      return res.status(400).json({ 
        error: 'Validation failed: ' + errorMessages,
        details: errors.array() 
      });
    }

const { email, password, name, username, city, zip, role, referralCode } = req.body;
    
    console.log('[signup] Request received:', { email, name, username, role, city, zip: zip?.substring(0, 3) + '**', referralCode });
    console.log('[signup] JWT_SECRET exists:', !!process.env.JWT_SECRET);

    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      select: { id: true, email: true, username: true },
    });

    if (existing) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

// Generate 6-digit verification code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Create user with both roles (users can be both customer and hustler)
    let user;
    try {
      // First try with email verification fields
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          username,
          city,
          zip,
          roles: ['CUSTOMER', 'HUSTLER'],
          emailVerified: false,
          emailVerificationCode: verificationCode,
          emailVerificationExpiry: verificationCodeExpiry,
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          roles: true,
          emailVerified: true,
          createdAt: true,
        },
      });
    } catch (createError) {
      console.error('[signup] User creation error:', createError.message);
      // If it fails due to missing columns, try without email verification fields
      if (createError.code === 'P2002' || createError.message?.includes('Unknown arg')) {
        console.log('[signup] Retrying without email verification fields...');
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            name,
            username,
            city,
            zip,
            roles: ['CUSTOMER', 'HUSTLER'],
          },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            roles: true,
            createdAt: true,
          },
        });
      } else {
        throw createError;
      }
    }

    // Track referral if code provided (non-blocking)
    if (referralCode) {
      try {
        const referralResponse = await fetch(`${process.env.APP_BASE_URL || 'http://localhost:8080'}/referrals/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referralCode, userId: user.id }),
        });
        if (referralResponse.ok) {
          console.log('[signup] Referral tracked successfully');
        }
      } catch (referralError) {
        console.error('[signup] Error tracking referral (non-fatal):', referralError);
        // Don't fail signup if referral tracking fails
      }
    }

    // Send welcome email (non-blocking)
    console.log('[signup] About to send welcome email to:', user.email);
    try {
      await sendSignupEmail(user.email, user.name);
      console.log('[signup] ✅ Welcome email sent successfully');
    } catch (welcomeEmailError) {
      console.error('[signup] ❌ Failed to send welcome email:', welcomeEmailError.message);
    }
    
    // Send email verification email with code (non-blocking)
    console.log('[signup] About to send verification email to:', user.email, 'with code:', verificationCode);
    try {
      await sendEmailVerificationEmail(user.email, user.name, verificationCode);
      console.log('[signup] ✅ Verification email sent successfully to:', user.email);
    } catch (emailError) {
      console.error('[signup] ❌ Failed to send verification email:', emailError.message, emailError.stack);
      // Don't fail signup if email fails
    }

    // Generate token (but user won't be able to post jobs until verified)
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-me';
    if (!process.env.JWT_SECRET) {
      console.warn('[signup] WARNING: JWT_SECRET not set, using fallback!');
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({ 
      user: {
        ...user,
        emailVerified: false, // Always false on signup
      },
      token,
      requiresEmailVerification: true,
      message: 'Account created! Please check your email for a verification code.'
    });
  } catch (error) {
    console.error('[signup] CRITICAL ERROR:', error.message);
    console.error('[signup] Error code:', error.code);
    console.error('[signup] Full error:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Internal server error', debug: error.message });
  }
});

// POST /auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Login validation errors:', errors.array());
      const errorMessages = errors.array().map(e => `${e.param}: ${e.msg}`).join(', ');
      return res.status(400).json({ 
        error: 'Validation failed: ' + errorMessages,
        details: errors.array() 
      });
    }

    // Email is already normalized by express-validator
    const { email, password } = req.body;

    // Find user by email (email is already normalized by validator)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        passwordHash: true,
        roles: true,
        city: true,
        zip: true,
        photoUrl: true,
        ratingAvg: true,
        ratingCount: true,
        idVerified: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.error('Login failed: User not found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.error('Login failed: Invalid password for user:', user.email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Block login if email is not verified
    const isEmailVerified = user.emailVerified === true;
    if (!isEmailVerified) {
      return res.status(403).json({ 
        error: 'Email not verified',
        requiresEmailVerification: true,
        message: 'Please verify your email address before logging in. Check your inbox for the verification code.'
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roles: user.roles,
        idVerified: user.idVerified,
        emailVerified: true,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/reset
router.post('/reset', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // Don't reveal if user exists (security best practice)
    if (user) {
      // Generate reset token (in production, store in DB with expiry)
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const resetUrl = `${process.env.APP_BASE_URL}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    res.json({ message: 'If an account exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/verify-email - Verify email with 6-digit code
router.post('/verify-email', [
  body('code').trim().notEmpty().isLength({ min: 6, max: 6 }),
  body('email').optional().isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }

    const { code, email } = req.body;
    const providedCode = String(code).trim().replace(/\D/g, ''); // Remove non-digits

    if (providedCode.length !== 6) {
      return res.status(400).json({ error: 'Verification code must be 6 digits' });
    }

    // Try to find user by email
    // Note: This requires the emailVerified column to exist in the database
    let user;
    try {
      user = await prisma.user.findFirst({
        where: email 
          ? { 
              email,
              emailVerified: false,
            }
          : {
              emailVerified: false,
            },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          roles: true,
          emailVerificationCode: true,
          emailVerificationExpiry: true,
        },
      });
    } catch (schemaError) {
      // If emailVerified column doesn't exist, try without it
      console.warn('[verify-email] emailVerified column may not exist:', schemaError.message);
      if (email) {
        user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, username: true, roles: true },
        });
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found or already verified' });
    }

    // Check if code matches and hasn't expired
    const storedCode = String(user.emailVerificationCode || '').trim();
    const codeExpired = user.emailVerificationExpiry 
      ? new Date(user.emailVerificationExpiry) < new Date()
      : true;

    if (!storedCode || storedCode !== providedCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (codeExpired) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Verify email
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null, // Clear code after verification
        emailVerificationExpiry: null,
      },
    });

    // Generate new token with verified status
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roles: user.roles,
        emailVerified: true,
      },
      token,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout - Logout user (optional, mainly for server-side session cleanup if needed)
router.post('/logout', async (req, res) => {
  try {
    // In a stateless JWT system, logout is mainly client-side
    // But we can log it or do any server-side cleanup here if needed
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/resend-verification - Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, emailVerified: true },
      });
    } catch (e) {
      // If emailVerified doesn't exist, fetch without it
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      });
    }

    // Don't reveal if user exists (security best practice)
    if (user && (user.emailVerified === false || user.emailVerified === undefined)) {
      // Generate new verification code
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Update user with new code
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationCode: verificationCode,
          emailVerificationExpiry: verificationCodeExpiry,
        },
      });

      // Send verification email
      try {
        await sendEmailVerificationEmail(user.email, user.name, verificationCode);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return res.status(500).json({ error: 'Failed to send verification email' });
      }
    }

    res.json({ message: 'If an account exists and is not verified, a verification code has been sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh - Refresh JWT token (for persistent login)
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token (even if expired, we can still refresh if it's close to expiry)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // If token is expired, try to decode without verification to get userId
      if (error.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
        if (!decoded || !decoded.userId) {
          return res.status(401).json({ error: 'Invalid token' });
        }
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        roles: true,
        idVerified: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new token
    const newToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roles: user.roles,
        idVerified: user.idVerified,
        emailVerified: user.emailVerified || false,
      },
      token: newToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /auth/delete-all-users - Delete ALL users (DANGER - for testing only)
router.delete('/delete-all-users', [
  body('secret').notEmpty(),
  body('confirm').equals('DELETE_ALL'),
], async (req, res) => {
  try {
    const { secret, confirm } = req.body;
    
    const deleteSecret = process.env.DELETE_SECRET || 'hustl-delete-2024';
    if (secret !== deleteSecret || confirm !== 'DELETE_ALL') {
      return res.status(403).json({ error: 'Invalid secret or confirmation' });
    }

    console.log('[auth] ⚠️ DELETING ALL USERS AND DATA...');
    
    // Delete in order of dependencies
    await prisma.message.deleteMany({});
    console.log('[auth] Deleted all messages');
    
    await prisma.thread.deleteMany({});
    console.log('[auth] Deleted all threads');
    
    await prisma.offer.deleteMany({});
    console.log('[auth] Deleted all offers');
    
    await prisma.review.deleteMany({});
    console.log('[auth] Deleted all reviews');
    
    await prisma.payment.deleteMany({});
    console.log('[auth] Deleted all payments');
    
    try {
      await prisma.locationUpdate.deleteMany({});
      console.log('[auth] Deleted all location updates');
    } catch (e) { /* table might not exist */ }
    
    try {
      await prisma.referral.deleteMany({});
      console.log('[auth] Deleted all referrals');
    } catch (e) { /* table might not exist */ }
    
    await prisma.job.deleteMany({});
    console.log('[auth] Deleted all jobs');
    
    const userCount = await prisma.user.count();
    await prisma.user.deleteMany({});
    console.log(`[auth] ✅ Deleted ${userCount} users`);

    res.json({ 
      message: `Successfully deleted ALL data: ${userCount} users and all related records`,
      deletedUsers: userCount
    });
  } catch (error) {
    console.error('[auth] Delete all users error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /auth/delete-account - Delete a user account (for testing)
// Protected by a secret key to prevent misuse
router.delete('/delete-account', [
  body('email').isEmail().normalizeEmail(),
  body('secret').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, secret } = req.body;
    
    // Simple secret check - in production, use a proper admin auth
    const deleteSecret = process.env.DELETE_SECRET || 'hustl-delete-2024';
    if (secret !== deleteSecret) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete related data first (in order of dependencies)
    const userId = user.id;
    
    // Delete messages in threads where user is involved
    await prisma.message.deleteMany({
      where: { senderId: userId },
    });
    
    // Delete threads
    await prisma.thread.deleteMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
    });
    
    // Delete offers
    await prisma.offer.deleteMany({
      where: { hustlerId: userId },
    });
    
    // Delete reviews
    await prisma.review.deleteMany({
      where: { OR: [{ reviewerId: userId }, { revieweeId: userId }] },
    });
    
    // Delete payments
    await prisma.payment.deleteMany({
      where: { OR: [{ customerId: userId }, { hustlerId: userId }] },
    });
    
    // Delete jobs
    await prisma.job.deleteMany({
      where: { OR: [{ customerId: userId }, { hustlerId: userId }] },
    });
    
    // Finally delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    console.log(`[auth] Deleted user: ${email}`);
    res.json({ message: `User ${email} and all related data deleted successfully` });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;


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
    
    console.log('[signup] Request body:', { email, name, username, role, hasCity: !!city, hasZip: !!zip, referralCode });

    // Check if user exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

// Generate 6-digit verification code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const verificationCodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create user with both roles (users can be both customer and hustler)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        username,
        city,
        zip,
        roles: ['CUSTOMER', 'HUSTLER'], // All users can be both
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

    // Send welcome email
    await sendSignupEmail(user.email, user.name);
    
    // Send email verification email with code
    try {
      await sendEmailVerificationEmail(user.email, user.name, verificationCode);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail signup if email fails, but log it
    }

    // Generate token (but user won't be able to post jobs until verified)
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
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
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
        emailVerified: user.emailVerified || false,
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

    // Try to find user by email (if provided) or by code in database
    // For simplicity, we'll search users with matching verification code
    const user = await prisma.user.findFirst({
      where: email 
        ? { 
            email,
            emailVerified: false,
          }
        : {
            emailVerified: false,
          },
    });

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

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists (security best practice)
    if (user && !user.emailVerified) {
      // Generate new verification code
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const verificationCodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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

module.exports = router;


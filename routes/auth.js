const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { sendSignupEmail, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

// POST /auth/signup
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  body('username').trim().isAlphanumeric().isLength({ min: 3, max: 20 }),
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

    const { email, password, name, username, role } = req.body;
    
    console.log('[signup] Request body:', { email, name, username, role, hasCity: !!req.body.city, hasZip: !!req.body.zip });

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

    // Create user - simple signup, no city/zip required
    const userData = {
      email,
      passwordHash,
      name,
      username,
      roles: ['CUSTOMER', 'HUSTLER'], // All users can be both
      // city and zip are NOT included - they are optional
    };
    
    console.log('[signup] Creating user with data (no city/zip):', { ...userData, passwordHash: '[HIDDEN]' });
    
    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        roles: true,
        createdAt: true,
      },
    });

    // Send welcome email
    await sendSignupEmail(user.email, user.name);

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Signup error full details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    // Provide more detailed error message
    let errorMessage = 'Account creation failed. Please try again.';
    if (error.code === 'P2002') {
      errorMessage = 'Email or username already exists';
    } else if (error.message) {
      // Completely hide any city/zip related errors
      const lowerMsg = error.message.toLowerCase();
      if (lowerMsg.includes('city') || lowerMsg.includes('zip') || lowerMsg.includes('location')) {
        console.error('BLOCKED city/zip error from reaching user:', error.message);
        errorMessage = 'Account creation failed. Please try again or contact support.';
      } else {
        errorMessage = error.message;
      }
    }
    res.status(500).json({ error: errorMessage });
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

module.exports = router;


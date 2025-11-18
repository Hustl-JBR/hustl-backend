const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /users/me
router.get('/me', async (req, res) => {
  try {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          city: true,
          zip: true,
          photoUrl: true,
          roles: true,
          ratingAvg: true,
          ratingCount: true,
          idVerified: true,
          createdAt: true,
          gender: true,
          bio: true,
        },
      });
    } catch (genderError) {
      // If gender/bio columns don't exist, query without them
      if (genderError.message && genderError.message.includes('gender')) {
        user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            city: true,
            zip: true,
            photoUrl: true,
            roles: true,
            ratingAvg: true,
            ratingCount: true,
            idVerified: true,
            createdAt: true,
          },
        });
        user.gender = null;
        user.bio = null;
      } else {
        throw genderError;
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id - Get public user profile
router.get('/:id', async (req, res) => {
  try {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          name: true,
          username: true,
          city: true,
          zip: true,
          photoUrl: true,
          ratingAvg: true,
          ratingCount: true,
          idVerified: true,
          createdAt: true,
          gender: true,
          bio: true,
        },
      });
    } catch (genderError) {
      // If gender/bio columns don't exist, query without them
      if (genderError.message && genderError.message.includes('gender')) {
        user = await prisma.user.findUnique({
          where: { id: req.params.id },
          select: {
            id: true,
            name: true,
            username: true,
            city: true,
            zip: true,
            photoUrl: true,
            ratingAvg: true,
            ratingCount: true,
            idVerified: true,
            createdAt: true,
          },
        });
        user.gender = null;
        user.bio = null;
      } else {
        throw genderError;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/me
router.patch('/me', [
  body('name').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('zip').optional().trim().matches(/^\d{5}(-\d{4})?$/),
  body('photoUrl').optional().custom((value) => {
    // Allow empty string, null, or valid URL
    if (!value || value === '' || value === null) return true;
    // Check if it's a valid URL or a data URL (for base64 images)
    try {
      // Try to create URL object - this validates the format
      new URL(value);
      return true;
    } catch {
      // Also allow data URLs (data:image/...)
      if (value.startsWith('data:image/')) return true;
      // Allow any string that looks like a URL (R2 URLs, etc.)
      if (typeof value === 'string' && value.length > 0) {
        // Be lenient - just check it's a string
        return true;
      }
      return false;
    }
  }).withMessage('photoUrl must be a valid URL'),
  body('bio').optional().trim(),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('[PATCH /users/me] Validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { name, city, zip, photoUrl, bio, gender } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (city) updateData.city = city;
    if (zip) updateData.zip = zip;
    if (photoUrl) updateData.photoUrl = photoUrl;
    
    // Handle bio and gender - only include if columns exist
    try {
      // Try to update with bio and gender
      if (bio !== undefined) updateData.bio = bio;
      if (gender !== undefined) updateData.gender = gender;
    } catch (e) {
      // If columns don't exist, skip them
      console.warn('Bio/gender columns may not exist:', e.message);
    }

    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          city: true,
          zip: true,
          photoUrl: true,
          roles: true,
          ratingAvg: true,
          ratingCount: true,
          idVerified: true,
          updatedAt: true,
          gender: true,
          bio: true,
        },
      });
    } catch (updateError) {
      // If gender/bio columns don't exist, update without them
      if (updateError.message && updateError.message.includes('gender')) {
        delete updateData.bio;
        delete updateData.gender;
        user = await prisma.user.update({
          where: { id: req.user.id },
          data: updateData,
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            city: true,
            zip: true,
            photoUrl: true,
            roles: true,
            ratingAvg: true,
            ratingCount: true,
            idVerified: true,
            updatedAt: true,
          },
        });
        user.gender = null;
        user.bio = null;
      } else {
        throw updateError;
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


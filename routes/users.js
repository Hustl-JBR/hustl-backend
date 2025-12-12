const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /users/me - Get current user's profile (requires auth)
// Must be defined BEFORE /:id to avoid route conflicts
router.get('/me', authenticate, async (req, res) => {
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
          tools: true,
        },
      });
    } catch (genderError) {
      // If gender/bio/tools columns don't exist, query without them
      if (genderError.message && (genderError.message.includes('gender') || genderError.message.includes('tools'))) {
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
        user.tools = null;
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

// GET /users/:id - Get public user profile (optional auth)
// This route must be defined AFTER /me to avoid route conflicts
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // Don't allow accessing /me via this route
    if (req.params.id === 'me') {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[GET /users/:id] Fetching profile for user ID: ${req.params.id}`);
    const requestedUserId = req.params.id;

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: requestedUserId },
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
          tools: true,
        },
      });
    } catch (genderError) {
      // If gender/bio/tools columns don't exist, query without them
      if (genderError.message && (genderError.message.includes('gender') || genderError.message.includes('tools'))) {
        user = await prisma.user.findUnique({
          where: { id: requestedUserId },
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
        user.tools = null;
      } else {
        throw genderError;
      }
    }

    if (!user) {
      console.log(`[GET /users/:id] User not found for ID: ${requestedUserId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[GET /users/:id] Returning profile for: ${user.name} (ID: ${user.id})`);
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All routes below require authentication
router.use(authenticate);

// PATCH /users/me
router.patch('/me', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('bio').optional().trim(),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('tools').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, city, zip, photoUrl, bio, gender, tools } = req.body;
    const updateData = {};

    console.log('[PATCH /users/me] Received update request:', { name, city, zip, photoUrl, bio, gender, tools });

    if (name) updateData.name = name;
    if (city) updateData.city = city;
    if (zip !== undefined) {
      // Allow clearing zip by setting to null or empty string
      updateData.zip = (zip === '' || zip === null) ? null : zip;
    }
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    
    // Handle bio, gender, and tools - allow empty strings to clear values
    // Always include bio if it's in the request (even if null) to ensure it's saved/cleared
    if (bio !== undefined) {
      // Allow empty string or null to clear bio
      updateData.bio = (bio === '' || bio === null) ? null : bio.trim();
    }
    if (gender !== undefined) {
      // Allow empty string to clear gender
      updateData.gender = (gender === '' || gender === null) ? null : gender;
    }
    if (tools !== undefined) {
      // Allow empty string to clear tools
      updateData.tools = (tools === '' || tools === null) ? null : tools.trim();
    }

    console.log('[PATCH /users/me] Prepared updateData:', updateData);

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
          tools: true,
        },
      });
    } catch (updateError) {
      // If gender/bio/tools columns don't exist, update without them
      if (updateError.message && (updateError.message.includes('gender') || updateError.message.includes('tools'))) {
        delete updateData.bio;
        delete updateData.gender;
        delete updateData.tools;
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
        user.tools = null;
      } else {
        throw updateError;
      }
    }

    console.log('[PATCH /users/me] Successfully updated user:', user.id, 'Returning:', { name: user.name, bio: user.bio, gender: user.gender });
    res.json(user);
  } catch (error) {
    console.error('[PATCH /users/me] Update user error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /users/me/photo - Upload profile photo to R2
const multer = require('multer');
const { uploadFileToR2 } = require('../services/r2');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for profile photos
  },
  fileFilter: (req, file, cb) => {
    // Allow only images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only images are supported for profile photos.'));
    }
  },
});

router.post('/me/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const { file } = req;
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.originalname.split('.').pop() || 'jpg';
    const filename = `profile-photos/${req.user.id}/${timestamp}.${extension}`;
    
    // Upload to R2
    const { fileKey, publicUrl } = await uploadFileToR2(
      file.buffer,
      filename,
      file.mimetype
    );

    // Update user's photoUrl in database
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        photoUrl: publicUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        photoUrl: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      photoUrl: publicUrl,
      user: user,
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload profile photo' });
  }
});

// GET /users/me/photo - Get profile photo URL
router.get('/me/photo', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        photoUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      photoUrl: user.photoUrl || null,
    });
  } catch (error) {
    console.error('Get profile photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


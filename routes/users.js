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
  body('bio').optional().custom((value) => {
    // Allow null, empty string, or any string value
    if (value === null || value === undefined || value === '') return true;
    if (typeof value === 'string' && value.trim().length <= 300) return true;
    return false;
  }).withMessage('Bio must be a string with max 300 characters'),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say', null]),
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
      const trimmedBio = typeof bio === 'string' ? bio.trim() : bio;
      updateData.bio = (trimmedBio === '' || trimmedBio === null) ? null : trimmedBio;
      console.log('[PATCH /users/me] Bio processing - Original:', JSON.stringify(bio), 'Type:', typeof bio, 'Trimmed:', JSON.stringify(trimmedBio), 'Final:', JSON.stringify(updateData.bio));
    }
    if (gender !== undefined) {
      // Allow empty string to clear gender
      updateData.gender = (gender === '' || gender === null) ? null : gender;
    }
    if (tools !== undefined) {
      // Allow empty string to clear tools
      updateData.tools = (tools === '' || tools === null) ? null : tools.trim();
    }

    console.log('[PATCH /users/me] Prepared updateData:', JSON.stringify(updateData, null, 2));

    let user;
    try {
      console.log('[PATCH /users/me] Attempting Prisma update with data:', JSON.stringify(updateData, null, 2));
      
      // Build select statement - try without tools first since it may not exist
      const baseSelect = {
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
      };
      
      // Try update with tools in select first, fall back without it if it fails
      // Note: We only include tools in SELECT, not in updateData (unless it was explicitly sent)
      let selectWithTools = { ...baseSelect, tools: true };
      
      try {
        user = await prisma.user.update({
          where: { id: req.user.id },
          data: updateData,
          select: selectWithTools,
        });
        console.log('[PATCH /users/me] Prisma update succeeded. User bio:', JSON.stringify(user.bio), 'gender:', user.gender);
      } catch (toolsError) {
        // If tools column doesn't exist in SELECT, try without it
        if (toolsError.code === 'P2022' && toolsError.message && toolsError.message.includes('tools')) {
          console.warn('[PATCH /users/me] Tools column does not exist in database, retrying without tools in select');
          // Remove tools from updateData if it was there (but keep bio and gender!)
          const updateDataWithoutTools = { ...updateData };
          delete updateDataWithoutTools.tools;
          
          user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateDataWithoutTools, // This still has bio and gender!
            select: baseSelect, // This still has bio and gender!
          });
          user.tools = null; // Set to null since column doesn't exist
          console.log('[PATCH /users/me] Prisma update succeeded without tools. User bio:', JSON.stringify(user.bio), 'gender:', user.gender);
        } else {
          throw toolsError; // Re-throw if it's a different error
        }
      }
    } catch (updateError) {
      console.error('[PATCH /users/me] Prisma update error:', updateError);
      console.error('[PATCH /users/me] Error message:', updateError.message);
      console.error('[PATCH /users/me] Error code:', updateError.code);
      
      // Check which specific column is causing the error
      const errorMessage = updateError.message || '';
      const isToolsError = errorMessage.includes('tools');
      const isBioError = errorMessage.includes('bio');
      const isGenderError = errorMessage.includes('gender');
      const isColumnError = updateError.code === 'P2021' || updateError.code === 'P2022';
      
      // If it's a column error, try updating without the problematic column(s)
      if (isColumnError && (isToolsError || isBioError || isGenderError)) {
        console.warn('[PATCH /users/me] Database column error detected. Problematic columns:', {
          tools: isToolsError,
          bio: isBioError,
          gender: isGenderError
        });
        
        const fallbackUpdateData = { ...updateData };
        const fallbackSelect = {
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
        };
        
        // Only remove the column(s) that are causing the error
        if (isToolsError) {
          delete fallbackUpdateData.tools;
          console.warn('[PATCH /users/me] Removing tools from update (column does not exist)');
        } else {
          fallbackSelect.tools = true;
        }
        
        if (isBioError) {
          delete fallbackUpdateData.bio;
          console.warn('[PATCH /users/me] Removing bio from update (column does not exist)');
        } else {
          fallbackSelect.bio = true;
        }
        
        if (isGenderError) {
          delete fallbackUpdateData.gender;
          console.warn('[PATCH /users/me] Removing gender from update (column does not exist)');
        } else {
          fallbackSelect.gender = true;
        }
        
        // Try the update again without the problematic column(s)
        try {
          user = await prisma.user.update({
            where: { id: req.user.id },
            data: fallbackUpdateData,
            select: fallbackSelect,
          });
          
          // Set null for columns that don't exist
          if (isToolsError && !user.tools) user.tools = null;
          if (isBioError && !user.bio) user.bio = null;
          if (isGenderError && !user.gender) user.gender = null;
          
          console.log('[PATCH /users/me] Update succeeded after removing problematic columns');
        } catch (retryError) {
          console.error('[PATCH /users/me] Retry also failed:', retryError);
          throw updateError; // Throw original error
        }
      } else {
        throw updateError;
      }
    }

    console.log('[PATCH /users/me] Successfully updated user:', user.id);
    console.log('[PATCH /users/me] User data - name:', user.name, 'bio:', JSON.stringify(user.bio), 'bio type:', typeof user.bio, 'gender:', user.gender);
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


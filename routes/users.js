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
    // Since tools column doesn't exist, query without it from the start
    // This avoids the error and retry cycle that could cause stale data
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
          photoUrl: true, // CRITICAL: Always include photoUrl
          roles: true,
          ratingAvg: true,
          ratingCount: true,
          idVerified: true,
          createdAt: true,
          gender: true,
          bio: true,
          // tools: true, // Removed - column doesn't exist in database
        },
      });
      
      // Set tools to null since column doesn't exist
      user.tools = null;
    } catch (genderError) {
      // If gender/bio/tools columns don't exist, query without them
      // BUT ALWAYS include photoUrl
      if (genderError.message && (genderError.message.includes('gender') || genderError.message.includes('tools'))) {
        console.warn('[GET /users/me] Some columns missing, retrying without them (but keeping photoUrl)');
        user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            city: true,
            zip: true,
            photoUrl: true, // CRITICAL: Always include photoUrl even in fallback
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
    
    // Ensure photoUrl is always present (even if null)
    if (user && user.photoUrl === undefined) {
      console.warn('[GET /users/me] photoUrl was undefined, setting to null');
      user.photoUrl = null;
    }
    
    console.log('[GET /users/me] Returning user with photoUrl:', user.photoUrl);

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
          // tools: true, // Removed - column doesn't exist in database
        },
      });
      
      // Set tools to null since column doesn't exist
      user.tools = null;
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

    // Get completed jobs count for this user
    const completedJobsCount = await prisma.job.count({
      where: {
        AND: [
          {
            OR: [
              { customerId: requestedUserId },
              { hustlerId: requestedUserId }
            ]
          },
          {
            OR: [
              { 
                status: 'PAID',
                completionCodeVerified: true
              },
              { 
                status: 'COMPLETED_BY_HUSTLER',
                completionCodeVerified: true
              }
            ]
          },
          {
            payment: {
              status: 'CAPTURED'
            }
          }
        ]
      }
    });

    console.log(`[GET /users/:id] Returning profile for: ${user.name} (ID: ${user.id}) with ${completedJobsCount} completed jobs`);
    res.json({
      ...user,
      completedJobsCount
    });
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
  body('hometown').trim().notEmpty().withMessage('Hometown (City + State) is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, city, zip, photoUrl, bio, gender, tools, hometown } = req.body;
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
    // Note: hometown column may not exist in database - handle gracefully
    if (hometown !== undefined) {
      const trimmedHometown = typeof hometown === 'string' ? hometown.trim() : hometown;
      if (!trimmedHometown || trimmedHometown === '') {
        return res.status(400).json({ error: 'Hometown (City + State) is required' });
      }
      // Only add hometown if column exists (will be caught in try/catch if it doesn't)
      updateData.hometown = trimmedHometown;
    }
    if (gender !== undefined) {
      // Allow empty string to clear gender
      updateData.gender = (gender === '' || gender === null) ? null : gender;
    }
    // Handle tools separately using raw SQL to ensure it's saved even if Prisma has issues
    let toolsToSave = null;
    if (tools !== undefined) {
      // Allow empty string to clear tools
      toolsToSave = (tools === '' || tools === null) ? null : tools.trim();
      // Don't add to updateData yet - we'll use raw SQL
    }

    console.log('[PATCH /users/me] Prepared updateData:', JSON.stringify(updateData, null, 2));
    console.log('[PATCH /users/me] Tools to save:', toolsToSave);

    let user;
    try {
      console.log('[PATCH /users/me] Attempting Prisma update with data:', JSON.stringify(updateData, null, 2));
      
      // Build select statement - ALWAYS include photoUrl (critical for profile photos)
      // Try without tools first since it may not exist
      const baseSelect = {
        id: true,
        email: true,
        name: true,
        username: true,
        city: true,
        zip: true,
        photoUrl: true, // CRITICAL: Always include photoUrl
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
      } catch (firstError) {
        // Check if it's a column error (tools, hometown, etc.)
        const errorMessage = firstError.message || '';
        const unknownArgMatch = errorMessage.match(/Unknown argument `([^`]+)`/);
        const problematicColumn = unknownArgMatch ? unknownArgMatch[1] : null;
        
        // If it's a tools column error in SELECT, try without it
        if (firstError.code === 'P2022' && errorMessage.includes('tools') && (errorMessage.includes('select') || errorMessage.includes('column'))) {
          console.warn('[PATCH /users/me] Tools column does not exist in database, retrying without tools');
          const updateDataWithoutTools = { ...updateData };
          delete updateDataWithoutTools.tools;
          
          // Also check for hometown and remove it if it doesn't exist
          if (updateDataWithoutTools.hometown) {
            // Try to detect if hometown column exists by checking if it's in the error
            // For now, remove hometown as well since it's likely missing
            delete updateDataWithoutTools.hometown;
            console.warn('[PATCH /users/me] Also removing hometown (column may not exist)');
          }
          
          user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateDataWithoutTools,
            select: baseSelect, // baseSelect doesn't include tools
          });
          user.tools = null;
          if (updateData.hometown) user.hometown = null; // Set to null if we removed it
          console.log('[PATCH /users/me] Prisma update succeeded without tools. User bio:', JSON.stringify(user.bio), 'gender:', user.gender);
        } else if (problematicColumn && (problematicColumn === 'hometown' || problematicColumn === 'tools' || problematicColumn === 'bio' || problematicColumn === 'gender')) {
          // If it's a column error in the data (not SELECT), remove that column and retry
          console.warn(`[PATCH /users/me] Column '${problematicColumn}' does not exist in database, retrying without it`);
          const updateDataWithoutColumn = { ...updateData };
          delete updateDataWithoutColumn[problematicColumn];
          
          // Also remove from select if it was there
          const selectWithoutColumn = { ...selectWithTools };
          delete selectWithoutColumn[problematicColumn];
          
          user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateDataWithoutColumn,
            select: selectWithoutColumn,
          });
          user[problematicColumn] = null; // Set to null since column doesn't exist
          console.log(`[PATCH /users/me] Prisma update succeeded without ${problematicColumn}. User bio:`, JSON.stringify(user.bio), 'gender:', user.gender);
        } else {
          throw firstError; // Re-throw if it's a different error
        }
      }
    } catch (updateError) {
      console.error('[PATCH /users/me] Prisma update error:', updateError);
      console.error('[PATCH /users/me] Error message:', updateError.message);
      console.error('[PATCH /users/me] Error code:', updateError.code);
      
      // Check which specific column is causing the error
      // Look for the exact column name in the error message
      const errorMessage = updateError.message || '';
      
      // Check for "Unknown argument `columnname`" pattern - this is the most specific
      const unknownArgMatch = errorMessage.match(/Unknown argument `([^`]+)`/);
      const problematicColumn = unknownArgMatch ? unknownArgMatch[1] : null;
      
      // Also check for column name in error message (for P2022 errors)
      const isToolsError = problematicColumn === 'tools' || (errorMessage.includes('tools') && errorMessage.includes('column'));
      const isBioError = problematicColumn === 'bio' || (errorMessage.includes('bio') && errorMessage.includes('column'));
      const isGenderError = problematicColumn === 'gender' || (errorMessage.includes('gender') && errorMessage.includes('column'));
      const isHometownError = problematicColumn === 'hometown' || (errorMessage.includes('hometown') && errorMessage.includes('column'));
      
      // P2021 = table does not exist, P2022 = column does not exist
      // Also catch "Unknown argument" errors which occur when column doesn't exist
      const isColumnError = updateError.code === 'P2021' || updateError.code === 'P2022' || errorMessage.includes('Unknown argument');
      
      // If it's a column error, try updating without ONLY the problematic column(s)
      if (isColumnError && (isToolsError || isBioError || isGenderError || isHometownError)) {
        console.warn('[PATCH /users/me] Database column error detected. Problematic column:', problematicColumn || 'unknown');
        console.warn('[PATCH /users/me] Error details:', {
          tools: isToolsError,
          bio: isBioError,
          gender: isGenderError,
          hometown: isHometownError
        });
        
        const fallbackUpdateData = { ...updateData };
        const fallbackSelect = {
          id: true,
          email: true,
          name: true,
          username: true,
          city: true,
          zip: true,
          photoUrl: true, // CRITICAL: Always include photoUrl even in fallback
          roles: true,
          ratingAvg: true,
          ratingCount: true,
          idVerified: true,
          updatedAt: true,
        };
        
        // Only remove the column(s) that are ACTUALLY causing the error
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
        
        if (isHometownError) {
          delete fallbackUpdateData.hometown;
          console.warn('[PATCH /users/me] Removing hometown from update (column does not exist)');
        }
        
        // Try the update again without the problematic column(s)
        try {
          // Make sure fallbackSelect doesn't include tools if tools column doesn't exist
          const finalSelect = { ...fallbackSelect };
          if (isToolsError) {
            delete finalSelect.tools;
          }
          
          user = await prisma.user.update({
            where: { id: req.user.id },
            data: fallbackUpdateData,
            select: finalSelect,
          });
          
          // Set null for columns that don't exist
          if (isToolsError) user.tools = null;
          if (isBioError) user.bio = null;
          if (isGenderError) user.gender = null;
          if (isHometownError) user.hometown = null;
          
          console.log('[PATCH /users/me] Update succeeded after removing problematic columns');
        } catch (retryError) {
          console.error('[PATCH /users/me] Retry also failed:', retryError);
          const retryErrorMessage = retryError.message || '';
          const retryUnknownArgMatch = retryErrorMessage.match(/Unknown argument `([^`]+)`/);
          const retryProblematicColumn = retryUnknownArgMatch ? retryUnknownArgMatch[1] : null;
          const isRetryToolsError = retryErrorMessage.includes('tools') && (retryErrorMessage.includes('column') || retryError.code === 'P2022');
          
          // If retry failed due to another missing column, remove that too and try once more
          if ((retryProblematicColumn && (retryProblematicColumn === 'hometown' || retryProblematicColumn === 'tools' || retryProblematicColumn === 'bio' || retryProblematicColumn === 'gender')) || isRetryToolsError) {
            const columnToRemove = retryProblematicColumn || 'tools';
            console.warn(`[PATCH /users/me] Retry failed due to missing column: ${columnToRemove}, removing it and retrying once more`);
            const finalUpdateData = { ...fallbackUpdateData };
            delete finalUpdateData[columnToRemove];
            
            const finalSelect = { ...fallbackSelect };
            delete finalSelect[columnToRemove];
            if (isToolsError || columnToRemove === 'tools') delete finalSelect.tools;
            
            user = await prisma.user.update({
              where: { id: req.user.id },
              data: finalUpdateData,
              select: finalSelect,
            });
            
            // Set null for all removed columns
            if (isToolsError || columnToRemove === 'tools') user.tools = null;
            if (isBioError || columnToRemove === 'bio') user.bio = null;
            if (isGenderError || columnToRemove === 'gender') user.gender = null;
            if (isHometownError || columnToRemove === 'hometown') user.hometown = null;
            
            console.log('[PATCH /users/me] Update succeeded after second retry');
          } else {
            throw updateError; // Throw original error
          }
        }
      } else {
        throw updateError;
      }
    }

    // Save tools using raw SQL if tools were provided
    if (toolsToSave !== undefined) {
      try {
        if (toolsToSave === null || toolsToSave === '') {
          // Clear tools
          await prisma.$executeRawUnsafe(
            `UPDATE users SET tools = NULL, updated_at = NOW() WHERE id = $1`,
            req.user.id
          );
          console.log('[PATCH /users/me] Tools cleared via raw SQL');
        } else {
          // Save tools
          await prisma.$executeRawUnsafe(
            `UPDATE users SET tools = $1, updated_at = NOW() WHERE id = $2`,
            toolsToSave,
            req.user.id
          );
          console.log('[PATCH /users/me] Tools saved via raw SQL:', toolsToSave);
        }
        // Update user object with tools value
        user.tools = toolsToSave;
      } catch (toolsError) {
        console.error('[PATCH /users/me] Error saving tools via raw SQL:', toolsError);
        // If tools column doesn't exist, set to null in response
        user.tools = null;
      }
    }

    console.log('[PATCH /users/me] Successfully updated user:', user.id);
    console.log('[PATCH /users/me] User data - name:', user.name, 'bio:', JSON.stringify(user.bio), 'bio type:', typeof user.bio, 'gender:', user.gender, 'tools:', user.tools, 'photoUrl:', user.photoUrl);
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
    console.log('[POST /users/me/photo] Photo upload request received');
    
    if (!req.file) {
      console.error('[POST /users/me/photo] No file provided');
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const { file } = req;
    console.log('[POST /users/me/photo] File received:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      userId: req.user.id
    });
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.originalname.split('.').pop() || 'jpg';
    const filename = `profile-photos/${req.user.id}/${timestamp}.${extension}`;
    
    console.log('[POST /users/me/photo] Uploading to R2:', filename);
    
    // Upload to R2
    const { fileKey, publicUrl } = await uploadFileToR2(
      file.buffer,
      filename,
      file.mimetype
    );

    console.log('[POST /users/me/photo] R2 upload successful:', { fileKey, publicUrl });

    // Update user's photoUrl in database - ALWAYS include photoUrl in select
    // Handle tools column error gracefully
    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          photoUrl: publicUrl,
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          photoUrl: true, // CRITICAL: Always include photoUrl
          updatedAt: true,
          gender: true,
          bio: true,
          tools: true,
        },
      });
    } catch (toolsError) {
      // If tools column doesn't exist, retry without it
      if (toolsError.code === 'P2022' && toolsError.message && toolsError.message.includes('tools')) {
        console.warn('[POST /users/me/photo] Tools column missing, retrying without it');
        user = await prisma.user.update({
          where: { id: req.user.id },
          data: {
            photoUrl: publicUrl,
          },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            photoUrl: true, // CRITICAL: Always include photoUrl
            updatedAt: true,
            gender: true,
            bio: true,
          },
        });
        user.tools = null;
      } else {
        throw toolsError;
      }
    }

    console.log('[POST /users/me/photo] Database updated successfully. photoUrl:', user.photoUrl);

    res.json({
      success: true,
      photoUrl: publicUrl, // Return the publicUrl from R2
      user: user, // Return full user object with photoUrl from database
    });
  } catch (error) {
    console.error('[POST /users/me/photo] Upload error:', error);
    console.error('[POST /users/me/photo] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Failed to upload profile photo',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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


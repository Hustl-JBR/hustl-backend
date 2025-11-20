const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { generatePresignedUploadUrl, uploadFileToR2 } = require('../services/r2');
const multer = require('multer');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only images and PDFs are supported.'));
    }
  },
});

// POST /r2/upload - Upload file directly through backend (avoids CORS issues)
// Accepts both 'file' (generic) and 'photo' (profile photo) field names
router.post('/upload', (req, res, next) => {
  console.log('[R2 Upload] Request received:', {
    method: req.method,
    path: req.path,
    contentType: req.headers['content-type'],
    hasAuth: !!req.headers.authorization,
  });
  next();
}, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), async (req, res) => {
  try {
    // Support both 'file' and 'photo' field names
    const file = req.files?.['file']?.[0] || req.files?.['photo']?.[0] || req.file;
    
    console.log('[R2 Upload] File received:', {
      hasFile: !!file,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimeType: file?.mimetype,
      fields: req.files ? Object.keys(req.files) : 'none',
    });

    if (!file) {
      console.error('[R2 Upload] No file provided in request');
      return res.status(400).json({ error: 'No file provided. Please include a file with field name "file" or "photo".' });
    }
    console.log('[R2 Upload] Uploading to R2...');
    const { fileKey, publicUrl } = await uploadFileToR2(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    console.log('[R2 Upload] Upload successful:', { fileKey, publicUrl });

    res.json({
      fileKey,
      publicUrl,
    });
  } catch (error) {
    console.error('[R2 Upload] Upload file error:', error);
    console.error('[R2 Upload] Error stack:', error.stack);
    res.status(400).json({ error: error.message || 'Failed to upload file' });
  }
});

// POST /r2/presign - Generate presigned URL for upload (legacy, kept for compatibility)
router.post('/presign', [
  body('filename').trim().notEmpty(),
  body('contentType').notEmpty(),
  body('fileSize').isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { filename, contentType, fileSize } = req.body;

    const { uploadUrl, fileKey, publicUrl } = await generatePresignedUploadUrl(
      filename,
      contentType,
      fileSize
    );

    res.json({
      uploadUrl,
      fileKey,
      publicUrl,
    });
  } catch (error) {
    console.error('Generate presigned URL error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;


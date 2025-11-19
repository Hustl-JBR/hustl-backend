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
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { file } = req;
    const { fileKey, publicUrl } = await uploadFileToR2(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    res.json({
      fileKey,
      publicUrl,
    });
  } catch (error) {
    console.error('Upload file error:', error);
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


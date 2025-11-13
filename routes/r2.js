const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { generatePresignedUploadUrl } = require('../services/r2');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /r2/presign - Generate presigned URL for upload
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


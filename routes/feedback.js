const express = require('express');
const { body, validationResult } = require('express-validator');
const { sendFeedbackEmail } = require('../services/email');

const router = express.Router();

// POST /feedback - Send feedback email
router.post('/', [
  body('message').trim().notEmpty().withMessage('Feedback message is required'),
  body('name').optional().trim(),
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

    const { name, email, message } = req.body;

    // Send feedback email
    await sendFeedbackEmail(name || 'Anonymous', email || null, message);

    res.json({ 
      success: true, 
      message: 'Feedback sent successfully' 
    });
  } catch (error) {
    console.error('Send feedback error:', error);
    res.status(500).json({ 
      error: 'Failed to send feedback',
      message: error.message 
    });
  }
});

module.exports = router;


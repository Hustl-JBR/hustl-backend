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
    const user = await prisma.user.findUnique({
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
  body('photoUrl').optional().isURL(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, city, zip, photoUrl } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (city) updateData.city = city;
    if (zip) updateData.zip = zip;
    if (photoUrl) updateData.photoUrl = photoUrl;

    const user = await prisma.user.update({
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

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /tracking/start/:jobId - Start tracking location for a job
router.post('/start/:jobId', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    // Verify job exists and hustler is assigned
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== userId) {
      return res.status(403).json({ error: 'You are not assigned to this job' });
    }

    if (job.status !== 'ASSIGNED' && job.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Job must be ASSIGNED or IN_PROGRESS to start tracking' });
    }

    // Update job status to IN_PROGRESS if not already
    if (job.status === 'ASSIGNED') {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    res.json({ 
      message: 'Tracking started',
      job: {
        ...job,
        status: 'IN_PROGRESS',
      },
    });
  } catch (error) {
    console.error('Start tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /tracking/update/:jobId - Update location for a job
router.post('/update/:jobId', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { lat, lng, accuracy, heading, speed } = req.body;
    const userId = req.user.id;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Verify job exists and hustler is assigned
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== userId) {
      return res.status(403).json({ error: 'You are not assigned to this job' });
    }

    // Create location update
    const locationUpdate = await prisma.locationUpdate.create({
      data: {
        jobId,
        hustlerId: userId,
        lat: Number(lat),
        lng: Number(lng),
        accuracy: accuracy ? Number(accuracy) : null,
        heading: heading ? Number(heading) : null,
        speed: speed ? Number(speed) : null,
      },
    });

    // Broadcast to WebSocket clients (customer viewing job)
    // This will be handled by the WebSocket server

    res.json({ 
      locationUpdate,
      message: 'Location updated',
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tracking/:jobId - Get latest location for a job (for customer)
router.get('/:jobId', authenticate, async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only customer or hustler can view tracking
    if (job.customerId !== userId && job.hustlerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get latest location update
    const latestLocation = await prisma.locationUpdate.findFirst({
      where: { jobId },
      orderBy: { timestamp: 'desc' },
    });

    // Get all recent updates (last 10 minutes) for path visualization
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentUpdates = await prisma.locationUpdate.findMany({
      where: {
        jobId,
        timestamp: {
          gte: tenMinutesAgo,
        },
      },
      orderBy: { timestamp: 'asc' },
      take: 100, // Limit to prevent huge responses
    });

    res.json({
      latestLocation,
      path: recentUpdates,
      job: {
        id: job.id,
        title: job.title,
        address: job.address,
        lat: job.lat,
        lng: job.lng,
        status: job.status,
        hustler: job.hustler,
      },
    });
  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /tracking/stop/:jobId - Stop tracking (when arrived)
router.post('/stop/:jobId', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    // Verify job exists and hustler is assigned
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.hustlerId !== userId) {
      return res.status(403).json({ error: 'You are not assigned to this job' });
    }

    res.json({ 
      message: 'Tracking stopped',
    });
  } catch (error) {
    console.error('Stop tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;




const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /notifications - Get user's notifications
router.get('/', async (req, res) => {
  try {
    // Get notifications from audit logs and other sources
    // For now, we'll create notifications on-the-fly from audit logs
    // In the future, create a dedicated notifications table
    
    // Get recent activity that should show as notifications
    const notifications = [];
    
    // 1. Get recent messages (if user has unread messages)
    const threads = await prisma.thread.findMany({
      where: {
        OR: [
          { userAId: req.user.id },
          { userBId: req.user.id },
        ],
      },
      include: {
        messages: {
          where: {
            senderId: { not: req.user.id }, // Only messages NOT sent by current user
            read: false, // Only unread messages
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
              },
            },
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
    
    for (const thread of threads) {
      if (thread.messages.length > 0) {
        const lastMessage = thread.messages[0];
        // Query already filters by senderId != currentUser and read = false
        // Only show if message is recent (last 7 days)
        const daysAgo = (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo <= 7) {
          notifications.push({
            id: `message_${lastMessage.id}`,
            type: 'MESSAGE',
            title: 'New Message',
            message: `${lastMessage.sender.name} sent you a message about "${thread.job?.title || 'a job'}"`,
            icon: '💬',
            link: `/messages?thread=${thread.id}`,
            createdAt: lastMessage.createdAt,
            read: false, // Always false since query filters by read = false
          });
        }
      }
    }
    
    // 2. Get jobs where user's offer was accepted
    const acceptedOffers = await prisma.offer.findMany({
      where: {
        hustlerId: req.user.id,
        status: 'ACCEPTED',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    for (const offer of acceptedOffers) {
      notifications.push({
        id: `offer_accepted_${offer.id}`,
        type: 'OFFER_ACCEPTED',
        title: 'Offer Accepted! 🎉',
        message: `Congratulations! You were picked for "${offer.job.title}"`,
        icon: '✅',
        link: `/jobs/${offer.jobId}`,
        createdAt: offer.updatedAt || offer.createdAt,
        read: false,
      });
    }
    
    // 3. Get offers received (for customers)
    const receivedOffers = await prisma.offer.findMany({
      where: {
        job: {
          customerId: req.user.id,
        },
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        hustler: {
          select: {
            id: true,
            name: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    for (const offer of receivedOffers) {
      notifications.push({
        id: `offer_received_${offer.id}`,
        type: 'OFFER_RECEIVED',
        title: 'New Offer',
        message: `${offer.hustler.name} applied to your job "${offer.job.title}"`,
        icon: '📋',
        link: `/jobs/${offer.jobId}`,
        createdAt: offer.createdAt,
        read: false,
      });
    }
    
    // 4. Get payment updates
    const paymentUpdates = await prisma.payment.findMany({
      where: {
        OR: [
          { customerId: req.user.id },
          { hustlerId: req.user.id },
        ],
        status: 'CAPTURED',
        capturedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { capturedAt: 'desc' },
      take: 10,
    });
    
    for (const payment of paymentUpdates) {
      if (payment.hustlerId === req.user.id) {
        notifications.push({
          id: `payout_${payment.id}`,
          type: 'PAYOUT',
          title: 'Payment Released',
          message: `Payment for "${payment.job.title}" has been released`,
          icon: '💰',
          link: `/jobs/${payment.jobId}`,
          createdAt: payment.capturedAt || payment.updatedAt,
          read: false,
        });
      }
    }
    
    // Sort by date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limit to 50 most recent
    const unreadCount = notifications.filter(n => !n.read).length;
    
    res.json({
      notifications: notifications.slice(0, 50),
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/:id/read - Mark notification as read
router.post('/:id/read', async (req, res) => {
  try {
    // For now, we'll track read status in localStorage on frontend
    // In the future, store in database
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/read-all - Mark all notifications as read
router.post('/read-all', async (req, res) => {
  try {
    // For now, we'll track read status in localStorage on frontend
    // In the future, store in database
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


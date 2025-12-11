const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /threads - List user's threads (only for ASSIGNED jobs)
router.get('/', async (req, res) => {
  try {
    console.log(`[THREADS] Fetching threads for user ${req.user.id}`);
    
    // First, check if user has any threads at all (for debugging)
    const allUserThreads = await prisma.thread.findMany({
      where: {
        OR: [
          { userAId: req.user.id },
          { userBId: req.user.id },
        ],
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
    console.log(`[THREADS] User has ${allUserThreads.length} total threads. Job statuses:`, allUserThreads.map(t => ({ jobId: t.job.id, status: t.job.status })));
    
    const threads = await prisma.thread.findMany({
      where: {
        AND: [
          {
            OR: [
              { userAId: req.user.id },
              { userBId: req.user.id },
            ],
          },
          {
            job: {
              status: {
                in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM', 'PAID'] // Show messages for scheduled, assigned, in-progress, and completed jobs
              },
            },
          },
        ],
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        userA: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
        userB: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
            read: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Calculate unread count for each thread
    const threadsWithUnread = await Promise.all(threads.map(async (thread) => {
      const unreadCount = await prisma.message.count({
        where: {
          threadId: thread.id,
          senderId: { not: req.user.id }, // Only count messages from other user
          read: false,
        },
      });
      
      return {
        ...thread,
        unreadCount,
      };
    }));

    console.log(`[THREADS] Found ${threadsWithUnread.length} threads for user ${req.user.id}`);
    res.json(threadsWithUnread);
  } catch (error) {
    console.error('List threads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /threads/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const thread = await prisma.thread.findUnique({
      where: { id: req.params.id },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Verify user is part of thread
    if (thread.userAId !== req.user.id && thread.userBId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const messages = await prisma.message.findMany({
      where: { threadId: req.params.id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark messages as read when viewing (except messages sent by current user)
    const unreadMessageIds = messages
      .filter(msg => !msg.read && msg.senderId !== req.user.id)
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: unreadMessageIds },
        },
        data: {
          read: true,
          readAt: new Date(),
          readBy: req.user.id,
        },
      });
      
      // Also update thread's lastMessageAt if needed
      await prisma.thread.update({
        where: { id: req.params.id },
        data: { lastMessageAt: new Date() },
      });
    }

    // Return messages with updated read status
    const updatedMessages = messages.map(msg => ({
      ...msg,
      read: unreadMessageIds.includes(msg.id) ? true : msg.read,
      readAt: unreadMessageIds.includes(msg.id) ? new Date() : msg.readAt,
      readBy: unreadMessageIds.includes(msg.id) ? req.user.id : msg.readBy,
    }));

    res.json(updatedMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /threads/:id/messages
router.post('/:id/messages', [
  body('body').trim().notEmpty().isLength({ max: 5000 }),
  body('attachments').optional().isArray(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const thread = await prisma.thread.findUnique({
      where: { id: req.params.id },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Verify user is part of thread
    if (thread.userAId !== req.user.id && thread.userBId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Rate limiting: max 5 messages per 10 seconds
    const recentCount = await prisma.message.count({
      where: {
        threadId: req.params.id,
        senderId: req.user.id,
        createdAt: {
          gte: new Date(Date.now() - 10000), // Last 10 seconds
        },
      },
    });

    if (recentCount >= 5) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // Basic profanity check (simple - can be enhanced)
    const { body, attachments = [] } = req.body;
    
    // Block phone/email patterns before assignment
    const job = await prisma.job.findUnique({
      where: { id: thread.jobId },
      select: { status: true },
    });

    if (job.status === 'OPEN' || job.status === 'REQUESTED') {
      const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
      
      if (phoneRegex.test(body) || emailRegex.test(body)) {
        return res.status(400).json({ 
          error: 'Contact information cannot be shared before job assignment' 
        });
      }
    }

    // Validate attachments
    if (attachments.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 attachments per message' });
    }

    const message = await prisma.message.create({
      data: {
        threadId: req.params.id,
        senderId: req.user.id,
        body,
        attachments,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });

    // Update thread last message time
    await prisma.thread.update({
      where: { id: req.params.id },
      data: { lastMessageAt: new Date() },
    });

    // Send email notification to recipient (the other user in the thread)
    try {
      const recipientId = thread.userAId === req.user.id ? thread.userBId : thread.userAId;
      
      // Get recipient and job info for email
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { email: true, name: true },
      });

      const job = await prisma.job.findUnique({
        where: { id: thread.jobId },
        select: { title: true },
      });

      if (recipient && job) {
        const { sendNewMessageEmail } = require('../services/email');
        const messagePreview = body.length > 100 ? body.substring(0, 100) + '...' : body;
        
        await sendNewMessageEmail(
          recipient.email,
          recipient.name,
          req.user.name,
          job.title,
          messagePreview,
          thread.id
        );
        
        // Create in-app notification (notifications are generated on-the-fly in notifications.js)
        // No need to create a database record since notifications.js reads from messages table
        console.log(`[Message] Created message notification for user ${recipientId} from job ${thread.jobId}`);
      }
    } catch (emailError) {
      // Don't fail message creation if email fails
      console.error('Error sending message notification email:', emailError);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /threads/:id/messages/:messageId/read - Mark a specific message as read
router.post('/:id/messages/:messageId/read', async (req, res) => {
  try {
    const thread = await prisma.thread.findUnique({
      where: { id: req.params.id },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Verify user is part of thread
    if (thread.userAId !== req.user.id && thread.userBId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.threadId !== req.params.id) {
      return res.status(400).json({ error: 'Message does not belong to this thread' });
    }

    // Only mark as read if message was not sent by current user
    if (message.senderId !== req.user.id && !message.read) {
      await prisma.message.update({
        where: { id: req.params.messageId },
        data: {
          read: true,
          readAt: new Date(),
          readBy: req.user.id,
        },
      });
    }

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /threads/:id/mark-all-read - Mark all messages in thread as read
router.post('/:id/mark-all-read', async (req, res) => {
  try {
    const thread = await prisma.thread.findUnique({
      where: { id: req.params.id },
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Verify user is part of thread
    if (thread.userAId !== req.user.id && thread.userBId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Mark all unread messages as read (except messages sent by current user)
    await prisma.message.updateMany({
      where: {
        threadId: req.params.id,
        senderId: { not: req.user.id },
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
        readBy: req.user.id,
      },
    });

    res.json({ success: true, message: 'All messages marked as read' });
  } catch (error) {
    console.error('Mark all messages read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


const express = require('express');
const prisma = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendSupportEmail } = require('../services/email');

const router = express.Router();

// GET /support/faq - Get FAQ categories and questions
router.get('/faq', async (req, res) => {
  try {
    const faqData = {
      categories: [
        {
          id: 'getting-started',
          title: 'Getting Started',
          icon: '🚀',
          questions: [
            {
              id: 'how-do-i-sign-up',
              question: 'How do I create an account?',
              answer: 'Click "Sign in / Create account" in the header, then select "Create account". Enter your name, email, and password. Choose whether you want to post jobs (Customer) or do jobs (Hustler). You can switch between roles anytime!',
            },
            {
              id: 'what-is-hustl',
              question: 'What is Hustl?',
              answer: 'Hustl connects people in Tennessee who need help with local hustlers who can do the work. Post jobs like moving, yard work, cleaning, or find work and earn money doing these jobs.',
            },
            {
              id: 'how-much-does-it-cost',
              question: 'How much does it cost?',
              answer: 'Hustl charges a 15% platform fee on completed jobs. For customers, this is included in the total price. For hustlers, this fee is deducted from your earnings. There are no signup fees or monthly subscriptions.',
            },
            {
              id: 'where-is-hustl-available',
              question: 'Where is Hustl available?',
              answer: 'Currently, Hustl is available throughout Tennessee. All jobs must be posted with a Tennessee zip code (37000-38999).',
            },
          ],
        },
        {
          id: 'for-customers',
          title: 'For Customers',
          icon: '👤',
          questions: [
            {
              id: 'how-to-post-job',
              question: 'How do I post a job?',
              answer: 'Click "Post a job" in the navigation, fill out the job details (title, description, category, location, payment amount, and date/time), then click "Post Job". Hustlers will see your job and can apply.',
            },
            {
              id: 'how-to-pay',
              question: 'How do I pay for a job?',
              answer: 'Payment is handled securely through Stripe. When you accept a hustler, you\'ll be prompted to complete payment. The payment is held securely until the job is completed and you confirm it\'s done.',
            },
            {
              id: 'what-if-job-not-done',
              question: 'What if the job isn\'t done correctly?',
              answer: 'If you\'re not satisfied, don\'t enter the verification code. Contact the hustler through the in-app messaging to discuss the issue. If you can\'t resolve it, contact support at team.hustlapp@outlook.com.',
            },
            {
              id: 'can-i-cancel',
              question: 'Can I cancel a job?',
              answer: 'Yes, you can cancel a job before it\'s started. If payment has been made, you\'ll receive a full refund. Once the job is in progress, cancellation policies apply.',
            },
            {
              id: 'how-to-rate',
              question: 'How do I rate a hustler?',
              answer: 'After a job is completed and payment is released, you\'ll be prompted to leave a review. You can rate 1-5 stars and write a review. This helps other customers find great hustlers!',
            },
          ],
        },
        {
          id: 'for-hustlers',
          title: 'For Hustlers',
          icon: '💪',
          questions: [
            {
              id: 'how-to-apply',
              question: 'How do I apply for jobs?',
              answer: 'Browse available jobs in the "Jobs" tab. Click on any job to see details, then click "Apply as a Hustler". Add a message about why you\'re a good fit and optionally suggest a price.',
            },
            {
              id: 'how-to-get-paid',
              question: 'How do I get paid?',
              answer: 'You need to set up a Stripe Connect account to receive payments. After completing a job and the customer confirms, payment is automatically transferred to your Stripe account. You can then transfer it to your bank account.',
            },
            {
              id: 'when-do-i-get-paid',
              question: 'When do I get paid?',
              answer: 'Payment is released immediately after the customer enters the verification code confirming the job is complete. The money is transferred to your Stripe account, and you can withdraw it to your bank account.',
            },
            {
              id: 'what-is-platform-fee',
              question: 'What is the platform fee?',
              answer: 'Hustl charges a 15% platform fee on all completed jobs. This covers payment processing, platform maintenance, and customer support. For example, on a $100 job, you\'ll receive $85.',
            },
            {
              id: 'how-to-complete-job',
              question: 'How do I mark a job as complete?',
              answer: 'When you finish the job, go to the job details and click "Mark Job as Complete". A 6-digit verification code will be generated. Share this code with the customer, who will enter it to confirm and release payment.',
            },
            {
              id: 'id-verification',
              question: 'Do I need ID verification?',
              answer: 'ID verification is recommended for hustlers to build trust with customers. Verified hustlers get more job offers. You can verify your ID in your profile settings.',
            },
          ],
        },
        {
          id: 'safety',
          title: 'Safety & Trust',
          icon: '🛡️',
          questions: [
            {
              id: 'is-hustl-safe',
              question: 'Is Hustl safe?',
              answer: 'Yes! We verify user identities, use secure payment processing, and have a review system. Always communicate through the app, meet in public places when possible, and trust your instincts.',
            },
            {
              id: 'what-if-something-wrong',
              question: 'What if something goes wrong?',
              answer: 'Contact support immediately at team.hustlapp@outlook.com. For safety issues, report them right away. We take all reports seriously and will investigate promptly.',
            },
            {
              id: 'background-checks',
              question: 'Do you do background checks?',
              answer: 'We verify user identities and have a review system. While we don\'t currently perform full background checks, we monitor user behavior and remove accounts that violate our terms.',
            },
          ],
        },
        {
          id: 'payments',
          title: 'Payments & Pricing',
          icon: '💳',
          questions: [
            {
              id: 'payment-methods',
              question: 'What payment methods are accepted?',
              answer: 'We accept all major credit cards, debit cards, and digital wallets through Stripe. Payment is secure and encrypted.',
            },
            {
              id: 'refund-policy',
              question: 'What is your refund policy?',
              answer: 'If a job is cancelled before it starts, you\'ll receive a full refund. If there\'s an issue with completed work, contact support and we\'ll work with both parties to resolve it fairly.',
            },
            {
              id: 'pricing-suggestions',
              question: 'How do I know what to charge?',
              answer: 'When posting a job, you\'ll see suggested pricing based on similar jobs in your area. You can also see what other customers are paying for similar work.',
            },
          ],
        },
        {
          id: 'technical',
          title: 'Technical Support',
          icon: '🔧',
          questions: [
            {
              id: 'app-not-working',
              question: 'The app isn\'t working. What should I do?',
              answer: 'Try refreshing the page, clearing your browser cache, or using a different browser. If the problem persists, contact support at team.hustlapp@outlook.com with details about the issue.',
            },
            {
              id: 'cant-login',
              question: 'I can\'t log in. Help!',
              answer: 'Make sure you\'re using the correct email and password. If you forgot your password, use the password reset feature. Still having issues? Contact support.',
            },
            {
              id: 'notifications-not-working',
              question: 'I\'m not receiving notifications.',
              answer: 'Check your browser notification settings and make sure they\'re enabled for this site. Also check that you\'re logged in and have notifications enabled in your profile settings.',
            },
          ],
        },
      ],
    };

    res.json(faqData);
  } catch (error) {
    console.error('Get FAQ error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /support/contact - Send support message
router.post('/contact', authenticate, async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const userId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Send support email
    try {
      await sendSupportEmail({
        from: user.email,
        fromName: user.name,
        subject: `[${category || 'General'}] ${subject}`,
        message,
        userId,
      });
    } catch (emailError) {
      console.error('Error sending support email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      message: 'Support request sent successfully. We\'ll get back to you soon!',
    });
  } catch (error) {
    console.error('Contact support error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;



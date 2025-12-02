const express = require('express');
const prisma = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { capturePaymentIntent } = require('../services/stripe');
const { sendPaymentReceiptEmail } = require('../services/email');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /payments/intent - Create payment intent (pre-auth)
router.post('/intent', requireRole('CUSTOMER'), async (req, res) => {
  try {
    // This is typically called during offer acceptance
    // See offers.js for implementation
    res.status(501).json({ error: 'Use /offers/:id/accept endpoint' });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs/:id/confirm - Capture payment (Customer confirms completion)
router.post('/jobs/:jobId/confirm', requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: {
          select: { id: true, email: true, name: true, username: true },
        },
        hustler: {
          select: { id: true, email: true, name: true, username: true, stripeAccountId: true },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'COMPLETED_BY_HUSTLER' && job.status !== 'AWAITING_CUSTOMER_CONFIRM') {
      return res.status(400).json({ error: 'Job is not ready for confirmation' });
    }

    if (!job.payment) {
      return res.status(400).json({ error: 'Payment not found' });
    }

    if (job.payment.status !== 'PREAUTHORIZED') {
      return res.status(400).json({ error: 'Payment is not pre-authorized' });
    }

    // Capture payment - Skip in test mode
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let captured;
    if (skipStripeCheck) {
      console.log('[TEST MODE] Skipping Stripe payment capture');
      captured = { id: job.payment.providerId, status: 'succeeded' };
    } else {
      captured = await capturePaymentIntent(job.payment.providerId);
    }

    // Calculate hustler fee (16% platform fee)
    const hustlerFee = Number(job.payment.amount) * 0.16;

    // Update payment
    const payment = await prisma.payment.update({
      where: { id: job.payment.id },
      data: {
        status: 'CAPTURED',
        feeHustler: hustlerFee,
      },
    });

    // Update job status
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PAID' },
    });

    // Generate receipt URL (store in R2 or generate PDF)
    const receiptUrl = `${process.env.APP_BASE_URL}/payments/receipts/${payment.id}`;

    await prisma.payment.update({
      where: { id: payment.id },
      data: { receiptUrl },
    });

    // Send receipt email
    await sendPaymentReceiptEmail(
      job.customer.email,
      job.customer.name,
      payment,
      receiptUrl
    );

    // Check referral completion (non-blocking)
    if (job.hustlerId) {
      try {
        await fetch(`${process.env.APP_BASE_URL || 'http://localhost:8080'}/referrals/check-completion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.headers.authorization?.split(' ')[1] || ''}`,
          },
          body: JSON.stringify({ referredUserId: job.hustlerId }),
        });
      } catch (referralError) {
        console.error('Error checking referral completion (non-fatal):', referralError);
      }
    }

    res.json({
      job: updatedJob,
      payment: {
        ...payment,
        receiptUrl,
      },
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments/jobs/:jobId - Get payment for a job
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is involved in the job
    if (job.customerId !== req.user.id && job.hustlerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!job.payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(job.payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payments/checkout/offer/:offerId - Create Stripe checkout for offer acceptance
router.post('/checkout/offer/:offerId', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { offerId } = req.params;
    console.log(`[CHECKOUT] User ${req.user.id} (roles: ${req.user.roles?.join(', ')}) attempting checkout for offer ${offerId}`);
    
    // Get offer with job details
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: {
          include: {
            customer: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        hustler: {
          select: {
            id: true,
            name: true,
            email: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (!offer.job) {
      console.error(`[500] Offer ${offerId} has no associated job`);
      return res.status(500).json({ error: 'Offer has no associated job' });
    }

    if (offer.job.customerId !== req.user.id) {
      console.error(`[403] User ${req.user.id} tried to checkout offer ${offerId} for job owned by ${offer.job.customerId}`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only checkout offers for your own jobs'
      });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ 
        error: 'Offer is not pending',
        message: `Offer status is ${offer.status}, must be PENDING to checkout`
      });
    }

    if (!offer.hustler) {
      console.error(`[500] Offer ${offerId} has no associated hustler`);
      return res.status(500).json({ error: 'Offer has no associated hustler' });
    }

    // REQUIRE STRIPE ACCOUNT - Hustler must have Stripe connected
    // Skip in test mode (when SKIP_STRIPE_CHECK=true)
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    if (!offer.hustler.stripeAccountId && !skipStripeCheck) {
      // Send email to hustler about needing Stripe
      try {
        const { sendStripeRequiredEmail } = require('../services/email');
        await sendStripeRequiredEmail(
          offer.hustler.email,
          offer.hustler.name,
          offer.job.title
        );
      } catch (emailError) {
        console.error('Error sending Stripe required email:', emailError);
      }
      
      return res.status(400).json({ 
        error: 'Hustler must connect Stripe account',
        requiresStripe: true,
        message: 'This hustler needs to connect their Stripe account before you can pay them. They have been notified via email.'
      });
    }
    
    // In test mode, use a fake Stripe account ID if needed
    if (skipStripeCheck && !offer.hustler.stripeAccountId) {
      console.log('[TEST MODE] Skipping Stripe account check for hustler:', offer.hustler.id);
    }

    // Calculate payment amounts (3% customer fee)
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    const origin = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 
                   req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const base = origin.replace(/\/+$/, '');

    // Create Stripe checkout session - Skip in test mode
    let session;
    if (skipStripeCheck) {
      // In test mode, accept the offer first, then return fake success URL
      console.log('[TEST MODE] Skipping Stripe checkout - accepting offer directly');
      
      // Accept the offer (same logic as /offers/:id/accept)
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' },
      });

      // Decline other offers
      await prisma.offer.updateMany({
        where: {
          jobId: offer.job.id,
          id: { not: offerId },
          status: 'PENDING',
        },
        data: { status: 'DECLINED' },
      });

      // Generate verification codes (Uber-style safety)
      const generateCode = () => String(Math.floor(1000 + Math.random() * 9000));
      
      // Update job with hustler and verification codes
      const updatedJob = await prisma.job.update({
        where: { id: offer.job.id },
        data: {
          status: 'ASSIGNED',
          hustlerId: offer.hustlerId,
          arrivalCode: generateCode(),
          completionCode: generateCode(),
        },
      });
      
      console.log(`[TEST MODE] Job ${updatedJob.id} updated: status=ASSIGNED, hustlerId=${updatedJob.hustlerId}, codes generated`);

      // Create fake payment record
      const fakePaymentIntent = {
        id: `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        client_secret: `pi_test_${Date.now()}_secret`,
        status: 'requires_capture',
        amount: Math.round(total * 100),
      };

      await prisma.payment.create({
        data: {
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount,
          tip: tipAmount,
          feeCustomer: customerFee,
          feeHustler: 0,
          status: 'PREAUTHORIZED',
          providerId: fakePaymentIntent.id,
          provider: 'STRIPE',
        },
      });

      // Create thread for messaging
      await prisma.thread.upsert({
        where: {
          jobId: offer.job.id,
        },
        update: {},
        create: {
          jobId: offer.job.id,
          userAId: req.user.id,
          userBId: offer.hustlerId,
        },
      });

      console.log('[TEST MODE] Offer accepted and payment pre-authorized (fake)');
      const fakeUrl = `${base}/?payment=success&offerId=${offerId}&jobId=${offer.job.id}&test_mode=true`;
      return res.json({ url: fakeUrl });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Job: ${offer.job.title}`,
                description: `Payment for ${offer.hustler.name || 'Hustler'}`,
              },
              unit_amount: Math.round(total * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        customer_email: req.user.email,
        metadata: {
          offerId: offer.id,
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        success_url: `${base}/?payment=success&offerId=${offerId}&jobId=${offer.job.id}`,
        cancel_url: `${base}/?payment=cancelled`,
      });
    }

    res.json({ url: session.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    console.error('Error stack:', error.stack);
    const errorMessage = error.message || 'Internal server error';
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /payments/config - Get Stripe publishable key for Payment Element
router.get('/config', authenticate, async (req, res) => {
  try {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    
    res.json({ publishableKey });
  } catch (error) {
    console.error('Get Stripe config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /payments/create-intent/offer/:offerId - Create payment intent for offer acceptance
router.post('/create-intent/offer/:offerId', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { offerId } = req.params;
    
    // Get offer with job details
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        job: {
          include: {
            customer: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        hustler: {
          select: {
            id: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (offer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Offer is not pending' });
    }

    // Calculate payment amounts
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    // Check active jobs limit
    const activeJobsCount = await prisma.job.count({
      where: {
        customerId: req.user.id,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED_BY_HUSTLER', 'AWAITING_CUSTOMER_CONFIRM'],
        },
      },
    });

    const maxActiveJobs = 2; // Can be made configurable
    if (activeJobsCount >= maxActiveJobs) {
      return res.status(400).json({
        error: 'Active jobs limit reached',
        message: `You can only have ${maxActiveJobs} active jobs at a time. Please complete or cancel existing jobs.`,
        currentActiveJobs: activeJobsCount,
        maxActiveJobs,
      });
    }

    // Create payment intent
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let paymentIntent;

    if (skipStripeCheck) {
      // Test mode - create fake payment intent
      paymentIntent = {
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
        status: 'requires_payment_method',
      };
    } else {
      // Real Stripe payment intent
      const transferData = offer.hustler.stripeAccountId
        ? {
            destination: offer.hustler.stripeAccountId,
            amount: Math.round(jobAmount * 100), // Amount in cents for hustler
          }
        : undefined;

      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100), // Total in cents
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          offerId: offer.id,
          jobId: offer.job.id,
          customerId: req.user.id,
          hustlerId: offer.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        ...(transferData && { transfer_data: transferData }),
        capture_method: 'manual', // Pre-authorize, capture later
      });
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      message: error.message || 'Failed to create payment intent'
    });
  }
});

// POST /payments/create-intent/job/:jobId - Create payment intent for job completion
router.post('/create-intent/job/:jobId', authenticate, requireRole('CUSTOMER'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payment: true,
        customer: { select: { id: true, email: true, name: true } },
        hustler: {
          select: {
            id: true,
            stripeAccountId: true,
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status !== 'COMPLETED_BY_HUSTLER' && job.status !== 'AWAITING_CUSTOMER_CONFIRM') {
      return res.status(400).json({ error: 'Job is not ready for payment' });
    }

    // If payment already exists and is pre-authorized, return existing client secret
    if (job.payment && job.payment.status === 'PREAUTHORIZED' && job.payment.providerId) {
      const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
      
      if (skipStripeCheck) {
        return res.json({ 
          clientSecret: `pi_test_${job.payment.providerId}_secret` 
        });
      }

      // Retrieve existing payment intent
      const existingIntent = await stripe.paymentIntents.retrieve(job.payment.providerId);
      return res.json({ clientSecret: existingIntent.client_secret });
    }

    // Calculate payment amounts
    const jobAmount = Number(job.amount);
    const tipAmount = Number(job.payment?.tip || 0);
    const customerFee = Number(job.payment?.feeCustomer || Math.min(Math.max(jobAmount * 0.03, 1), 10));
    const total = jobAmount + tipAmount + customerFee;

    // Create payment intent
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    let paymentIntent;

    if (skipStripeCheck) {
      // Test mode
      paymentIntent = {
        id: `pi_test_${Date.now()}`,
        client_secret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
        status: 'requires_payment_method',
      };
    } else {
      // Real Stripe payment intent
      const transferData = job.hustler?.stripeAccountId
        ? {
            destination: job.hustler.stripeAccountId,
            amount: Math.round(jobAmount * 100),
          }
        : undefined;

      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          jobId: job.id,
          customerId: req.user.id,
          hustlerId: job.hustlerId,
          amount: jobAmount.toString(),
          tip: tipAmount.toString(),
          customerFee: customerFee.toString(),
        },
        ...(transferData && { transfer_data: transferData }),
        capture_method: 'automatic', // Auto-capture for completion payments
      });
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      message: error.message || 'Failed to create payment intent'
    });
  }
});

// GET /payments/earnings - Get hustler earnings dashboard data
router.get('/earnings', authenticate, requireRole('HUSTLER'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query; // 'day', 'week', 'month', 'year', 'all'

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Get all payments for this hustler
    const payments = await prisma.payment.findMany({
      where: {
        hustlerId: userId,
        status: 'CAPTURED',
        capturedAt: {
          gte: period !== 'all' ? startDate : undefined,
        },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            category: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        capturedAt: 'desc',
      },
    });

    // Get payouts
    const payouts = await prisma.payout.findMany({
      where: {
        hustlerId: userId,
        status: 'COMPLETED',
        completedAt: {
          gte: period !== 'all' ? startDate : undefined,
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
      orderBy: {
        completedAt: 'desc',
      },
    });

    // Calculate totals
    const totalEarnings = payments.reduce((sum, p) => {
      return sum + Number(p.amount) + Number(p.tip || 0);
    }, 0);

    const totalPayouts = payouts.reduce((sum, p) => {
      return sum + Number(p.netAmount);
    }, 0);

    const totalFees = payments.reduce((sum, p) => {
      return sum + Number(p.platformFee || 0);
    }, 0);

    const totalTips = payments.reduce((sum, p) => {
      return sum + Number(p.tip || 0);
    }, 0);

    // Group by time period for chart data
    const chartData = [];
    const now = new Date();
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : payments.length;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      if (period === 'day') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      if (period === 'day') {
        nextDate.setHours(nextDate.getHours() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      const dayPayments = payments.filter(p => {
        const captureDate = p.capturedAt ? new Date(p.capturedAt) : null;
        if (!captureDate) return false;
        return captureDate >= date && captureDate < nextDate;
      });

      const dayEarnings = dayPayments.reduce((sum, p) => {
        return sum + Number(p.amount) + Number(p.tip || 0);
      }, 0);

      chartData.push({
        date: date.toISOString(),
        earnings: dayEarnings,
        jobs: dayPayments.length,
      });
    }

    // Calculate averages
    const avgPerJob = payments.length > 0 ? totalEarnings / payments.length : 0;
    const jobsCompleted = payments.length;

    res.json({
      period,
      totals: {
        earnings: totalEarnings,
        payouts: totalPayouts,
        fees: totalFees,
        tips: totalTips,
        jobsCompleted,
        avgPerJob,
      },
      chartData,
      recentPayments: payments.slice(0, 10).map(p => ({
        id: p.id,
        jobId: p.jobId,
        jobTitle: p.job.title,
        category: p.job.category,
        amount: Number(p.amount),
        tip: Number(p.tip || 0),
        fee: Number(p.platformFee || 0),
        total: Number(p.amount) + Number(p.tip || 0),
        date: p.capturedAt,
      })),
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /payments/receipts - List user's receipts
router.get('/receipts', async (req, res) => {
  try {
    const receipts = await prisma.payment.findMany({
      where: {
        OR: [
          { customerId: req.user.id },
          { hustlerId: req.user.id },
        ],
        status: 'CAPTURED',
        receiptUrl: { not: null },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        hustler: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(receipts);
  } catch (error) {
    console.error('List receipts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


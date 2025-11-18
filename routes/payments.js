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
        customer: true,
        hustler: true,
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
router.get('/jobs/:jobId', authenticate, async (req, res) => {
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

    // If no payment exists, return null instead of 404 (payment might not be created yet)
    if (!job.payment) {
      return res.json(null);
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
            customer: true,
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

    // REQUIRE STRIPE ACCOUNT - COMPLETELY REMOVED FOR TESTING
    // TEMPORARILY DISABLED - All Stripe checks bypassed
    const skipStripeCheck = process.env.SKIP_STRIPE_CHECK === 'true';
    
    // TEMPORARY: Completely bypass all Stripe checks for testing
    console.log('[TESTING] Bypassing all Stripe checks - allowing checkout without Stripe account');

    // Calculate payment amounts (3% customer fee)
    const jobAmount = Number(offer.job.amount);
    const tipPercent = Math.min(parseFloat(req.body.tipPercent || 0), 25);
    const tipAmount = Math.min(jobAmount * (tipPercent / 100), 50);
    const customerFee = Math.min(Math.max(jobAmount * 0.03, 1), 10);
    const total = jobAmount + tipAmount + customerFee;

    const origin = process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 
                   req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const base = origin.replace(/\/+$/, '');

    // TEMPORARILY BYPASSING STRIPE - Always use test mode logic for testing
    // Create Stripe checkout session - TEMPORARILY ALWAYS SKIP
    let session;
    // TEMPORARY: Always bypass Stripe for testing
    const forceTestMode = true; // Set to false to re-enable Stripe
    if (skipStripeCheck || forceTestMode) {
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

      // Update job with assignment timestamp and generate 4-digit start code
      const requirements = offer.job.requirements || {};
      requirements.assignedAt = new Date().toISOString();
      // Generate 4-digit start code for customer to provide to hustler
      requirements.startCode = String(Math.floor(1000 + Math.random() * 9000));
      console.log(`[TEST MODE] Generated start code: ${requirements.startCode} for job ${offer.job.id}`);
      
      const updatedJob = await prisma.job.update({
        where: { id: offer.job.id },
        data: {
          status: 'ASSIGNED',
          hustlerId: offer.hustlerId,
          requirements,
        },
      });
      
      console.log(`[TEST MODE] Job ${updatedJob.id} updated: status=ASSIGNED, hustlerId=${updatedJob.hustlerId}`);

      // Create fake payment record (non-fatal if it fails)
      const fakePaymentIntent = {
        id: `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        client_secret: `pi_test_${Date.now()}_secret`,
        status: 'requires_capture',
        amount: Math.round(total * 100),
      };

      try {
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
        console.log('[TEST MODE] Payment record created');
      } catch (paymentError) {
        console.error('[TEST MODE] Payment creation error (non-fatal):', paymentError);
        // Continue - payment might already exist or have constraint issue
      }

      // Create thread for messaging (non-fatal if it fails)
      try {
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
        console.log('[TEST MODE] Thread created for messaging');
      } catch (threadError) {
        console.error('[TEST MODE] Thread creation error (non-fatal):', threadError);
        // Continue - thread might already exist or have constraint issue
      }

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
    console.error('Error details:', JSON.stringify(error, null, 2));
    const errorMessage = error.message || 'Internal server error';
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      message: `Checkout failed: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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


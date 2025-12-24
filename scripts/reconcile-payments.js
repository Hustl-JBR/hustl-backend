/**
 * Payment Reconciliation Script
 * 
 * Detects drift between Stripe and Database payment statuses
 * READ-ONLY - Reports discrepancies, does not modify data
 * 
 * Run: node scripts/reconcile-payments.js
 */

const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const prisma = new PrismaClient();

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ ERROR: STRIPE_SECRET_KEY not set');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim().replace(/^["']|["']$/g, ''));

// Map Stripe payment intent status to our database status
function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'PREAUTHORIZED'; // Waiting for customer action
    case 'processing':
      return 'PREAUTHORIZED'; // Being processed
    case 'requires_capture':
      return 'PREAUTHORIZED'; // Authorized, waiting to capture
    case 'succeeded':
      return 'CAPTURED'; // Captured successfully
    case 'canceled':
      return 'VOIDED'; // Voided/canceled
    default:
      return null; // Unknown status
  }
}

async function reconcilePayments() {
  console.log('🔍 Payment Reconciliation Report');
  console.log('================================\n');
  console.log(`Mode: ${process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'LIVE'}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Fetch payments with Stripe payment intent IDs
  const payments = await prisma.payment.findMany({
    where: {
      providerId: { not: null },
      status: { in: ['PREAUTHORIZED', 'CAPTURED', 'VOIDED'] }
    },
    include: {
      job: {
        select: { id: true, title: true, status: true }
      },
      customer: {
        select: { id: true, name: true, email: true }
      },
      hustler: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100 // Limit to recent 100 payments to avoid timeout
  });

  console.log(`📊 Checking ${payments.length} payments...\n`);

  const discrepancies = [];
  let checked = 0;
  let errors = 0;

  for (const payment of payments) {
    try {
      // Fetch payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(payment.providerId);
      const stripeStatus = mapStripeStatus(paymentIntent.status);

      checked++;

      // Compare statuses
      if (payment.status !== stripeStatus) {
        discrepancies.push({
          paymentId: payment.id,
          jobId: payment.jobId,
          jobTitle: payment.job?.title || 'N/A',
          jobStatus: payment.job?.status || 'N/A',
          customer: payment.customer?.name || 'Unknown',
          hustler: payment.hustler?.name || 'Unknown',
          dbStatus: payment.status,
          stripeStatus: stripeStatus,
          stripeRawStatus: paymentIntent.status,
          providerId: payment.providerId,
          amount: `$${Number(payment.amount || 0).toFixed(2)}`,
          createdAt: payment.createdAt
        });
      }

      // Progress indicator every 10 payments
      if (checked % 10 === 0) {
        process.stdout.write(`Checked ${checked}/${payments.length}...\r`);
      }

    } catch (error) {
      errors++;
      console.error(`\n⚠️  Error checking payment ${payment.id}:`, error.message);
      
      // If payment intent not found in Stripe, that's a discrepancy too
      if (error.code === 'resource_missing') {
        discrepancies.push({
          paymentId: payment.id,
          jobId: payment.jobId,
          jobTitle: payment.job?.title || 'N/A',
          jobStatus: payment.job?.status || 'N/A',
          customer: payment.customer?.name || 'Unknown',
          hustler: payment.hustler?.name || 'Unknown',
          dbStatus: payment.status,
          stripeStatus: 'NOT_FOUND',
          stripeRawStatus: 'N/A',
          providerId: payment.providerId,
          amount: `$${Number(payment.amount || 0).toFixed(2)}`,
          createdAt: payment.createdAt,
          error: 'Payment intent not found in Stripe'
        });
      }
    }
  }

  console.log(`\nChecked ${checked} payments\n`);

  // Report results
  if (discrepancies.length === 0) {
    console.log('✅ SUCCESS: All payment statuses are synchronized!');
    console.log('No discrepancies found between Stripe and Database.\n');
  } else {
    console.log(`⚠️  DISCREPANCIES FOUND: ${discrepancies.length}\n`);
    console.log('┌─────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Payment Status Discrepancies (Stripe ↔ Database)                               │');
    console.log('└─────────────────────────────────────────────────────────────────────────────────┘\n');

    discrepancies.forEach((disc, index) => {
      console.log(`${index + 1}. Payment ID: ${disc.paymentId}`);
      console.log(`   Job: ${disc.jobTitle} (${disc.jobStatus})`);
      console.log(`   Customer: ${disc.customer}`);
      console.log(`   Hustler: ${disc.hustler}`);
      console.log(`   Amount: ${disc.amount}`);
      console.log(`   Database Status: ${disc.dbStatus}`);
      console.log(`   Stripe Status: ${disc.stripeStatus} (raw: ${disc.stripeRawStatus})`);
      console.log(`   Stripe Payment Intent: ${disc.providerId}`);
      if (disc.error) {
        console.log(`   Error: ${disc.error}`);
      }
      console.log(`   Created: ${disc.createdAt}`);
      console.log('');
    });

    console.log('─────────────────────────────────────────────────────────────────────────────────');
    console.log(`Total Discrepancies: ${discrepancies.length}`);
    console.log('─────────────────────────────────────────────────────────────────────────────────\n');

    // Summary by discrepancy type
    const typeCounts = {};
    discrepancies.forEach(disc => {
      const key = `${disc.dbStatus} → ${disc.stripeStatus}`;
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });

    console.log('Discrepancy Types:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log('');
  }

  if (errors > 0) {
    console.log(`⚠️  Encountered ${errors} errors during reconciliation\n`);
  }

  console.log('ℹ️  This is a READ-ONLY report. No data has been modified.');
  console.log('ℹ️  To fix discrepancies, use admin tools or manual intervention.\n');

  await prisma.$disconnect();
}

// Run reconciliation
reconcilePayments()
  .then(() => {
    console.log('✅ Reconciliation complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Reconciliation failed:', error);
    process.exit(1);
  });

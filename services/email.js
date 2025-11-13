const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Hustl <noreply@hustl.app>'; // Update with your verified domain

async function sendSignupEmail(email, name) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to Hustl!',
      html: `
        <h1>Welcome to Hustl, ${name}!</h1>
        <p>Thanks for joining Hustl. You're all set to start posting jobs or finding work.</p>
        <p>Get started by:</p>
        <ul>
          <li>Completing your profile</li>
          <li>Posting your first job (if you're a customer)</li>
          <li>Browsing available jobs (if you're a hustler)</li>
        </ul>
        <p>Happy hustling!</p>
      `,
    });
  } catch (error) {
    console.error('Send signup email error:', error);
    // Don't throw - email failures shouldn't break signup
  }
}

async function sendPasswordResetEmail(email, name, resetUrl) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your Hustl password',
      html: `
        <h1>Password Reset Request</h1>
        <p>Hi ${name},</p>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  } catch (error) {
    console.error('Send password reset email error:', error);
    throw error; // This is important, so we should know if it fails
  }
}

async function sendOfferReceivedEmail(email, name, jobTitle, offerNote) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `New offer on "${jobTitle}"`,
      html: `
        <h1>New Offer Received</h1>
        <p>Hi ${name},</p>
        <p>You received a new offer on your job: <strong>${jobTitle}</strong></p>
        ${offerNote ? `<p>Message: ${offerNote}</p>` : ''}
        <p><a href="${process.env.APP_BASE_URL}/jobs/${jobTitle}">View Offer</a></p>
      `,
    });
  } catch (error) {
    console.error('Send offer received email error:', error);
  }
}

async function sendJobAssignedEmail(email, name, jobTitle) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You've been assigned to "${jobTitle}"`,
      html: `
        <h1>Job Assigned!</h1>
        <p>Hi ${name},</p>
        <p>Great news! You've been assigned to the job: <strong>${jobTitle}</strong></p>
        <p>You can now message the customer and view the job details.</p>
        <p><a href="${process.env.APP_BASE_URL}/jobs/${jobTitle}">View Job</a></p>
      `,
    });
  } catch (error) {
    console.error('Send job assigned email error:', error);
  }
}

async function sendJobCompleteEmail(email, name, jobTitle) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `"${jobTitle}" marked as complete`,
      html: `
        <h1>Job Complete</h1>
        <p>Hi ${name},</p>
        <p>The hustler has marked the job <strong>${jobTitle}</strong> as complete.</p>
        <p>Please confirm completion and complete payment.</p>
        <p><a href="${process.env.APP_BASE_URL}/jobs/${jobTitle}">Confirm & Pay</a></p>
      `,
    });
  } catch (error) {
    console.error('Send job complete email error:', error);
  }
}

async function sendPaymentReceiptEmail(email, name, payment, receiptUrl) {
  try {
    const amount = Number(payment.amount);
    const tip = Number(payment.tip);
    const serviceFee = Number(payment.feeCustomer);
    const total = Number(payment.total);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Payment Receipt - Hustl',
      html: `
        <h1>Payment Receipt</h1>
        <p>Hi ${name},</p>
        <p>Thank you for your payment. Here's your receipt:</p>
        <table>
          <tr><td>Job Amount:</td><td>$${amount.toFixed(2)}</td></tr>
          <tr><td>Tip:</td><td>$${tip.toFixed(2)}</td></tr>
          <tr><td>Service Fee:</td><td>$${serviceFee.toFixed(2)}</td></tr>
          <tr><td><strong>Total:</strong></td><td><strong>$${total.toFixed(2)}</strong></td></tr>
        </table>
        <p><a href="${receiptUrl}">View Receipt</a></p>
      `,
    });
  } catch (error) {
    console.error('Send payment receipt email error:', error);
  }
}

async function sendPayoutSentEmail(email, name, amount) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Payout Sent - Hustl',
      html: `
        <h1>Payout Sent</h1>
        <p>Hi ${name},</p>
        <p>Your payout of $${amount.toFixed(2)} has been sent to your account.</p>
        <p>It may take 1-3 business days to appear in your account.</p>
      `,
    });
  } catch (error) {
    console.error('Send payout sent email error:', error);
  }
}

module.exports = {
  sendSignupEmail,
  sendPasswordResetEmail,
  sendOfferReceivedEmail,
  sendJobAssignedEmail,
  sendJobCompleteEmail,
  sendPaymentReceiptEmail,
  sendPayoutSentEmail,
};

const { Resend } = require('resend');

// Initialize Resend only if API key is provided (email is optional)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Helper to check if email is configured
function isEmailConfigured() {
  if (!resend) {
    console.warn('Email not configured: RESEND_API_KEY is not set. Email functions will be disabled.');
    return false;
  }
  return true;
}

// TODO: Update this email address when you get your domain
// You'll need to verify the domain in Resend and update this to match
// Example: 'Hustl <noreply@yourdomain.com>'
const FROM_EMAIL = process.env.FROM_EMAIL || 'Hustl <noreply@hustl.app>';

async function sendSignupEmail(email, name) {
  if (!isEmailConfigured()) return;
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
  if (!isEmailConfigured()) return;
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
  if (!isEmailConfigured()) return;
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
  if (!isEmailConfigured()) return;
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

async function sendJobCompleteEmail(email, name, jobTitle, verificationCode) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `"${jobTitle}" marked as complete`,
      html: `
        <h1>Job Complete</h1>
        <p>Hi ${name},</p>
        <p>The hustler has marked the job <strong>${jobTitle}</strong> as complete.</p>
        ${verificationCode ? `
        <p><strong>Verification Code: ${verificationCode}</strong></p>
        <p>Please enter this code when confirming completion. This ensures you're both on the same page.</p>
        ` : ''}
        <p>Please confirm completion and complete payment.</p>
        <p><a href="${process.env.APP_BASE_URL}/jobs">Confirm & Pay</a></p>
      `,
    });
  } catch (error) {
    console.error('Send job complete email error:', error);
  }
}

async function sendPaymentReceiptEmail(email, name, payment, receiptUrl) {
  if (!isEmailConfigured()) return;
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
  if (!isEmailConfigured()) return;
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

async function sendPaymentCompleteEmail(email, name, jobTitle, amount) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Payment released for "${jobTitle}"`,
      html: `
        <h1>Payment Released!</h1>
        <p>Hi ${name},</p>
        <p>Great news! The customer has confirmed completion of the job <strong>${jobTitle}</strong>.</p>
        <p>Your payment of $${amount.toFixed(2)} has been released and will be processed.</p>
        <p>Thank you for your hard work!</p>
        <p><a href="${process.env.APP_BASE_URL}/jobs">View Jobs</a></p>
      `,
    });
  } catch (error) {
    console.error('Send payment complete email error:', error);
  }
}

async function sendAutoCompleteEmail(email, name, jobTitle) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Job "${jobTitle}" auto-completed`,
      html: `
        <h1>Job Auto-Completed</h1>
        <p>Hi ${name},</p>
        <p>The job <strong>${jobTitle}</strong> has been automatically marked as complete since the job date has passed.</p>
        <p>Payment has been processed and released to the hustler.</p>
        <p><a href="${process.env.APP_BASE_URL}/jobs">View Jobs</a></p>
      `,
    });
  } catch (error) {
    console.error('Send auto complete email error:', error);
  }
}

async function sendRefundEmail(email, name, jobTitle, amount) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Refund processed for "${jobTitle}"`,
      html: `
        <h1>Refund Processed</h1>
        <p>Hi ${name},</p>
        <p>Your job <strong>${jobTitle}</strong> has been cancelled.</p>
        <p>A refund of $${amount.toFixed(2)} has been processed and will appear in your account within 5-10 business days.</p>
        <p><a href="${process.env.APP_BASE_URL}/jobs">View Jobs</a></p>
      `,
    });
  } catch (error) {
    console.error('Send refund email error:', error);
  }
}

async function sendStripeRequiredEmail(email, name, jobTitle) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Action Required: Connect Stripe to Accept "${jobTitle}"`,
      html: `
        <h1>Stripe Account Required</h1>
        <p>Hi ${name},</p>
        <p>Great news! A customer wants to accept your offer for the job: <strong>${jobTitle}</strong></p>
        <p><strong>However, you must connect your Stripe account first before you can be accepted.</strong></p>
        <p>Stripe is required because it's the only way you can receive payments on Hustl. It's quick and secure.</p>
        <p><a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/profile">Connect Stripe Account Now</a></p>
        <p>Once you connect your Stripe account, the customer can accept your offer and you'll be assigned to the job.</p>
        <p>Don't miss out on this opportunity - connect your account now!</p>
      `,
    });
  } catch (error) {
    console.error('Send Stripe required email error:', error);
    throw error; // This is important, so we should know if it fails
  }
}

async function sendNewMessageEmail(recipientEmail, recipientName, senderName, jobTitle, messagePreview, threadId) {
  if (!isEmailConfigured()) return;
  try {
    const messageUrl = `${process.env.APP_BASE_URL || 'http://localhost:8080'}/messages/${threadId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `New message from ${senderName} about "${jobTitle}"`,
      html: `
        <h2>New Message</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${senderName}</strong> sent you a new message about the job: <strong>${jobTitle}</strong></p>
        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 3px solid #2563eb;">
          <p style="margin: 0; font-style: italic; color: #6b7280;">"${messagePreview}"</p>
        </div>
        <p><a href="${messageUrl}" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; margin-top: 1rem;">View Message</a></p>
        <p style="color: #6b7280; font-size: 0.85rem; margin-top: 1.5rem;">You're receiving this because you have an active job with ${senderName}.</p>
      `,
    });
  } catch (error) {
    console.error('Send new message email error:', error);
    // Don't throw - message emails are nice-to-have, not critical
  }
}

async function sendFeedbackEmail(feedbackName, feedbackEmail, feedbackMessage) {
  if (!isEmailConfigured()) {
    console.warn('Feedback email not sent: RESEND_API_KEY is not configured');
    return; // Don't throw - feedback can be logged instead
  }
  try {
    const feedbackEmailAddress = process.env.FEEDBACK_EMAIL || 'team.hustlapp@outlook.com';
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: feedbackEmailAddress,
      subject: `Feedback from ${feedbackName || 'Anonymous User'}`,
      html: `
        <h2>New Feedback Received</h2>
        ${feedbackName ? `<p><strong>From:</strong> ${feedbackName}</p>` : '<p><strong>From:</strong> Anonymous</p>'}
        ${feedbackEmail ? `<p><strong>Email:</strong> ${feedbackEmail}</p>` : '<p><strong>Email:</strong> Not provided</p>'}
        <hr>
        <p><strong>Message:</strong></p>
        <p>${feedbackMessage.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #6b7280; font-size: 0.85rem;">Sent from Hustl feedback form</p>
      `,
      replyTo: feedbackEmail || undefined, // Allow replying directly to user if email provided
    });
  } catch (error) {
    console.error('Send feedback email error:', error);
    throw error; // This is important for feedback
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
  sendPaymentCompleteEmail,
  sendAutoCompleteEmail,
  sendRefundEmail,
  sendStripeRequiredEmail,
  sendFeedbackEmail,
  sendNewMessageEmail,
};

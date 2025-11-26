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

async function sendEmailVerificationEmail(email, name, verificationCode) {
  if (!isEmailConfigured()) return;
  try {
    const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:8080'}/verify-email?code=${verificationCode}&email=${encodeURIComponent(email)}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your Hustl email address',
      html: `
        <h1>Verify Your Email</h1>
        <p>Hi ${name},</p>
        <p>Thanks for signing up for Hustl! Please verify your email address to get started.</p>
        <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: #0ea5e9; letter-spacing: 0.5rem; margin-bottom: 0.5rem;">${verificationCode}</div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem;">Enter this code on the verification page, or click the link below</p>
        </div>
        <p style="margin-top: 1.5rem;">
          <a href="${verifyUrl}" style="display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Verify Email Address</a>
        </p>
        <p style="color: #64748b; font-size: 0.85rem; margin-top: 1.5rem;">
          This code will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
      `,
    });
  } catch (error) {
    console.error('Send email verification error:', error);
    throw error; // This is important, so we should know if it fails
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

async function sendJobAssignedEmail(email, name, jobTitle, jobId, customerName) {
  if (!isEmailConfigured()) return;
  try {
    const jobUrl = `${process.env.APP_BASE_URL || 'http://localhost:8080'}/jobs/${jobId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🎉 Congratulations! You were picked for "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #059669; font-size: 1.75rem; margin-bottom: 1rem;">🎉 Congratulations!</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #065f46; margin: 0 0 0.5rem 0; font-weight: 600;">
              You were picked as the Hustler for this job:
            </p>
            <h2 style="color: #047857; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            ${customerName ? `<p style="color: #065f46; margin: 0.5rem 0 0 0;">by ${customerName}</p>` : ''}
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            Great news! The customer has selected you for this job. You can now:
          </p>
          
          <ul style="color: #374151; line-height: 1.8; margin: 1rem 0; padding-left: 1.5rem;">
            <li>View the full job details</li>
            <li>Message the customer directly</li>
            <li>Get the exact address and contact information</li>
            <li>Start working on the job</li>
          </ul>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${jobUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              View Job Details →
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">
            Questions? Reply to this email or contact support through the app.
          </p>
          
          <p style="color: #6b7280; font-size: 0.85rem; margin-top: 1rem;">
            Good luck with the job! 💪
          </p>
        </div>
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

// Admin notification for refunds
async function sendAdminRefundNotification(payment, refundAmount, reason, adminName) {
  if (!isEmailConfigured()) return;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL;
  if (!adminEmail) {
    console.warn('Admin email not configured - skipping admin refund notification');
    return;
  }
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `🔴 REFUND PROCESSED: $${refundAmount.toFixed(2)} - Job #${payment.jobId}`,
      html: `
        <h1>Refund Processed</h1>
        <p><strong>Processed by:</strong> ${adminName}</p>
        <p><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <hr>
        <h2>Payment Details</h2>
        <p><strong>Payment ID:</strong> ${payment.id}</p>
        <p><strong>Job ID:</strong> ${payment.jobId}</p>
        <p><strong>Original Amount:</strong> $${Number(payment.total).toFixed(2)}</p>
        <p><strong>Customer:</strong> ${payment.customer?.name || 'N/A'} (${payment.customer?.email || 'N/A'})</p>
        <p><strong>Hustler:</strong> ${payment.hustler?.name || 'N/A'} (${payment.hustler?.email || 'N/A'})</p>
        <p><strong>Job Title:</strong> ${payment.job?.title || 'N/A'}</p>
        <hr>
        <p><a href="${process.env.APP_BASE_URL}/admin/refunds">View All Refunds</a></p>
      `,
    });
  } catch (error) {
    console.error('Send admin refund notification error:', error);
  }
}

// Admin notification for payouts
async function sendAdminPayoutNotification(payout, hustler) {
  if (!isEmailConfigured()) return;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL;
  if (!adminEmail) {
    console.warn('Admin email not configured - skipping admin payout notification');
    return;
  }
  
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `💰 PAYOUT ${payout.status}: $${Number(payout.netAmount).toFixed(2)} - ${hustler.name}`,
      html: `
        <h1>Payout ${payout.status}</h1>
        <p><strong>Payout ID:</strong> ${payout.id}</p>
        <p><strong>Status:</strong> ${payout.status}</p>
        <p><strong>Amount:</strong> $${Number(payout.amount).toFixed(2)}</p>
        <p><strong>Platform Fee:</strong> $${Number(payout.platformFee).toFixed(2)}</p>
        <p><strong>Net Amount:</strong> $${Number(payout.netAmount).toFixed(2)}</p>
        <hr>
        <h2>Hustler Details</h2>
        <p><strong>Name:</strong> ${hustler.name}</p>
        <p><strong>Email:</strong> ${hustler.email}</p>
        <p><strong>Job ID:</strong> ${payout.jobId}</p>
        <p><strong>Provider ID:</strong> ${payout.payoutProviderId || 'N/A'}</p>
        <hr>
        <p><a href="${process.env.APP_BASE_URL}/admin/payouts">View All Payouts</a></p>
      `,
    });
  } catch (error) {
    console.error('Send admin payout notification error:', error);
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

<<<<<<< HEAD
async function sendDisputeEmail(email, name, jobTitle, reason, description) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Issue reported for "${jobTitle}"`,
      html: `
        <h1>Issue Reported</h1>
        <p>Hi ${name},</p>
        <p>An issue has been reported for the job <strong>${jobTitle}</strong>.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
        <p>Payment will not be automatically released while this dispute is pending. Please review the issue and contact support if needed.</p>
        <p><a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/jobs">View Job Details</a></p>
      `,
    });
  } catch (error) {
    console.error('Send dispute email error:', error);
  }
}

async function sendStatusUpdateEmail(email, name, jobTitle, statusMessage) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Status update for "${jobTitle}"`,
      html: `
        <h1>Status Update</h1>
        <p>Hi ${name},</p>
        <p>Your hustler has updated the status for the job <strong>${jobTitle}</strong>.</p>
        <p><strong>Status:</strong> ${statusMessage}</p>
        <p><a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/jobs">View Job Details</a></p>
      `,
    });
  } catch (error) {
    console.error('Send status update email error:', error);
  }
}

async function sendJobExpiringEmail(email, name, jobTitle, jobId) {
  if (!isEmailConfigured()) return;
  try {
    const jobUrl = `${process.env.APP_BASE_URL || 'http://localhost:8080'}/jobs/${jobId}`;
    const renewUrl = `${process.env.APP_BASE_URL || 'http://localhost:8080'}/jobs/${jobId}?renew=true`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `⚠️ Your Hustl job is about to expire`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #dc2626; font-size: 1.75rem; margin-bottom: 1rem;">⚠️ Your Job is About to Expire</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #92400e; margin: 0 0 0.5rem 0; font-weight: 600;">
              Your job posted on Hustl is about to expire in the next 24 hours:
            </p>
            <h2 style="color: #78350f; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            If you still need help with this job, you can renew it to keep it posted and visible to hustlers.
          </p>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${renewUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              Renew Job →
            </a>
          </div>
          
          <div style="margin: 1.5rem 0; text-align: center;">
            <a href="${jobUrl}" style="color: #2563eb; text-decoration: underline; font-size: 0.95rem;">View Job Details</a>
          </div>
          
          <p style="color: #6b7280; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">
            If you don't renew it, the job will automatically be removed to keep the app clean for other users.
          </p>
          
          <p style="color: #6b7280; font-size: 0.85rem; margin-top: 1rem;">
            Questions? Reply to this email or contact support through the app.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send job expiring email error:', error);
    throw error; // Important - we want to know if this fails
  }
}

=======
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
module.exports = {
  sendSignupEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendOfferReceivedEmail,
  sendJobAssignedEmail,
  sendJobCompleteEmail,
  sendPaymentReceiptEmail,
  sendPayoutSentEmail,
  sendPaymentCompleteEmail,
  sendAutoCompleteEmail,
  sendRefundEmail,
  sendAdminRefundNotification,
  sendAdminPayoutNotification,
  sendStripeRequiredEmail,
  sendFeedbackEmail,
  sendNewMessageEmail,
<<<<<<< HEAD
  sendDisputeEmail,
  sendStatusUpdateEmail,
  sendJobExpiringEmail,
  sendSupportEmail,
=======
>>>>>>> parent of 48d5431 (Add deployment configuration and finalize for production)
};

async function sendSupportEmail({ from, fromName, subject, message, userId }) {
  if (!isEmailConfigured()) {
    console.warn('Support email not sent: RESEND_API_KEY is not configured');
    return;
  }
  try {
    const supportEmail = process.env.SUPPORT_EMAIL || 'team.hustlapp@outlook.com';
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: supportEmail,
      subject: `[Support Request] ${subject}`,
      html: `
        <h2>New Support Request</h2>
        <p><strong>From:</strong> ${fromName || 'Unknown'} (${from})</p>
        <p><strong>User ID:</strong> ${userId || 'N/A'}</p>
        <hr>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 3px solid #2563eb;">
          <p style="margin: 0; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        <hr>
        <p style="color: #6b7280; font-size: 0.85rem;">Sent from Hustl help center</p>
      `,
      replyTo: from, // Allow replying directly to user
    });
  } catch (error) {
    console.error('Send support email error:', error);
    throw error;
  }
}

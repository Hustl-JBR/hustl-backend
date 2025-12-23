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

// Use Resend's onboarding domain for testing, or set FROM_EMAIL with your verified domain
// Example: 'Hustl <hello@hustljobs.com>' (after verifying hustljobs.com in Resend)
// IMPORTANT: If domain is not verified in Resend, use onboarding@resend.dev
// Check Resend dashboard to see if hustljobs.com shows "Verified"
const FROM_EMAIL = process.env.FROM_EMAIL || 'Hustl <onboarding@resend.dev>';
const FALLBACK_EMAIL = 'Hustl <onboarding@resend.dev>'; // Always works, use as fallback

// Log which FROM_EMAIL is being used
console.log('[Email] FROM_EMAIL configured as:', FROM_EMAIL);

async function sendSignupEmail(email, name) {
  if (!isEmailConfigured()) return;
  try {
    console.log('[Email] Sending welcome email to:', email);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: '🎉 Welcome to Hustl - Let\'s get started!',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">Welcome to Hustl! 🎉</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              You're now part of Tennessee's local help community. Whether you want to post jobs or make extra cash, Hustl connects you with real people in your area.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 1rem 0; font-size: 1rem;">🚀 What's next?</h3>
              <ul style="color: #475569; padding-left: 1.25rem; margin: 0; line-height: 1.8;">
                <li><strong>Need help?</strong> Post a job and get offers from local hustlers</li>
                <li><strong>Want to earn?</strong> Browse jobs and start making money today</li>
                <li><strong>Stay safe:</strong> All payments are secure through Stripe</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="https://hustljobs.com" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Start Hustling →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; text-align: center;">
              Questions? Just reply to this email — we're here to help!
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Welcome email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send signup email error:', error);
    // Don't throw - email failures shouldn't break signup
  }
}

async function sendEmailVerificationEmail(email, name, verificationCode) {
  if (!isEmailConfigured()) {
    console.warn('[Email] Verification email not sent - RESEND_API_KEY not configured');
    throw new Error('RESEND_API_KEY not configured');
  }
  try {
    console.log('[Email] Sending verification email to:', email, 'with code:', verificationCode);
    console.log('[Email] Using FROM_EMAIL:', FROM_EMAIL);
    console.log('[Email] Resend configured:', !!resend);
    
    let result;
    try {
      // Try with configured FROM_EMAIL first
      result = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `🔐 Your Hustl verification code: ${verificationCode}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.5rem;">Verify Your Email 🔐</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>!
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              You're almost ready! Enter this 6-digit code to verify your email and start using Hustl:
            </p>
            
            <!-- Code Box -->
            <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 3px solid #2563eb; border-radius: 12px; padding: 2rem; margin: 1.5rem 0; text-align: center;">
              <div style="font-size: 2.5rem; font-weight: 800; color: #1e40af; letter-spacing: 0.75rem; font-family: 'Courier New', monospace;">
                ${verificationCode}
              </div>
              <p style="margin: 1rem 0 0 0; color: #3b82f6; font-size: 0.9rem; font-weight: 500;">
                Your verification code
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; text-align: center; margin: 1.5rem 0;">
              ⏰ This code expires in <strong>5 minutes</strong>
            </p>
            
            <!-- Security Note -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 1rem; margin-top: 1.5rem; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; margin: 0; font-size: 0.85rem;">
                <strong>🔒 Security tip:</strong> Never share this code with anyone. Hustl will never ask for your code over the phone.
              </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 0.8rem; margin-top: 1.5rem; text-align: center;">
              If you didn't create a Hustl account, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      });
      console.log('[Email] ✅ Verification email sent successfully to:', email);
      console.log('[Email] Resend response:', JSON.stringify(result, null, 2));
      return result;
    } catch (firstError) {
      // If custom domain fails, try fallback email
      if (FROM_EMAIL !== FALLBACK_EMAIL && firstError.message?.includes('domain') || firstError.message?.includes('not verified')) {
        console.warn('[Email] ⚠️ Custom domain failed, trying fallback email:', firstError.message);
        console.log('[Email] Retrying with fallback email:', FALLBACK_EMAIL);
        
        try {
          result = await resend.emails.send({
            from: FALLBACK_EMAIL,
            to: email,
            subject: `🔐 Your Hustl verification code: ${verificationCode}`,
            html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.5rem;">Verify Your Email 🔐</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>!
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              You're almost ready! Enter this 6-digit code to verify your email and start using Hustl:
            </p>
            
            <!-- Code Box -->
            <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 3px solid #2563eb; border-radius: 12px; padding: 2rem; margin: 1.5rem 0; text-align: center;">
              <div style="font-size: 2.5rem; font-weight: 800; color: #1e40af; letter-spacing: 0.75rem; font-family: 'Courier New', monospace;">
                ${verificationCode}
              </div>
              <p style="margin: 1rem 0 0 0; color: #3b82f6; font-size: 0.9rem; font-weight: 500;">
                Your verification code
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; text-align: center; margin: 1.5rem 0;">
              ⏰ This code expires in <strong>5 minutes</strong>
            </p>
            
            <!-- Security Note -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 1rem; margin-top: 1.5rem; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; margin: 0; font-size: 0.85rem;">
                <strong>🔒 Security tip:</strong> Never share this code with anyone. Hustl will never ask for your code over the phone.
              </p>
            </div>
            
            <p style="color: #94a3b8; font-size: 0.8rem; margin-top: 1.5rem; text-align: center;">
              If you didn't create a Hustl account, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
          });
          console.log('[Email] ✅ Verification email sent successfully using fallback email to:', email);
          return result;
        } catch (fallbackError) {
          console.error('[Email] ❌ Both custom domain and fallback failed');
          throw firstError; // Throw original error
        }
      } else {
        throw firstError;
      }
    }
  } catch (error) {
    console.error('[Email] ❌ Send email verification error:', error);
    console.error('[Email] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      response: error.response?.data || error.response
    });
    // Throw error so signup route can handle it
    throw error;
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
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">Reset Your Password</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              You requested to reset your password. Click the button below to reset it:
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                Reset Password →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
              This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Password reset email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send password reset email error:', error);
    throw error; // This is important, so we should know if it fails
  }
}

async function sendPasswordChangedEmail(email, name) {
  if (!isEmailConfigured()) {
    console.log('[Email] Email not configured, skipping password changed email');
    return;
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your Hustl password has been changed',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">Password Changed ✅</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Your password has been successfully changed. You can now use your new password to log in.
            </p>
            
            <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; text-align: center;">
              <p style="margin: 0; font-weight: 600; color: #065f46; font-size: 1rem;">✅ Password Successfully Changed</p>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
              If you didn't make this change, please contact support immediately to secure your account.
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Password changed email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send password changed email error:', error);
    // Don't throw - just log the error so it doesn't break the password change
    console.error('[Email] Email error details:', {
      message: error.message,
      stack: error.stack
    });
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs/${jobTitle}">View Offer</a></p>
      `,
    });
  } catch (error) {
    console.error('Send offer received email error:', error);
  }
}

async function sendJobAssignedEmail(email, name, jobTitle, jobId, customerName) {
  if (!isEmailConfigured()) return;
  try {
    const jobUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs/${jobId}`;
    
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
              Customer accepted you for this job:
            </p>
            <h2 style="color: #047857; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            ${customerName ? `<p style="color: #065f46; margin: 0.5rem 0 0 0;">by ${customerName}</p>` : ''}
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            Great news! The customer accepted you for this job. You can now:
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs">Confirm & Pay</a></p>
      `,
    });
  } catch (error) {
    console.error('Send job complete email error:', error);
  }
}

async function sendJobCompletionCongratsEmail(email, name, jobTitle, otherPersonName) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🎉 Congrats on completing "${jobTitle}"!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">🎉 Job Completed!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Congrats on completing your job! We hope everything went great.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 1rem 0; font-size: 1rem;">⭐ What's next?</h3>
              <p style="color: #475569; margin: 0; line-height: 1.6;">
                Please take a moment to rate ${otherPersonName || 'your partner'}, and feel free to work together again on Hustl.
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Leave a Review →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; text-align: center;">
              Thanks for using Hustl! 💪
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Job completion congrats email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send job completion congrats email error:', error);
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
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">💰 Payment Receipt</h1>
          </div>
          
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Thank you for using Hustl! Here's your payment receipt:
            </p>
            
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Job Amount:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${amount.toFixed(2)}</td>
                </tr>
                ${tip > 0 ? `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Tip:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${tip.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Service Fee:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${serviceFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 0.75rem 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;">Total:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-size: 1.1rem; font-weight: 700; color: #2563eb;">$${total.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${receiptUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Full Receipt →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
              If you have any questions, please contact support.
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Payment receipt email sent successfully to customer:', email);
  } catch (error) {
    console.error('[Email] Send payment receipt email error:', error);
  }
}

async function sendHustlerPaymentReceiptEmail(email, name, jobTitle, jobId, payment, actualHours) {
  if (!isEmailConfigured()) return;
  try {
    const amount = Number(payment.amount);
    const platformFee = Number(payment.feeHustler) || (amount * 0.12);
    const payout = amount - platformFee;
    const viewJobUrl = `${process.env.FRONTEND_BASE_URL || 'https://hustljobs.com'}?view=job-details&jobId=${jobId}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `💰 Payment Receipt - "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">💰 Payment Receipt</h1>
          </div>
          
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great work on completing <strong>"${jobTitle}"</strong>! Here's your payment receipt:
            </p>
            
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              ${actualHours ? `
              <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0;">
                <div style="color: #64748b; font-size: 0.9rem; margin-bottom: 0.25rem;">⏱️ Time Worked</div>
                <div style="font-weight: 600; color: #1e293b; font-size: 1.1rem;">${actualHours.toFixed(2)} hours</div>
              </div>
              ` : ''}
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Job Amount:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${amount.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Platform Fee (12%):</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">-$${platformFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 0.75rem 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;">Your Payout:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-size: 1.1rem; font-weight: 700; color: #10b981;">$${payout.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #d1fae5; border: 2px solid #10b981; border-radius: 12px; padding: 1rem; margin: 1.5rem 0; text-align: center;">
              <p style="margin: 0; font-weight: 600; color: #065f46; font-size: 0.95rem;">
                💳 Payment processed via Stripe. Funds will be transferred to your connected account.
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${viewJobUrl}" style="display: inline-block; padding: 1rem 2rem; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Job Details →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
              If you have any questions about your payment, please contact support.
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Hustler payment receipt email sent successfully:', email);
  } catch (error) {
    console.error('[Email] Send hustler payment receipt email error:', error);
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs">View Jobs</a></p>
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs">View Jobs</a></p>
      `,
    });
  } catch (error) {
    console.error('Send auto complete email error:', error);
  }
}

async function sendRefundEmail(email, name, jobTitle, amount, reason, payment) {
  if (!isEmailConfigured()) return;
  try {
    const refundAmount = payment ? Number(payment.total || payment.amount || amount) : Number(amount);
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'team.hustljobs@outlook.com';
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Refund Processed - "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">Refund Processed</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Your job <strong>"${jobTitle}"</strong> has been cancelled and a refund has been processed.
            </p>
            
            ${reason ? `
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; margin: 1.5rem 0; border-radius: 4px;">
              <p style="color: #991b1b; margin: 0; font-weight: 600; margin-bottom: 0.5rem;">Reason:</p>
              <p style="color: #7f1d1d; margin: 0;">${reason}</p>
            </div>
            ` : ''}
            
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">💰</div>
                <div style="font-size: 2rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">$${refundAmount.toFixed(2)}</div>
                <div style="color: #64748b; font-size: 0.9rem;">Refund Amount</div>
              </div>
              
              ${payment ? `
              <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 0.5rem 0; color: #64748b;">Job Amount:</td>
                  <td style="padding: 0.5rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${Number(payment.amount || 0).toFixed(2)}</td>
                </tr>
                ${Number(payment.tip || 0) > 0 ? `
                <tr>
                  <td style="padding: 0.5rem 0; color: #64748b;">Tip:</td>
                  <td style="padding: 0.5rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${Number(payment.tip || 0).toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 0.5rem 0; color: #64748b;">Service Fee:</td>
                  <td style="padding: 0.5rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${Number(payment.feeCustomer || 0).toFixed(2)}</td>
                </tr>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; font-weight: 700; color: #1e293b;">Total Refunded:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 700; color: #10b981; font-size: 1.1rem;">$${refundAmount.toFixed(2)}</td>
                </tr>
              </table>
              ` : ''}
            </div>
            
            <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #2563eb;">
              <p style="color: #1e40af; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>💡 Refund Timeline:</strong><br>
                The refund has been processed and will appear in your account within 5-10 business days, depending on your bank or card issuer.
              </p>
            </div>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>❓ Questions about this refund?</strong><br>
                If you need assistance or have questions, please email us at <a href="mailto:${supportEmail}" style="color: #92400e; font-weight: 600;">${supportEmail}</a> and include details about what happened.
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'https://hustljobs.com'}/?view=manage-jobs" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View My Jobs →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Refund email sent successfully');
  } catch (error) {
    console.error('[Email] Error sending refund email:', error);
    throw error;
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/admin/refunds">View All Refunds</a></p>
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/admin/payouts">View All Payouts</a></p>
      `,
    });
  } catch (error) {
    console.error('Send admin payout notification error:', error);
  }
}

async function sendStripeConnectedEmail(email, name) {
  if (!isEmailConfigured()) return;
  try {
    console.log('[Email] Sending Stripe connected email to:', email);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: '✅ Your Stripe account is connected - You\'re ready to earn!',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">✅ Stripe Account Connected!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 🎉
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! Your Stripe account has been successfully connected. You're now all set to receive payments directly to your bank account.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin-top: 0; margin-bottom: 1rem;">💰 What happens next?</h3>
              <ul style="color: #475569; line-height: 1.8; margin: 0; padding-left: 1.5rem;">
                <li>When you complete a job, payment is automatically transferred to your Stripe account</li>
                <li>Stripe will automatically send payouts to your bank (usually daily or weekly)</li>
                <li>You can track all payments in your Stripe dashboard</li>
                <li>No action needed from you - it's all automatic!</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'https://hustljobs.com'}/profile" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 0.75rem 2rem; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Your Profile
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; margin-bottom: 0;">
              Questions? Reply to this email or contact us at <a href="mailto:${FROM_EMAIL.replace(/.*<(.+)>/, '$1')}" style="color: #2563eb;">${FROM_EMAIL.replace(/.*<(.+)>/, '$1')}</a>
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Stripe connected email sent successfully');
  } catch (error) {
    console.error('[Email] Error sending Stripe connected email:', error);
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
        <p><a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}/profile">Connect Stripe Account Now</a></p>
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
    const messageUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}/messages/${threadId}`;
    
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

async function sendJobExpiringEmail(email, name, jobTitle, jobId) {
  if (!isEmailConfigured()) return;
  try {
    const manageJobsUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}`;
    const jobUrl = `${manageJobsUrl}/jobs/${jobId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `⏰ Your job "${jobTitle}" expires in 1 hour!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #dc2626; font-size: 1.75rem; margin-bottom: 1rem;">⏰ Job Expiring Soon!</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #991b1b; margin: 0 0 0.5rem 0; font-weight: 600;">
              Your job will expire in less than 1 hour:
            </p>
            <h2 style="color: #dc2626; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            Don't lose your job posting! You can:
          </p>
          
          <ul style="color: #374151; line-height: 1.8; margin: 1rem 0; padding-left: 1.5rem;">
            <li>Extend the expiration date</li>
            <li>Update the job details</li>
            <li>Repost the job if it expires</li>
          </ul>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${manageJobsUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              Manage Your Jobs →
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">
            Once a job expires, it will be removed from Browse Jobs. You can always repost it from your Manage Jobs page.
          </p>
        </div>
      `,
    });
    console.log(`[Email] Sent job expiring email to ${email} for job ${jobId}`);
  } catch (error) {
    console.error('[Email] Send job expiring email error:', error);
    throw error;
  }
}

async function sendJobUnacceptedEmail(email, name, jobTitle, jobId, customerName) {
  if (!isEmailConfigured()) return;
  try {
    const jobUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs/${jobId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Job Unassigned: "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #dc2626; font-size: 1.75rem; margin-bottom: 1rem;">Job Unassigned</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #991b1b; margin: 0 0 0.5rem 0; font-weight: 600;">
              The customer has unassigned you from this job:
            </p>
            <h2 style="color: #dc2626; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            ${customerName ? `<p style="color: #991b1b; margin: 0.5rem 0 0 0;">by ${customerName}</p>` : ''}
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            The job is now open for other applicants. Don't worry - there are plenty of other opportunities available!
          </p>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              Browse More Jobs →
            </a>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send job unaccepted email error:', error);
  }
}

async function sendHustlerCancelledEmail(email, name, jobTitle, hustlerName, jobId, refundAmount = null) {
  if (!isEmailConfigured()) return;
  try {
    const jobUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs/${jobId}`;
    const refundSection = refundAmount ? `
      <div style="background: #dcfce7; border: 2px solid #16a34a; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
        <div style="font-size: 1.1rem; font-weight: 700; color: #166534; margin-bottom: 0.5rem;">💰 Full Refund Processed</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #166534; margin-bottom: 0.5rem;">$${Number(refundAmount).toFixed(2)}</div>
        <div style="font-size: 0.9rem; color: #166534; line-height: 1.6;">
          Your payment has been fully refunded. The refund will appear in your account within 5-10 business days.
        </div>
      </div>
    ` : '';
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Hustler Left: "${jobTitle}"${refundAmount ? ' - Full Refund Processed' : ''}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #dc2626; font-size: 1.75rem; margin-bottom: 1rem;">Hustler Left Job</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #991b1b; margin: 0 0 0.5rem 0; font-weight: 600;">
              The hustler has left this job:
            </p>
            <h2 style="color: #dc2626; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            <p style="color: #991b1b; margin: 0.5rem 0 0 0;">Hustler: ${hustlerName}</p>
          </div>
          
          ${refundSection}
          
          <div style="margin-top: 1.5rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 0.5rem;">What's Next?</div>
            <div style="font-size: 0.9rem; color: #1e3a8a; line-height: 1.6;">
              You can now hire someone else for this job or unassign if you no longer need it. The job is back to "Open" status and available for new applications.
            </div>
          </div>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${jobUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              View Job Details →
            </a>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send hustler cancelled email error:', error);
  }
}

async function sendJobDeletedEmail(email, name, jobTitle, customerName) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Job Deleted: "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #dc2626; font-size: 1.75rem; margin-bottom: 1rem;">Job Deleted</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #991b1b; margin: 0 0 0.5rem 0; font-weight: 600;">
              The customer has deleted this job:
            </p>
            <h2 style="color: #dc2626; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            ${customerName ? `<p style="color: #991b1b; margin: 0.5rem 0 0 0;">by ${customerName}</p>` : ''}
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            This job is no longer available. Don't worry - there are plenty of other opportunities available!
          </p>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              Browse More Jobs →
            </a>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send job deleted email error:', error);
  }
}

async function sendJobDeletedConfirmationEmail(email, name, jobTitle) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Job Deleted: "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #059669; font-size: 1.75rem; margin-bottom: 1rem;">✅ Job Deleted</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #065f46; margin: 0 0 0.5rem 0; font-weight: 600;">
              Your job has been successfully deleted:
            </p>
            <h2 style="color: #047857; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            The job and all associated data have been removed from the system.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send job deleted confirmation email error:', error);
  }
}

async function sendHustlerUnassignedConfirmationEmail(email, name, jobTitle, hustlerName) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Hustler Unassigned: "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #059669; font-size: 1.75rem; margin-bottom: 1rem;">✅ Hustler Unassigned</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #065f46; margin: 0 0 0.5rem 0; font-weight: 600;">
              You have successfully unassigned the hustler from:
            </p>
            <h2 style="color: #047857; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            <p style="color: #065f46; margin: 0.5rem 0 0 0;">Hustler: ${hustlerName}</p>
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            The job is now open for other applicants. You can review new applications or accept a different hustler.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send hustler unassigned confirmation email error:', error);
  }
}

async function sendHustlerLeftConfirmationEmail(email, name, jobTitle, customerName) {
  if (!isEmailConfigured()) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You Left: "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #059669; font-size: 1.75rem; margin-bottom: 1rem;">✅ You Left Job</h1>
          <p style="font-size: 1.1rem; color: #1f2937; margin-bottom: 1.5rem;">Hi <strong>${name}</strong>,</p>
          
          <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="font-size: 1.05rem; color: #065f46; margin: 0 0 0.5rem 0; font-weight: 600;">
              You have successfully left this job:
            </p>
            <h2 style="color: #047857; font-size: 1.5rem; margin: 0.5rem 0;">
              ${jobTitle}
            </h2>
            ${customerName ? `<p style="color: #065f46; margin: 0.5rem 0 0 0;">Customer: ${customerName}</p>` : ''}
          </div>
          
          <p style="color: #374151; line-height: 1.6; margin: 1.5rem 0;">
            The job is now open for other applicants. You can browse and apply to other jobs.
          </p>
          
          <div style="margin: 2rem 0; text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://hustljobs.com'}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
              Browse More Jobs →
            </a>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Send hustler left confirmation email error:', error);
  }
}

async function sendPriceChangeProposalEmail(email, name, jobTitle, jobId, proposedPrice) {
  if (!isEmailConfigured()) return;
  try {
    const manageJobsUrl = `https://hustljobs.com?view=manage-jobs&jobId=${jobId}`;
    const priceText = proposedPrice.amount !== null 
      ? `$${proposedPrice.amount.toFixed(2)}`
      : proposedPrice.hourlyRate !== null && proposedPrice.estHours !== null
      ? `$${proposedPrice.hourlyRate.toFixed(2)}/hr × ${proposedPrice.estHours} hours = $${(proposedPrice.hourlyRate * proposedPrice.estHours).toFixed(2)}`
      : 'See job details';
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `💰 Price Change Proposal for "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">💰 Price Change Proposal</h1>
          </div>
          
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              The hustler proposed a new price for the job <strong>"${jobTitle}"</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 2px solid #fbbf24;">
              <p style="margin: 0 0 0.75rem 0; font-weight: 600; color: #92400e;">Proposed New Price:</p>
              <p style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #78350f;">${priceText}</p>
            </div>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              <strong>Action Required:</strong> Please review and accept or decline this price change. The job cannot proceed until you respond.
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${manageJobsUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                Review Price Change →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; text-align: center;">
              If you decline, the customer may unassign you and select another hustler.
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Price change proposal email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send price change proposal email error:', error);
  }
}

async function sendPriceChangeAcceptedEmail(email, name, jobTitle, jobId, newAmount) {
  if (!isEmailConfigured()) return;
  try {
    const manageJobsUrl = `https://hustljobs.com?view=manage-jobs&jobId=${jobId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Customer Accepted Your Price for "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">✅ Customer Accepted Your Price</h1>
          </div>
          
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! The customer accepted your price for <strong>"${jobTitle}"</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 2px solid #10b981;">
              <p style="margin: 0 0 0.75rem 0; font-weight: 600; color: #059669;">New Agreed Price:</p>
              <p style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #047857;">$${newAmount.toFixed(2)}</p>
            </div>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              The payment authorization has been updated to reflect the new price. The job can now proceed as scheduled.
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${manageJobsUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Job →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Price change accepted email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send price change accepted email error:', error);
  }
}

async function sendPriceChangeDeclinedEmail(email, name, jobTitle, jobId) {
  if (!isEmailConfigured()) return;
  try {
    const manageJobsUrl = `https://hustljobs.com?view=manage-jobs&jobId=${jobId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `❌ Price Change Declined for "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">❌ Price Change Declined</h1>
          </div>
          
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              The customer declined your price change proposal for <strong>"${jobTitle}"</strong>.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 2px solid #fca5a5;">
              <p style="margin: 0; color: #991b1b; font-weight: 600;">
                The job will remain at the original agreed price. If you'd like to proceed with a different price, you may need to unassign this hustler and select another.
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${manageJobsUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                Manage Job →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Price change declined email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send price change declined email error:', error);
  }
}

async function sendHoursExtendedEmail(email, name, jobTitle, jobId, hoursAdded, newMaxHours, customerName) {
  if (!isEmailConfigured()) return;
  try {
    const manageJobsUrl = `https://hustljobs.com?view=manage-jobs&jobId=${jobId}`;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `⏱️ Hours Extended for "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">⏱️ Hours Extended</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              <strong>${customerName}</strong> has added ${hoursAdded} ${hoursAdded === 1 ? 'hour' : 'hours'} to the job <strong>"${jobTitle}"</strong>.
            </p>
            
            <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; text-align: center;">
              <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 1rem;">
                New Max Hours: <strong>${newMaxHours} ${newMaxHours === 1 ? 'hour' : 'hours'}</strong>
              </p>
            </div>
            
            <p style="color: #64748b; line-height: 1.6; margin-bottom: 1.5rem;">
              You can continue working on the job. The customer will be charged for the additional time authorized.
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${manageJobsUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Job →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Hours extended email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send hours extended email error:', error);
  }
}

async function sendTipReceivedEmail(email, name, jobTitle, tipAmount, customerName) {
  if (!isEmailConfigured()) return;
  try {
    console.log('[Email] Sending tip received email to:', email);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `💝 You received a $${tipAmount.toFixed(2)} tip!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">💝 You Got a Tip!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! <strong>${customerName}</strong> just tipped you <strong style="color: #10b981; font-size: 1.2rem;">$${tipAmount.toFixed(2)}</strong> for your work on "${jobTitle}".
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 2px solid #10b981;">
              <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">💝</div>
                <div style="font-size: 2rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">$${tipAmount.toFixed(2)}</div>
                <div style="color: #64748b; font-size: 0.9rem;">Tip from ${customerName}</div>
              </div>
            </div>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Your tip has been sent directly to your Stripe account. Keep up the excellent work! 🎉
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'https://hustljobs.com'}/?view=manage-jobs" style="display: inline-block; padding: 1rem 2rem; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Job Details →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">
              Thank you for being part of the Hustl community!
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Tip received email sent successfully');
  } catch (error) {
    console.error('[Email] Error sending tip received email:', error);
    throw error;
  }
}

async function sendStartCodeActivatedEmail(email, name, jobTitle, jobId, jobAmount, serviceFee, total, receiptUrl, hustlerName) {
  if (!isEmailConfigured()) return;
  try {
    console.log('[Email] Sending start code activated email to:', email);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Job Started - "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">✅ Job Started!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! <strong>${hustlerName}</strong> has started working on your job <strong>"${jobTitle}"</strong>. Your payment is now secured in escrow.
            </p>
            
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <div style="font-weight: 700; font-size: 1.1rem; color: #1e293b; margin-bottom: 1rem; text-align: center;">Payment Confirmed</div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Job Amount:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${jobAmount.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Service Fee (6.5%):</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${serviceFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 0.75rem 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;">Total Paid:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-size: 1.1rem; font-weight: 700; color: #2563eb;">$${total.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #2563eb;">
              <p style="color: #1e40af; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>🔒 Payment in Escrow:</strong><br>
                Your payment is securely held in escrow until the hustler completes the job and enters the completion code. This protects both you and the hustler.
              </p>
            </div>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>💡 Need a Refund?</strong><br>
                If something goes wrong, you can request a refund by emailing <a href="mailto:${process.env.SUPPORT_EMAIL || 'team.hustljobs@outlook.com'}" style="color: #92400e; font-weight: 600;">${process.env.SUPPORT_EMAIL || 'team.hustljobs@outlook.com'}</a> with details about what happened. Include your receipt for faster processing.
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${receiptUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem; margin-right: 1rem;">
                View Receipt →
              </a>
              <a href="${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'https://hustljobs.com'}/?view=manage-jobs" style="display: inline-block; padding: 1rem 2rem; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                Manage Jobs →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Start code activated email sent successfully');
  } catch (error) {
    console.error('[Email] Error sending start code activated email:', error);
    throw error;
  }
}

async function sendPaymentInEscrowEmail(email, name, jobTitle, jobId, amount) {
  if (!isEmailConfigured()) return;
  try {
    console.log('[Email] Sending payment in escrow email to:', email);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `💰 Payment in Escrow - "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">💰 Payment Secured</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! The customer has started the job <strong>"${jobTitle}"</strong> and your payment of <strong style="color: #10b981;">$${amount.toFixed(2)}</strong> is now secured in escrow.
            </p>
            
            <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #2563eb;">
              <p style="color: #1e40af; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>🔒 What This Means:</strong><br>
                The payment is safely held in escrow until you complete the job and enter the completion code. Once the customer verifies completion, the payment will be released to your Stripe account (minus our 12% platform fee).
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'https://hustljobs.com'}/?view=manage-jobs" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Job Details →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Payment in escrow email sent successfully');
  } catch (error) {
    console.error('[Email] Error sending payment in escrow email:', error);
    throw error;
  }
}

async function sendPaymentReleasedEmail(email, name, jobTitle, jobId, payment, receiptUrl, hustlerName, actualHours = null, originalAuthorized = null) {
  if (!isEmailConfigured()) return;
  try {
    console.log('[Email] Sending payment released email to:', email);
    const jobAmount = Number(payment.amount || 0);
    const tipAmount = Number(payment.tip || 0);
    const serviceFee = Number(payment.feeCustomer || 0);
    const total = Number(payment.total || 0);
    const isHourly = actualHours !== null && actualHours > 0;
    const refundAmount = isHourly && originalAuthorized ? (originalAuthorized - jobAmount) : 0;
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Payment Released - "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">✅ Payment Released!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hi <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! <strong>${hustlerName}</strong> has completed your job <strong>"${jobTitle}"</strong> and the payment has been released from escrow to the hustler.
            </p>
            
            ${isHourly ? `
            <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #2563eb;">
              <p style="color: #1e40af; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>⏱️ Hourly Job:</strong><br>
                The hustler worked <strong>${actualHours.toFixed(2)} hours</strong>. You were only charged for the actual time worked, and the unused portion has been automatically refunded to your payment method.
              </p>
            </div>
            ` : ''}
            
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #e2e8f0;">
              <div style="font-weight: 700; font-size: 1.1rem; color: #1e293b; margin-bottom: 1rem; text-align: center;">Payment Summary</div>
              <table style="width: 100%; border-collapse: collapse;">
                ${isHourly && originalAuthorized ? `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Originally Authorized:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #64748b;">$${originalAuthorized.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Job Amount Charged:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${jobAmount.toFixed(2)}</td>
                </tr>
                ${isHourly && refundAmount > 0 ? `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">💚 Refund (Unused Time):</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #10b981;">-$${refundAmount.toFixed(2)}</td>
                </tr>
                ` : ''}
                ${tipAmount > 0 ? `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">💝 Tip:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #10b981;">+$${tipAmount.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 0.75rem 0; color: #64748b;">Service Fee (6.5%):</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-weight: 600; color: #1e293b;">$${serviceFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 0.75rem 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;">Total Paid:</td>
                  <td style="padding: 0.75rem 0; text-align: right; font-size: 1.1rem; font-weight: 700; color: #2563eb;">$${total.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            ${isHourly && refundAmount > 0 ? `
            <div style="background: #dcfce7; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #10b981;">
              <p style="color: #166534; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>💚 Automatic Refund:</strong><br>
                You were authorized for more time than was used. The unused amount of <strong>$${refundAmount.toFixed(2)}</strong> has been automatically released back to your payment method. This typically appears in your account within 5-10 business days.
              </p>
            </div>
            ` : ''}
            
            <div style="background: #dcfce7; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #10b981;">
              <p style="color: #166534; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>✅ Job Complete:</strong><br>
                The payment has been successfully released to the hustler. Thank you for using Hustl!
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${receiptUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem; margin-right: 1rem;">
                View Receipt →
              </a>
              <a href="${process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || 'https://hustljobs.com'}/?view=manage-jobs" style="display: inline-block; padding: 1rem 2rem; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                Rate Your Hustler →
              </a>
            </div>
          </div>
        </div>
      `,
    });
    console.log('[Email] Payment released email sent successfully');
  } catch (error) {
    console.error('[Email] Error sending payment released email:', error);
    throw error;
  }
}

module.exports = {
  sendSignupEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendOfferReceivedEmail,
  sendJobAssignedEmail,
  sendJobCompleteEmail,
  sendJobCompletionCongratsEmail,
  sendJobPostedEmail,
  sendPaymentReceiptEmail,
  sendHustlerPaymentReceiptEmail,
  sendPayoutSentEmail,
  sendPaymentCompleteEmail,
  sendAutoCompleteEmail,
  sendRefundEmail,
  sendAdminRefundNotification,
  sendAdminPayoutNotification,
  sendStripeRequiredEmail,
  sendStripeConnectedEmail,
  sendFeedbackEmail,
  sendTipReceivedEmail,
  sendNewMessageEmail,
  sendJobExpiringEmail,
  sendJobUnacceptedEmail,
  sendHustlerCancelledEmail,
  sendJobDeletedEmail,
  sendJobDeletedConfirmationEmail,
  sendHustlerUnassignedConfirmationEmail,
  sendHustlerLeftConfirmationEmail,
  sendPriceChangeProposalEmail,
  sendPriceChangeAcceptedEmail,
  sendPriceChangeDeclinedEmail,
  sendHoursExtendedEmail,
  sendStartCodeActivatedEmail,
  sendPaymentInEscrowEmail,
  sendPaymentReleasedEmail,
};

async function sendJobPostedEmail(email, name, jobTitle, jobId, jobDate, amount, payType, hourlyRate, estHours) {
  if (!isEmailConfigured()) return;
  try {
    const jobUrl = `${process.env.APP_BASE_URL || 'https://hustljobs.com'}/jobs/${jobId}`;
    const manageJobsUrl = `${process.env.APP_BASE_URL || process.env.FRONTEND_BASE_URL || 'https://hustljobs.com'}`;
    
    // Format price display
    let priceDisplay = '';
    if (payType === 'hourly' && hourlyRate && estHours) {
      priceDisplay = `$${parseFloat(hourlyRate).toFixed(2)}/hr (max ${estHours} hrs)`;
    } else {
      priceDisplay = `$${parseFloat(amount || 0).toFixed(2)} flat`;
    }
    
    // Format date
    const formattedDate = new Date(jobDate).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Job Posted: "${jobTitle}"`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 1.75rem;">✅ Job Posted Successfully!</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 2rem; background: #f8fafc; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
              Hey <strong>${name}</strong>! 👋
            </p>
            
            <p style="color: #475569; line-height: 1.6; margin-bottom: 1.5rem;">
              Great news! Your job has been posted and is now visible to hustlers nearby. They'll start applying soon!
            </p>
            
            <!-- Job Details Card -->
            <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border: 2px solid #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #047857; margin: 0 0 1rem 0; font-size: 1.5rem;">${jobTitle}</h2>
              
              <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.2rem;">💰</span>
                  <div>
                    <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.25rem;">Price</div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 1.1rem;">${priceDisplay}</div>
                  </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.2rem;">📅</span>
                  <div>
                    <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.25rem;">Scheduled For</div>
                    <div style="font-weight: 600; color: #1e293b;">${formattedDate}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div style="background: #eff6ff; border-radius: 8px; padding: 1rem; margin: 1.5rem 0; border-left: 4px solid #2563eb;">
              <p style="color: #1e40af; margin: 0; font-size: 0.95rem; line-height: 1.6;">
                <strong>💡 What's next?</strong><br>
                Go to <strong>Manage Jobs</strong> to review applicants and choose your favorite hustler. You'll receive notifications when hustlers apply!
              </p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${manageJobsUrl}" style="display: inline-block; padding: 1rem 2rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.05rem;">
                View Manage Jobs →
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 0.9rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; text-align: center;">
              Questions? Just reply to this email — we're here to help!
            </p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Job posted email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Send job posted email error:', error);
    // Don't throw - email failures shouldn't break job posting
  }
}

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

# Email Setup Guide

## When Emails Will Start Working

Emails will start being sent **as soon as you configure the Resend API key** in your `.env` file.

## Required Environment Variables

Add these to your `.env` file in the root of the project:

```env
# Resend API Key (REQUIRED for emails to work)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# From Email Address (optional - defaults to 'Hustl <noreply@hustl.app>')
# You'll need to verify this domain in Resend
FROM_EMAIL=Hustl <noreply@yourdomain.com>

# Feedback Email (optional - defaults to 'team.hustlapp@outlook.com')
FEEDBACK_EMAIL=team.hustlapp@outlook.com

# App Base URL (for email links)
APP_BASE_URL=http://localhost:8080
```

## How to Get Your Resend API Key

1. **Sign up for Resend** (if you haven't already):
   - Go to https://resend.com
   - Create a free account

2. **Get your API key**:
   - Go to https://resend.com/api-keys
   - Click "Create API Key"
   - Copy the key (starts with `re_`)

3. **Verify your domain** (for production):
   - Go to https://resend.com/domains
   - Add your domain
   - Follow the DNS verification steps
   - Update `FROM_EMAIL` in `.env` to use your verified domain

## Email Types That Will Be Sent

Once configured, these emails will automatically be sent:

### User Emails
- ✅ **Welcome email** - When users sign up
- ✅ **Password reset** - When users request password reset

### Job-Related Emails
- ✅ **Offer received** - Customer gets email when hustler applies
- ✅ **Job assigned** - Hustler gets email when their offer is accepted
- ✅ **Stripe required** - Hustler gets email if they need to connect Stripe
- ✅ **Job complete** - Customer gets email when hustler marks job complete (includes verification code)
- ✅ **Payment receipt** - Customer gets email after payment
- ✅ **Payment released** - Hustler gets email when payment is released
- ✅ **Payout sent** - Hustler gets email when payout is processed
- ✅ **Refund processed** - Customer gets email when refund is issued

### Messaging Emails
- ✅ **New message** - Recipient gets email when they receive a new message (includes message preview and link)

### Feedback
- ✅ **Feedback email** - Sent to `team.hustlapp@outlook.com` (or `FEEDBACK_EMAIL`) when users submit feedback

## Testing Emails

1. **Add the API key to `.env`**:
   ```env
   RESEND_API_KEY=re_your_key_here
   ```

2. **Restart your server**:
   ```bash
   npm start
   ```

3. **Test by**:
   - Creating a new account (should send welcome email)
   - Submitting feedback (should send to team.hustlapp@outlook.com)
   - Having a hustler apply to a job (customer should get email)

## Troubleshooting

### Emails not sending?
- ✅ Check that `RESEND_API_KEY` is set in `.env`
- ✅ Restart the server after adding the key
- ✅ Check server logs for email errors
- ✅ Verify your Resend account is active

### "Invalid API key" error?
- ✅ Make sure the key starts with `re_`
- ✅ Check for extra spaces in `.env` file
- ✅ Verify the key is active in Resend dashboard

### Emails going to spam?
- ✅ Verify your domain in Resend
- ✅ Use a verified domain in `FROM_EMAIL`
- ✅ Add SPF/DKIM records (Resend will guide you)

## Current Status

**Right now**: Emails are configured in code but won't send until `RESEND_API_KEY` is added to `.env`.

**After setup**: All emails will work automatically! 🎉


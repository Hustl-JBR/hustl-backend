# Email System - Final Setup Steps ✅

## ✅ What's Already Done

- ✅ Email verification fields added to User model
- ✅ Migration file created
- ✅ Email verification routes already built
- ✅ All email templates built
- ✅ Resend API key already set in Railway

---

## 🚀 **Action Items for You:**

### **Step 1: Run Migration (Required for Email Verification)**

**Run this to add email verification fields to the database:**

```bash
# Generate Prisma client with new fields
npx prisma generate

# Run migration (adds email_verified, email_verification_code, email_verification_expiry)
npx prisma migrate dev --name add_email_verification_fields
```

**For production (Railway):**
```bash
npx prisma generate
npx prisma migrate deploy
```

---

### **Step 2: Set FROM_EMAIL in Railway (Recommended)**

**This sets the sender name/email for all emails:**

1. Go to Railway dashboard → Your project → Variables
2. Click "+ New Variable"
3. Add:
   ```
   Variable Name: FROM_EMAIL
   Value: Hustl <noreply@hustl.app>
   ```
4. Click "Add"

**Options:**

**Option A: Use Resend's default (testing)**
```
FROM_EMAIL=Hustl <onboarding@resend.dev>
```
- ✅ No domain setup needed
- ✅ Works immediately
- ⚠️ Emails come from `onboarding@resend.dev`

**Option B: Use your custom domain (production)**
```
FROM_EMAIL=Hustl <noreply@yourdomain.com>
```
- ✅ Professional branding
- ✅ Better deliverability
- ⚠️ Need to verify domain in Resend first

**To verify your domain:**
1. Go to Resend dashboard → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `hustl.app`)
4. Add DNS records they provide (SPF, DKIM, DMARC)
5. Wait for verification (5-10 minutes)
6. Then set `FROM_EMAIL=Hustl <noreply@yourdomain.com>`

---

## ✅ **What Will Work After Setup:**

### **Email Verification Flow:**
1. User signs up → Gets welcome email + verification email with 6-digit code ✅
2. User enters code → `POST /auth/verify-email` verifies email ✅
3. User can resend code → `POST /auth/resend-verification` sends new code ✅
4. Verified users → Can post jobs, apply to jobs, etc. ✅

### **All Email Notifications:**
- ✅ Welcome/Signup email
- ✅ Email verification (6-digit code)
- ✅ New message notifications
- ✅ Offer received ("New offer on [job title]")
- ✅ Job assigned ("🎉 You were picked for [job title]")
- ✅ Job complete ("[Job title] marked as complete")
- ✅ Payment released ("Payment released for [job title]")
- ✅ Refund processed ("Refund processed for [job title]")
- ✅ Admin notifications

---

## 🧪 **Test After Setup:**

1. **Sign up a new user:**
   - Should receive 2 emails: welcome + verification (with 6-digit code)
   - Check inbox (and spam folder)

2. **Verify email:**
   - Use code from verification email
   - Send `POST /auth/verify-email` with `{ "code": "123456", "email": "user@example.com" }`
   - Should return success

3. **Send a message:**
   - Recipient should get email notification
   - Check Railway logs for email sending status

---

## 📋 **Checklist:**

- [ ] Run migration: `npx prisma generate && npx prisma migrate dev --name add_email_verification_fields`
- [ ] Add `FROM_EMAIL` to Railway (recommended)
- [ ] (Optional) Verify domain in Resend for custom FROM_EMAIL
- [ ] Test: Sign up a new user and check for emails
- [ ] Test: Verify email with code from email
- [ ] Test: Send a message and check recipient gets email

---

## 🎯 **Summary:**

**What you need to do:**
1. ✅ Run the migration (5 minutes)
2. ✅ Set `FROM_EMAIL` in Railway (2 minutes)

**What's already done:**
- ✅ Email verification fields added to schema
- ✅ Migration file created
- ✅ Email verification routes built
- ✅ All email templates built
- ✅ Resend API key already set

**After setup:**
- ✅ All emails will send automatically
- ✅ Email verification will work fully
- ✅ Professional email branding (if domain verified)

---

**Everything is ready - just run the migration and set FROM_EMAIL!** 🚀


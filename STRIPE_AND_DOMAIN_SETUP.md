# Stripe & Domain Setup Guide 💳🌐

## ✅ Railway Domain is REAL and Works!

**Yes!** The Railway domain (`https://your-app.railway.app`) is:
- ✅ **100% real and functional**
- ✅ **Free forever**
- ✅ **Works with Stripe**
- ✅ **Has SSL (https) automatically**
- ✅ **Can be used in production**

**You DON'T need to buy a domain to:**
- Start using Stripe
- Go live with users
- Accept payments
- Send emails

**You CAN buy a custom domain for:**
- Better branding (e.g., `hustl.app` vs `hustl-backend.railway.app`)
- Shorter, easier to remember URL
- More professional look
- But it's **optional** - not required!

---

## 🎯 Should You Buy a Domain Before Stripe?

### Short Answer: **No, you can start with Railway domain!**

### Here's Why:

**Railway Domain Works Fine:**
- Stripe accepts any valid domain
- Users can pay on Railway domain
- Everything works the same
- You can add custom domain later

**When to Buy Custom Domain:**
- Before marketing/launch (looks more professional)
- When you're ready to brand properly
- When you want shorter URL
- But **not required** to start Stripe!

**Recommendation:**
1. ✅ **Start Stripe with Railway domain** (get it working first)
2. ✅ **Test payments** (make sure everything works)
3. ✅ **Buy custom domain later** (when ready to launch)
4. ✅ **Switch domain** (easy - just update DNS)

---

## 💳 How Stripe Works (Payment Flow)

### Step-by-Step Payment Process:

#### 1. **Customer Posts Job**
- Customer creates job on your site
- Sets price (e.g., $100)

#### 2. **Hustler Applies & Gets Accepted**
- Hustler applies for job
- Customer accepts offer
- Job status: "ASSIGNED"

#### 3. **Customer Pays (Stripe Checkout)**
- Customer clicks "Pay Now" button
- **Stripe redirects to:** `https://checkout.stripe.com/...`
  - This is Stripe's secure payment page
  - Customer enters card info there
  - Stripe handles all payment security
- **After payment:**
  - Stripe redirects back to your site
  - URL: `https://your-app.railway.app/success` (or similar)
  - Payment is held in escrow

#### 4. **Job Completion**
- Hustler completes job
- Customer confirms with 6-digit code
- **Stripe releases payment** to hustler
- Hustler gets paid (minus your 16% fee)

### Important Points:

**Stripe Redirects:**
- ✅ **Normal and secure** - Stripe handles payment page
- ✅ **Your domain** - Stripe redirects back to your site after payment
- ✅ **Secure** - Customer never enters card on your site
- ✅ **PCI compliant** - Stripe handles all card data

**What Users See:**
1. Click "Pay" on your site (`your-app.railway.app`)
2. Redirected to Stripe checkout (`checkout.stripe.com`)
3. Enter payment info on Stripe's secure page
4. Redirected back to your site (`your-app.railway.app/success`)

**This is how ALL payment systems work** - it's secure and standard!

---

## 📧 Email & Notification Setup

### Current Status:

**Emails Already Set Up:**
- ✅ Email service: Resend
- ✅ Email templates: Created
- ✅ Email functions: Working

**What Emails Are Sent:**

1. **Welcome Email** (when user signs up)
2. **Job Posted** (confirmation to customer)
3. **Offer Received** (customer gets email when hustler applies)
4. **Offer Accepted** (hustler gets email when accepted)
5. **Job Started** (customer gets email when hustler starts)
6. **Job Completed** (customer gets email when hustler marks complete)
7. **Payment Released** (hustler gets email when paid)
8. **New Message** (user gets email when they receive message)
9. **Review Request** (after job completion)

### Where Emails Go:

**To Users:**
- Emails go to **user's email address** (the one they signed up with)
- Each user gets emails about their jobs/messages

**To You (Admin):**
- **Feedback emails** go to: `team.hustlapp@outlook.com`
- **Error notifications** (if you set them up)
- **Admin dashboard** (if you build one)

### Setting Up Email Notifications:

#### 1. **Resend Setup** (Already Done)
- ✅ Resend API key in Railway variables
- ✅ Email templates created
- ✅ Functions ready

#### 2. **Test Emails:**
```javascript
// Test by:
1. Sign up a new account
2. Post a job
3. Check email inbox
4. Should receive welcome email
```

#### 3. **Update Email Addresses:**
In `services/email.js`:
- `FROM_EMAIL` - Who emails come from
- `FEEDBACK_EMAIL` - Where feedback goes

In Railway variables:
- `RESEND_API_KEY` - Your Resend API key
- `FROM_EMAIL` - e.g., `Hustl <noreply@yourdomain.com>`

---

## 🔔 In-App Notifications

### Current Features:

**Unread Message Badge:**
- ✅ Shows count on Messages tab
- ✅ Updates automatically
- ✅ Shows "New message" on conversations

**Email Notifications:**
- ✅ Sent when you receive message
- ✅ Sent for job updates
- ✅ Sent for payment updates

**Future (Can Add):**
- In-app notification center
- Push notifications (browser)
- Email digest (daily summary)

---

## 🚀 Recommended Setup Order

### Phase 1: Get Stripe Working (Now)
1. ✅ Use Railway domain (`your-app.railway.app`)
2. ✅ Set up Stripe test mode
3. ✅ Test payment flow
4. ✅ Verify redirects work
5. ✅ Test with real small payment

### Phase 2: Custom Domain (Optional - Later)
1. Buy domain (e.g., `hustl.app`)
2. Connect to Railway
3. Update `APP_BASE_URL` in Railway
4. Update Stripe redirect URLs
5. Test again

### Phase 3: Go Live
1. Switch Stripe to live mode
2. Update Stripe keys in Railway
3. Start accepting real payments
4. Monitor closely

---

## 📋 Stripe Setup Checklist

### Before Starting Stripe:

- [ ] Railway domain working (`your-app.railway.app`)
- [ ] App deployed and accessible
- [ ] Can sign up/log in
- [ ] Can post jobs
- [ ] Database connected

### Stripe Test Mode:

- [ ] Stripe account created
- [ ] Test API keys added to Railway
- [ ] `STRIPE_SECRET_KEY` set (test key)
- [ ] `STRIPE_PUBLISHABLE_KEY` set (test key)
- [ ] Webhook endpoint set up
- [ ] Test payment works
- [ ] Redirects back to your site

### Stripe Live Mode (When Ready):

- [ ] Stripe account verified
- [ ] Bank account added
- [ ] Live API keys added to Railway
- [ ] Webhook updated for live mode
- [ ] Test with small real payment
- [ ] Monitor for issues

---

## 🔗 Stripe Redirect URLs

### What You Need to Set:

**In Stripe Dashboard:**
1. Go to Settings → Checkout
2. Set redirect URLs:
   - Success: `https://your-app.railway.app/success`
   - Cancel: `https://your-app.railway.app/cancel`

**In Your Code:**
- Already set up in `routes/payments.js`
- Uses `APP_BASE_URL` from environment variables
- Automatically uses your Railway domain

**When You Get Custom Domain:**
- Just update `APP_BASE_URL` in Railway
- Update Stripe redirect URLs
- Everything else stays the same

---

## 📧 Email Setup Checklist

### Resend Configuration:

- [ ] Resend account created
- [ ] `RESEND_API_KEY` in Railway variables
- [ ] `FROM_EMAIL` set (e.g., `Hustl <noreply@yourdomain.com>`)
- [ ] Domain verified in Resend (if using custom domain)
- [ ] Test email sent successfully

### Email Testing:

- [ ] Sign up → receive welcome email
- [ ] Post job → receive confirmation
- [ ] Receive message → get notification email
- [ ] Complete job → get completion email
- [ ] Submit feedback → goes to your email

---

## 🎯 Quick Answers

### Q: Do I need to buy a domain for Stripe?
**A:** No! Railway domain works perfectly. Buy custom domain later for branding.

### Q: Will Stripe take users to different site?
**A:** Yes, temporarily. Stripe checkout is on `checkout.stripe.com` (secure), then redirects back to your site. This is normal and secure.

### Q: Where do emails go?
**A:** 
- User emails → User's email address (who signed up)
- Feedback emails → `team.hustlapp@outlook.com` (your email)
- All emails sent via Resend

### Q: Do notifications work?
**A:** 
- ✅ Email notifications: Yes (via Resend)
- ✅ In-app badge: Yes (unread messages)
- ✅ Future: Can add push notifications

### Q: When should I buy custom domain?
**A:** 
- Before public launch (looks professional)
- After Stripe is working (test first)
- When ready to brand properly
- Not urgent - Railway domain works fine!

---

## ✅ Action Items

### Right Now:
1. ✅ **Use Railway domain** for Stripe setup
2. ✅ **Test Stripe** in test mode
3. ✅ **Verify emails** are sending
4. ✅ **Test payment flow** end-to-end

### This Week:
5. ✅ **Buy custom domain** (optional but recommended)
6. ✅ **Connect domain** to Railway
7. ✅ **Update Stripe** redirect URLs
8. ✅ **Test again** with custom domain

### When Ready:
9. ✅ **Switch Stripe** to live mode
10. ✅ **Start accepting** real payments
11. ✅ **Monitor** closely
12. ✅ **Launch!** 🚀

---

## 🎉 Summary

**Railway Domain:**
- ✅ Real, free, works perfectly
- ✅ Can use for Stripe
- ✅ No purchase needed
- ✅ Custom domain is optional

**Stripe:**
- ✅ Works with Railway domain
- ✅ Redirects are normal/secure
- ✅ Can add custom domain later
- ✅ Start testing now!

**Emails:**
- ✅ Already set up
- ✅ Go to user emails
- ✅ Feedback to your email
- ✅ Test to verify

**You're ready to start Stripe with Railway domain!** 🚀



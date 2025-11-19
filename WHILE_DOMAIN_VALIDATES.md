# ⏳ While Domain Validates - What to Do Next

**Railway is validating your domain ownership...** (takes 5-60 minutes)

**Here's what to do while you wait:**

---

## ✅ Priority 1: Get EIN (5 minutes, FREE)

**You need this for LLC filing and bank account!**

1. **Go to:** https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-ein-online

2. **Click:** "Apply Online Now"

3. **Fill out form:**
   - Select: "Limited Liability Company"
   - Select: "Domestic" (Tennessee)
   - Business Name: "Hustl Jobs LLC" (or "Hustl Marketplace LLC")
   - Business Address: Your address
   - Your Name: Your name
   - SSN: Your Social Security Number
   - Business Purpose: "Marketplace platform connecting service providers with customers"

4. **Submit** → Get EIN instantly! ✅

5. **Save the confirmation letter (PDF)** - you'll need it!

**Time:** 5 minutes  
**Cost:** FREE ✅  
**Why:** Needed for LLC, bank account, Stripe

**See:** Full guide in `FORM_LLC_TENNESSEE.md`

---

## ✅ Priority 2: Prepare LLC Filing ($50)

**While waiting, gather information for LLC filing:**

### Information You Need:

1. **Business Name:** "Hustl Jobs LLC" (or your preference)
   - Check availability: https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx
   - Search for exact name: "Hustl Jobs LLC"

2. **Business Address:**
   - Can use your home address
   - Need: Street, City, State (TN), ZIP

3. **Registered Agent:**
   - Can be you!
   - Name: Your name
   - Address: Your address
   - Phone: Your phone

4. **Member Information:**
   - Your name
   - Your address

5. **Business Website:**
   - `https://hustljobs.com` ✅ (once domain is validated)

6. **EIN:**
   - Get from Priority 1 above ✅

**Once domain is validated and EIN is received:**
- File LLC online at: https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx
- Cost: $50 (one-time)

**See:** Full guide in `FORM_LLC_TENNESSEE.md`

---

## ✅ Priority 3: Check Domain Status

**Every 10-15 minutes, check:**

1. **Railway Dashboard:**
   - Settings → Domains
   - Look for domain status
   - "Pending" → Still validating
   - "Active" → ✅ Ready!

2. **Test DNS:**
   - Go to: https://dnschecker.org
   - Enter: `hustljobs.com`
   - Should show pointing to Railway

3. **Try accessing:**
   - Go to: `https://hustljobs.com`
   - If it loads → ✅ Done!
   - If not → Wait longer

**Usually takes:** 5-60 minutes

---

## ✅ Priority 4: Update Railway Variables (Once Domain is Active)

**After domain validates and is active:**

1. **Railway Dashboard** → Your Project → **Variables** tab

2. **Find or create:** `APP_BASE_URL`

3. **Set to:**
   ```
   https://hustljobs.com
   ```

4. **Also check/update:**
   - `FRONTEND_BASE_URL=https://hustljobs.com`
   - Any other URL variables

5. **Save changes**

**This ensures:**
- Email links use your domain
- Redirects use your domain
- API calls use your domain

---

## ✅ Priority 5: Update Stripe Webhooks (If Using Stripe)

**After domain is active:**

1. **Stripe Dashboard:**
   - https://dashboard.stripe.com
   - Developers → Webhooks

2. **If you have webhooks:**
   - Update URL to: `https://hustljobs.com/webhooks/stripe`

3. **If you don't have webhooks yet:**
   - You can set them up later
   - Not critical for now

---

## ✅ Priority 6: Test Domain (Once Active)

**Once Railway shows domain as "Active":**

1. **Go to:** `https://hustljobs.com`
2. **Check:**
   - Homepage loads ✅
   - SSL certificate active (lock icon) ✅
   - Can sign up ✅
   - Can log in ✅
   - All features work ✅

**If not working:**
- Check DNS: https://dnschecker.org
- Wait longer (up to 24 hours)
- Check Railway dashboard for errors

---

## 📋 Quick Action Plan (While Waiting)

**Do These Now (While Domain Validates):**

1. ✅ **Get EIN** (5 minutes, FREE)
   - https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-ein-online
   - Get instant EIN number
   - Save confirmation letter

2. ✅ **Gather LLC Info** (10 minutes)
   - Business name: "Hustl Jobs LLC"
   - Check name availability
   - Gather addresses, phone numbers

3. ✅ **Check Domain Status** (every 10-15 minutes)
   - Railway dashboard → Settings → Domains
   - Look for "Active" status

**After Domain is Active:**

4. ✅ **Update Railway Variables** (2 minutes)
   - Set `APP_BASE_URL=https://hustljobs.com`

5. ✅ **Test Domain** (5 minutes)
   - Go to https://hustljobs.com
   - Test all features

6. ✅ **File LLC** (15 minutes, $50)
   - Use domain in LLC filing
   - Use EIN you just got

---

## 🎯 Recommended Order

**While Domain Validates (30-60 minutes):**

1. **Get EIN** - 5 minutes, FREE ✅
2. **Prepare LLC info** - 10 minutes
3. **Check domain status** - every 10-15 minutes

**After Domain is Active:**

4. **Update Railway variables** - 2 minutes
5. **Test domain** - 5 minutes
6. **File LLC** - 15 minutes, $50

**Total Time:** ~1-2 hours
**Total Cost:** $50 (EIN is free!)

---

## 💡 Pro Tips

1. **Don't Wait Idle:**
   - Get EIN while domain validates (saves time!)
   - Prepare LLC info while waiting
   - Multi-task!

2. **Check Domain Regularly:**
   - Usually ready in 5-60 minutes
   - Check Railway dashboard every 15 minutes
   - Don't wait too long!

3. **Get EIN First:**
   - You need it for LLC filing anyway
   - Only takes 5 minutes
   - FREE!
   - Instant online

4. **Prepare LLC Info:**
   - Gather all info while waiting
   - Makes filing faster later
   - Check name availability now

---

## ✅ Quick Checklist

**While Domain Validates:**
- [ ] Get EIN from IRS (5 min, FREE)
- [ ] Save EIN confirmation letter (PDF)
- [ ] Check LLC name availability ("Hustl Jobs LLC")
- [ ] Gather LLC filing info (addresses, phone, etc.)
- [ ] Check domain status in Railway (every 10-15 min)

**After Domain is Active:**
- [ ] Update `APP_BASE_URL` in Railway variables
- [ ] Test domain: https://hustljobs.com
- [ ] Verify SSL certificate (lock icon)
- [ ] File LLC using domain and EIN
- [ ] Update Stripe webhooks (if using)

---

## 🚀 Summary

**While waiting for domain (30-60 minutes):**

1. ✅ **Get EIN** (5 min, FREE) - Do this now!
2. ✅ **Prepare LLC info** (10 min)
3. ✅ **Check domain status** (every 15 min)

**After domain is active:**

4. ✅ **Update Railway variables** (2 min)
5. ✅ **Test domain** (5 min)
6. ✅ **File LLC** (15 min, $50)

**Most Important:** Get your EIN now while waiting! It's free and only takes 5 minutes! 🎉

---

**Start with getting your EIN - it's free and instant! ⚡**


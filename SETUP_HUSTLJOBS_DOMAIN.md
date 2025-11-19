# 🌐 Setup hustljobs.com Domain - Step-by-Step Guide

**You have:** `hustljobs.com` domain purchased ✅  
**You need:** Connect it to Railway and configure everything

---

## 📋 Quick Checklist

- [ ] Connect domain to Railway (DNS setup)
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Update Railway environment variables
- [ ] Update Stripe webhooks (if using)
- [ ] Test domain works
- [ ] Use domain in LLC filing

---

## 🔗 Step 1: Connect Domain to Railway

### In Railway:

1. **Go to Railway Dashboard**
   - https://railway.app
   - Click on your project
   - Click **"Settings"** tab

2. **Click "Domains"** (left sidebar)

3. **Scroll to "Custom Domain" section**

4. **Click "Custom Domain" button**

5. **Enter domain:**
   ```
   hustljobs.com
   ```
   - Don't include `http://` or `https://`
   - Just: `hustljobs.com`

6. **Click "Add" or "Update"**

7. **Railway will show you DNS records**
   - Usually a **CNAME** record
   - Copy this information!
   - Example:
     ```
     Type: CNAME
     Name: @
     Value: hustl-production.up.railway.app
     ```

**✅ Save this DNS information - you'll need it in Step 2!**

---

## ⚙️ Step 2: Add DNS Records in Domain Registrar

**Go to wherever you bought hustljobs.com** (Namecheap, GoDaddy, Cloudflare, etc.)

### If Using Namecheap:

1. **Login to Namecheap**
   - https://namecheap.com
   - Click **"Account"** → **"Domain List"**

2. **Click on "hustljobs.com"**

3. **Click "Advanced DNS" tab**

4. **Scroll to "Host Records" section**

5. **Click "Add New Record"**

6. **Add CNAME Record:**
   - **Type:** `CNAME Record`
   - **Host:** `@` (this means root domain - hustljobs.com)
   - **Value:** `hustl-production.up.railway.app` (your Railway domain)
   - **TTL:** `Automatic` (or 3600)

7. **Optional: Add www subdomain**
   - **Type:** `CNAME Record`
   - **Host:** `www`
   - **Value:** `hustl-production.up.railway.app`
   - **TTL:** `Automatic`

8. **Click "Save" or "Add Record"**

**✅ DNS records added!**

---

### If Using GoDaddy:

1. **Login to GoDaddy**
2. **Go to:** My Products → Domains → hustljobs.com
3. **Click "DNS"**
4. **Click "Add"**
5. **Add:**
   - **Type:** `CNAME`
   - **Name:** `@` (or leave blank)
   - **Value:** `hustl-production.up.railway.app`
   - **TTL:** `600` (or 1 hour)
6. **Click "Save"**

---

### If Using Cloudflare:

1. **Login to Cloudflare**
2. **Select hustljobs.com domain**
3. **Go to "DNS" tab**
4. **Click "Add record"**
5. **Add:**
   - **Type:** `CNAME`
   - **Name:** `@` (or root)
   - **Target:** `hustl-production.up.railway.app`
   - **Proxy status:** Can leave on (orange cloud) or turn off (gray cloud)
6. **Click "Save"**

---

### If Using Google Domains:

1. **Login to Google Domains**
2. **Click on hustljobs.com**
3. **Go to "DNS" tab**
4. **Scroll to "Custom resource records"**
5. **Add:**
   - **Name:** `@`
   - **Type:** `CNAME`
   - **Data:** `hustl-production.up.railway.app`
6. **Click "Add"**

---

## ⏳ Step 3: Wait for DNS Propagation (5-60 minutes)

**After adding DNS records:**

1. **Wait 5-60 minutes** (can take up to 24 hours, but usually faster)
2. **Check Railway Dashboard:**
   - Railway → Settings → Domains
   - Should show domain status
   - "Pending" → Waiting for DNS
   - "Active" → ✅ Ready!

3. **Check DNS Propagation:**
   - Go to: https://dnschecker.org
   - Enter: `hustljobs.com`
   - Should show pointing to Railway

**Railway Will Automatically:**
- ✅ Request SSL certificate (Let's Encrypt - free)
- ✅ Set up HTTPS for your domain
- ✅ Usually ready in 5-10 minutes after DNS propagates

---

## 🔧 Step 4: Update Railway Environment Variables

**Once DNS propagates:**

1. **Go to Railway Dashboard**
   - Your Project → **"Variables"** tab

2. **Find or create `APP_BASE_URL`:**
   ```
   APP_BASE_URL=https://hustljobs.com
   ```

3. **Also check/update:**
   - `FRONTEND_BASE_URL=https://hustljobs.com`
   - Any other URL variables

4. **Save changes**

**This ensures:**
- Email links use your domain
- Redirects use your domain  
- API calls use your domain

---

## 🔗 Step 5: Update Stripe Webhooks (If Using Stripe)

**If you have Stripe webhooks configured:**

1. **Go to Stripe Dashboard**
   - https://dashboard.stripe.com
   - Developers → Webhooks

2. **Click on your webhook endpoint** (if you have one)

3. **Update URL to:**
   ```
   https://hustljobs.com/webhooks/stripe
   ```

4. **Click "Save"**

**If you don't have webhooks yet:**
- You can set them up later when needed
- Not critical for now

---

## ✅ Step 6: Test Domain Works

**Once DNS propagates (5-60 minutes):**

1. **Go to:** `https://hustljobs.com`
2. **Should show:** Your Hustl app! ✅
3. **Check:** SSL certificate active (lock icon in browser)
4. **Test:**
   - Homepage loads
   - Can sign up
   - Can log in
   - All features work

**If Not Working:**
- Check DNS propagation: https://dnschecker.org
- Check Railway dashboard for errors
- Wait longer (up to 24 hours)
- Verify DNS records are correct

---

## 🏢 Step 7: Use Domain in LLC Filing

**Now that you have the domain, use it in your LLC filing:**

**In Tennessee LLC filing:**
- **Business Name:** "Hustl Jobs LLC" (or "Hustl Marketplace LLC")
- **Business Website:** `https://hustljobs.com`
- **Business Email:** `contact@hustljobs.com` (if you set it up)

**This makes your LLC filing more professional!**

---

## 📋 Complete Checklist

**Domain Setup:**
- [ ] Connected domain in Railway (Settings → Domains → Custom Domain)
- [ ] Added DNS records in domain registrar (CNAME to hustl-production.up.railway.app)
- [ ] Waited for DNS propagation (5-60 minutes)
- [ ] Verified domain works: https://hustljobs.com
- [ ] SSL certificate active (lock icon)
- [ ] Updated `APP_BASE_URL` in Railway variables
- [ ] Updated Stripe webhooks (if using)
- [ ] Tested all features on custom domain

**Next Steps:**
- [ ] Use domain in LLC filing
- [ ] Set up business email (contact@hustljobs.com) - optional
- [ ] Update Terms/Privacy pages with domain

---

## 🎯 What You'll Have

**After Setup:**
- ✅ `hustljobs.com` → Your app (custom domain)
- ✅ `www.hustljobs.com` → Your app (if you added www CNAME)
- ✅ `hustl-production.up.railway.app` → Still works (backup)
- ✅ SSL certificate (HTTPS) on all domains
- ✅ Professional domain for your business

---

## 🆘 Troubleshooting

### Domain Not Working?

**Check:**
1. DNS records are correct (CNAME to hustl-production.up.railway.app)
2. DNS propagated (use https://dnschecker.org)
3. Railway dashboard shows domain status
4. Wait longer (up to 24 hours)

### SSL Not Working?

**Railway handles this automatically:**
- Wait 10-15 minutes after DNS propagates
- Check Railway dashboard for SSL status
- Verify DNS is correct

### Mixed Content Warnings?

**Check:**
- All URLs use `https://` (not `http://`)
- Environment variables use `https://hustljobs.com`
- No hardcoded URLs in code

---

## 📞 Need Help?

**Railway Support:**
- Docs: https://docs.railway.app/domains
- Support: https://railway.app/contact

**DNS Checkers:**
- https://dnschecker.org
- https://www.whatsmydns.net

---

## 🚀 Quick Summary

**What to Do Now:**

1. **Railway:** Add custom domain `hustljobs.com`
2. **Domain Registrar:** Add CNAME record pointing to `hustl-production.up.railway.app`
3. **Wait:** 5-60 minutes for DNS
4. **Railway:** Update `APP_BASE_URL` to `https://hustljobs.com`
5. **Test:** Visit `https://hustljobs.com` ✅

**Time:** ~1 hour (mostly waiting)  
**Result:** Professional domain connected! 🎉

---

**You're almost there! Just add DNS records and wait! 🌐✨**


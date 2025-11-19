# 🌐 Connect Custom Domain to Railway - Step-by-Step

**You already have:** `hustl-production.up.railway.app` ✅  
**You need:** Custom domain (e.g., `hustl.app`) connected to Railway

---

## 🎯 What You're Looking At

**In Railway → Settings → Domains:**

- **Public Domain:** `hustl-production.up.railway.app` ✅ (this works, but not professional)
- **Port:** 8080 ✅ (correct)
- **Custom Domain:** (empty - we'll add this)

**What to Do:**
1. Buy domain first (see `BUY_DOMAIN_FIRST.md`)
2. Add custom domain in Railway
3. Set up DNS records in domain registrar
4. Wait for DNS to propagate
5. ✅ Your domain works!

---

## 📝 Step 1: Buy Domain First (If You Haven't)

**Before connecting, you need to own a domain!**

1. **Go to Namecheap:** https://namecheap.com
2. **Search for:** `hustl.app` (or `gethustl.com`, `hustlapp.com`)
3. **Buy it:** ~$12-20/year
4. **Save login info** - you'll need it!

**See:** `BUY_DOMAIN_FIRST.md` for detailed guide

---

## 🔗 Step 2: Add Custom Domain in Railway

**In Railway Dashboard:**

1. **Go to:** Railway → Your Project → **Settings** tab
2. **Click:** **"Domains"** (left sidebar)
3. **Scroll down** to "Custom Domain" section
4. **Click:** **"Custom Domain"** button
5. **Enter your domain:** 
   - Type: `hustl.app` (or whatever you bought)
   - **Don't include** `http://` or `https://`
   - Just the domain name: `hustl.app`
6. **Click:** **"Add"** or **"Update"**

**Railway Will Show:**
- DNS records you need to add
- Usually a **CNAME** record
- Or an **A** record (if Railway gives you IP)

**Example DNS Record Railway Shows:**
```
Type: CNAME
Name: @
Value: hustl-production.up.railway.app
TTL: Automatic
```

**✅ Save this information!** You'll need it for Step 3.

---

## ⚙️ Step 3: Add DNS Records in Domain Registrar

**Go to your domain registrar** (Namecheap, Cloudflare, Google Domains, etc.)

### If Using Namecheap:

1. **Login to Namecheap**
2. **Go to:** Dashboard → Domain List → Click on your domain
3. **Click:** **"Advanced DNS"** tab
4. **Find:** "Host Records" section
5. **Click:** **"Add New Record"**

**Add CNAME Record:**
- **Type:** `CNAME Record`
- **Host:** `@` (or leave blank, or `www` if you want www.hustl.app)
- **Value:** `hustl-production.up.railway.app` (Railway's default domain)
- **TTL:** `Automatic` (or 3600)

**OR if Railway gives you A Record:**
- **Type:** `A Record`
- **Host:** `@`
- **Value:** `[IP Address from Railway]` (if Railway provides one)
- **TTL:** `Automatic`

6. **Click:** **"Save"** or **"Add Record"**

**If You Want Both `hustl.app` AND `www.hustl.app`:**

Add **TWO** records:
1. **CNAME** for `@` (root domain)
2. **CNAME** for `www` (www subdomain)

Both pointing to: `hustl-production.up.railway.app`

---

### If Using Cloudflare:

1. **Login to Cloudflare**
2. **Select your domain**
3. **Go to:** **"DNS"** tab
4. **Click:** **"Add record"**
5. **Add:**
   - **Type:** `CNAME`
   - **Name:** `@` (or `www`)
   - **Target:** `hustl-production.up.railway.app`
   - **Proxy:** Can leave on (orange cloud) or turn off (gray cloud)
6. **Click:** **"Save"**

---

### If Using Google Domains:

1. **Login to Google Domains**
2. **Click on your domain**
3. **Go to:** **"DNS"** tab
4. **Scroll to:** "Custom resource records"
5. **Add:**
   - **Name:** `@` (or `www`)
   - **Type:** `CNAME`
   - **Data:** `hustl-production.up.railway.app`
6. **Click:** **"Add"**

---

## ⏳ Step 4: Wait for DNS Propagation (5-60 minutes)

**After adding DNS records:**

1. **Wait:** DNS changes can take 5-60 minutes (sometimes up to 24 hours)
2. **Check Railway:** Railway dashboard will show status
   - Shows "Pending" while DNS propagates
   - Shows "Active" when ready ✅
3. **Check DNS:** Use https://dnschecker.org
   - Enter your domain: `hustl.app`
   - Should show pointing to Railway

**Railway Will Automatically:**
- Request SSL certificate (Let's Encrypt - free)
- Set up HTTPS for your domain
- Usually ready in 5-10 minutes after DNS propagates

---

## ✅ Step 5: Verify It Works

**Once DNS propagates (5-60 minutes):**

1. **Go to:** `https://hustl.app` (or your domain)
2. **Should show:** Your Hustl app!
3. **Check:** SSL certificate (lock icon in browser)
4. **Test:** All features work

**If Not Working:**
- Check DNS propagation: https://dnschecker.org
- Check Railway dashboard for errors
- Verify DNS records are correct
- Wait longer (up to 24 hours, but usually faster)

---

## 🔧 Step 6: Update Environment Variables

**In Railway:**

1. **Go to:** Railway → Your Project → **Variables** tab
2. **Find:** `APP_BASE_URL` (or create it)
3. **Update to:**
   ```
   APP_BASE_URL=https://hustl.app
   ```
   (Replace with your actual domain)

4. **Also check:**
   - `FRONTEND_BASE_URL` - update to your domain
   - Any other URLs in variables

**This ensures:**
- Email links use your domain
- Redirects use your domain
- API calls use your domain

---

## 🎯 Step 7: Update Stripe Webhooks (If Using)

**If you have Stripe webhooks:**

1. **Go to:** Stripe Dashboard → Developers → Webhooks
2. **Click:** Your webhook endpoint
3. **Update URL to:**
   ```
   https://hustl.app/webhooks/stripe
   ```
   (Replace with your actual domain)

4. **Click:** **"Save"**

**This ensures Stripe webhooks use your custom domain!**

---

## 📋 Quick Checklist

**Before Connecting:**
- [ ] Domain purchased (Namecheap, etc.)
- [ ] Domain login info saved
- [ ] Railway app is deployed and working

**Connecting Domain:**
- [ ] Added custom domain in Railway (Settings → Domains)
- [ ] Got DNS records from Railway
- [ ] Added DNS records in domain registrar
- [ ] Saved DNS records

**After Connecting:**
- [ ] Waited 5-60 minutes for DNS propagation
- [ ] Verified domain works: `https://hustl.app`
- [ ] SSL certificate active (lock icon in browser)
- [ ] Updated `APP_BASE_URL` in Railway variables
- [ ] Updated Stripe webhooks (if using)
- [ ] Tested all features on custom domain

---

## 🆘 Troubleshooting

### Domain Not Working?

**Check DNS Records:**
- Make sure CNAME/A record is correct
- Value should be: `hustl-production.up.railway.app`
- TTL should be Automatic or 3600

**Check DNS Propagation:**
- Use: https://dnschecker.org
- Enter your domain
- Should show pointing to Railway IP

**Check Railway:**
- Railway dashboard → Domains
- Should show domain status
- Look for errors

**Wait Longer:**
- DNS can take up to 24 hours (but usually 5-60 minutes)
- Be patient!

---

### SSL Not Working?

**Railway Handles This Automatically:**
- Usually takes 5-10 minutes after DNS propagates
- Check Railway dashboard for SSL status
- Look for lock icon in browser

**If SSL Not Working:**
- Wait 10-15 minutes
- Check Railway logs for SSL errors
- Verify DNS is correct (SSL won't work if DNS is wrong)

---

### Mixed Content Warnings?

**Check for HTTP Links:**
- Make sure all URLs use `https://`
- No `http://` links in code
- Update environment variables to use `https://`

---

## 💡 Pro Tips

1. **Use Both Root and WWW:**
   - Add CNAME for `@` (hustl.app)
   - Add CNAME for `www` (www.hustl.app)
   - Both work!

2. **Keep Railway Domain:**
   - Keep `hustl-production.up.railway.app`
   - It still works as backup
   - Both domains work simultaneously

3. **SSL is Free:**
   - Railway automatically gets SSL certificate
   - Uses Let's Encrypt (free)
   - Auto-renews (no action needed)

4. **Test First:**
   - Test on Railway domain first
   - Then add custom domain
   - Both work at the same time!

---

## 🎯 What You'll Have

**After Setup:**

- ✅ `hustl.app` → Your app (custom domain)
- ✅ `www.hustl.app` → Your app (if you added www)
- ✅ `hustl-production.up.railway.app` → Still works (backup)
- ✅ SSL certificate (HTTPS) on all domains
- ✅ Professional domain for your business

**Cost:**
- Domain: ~$12-20/year
- SSL: FREE (Railway)
- DNS: FREE (included with domain)
- Total: ~$12-20/year

---

## 📞 Need Help?

**Railway Support:**
- Docs: https://docs.railway.app/domains
- Support: https://railway.app/contact

**DNS Checkers:**
- https://dnschecker.org
- https://www.whatsmydns.net

**Domain Registrars:**
- Namecheap: https://www.namecheap.com/support/
- Cloudflare: https://community.cloudflare.com
- Google Domains: https://support.google.com/domains

---

## 🚀 Ready to Connect?

**Your Railway Setup:**
- ✅ App is deployed: `hustl-production.up.railway.app`
- ✅ Port 8080 configured
- ✅ Ready for custom domain

**Next Steps:**
1. Buy domain (if you haven't)
2. Add custom domain in Railway
3. Add DNS records in domain registrar
4. Wait for DNS propagation
5. ✅ Your custom domain works!

**Time:** ~1 hour (mostly waiting for DNS)  
**Cost:** ~$12-20/year for domain  
**Result:** Professional domain! 🎉

---

**You're almost there! Just add DNS records and wait! 🌐✨**


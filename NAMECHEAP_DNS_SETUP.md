# 🌐 Connect hustljobs.com to Railway - Namecheap Instructions

**You have:** `hustljobs.com` at Namecheap ✅  
**You need:** Add DNS record to point to Railway (don't change nameservers!)

---

## ✅ Important: Don't Change Nameservers!

**You do NOT need to change nameservers!**

- Keep Namecheap's default nameservers
- Just add a DNS record in Advanced DNS
- Much easier and faster!

---

## 📝 Step-by-Step: Add DNS Record in Namecheap

### Step 1: Login to Namecheap

1. **Go to:** https://namecheap.com
2. **Click:** "Sign In" (top right)
3. **Enter:** Your login credentials
4. **Click:** "Sign In"

---

### Step 2: Go to Domain List

1. **From left sidebar:** Click **"Domain List"**
   - (Don't use "Nameservers" section - we're using Advanced DNS instead)

2. **Find:** `hustljobs.com` in your domain list

3. **Click:** **"Manage"** button (next to hustljobs.com)

---

### Step 3: Go to Advanced DNS Tab

1. **At the top of the page:** Click **"Advanced DNS"** tab
   - (Not "Nameservers" tab - we don't need to change those!)

2. **You'll see:** "Host Records" section

---

### Step 4: Add CNAME Record

1. **Scroll down** to "Host Records" section

2. **Click:** **"Add New Record"** button

3. **Select record type:**
   - Click dropdown, select **"CNAME Record"**

4. **Fill in the record:**
   - **Host:** `@` (this means the root domain - hustljobs.com)
     - Or you can leave it blank
     - Just `@` means it points hustljobs.com
   
   - **Value:** `hustl-production.up.railway.app`
     - This is your Railway app URL
     - Make sure it's exactly this!
   
   - **TTL:** `Automatic` (or `3600` - 1 hour)
     - Automatic is fine

5. **Click:** **"Save"** or green checkmark button

**✅ CNAME record added for hustljobs.com!**

---

### Step 5: Add www Record (Optional but Recommended)

**If you want www.hustljobs.com to work too:**

1. **Click:** **"Add New Record"** again

2. **Select:** **"CNAME Record"**

3. **Fill in:**
   - **Host:** `www` (type "www" exactly)
   - **Value:** `hustl-production.up.railway.app`
   - **TTL:** `Automatic`

4. **Click:** **"Save"**

**✅ Now both hustljobs.com and www.hustljobs.com will work!**

---

### Step 6: Verify Records Are Added

**Check your Host Records section:**

You should see:
```
Type: CNAME Record
Host: @
Value: hustl-production.up.railway.app
TTL: Automatic

Type: CNAME Record  
Host: www
Value: hustl-production.up.railway.app
TTL: Automatic
```

**If you see these records:** ✅ Perfect! You're done with Namecheap!

---

## 🔗 Step 7: Add Domain in Railway

**Now go to Railway:**

1. **Go to:** Railway Dashboard (https://railway.app)

2. **Click:** Your project

3. **Click:** **"Settings"** tab

4. **Click:** **"Domains"** (left sidebar)

5. **Scroll to:** "Custom Domain" section

6. **Click:** **"Custom Domain"** button

7. **Enter:** `hustljobs.com`
   - Just the domain name, no http:// or https://

8. **Click:** **"Add"**

**Railway will:**
- ✅ Verify your DNS record
- ✅ Request SSL certificate (free, automatic)
- ✅ Set up HTTPS

---

## ⏳ Step 8: Wait for DNS Propagation

**After adding DNS records:**

1. **Wait:** 5-60 minutes (usually faster)
   - Can take up to 24 hours, but usually 5-60 minutes

2. **Check Railway:**
   - Railway Dashboard → Settings → Domains
   - Should show domain status
   - "Pending" → Waiting
   - "Active" → ✅ Ready!

3. **Check DNS:**
   - Go to: https://dnschecker.org
   - Enter: `hustljobs.com`
   - Should show pointing to Railway

**Railway Will Automatically:**
- Get SSL certificate (Let's Encrypt - free)
- Set up HTTPS
- Usually ready in 5-10 minutes

---

## ✅ Step 9: Update Railway Environment Variables

**Once DNS propagates:**

1. **Railway Dashboard** → Your Project → **"Variables"** tab

2. **Find or create:** `APP_BASE_URL`

3. **Set to:**
   ```
   https://hustljobs.com
   ```

4. **Also check/update:**
   - `FRONTEND_BASE_URL=https://hustljobs.com`

5. **Save changes**

---

## ✅ Step 10: Test Your Domain

**Once DNS propagates (5-60 minutes):**

1. **Open browser**
2. **Go to:** `https://hustljobs.com`
3. **Should show:** Your Hustl app! ✅
4. **Check:** Lock icon in browser (SSL active)

**Test:**
- [ ] Homepage loads
- [ ] Can sign up
- [ ] Can log in
- [ ] All features work
- [ ] SSL certificate active (lock icon)

---

## 📋 Quick Checklist

**Namecheap:**
- [ ] Logged in to Namecheap
- [ ] Went to Domain List → Manage → hustljobs.com
- [ ] Clicked "Advanced DNS" tab
- [ ] Added CNAME record: `@` → `hustl-production.up.railway.app`
- [ ] Added CNAME record: `www` → `hustl-production.up.railway.app` (optional)
- [ ] Saved records

**Railway:**
- [ ] Added custom domain `hustljobs.com` in Railway
- [ ] Waited for DNS propagation (5-60 minutes)
- [ ] Updated `APP_BASE_URL` to `https://hustljobs.com`
- [ ] Tested domain works

**Result:**
- [ ] https://hustljobs.com works ✅
- [ ] SSL certificate active ✅
- [ ] All features work ✅

---

## 🆘 Troubleshooting

### Can't Find Advanced DNS Tab?

**Make sure you:**
1. Clicked "Manage" next to your domain (not "Nameservers")
2. Look at the tabs at the top: "Overview", "Advanced DNS", "Email Forwarding"
3. Click "Advanced DNS" tab

### DNS Record Not Saving?

**Check:**
- Value is exactly: `hustl-production.up.railway.app`
- Host is `@` (or blank) for root domain
- TTL is Automatic or 3600
- Click "Save" button (green checkmark)

### Domain Not Working After 1 Hour?

**Check:**
1. DNS records are correct in Namecheap
2. DNS propagated: https://dnschecker.org
3. Railway dashboard shows domain status
4. Wait longer (up to 24 hours)

---

## 💡 Important Notes

**Don't Change Nameservers:**
- Keep Namecheap's default nameservers
- Just add DNS records in Advanced DNS
- Much simpler!

**What You're Doing:**
- Adding DNS records to point domain to Railway
- Namecheap stays as your registrar
- DNS records tell the internet where to find your site

**Keep These Records:**
- Save your DNS records somewhere
- You'll need them if you ever need to change them
- Don't delete them unless moving away from Railway

---

## 🎯 Summary

**What You Did:**
1. ✅ Added DNS records in Namecheap (Advanced DNS)
2. ✅ Added domain in Railway
3. ✅ Waited for DNS propagation
4. ✅ Updated Railway variables
5. ✅ Tested domain works

**Time:** ~1 hour (mostly waiting for DNS)  
**Result:** `https://hustljobs.com` works! 🎉

---

**Follow these exact steps and your domain will be connected! 🌐✨**


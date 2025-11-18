# How to Get a Domain for Hustl 🌐

**Step-by-step guide to buy and connect a custom domain**

---

## 🎯 Why Get a Custom Domain?

- **Professional**: `hustl.app` looks better than `hustl-abc123.railway.app`
- **Branding**: Easier to remember and share
- **Trust**: Users trust custom domains more
- **SEO**: Better for search engines
- **Email**: Can set up custom email (later)

---

## 💰 Where to Buy a Domain

### Recommended Providers:

1. **Namecheap** (Recommended)
   - URL: https://namecheap.com
   - Price: ~$10-15/year
   - Easy to use
   - Good support

2. **Google Domains**
   - URL: https://domains.google
   - Price: ~$12/year
   - Simple interface
   - Good for beginners

3. **Cloudflare Registrar**
   - URL: https://cloudflare.com/products/registrar
   - Price: At cost (~$8-10/year)
   - Best prices
   - Requires Cloudflare account

4. **GoDaddy**
   - URL: https://godaddy.com
   - Price: ~$12-15/year
   - Popular but can be expensive after first year

---

## 🎨 Domain Name Ideas

### Best Options:
- `hustl.app` - Short, memorable (~$20/year)
- `gethustl.com` - Clear, available (~$12/year)
- `hustl.work` - Relevant to jobs (~$15/year)
- `hustl.online` - Available (~$10/year)
- `hustlapp.com` - Descriptive (~$12/year)

### Check Availability:
1. Go to any registrar (Namecheap recommended)
2. Search for your desired domain
3. See if it's available
4. Check price

---

## 📝 Step 1: Buy the Domain

### Using Namecheap (Example):

1. **Go to Namecheap**
   - Visit https://namecheap.com
   - Click "Sign Up" (or "Log In" if you have account)

2. **Search for Domain**
   - Type your desired domain (e.g., `hustl.app`)
   - Click "Search"
   - See if it's available

3. **Add to Cart**
   - If available, click "Add to Cart"
   - Choose registration period (1 year minimum)
   - Click "View Cart"

4. **Checkout**
   - Review your order
   - Enter payment info
   - Complete purchase

5. **Verify Email**
   - Check your email
   - Click verification link
   - Domain is now yours!

---

## 🔗 Step 2: Connect Domain to Railway

### Option A: Using Railway's Domain Settings

1. **Get Your Railway App URL**
   - Go to Railway project
   - Settings → Domains
   - Copy your Railway URL: `your-app.railway.app`

2. **Add Custom Domain in Railway**
   - Railway → Settings → Domains
   - Click "Custom Domain"
   - Enter your domain: `hustl.app` (or whatever you bought)
   - Click "Add"

3. **Get DNS Records from Railway**
   - Railway will show you DNS records to add
   - Usually looks like:
     ```
     Type: CNAME
     Name: @
     Value: your-app.railway.app
     ```

4. **Add DNS Records to Domain**
   - Go to your domain registrar (Namecheap, etc.)
   - Find "DNS Management" or "Advanced DNS"
   - Add the CNAME record Railway provided
   - Save changes

5. **Wait for DNS Propagation**
   - Usually takes 5-60 minutes
   - Can check status in Railway dashboard
   - Railway will automatically get SSL certificate

### Option B: Using A Record (Alternative)

If Railway gives you an IP address instead:

1. **Get Railway IP**
   - Railway → Settings → Domains
   - Copy the IP address

2. **Add A Record**
   - Go to domain registrar
   - Add A record:
     ```
     Type: A
     Name: @
     Value: [Railway IP]
     TTL: Automatic
     ```

---

## ⚙️ Step 3: Update Your App

### 3.1 Update Environment Variables

1. **In Railway:**
   - Go to Variables tab
   - Update `APP_BASE_URL`:
     ```
     APP_BASE_URL=https://hustl.app
     ```
   - (Replace with your actual domain)

2. **In Your Code (if needed):**
   - Check `public/index.html` for any hardcoded URLs
   - Update to use your domain
   - Push changes to GitHub

### 3.2 Update Frontend URLs

If you have hardcoded URLs in your frontend:

```javascript
// Before
const BACKEND_URL = "http://localhost:8080";

// After (for production)
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? "https://hustl.app" 
  : "http://localhost:8080";
```

---

## ✅ Step 4: Verify It Works

### 4.1 Check DNS Propagation
- Use https://dnschecker.org
- Enter your domain
- Check if it points to Railway

### 4.2 Test Your Domain
1. Open browser
2. Go to `https://yourdomain.com`
3. Should load your app
4. Check for SSL (lock icon in browser)

### 4.3 Test Features
- [ ] Homepage loads
- [ ] Can sign up
- [ ] Can log in
- [ ] All features work
- [ ] No mixed content warnings

---

## 🔒 Step 5: SSL Certificate (Automatic)

**Good news:** Railway handles SSL automatically!

- When you add custom domain, Railway requests SSL
- Uses Let's Encrypt (free)
- Automatically renews
- Usually ready in 5-10 minutes

**Check SSL:**
- Look for lock icon in browser
- URL should be `https://` (not `http://`)
- No security warnings

---

## 🎯 Step 6: Update All References

### Places to Update Your Domain:

1. **Railway Environment Variables**
   - `APP_BASE_URL`

2. **Stripe Webhooks**
   - Update webhook URL to your domain
   - Stripe Dashboard → Webhooks → Edit endpoint

3. **Email Templates** (if using)
   - Update links in email templates
   - Point to your domain

4. **Social Media** (when you set up)
   - Update bio/links
   - Use your domain

5. **Terms & Privacy Pages**
   - Already point to your domain (if you set it up)

---

## 💡 Pro Tips

### 1. **Buy for Multiple Years**
- Domains are usually cheaper for longer periods
- Prevents forgetting to renew
- Lock in current price

### 2. **Enable Auto-Renew**
- Most registrars offer auto-renew
- Prevents losing your domain
- Set up payment method

### 3. **Privacy Protection**
- Most registrars offer "Whois Privacy"
- Hides your personal info from public records
- Usually free or ~$2/year

### 4. **Subdomains**
- You can use subdomains too:
  - `www.hustl.app`
  - `api.hustl.app`
  - `admin.hustl.app`
- Just add CNAME records pointing to Railway

---

## 🆘 Troubleshooting

### Domain Not Working?
1. **Check DNS Records**
   - Verify CNAME/A record is correct
   - Check TTL (should be automatic or 3600)

2. **Wait Longer**
   - DNS can take up to 48 hours (usually 5-60 min)
   - Be patient

3. **Check Railway**
   - Railway dashboard should show domain status
   - Look for errors

4. **Clear Browser Cache**
   - Try incognito mode
   - Clear DNS cache: `ipconfig /flushdns` (Windows)

### SSL Not Working?
1. **Wait 10-15 minutes**
   - Let's Encrypt needs time to issue certificate

2. **Check Railway Logs**
   - Look for SSL errors
   - Railway usually handles this automatically

3. **Verify DNS**
   - Make sure domain points to Railway
   - SSL won't work if DNS is wrong

### Mixed Content Warnings?
- Make sure all URLs use `https://`
- Check for hardcoded `http://` in code
- Update to use `https://`

---

## 📋 Domain Setup Checklist

- [ ] Domain purchased
- [ ] Domain verified (email confirmation)
- [ ] Railway custom domain added
- [ ] DNS records added to registrar
- [ ] DNS propagated (checked with dnschecker.org)
- [ ] SSL certificate active (lock icon in browser)
- [ ] `APP_BASE_URL` updated in Railway
- [ ] App accessible at custom domain
- [ ] All features work on custom domain
- [ ] Auto-renew enabled (optional but recommended)

---

## 💰 Cost Summary

**Typical Costs:**
- Domain: $10-20/year
- SSL: Free (Railway/Let's Encrypt)
- DNS: Free (included with domain)
- **Total: ~$10-20/year**

**Worth it?** Absolutely! Professional domain makes huge difference.

---

## 🎉 You're Done!

Once your domain is connected:
1. Share your professional URL
2. Update all your links
3. Start building your brand!

**Your app now has a professional domain! 🌐**

---

## 📞 Need Help?

- Namecheap Support: https://www.namecheap.com/support/
- Railway Docs: https://docs.railway.app
- DNS Checker: https://dnschecker.org


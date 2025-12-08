# Switch hustljobs.com to Cloudflare - Step by Step

## Why Cloudflare?
- ✅ Free DNS management
- ✅ Better, easier interface
- ✅ Faster DNS propagation
- ✅ Free CDN and security features
- ✅ Easy to add DNS records

---

## Step 1: Create Cloudflare Account (if you don't have one)

1. Go to: https://dash.cloudflare.com/sign-up
2. Sign up with your email (or log in if you already have an account)
3. Verify your email if needed

---

## Step 2: Add Your Domain to Cloudflare

1. Once logged in, click **"Add a Site"** or **"Add Site"**
2. Enter: `hustljobs.com`
3. Click **"Add site"**
4. Select the **Free plan** (it's free forever)
5. Click **"Continue"**

---

## Step 3: Cloudflare Will Scan Your DNS Records

Cloudflare will automatically detect your existing DNS records. This is good - it means your site won't break.

1. Review the DNS records it found
2. Make sure your main records are there (A records pointing to Railway, etc.)
3. Click **"Continue"**

---

## Step 4: Update Nameservers in Namecheap

**IMPORTANT:** Cloudflare will show you TWO nameservers. You MUST update these in Namecheap.

### In Cloudflare:
- You'll see something like:
  - `alex.ns.cloudflare.com`
  - `linda.ns.cloudflare.com`
- **Copy both nameservers** (write them down!)

### In Namecheap:
1. Go to: https://www.namecheap.com
2. Log in
3. Go to **"Domain List"**
4. Click **"Manage"** next to `hustljobs.com`
5. Go to **"Nameservers"** section
6. Select **"Custom DNS"** (instead of "Namecheap BasicDNS")
7. Enter the TWO nameservers from Cloudflare:
   - First nameserver: `alex.ns.cloudflare.com` (or whatever Cloudflare gave you)
   - Second nameserver: `linda.ns.cloudflare.com` (or whatever Cloudflare gave you)
8. Click **"Save"** or **"Check"**

---

## Step 5: Wait for Nameserver Propagation

- Usually takes **15 minutes to 2 hours**
- Cloudflare will show "Pending" until it's active
- You'll get an email when it's ready, OR check back in Cloudflare dashboard

**While waiting:** Your site will still work (DNS is cached), but new DNS changes will go through Cloudflare.

---

## Step 6: Add Resend DNS Records in Cloudflare

Once Cloudflare shows your domain is "Active":

1. In Cloudflare dashboard, click on `hustljobs.com`
2. Go to **"DNS"** in the left sidebar
3. Click **"Add record"**

Add these 4 records:

### Record 1: Domain Verification
- **Type:** `TXT`
- **Name:** `resend._domainkey`
- **Content:** `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDMzzW2YboVoGJLnUi2KzAr9UWEXknafF8EhmHtXgsKdSgtilreDR6gkWmC0QTujZZlVv3VTk/y2Vdwaz0txCAbJIRugvluckOMU4uy1Z3R2xtDeOUr329r3f8LpFzpPdB91z9CjzoT9TlShdpGzK2otumC9+Z+D9c6LQs3pwC/0QIDAQAB`
- **TTL:** `Auto`
- Click **"Save"**

### Record 2: SPF
- **Type:** `TXT`
- **Name:** `send`
- **Content:** `v=spf1 include:amazonses.com ~all`
- **TTL:** `Auto`
- Click **"Save"**

### Record 3: MX for Sending
- **Type:** `MX`
- **Name:** `send`
- **Mail server:** `feedback-smtp.us-east-1.amazonses.com`
- **Priority:** `10`
- **TTL:** `Auto`
- Click **"Save"**

### Record 4: DMARC (Optional but Recommended)
- **Type:** `TXT`
- **Name:** `_dmarc`
- **Content:** `v=DMARC1; p=none;`
- **TTL:** `Auto`
- Click **"Save"**

---

## Step 7: Verify in Resend

1. Wait 15-30 minutes after adding DNS records
2. Go to your Resend dashboard
3. Check your domain status
4. It should show **"Verified"** ✅

---

## Step 8: Update Railway Environment Variable

Once Resend shows "Verified":

1. Go to Railway dashboard
2. Select your project
3. Go to **"Variables"** tab
4. Add or update:
   - **Variable:** `FROM_EMAIL`
   - **Value:** `Hustl <hello@hustljobs.com>` (or `noreply@hustljobs.com`)

---

## Important Notes

⚠️ **Your site will keep working** during the switch - DNS is cached, so users won't notice anything.

⚠️ **Don't delete existing DNS records** in Cloudflare - especially A records pointing to Railway!

⚠️ **If something breaks:** You can always switch back to Namecheap nameservers in Namecheap.

---

## Troubleshooting

**"Domain not active in Cloudflare"**
- Wait longer (can take up to 24 hours, usually 15 min - 2 hours)
- Double-check nameservers in Namecheap match Cloudflare exactly

**"Site not loading"**
- Make sure you kept the A records in Cloudflare pointing to Railway
- Check that nameservers are updated in Namecheap

**"Resend not verifying"**
- Wait 30 minutes after adding DNS records
- Double-check you copied the DNS record values exactly (no extra spaces)

---

## Need Help?

If you get stuck at any step, let me know which step and I'll help!


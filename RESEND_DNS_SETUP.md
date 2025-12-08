# Resend DNS Setup Guide for hustljobs.com

## Step 1: Add DNS Records to Your Domain Provider

You need to add these DNS records to wherever you manage DNS for `hustljobs.com` (this could be:
- Your domain registrar (GoDaddy, Namecheap, etc.)
- Your hosting provider
- Cloudflare
- Or wherever your domain's DNS is managed)

### Where to Add DNS Records:
1. Log into your domain provider's dashboard
2. Find "DNS Management" or "DNS Settings" or "Name Servers"
3. Look for "DNS Records" or "Add Record"

---

## Step 2: Add These DNS Records

### Domain Verification (Required)
**Type:** `TXT`  
**Name:** `resend._domainkey`  
**Content:** `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDMzzW2YboVoGJLnUi2KzAr9UWEXknafF8EhmHtXgsKdSgtilreDR6gkWmC0QTujZZlVv3VTk/y2Vdwaz0txCAbJIRugvluckOMU4uy1Z3R2xtDeOUr329r3f8LpFzpPdB91z9CjzoT9TlShdpGzK2otumC9+Z+D9c6LQs3pwC/0QIDAQAB`  
**TTL:** `Auto` (or 3600)

### Enable Sending - SPF (Required)
**Type:** `TXT`  
**Name:** `send`  
**Content:** `v=spf1 include:amazonses.com ~all`  
**TTL:** `Auto` (or 3600)

### Enable Sending - MX (Required)
**Type:** `MX`  
**Name:** `send`  
**Content:** `feedback-smtp.us-east-1.amazonses.com`  
**TTL:** `Auto`  
**Priority:** `10`

### DMARC (Optional but Recommended)
**Type:** `TXT`  
**Name:** `_dmarc`  
**Content:** `v=DMARC1; p=none;`  
**TTL:** `Auto` (or 3600)

### Enable Receiving (Optional - only if you want to receive emails)
**Type:** `MX`  
**Name:** `@` (or leave blank, depending on your provider)  
**Content:** `inbound-smtp.us-east-1.amazonaws.com`  
**TTL:** `Auto`  
**Priority:** `10`

---

## Step 3: Wait for DNS Propagation

After adding the records:
- DNS changes can take **5 minutes to 48 hours** to propagate
- Usually takes **15-30 minutes**
- You can check if records are live at: https://mxtoolbox.com/SuperTool.aspx

---

## Step 4: Verify in Resend Dashboard

1. Go back to your Resend dashboard
2. Check your domain status
3. It should show "Verified" once DNS records are detected

---

## Step 5: Update Environment Variable

Once verified, update your Railway environment variable:

**Variable Name:** `FROM_EMAIL`  
**Value:** `Hustl <hello@hustljobs.com>` (or `noreply@hustljobs.com`, `support@hustljobs.com`, etc.)

**Where to add this:**
1. Go to Railway dashboard
2. Select your project
3. Go to "Variables" tab
4. Add or update `FROM_EMAIL` with your domain email

---

## Where Emails Are Stored

**Emails are NOT stored in Resend** - they are sent through Resend but:
- **Sent emails:** Resend keeps logs of sent emails in your dashboard (for debugging)
- **Received emails:** If you set up receiving, emails go to the email address you configure
- **User emails:** Your users receive emails in their own inboxes (Gmail, Outlook, etc.)

**Your code sends emails TO users** - the emails go directly to the user's email address (Gmail, Outlook, iCloud, etc.). Resend is just the delivery service.

---

## Common Issues

### "Domain not verified"
- Wait longer for DNS propagation (can take up to 48 hours)
- Double-check you copied the DNS records exactly (no extra spaces)
- Make sure you're editing DNS for the correct domain

### "Emails going to spam"
- Add the DMARC record (helps with deliverability)
- Make sure SPF record is correct
- Wait for DNS to fully propagate

### "Can't find DNS settings"
- Check your domain registrar's help docs
- Look for "DNS Management", "Name Servers", or "DNS Records"
- If you use Cloudflare, go to DNS section

---

## Quick Checklist

- [ ] Added `resend._domainkey` TXT record
- [ ] Added `send` TXT record (SPF)
- [ ] Added `send` MX record
- [ ] Added `_dmarc` TXT record (optional but recommended)
- [ ] Waited 15-30 minutes for DNS propagation
- [ ] Verified domain in Resend dashboard shows "Verified"
- [ ] Updated `FROM_EMAIL` in Railway to use `@hustljobs.com`
- [ ] Tested sending an email

---

## Need Help?

If DNS records aren't working:
1. Check MXToolbox to see if records are live
2. Verify you're editing DNS for the correct domain
3. Make sure there are no typos in the record values
4. Contact your domain provider's support if you can't find DNS settings


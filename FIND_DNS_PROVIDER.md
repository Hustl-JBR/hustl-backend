# How to Find Where Your DNS is Managed

Your domain `hustljobs.com` is using nameservers: `dns1.registrar-servers.com` and `dns2.registrar-servers.com`

This means your DNS is managed at **wherever you registered/bought your domain**.

## Step 1: Find Your Domain Registrar

Check these places:
1. **Your email inbox** - Search for "hustljobs.com" or "domain registration"
2. **Your credit card/bank statements** - Look for domain registration charges
3. **Common registrars:**
   - Namecheap
   - Name.com
   - Google Domains
   - GoDaddy
   - Hover
   - Porkbun
   - Cloudflare (if you registered there)

## Step 2: Log Into Your Registrar

Once you know where you registered:
1. Go to that website
2. Log in
3. Find "My Domains" or "Domain Management"
4. Click on `hustljobs.com`
5. Look for "DNS Management" or "DNS Records" or "Advanced DNS"

## Step 3: Add the DNS Records

Once you're in DNS management, add these 4 records:

### Record 1: Domain Verification
- **Type:** TXT
- **Name/Host:** `resend._domainkey`
- **Value/Content:** `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDMzzW2YboVoGJLnUi2KzAr9UWEXknafF8EhmHtXgsKdSgtilreDR6gkWmC0QTujZZlVv3VTk/y2Vdwaz0txCAbJIRugvluckOMU4uy1Z3R2xtDeOUr329r3f8LpFzpPdB91z9CjzoT9TlShdpGzK2otumC9+Z+D9c6LQs3pwC/0QIDAQAB`
- **TTL:** 3600 (or Auto)

### Record 2: SPF
- **Type:** TXT
- **Name/Host:** `send`
- **Value/Content:** `v=spf1 include:amazonses.com ~all`
- **TTL:** 3600 (or Auto)

### Record 3: MX for Sending
- **Type:** MX
- **Name/Host:** `send`
- **Value/Content:** `feedback-smtp.us-east-1.amazonses.com`
- **Priority:** 10
- **TTL:** 3600 (or Auto)

### Record 4: DMARC (Optional but Recommended)
- **Type:** TXT
- **Name/Host:** `_dmarc`
- **Value/Content:** `v=DMARC1; p=none;`
- **TTL:** 3600 (or Auto)

---

## Alternative: Switch to Cloudflare (Easier Option)

If you can't find your registrar or want an easier interface:

1. **Sign up for Cloudflare** (free): https://dash.cloudflare.com/sign-up
2. **Add your domain** to Cloudflare
3. **Update nameservers** at your registrar to Cloudflare's nameservers
4. **Add DNS records** in Cloudflare (much easier interface)

Would you like me to guide you through switching to Cloudflare instead?


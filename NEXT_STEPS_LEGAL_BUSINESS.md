# 🚀 Next Steps: Legal, Business, & Launch Checklist

Complete guide for launching Hustl legally and professionally.

---

## 📋 Quick Priority Checklist

**Do These First (Before Launch):**
- [ ] Business structure (LLC recommended)
- [ ] Get EIN from IRS (free)
- [ ] Register with Tennessee Secretary of State
- [ ] Get business bank account
- [ ] Complete Stripe account setup (business info)
- [ ] Review/update Terms & Privacy Policy
- [ ] Buy domain name
- [ ] Set up business email

**Do These Next (Week 1):**
- [ ] Register for Tennessee business tax
- [ ] Get business insurance (general liability)
- [ ] Set up accounting/bookkeeping
- [ ] Connect domain to Railway
- [ ] Test payment flow end-to-end

**Do These Later (Month 1-3):**
- [ ] Consider trademark for "Hustl"
- [ ] Set up business credit card
- [ ] Create business social media accounts
- [ ] Marketing/SEO setup

---

## 1️⃣ BUSINESS STRUCTURE & REGISTRATION

### Option A: LLC (Recommended for Startups)

**Why LLC?**
- Protects personal assets from business debts
- Simple to set up and manage
- Flexible tax options
- Professional credibility

**Steps to Form LLC in Tennessee:**

1. **Choose Business Name**
   - Check availability: https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx
   - Search for "Hustl" or "Hustl LLC"
   - Must be unique in Tennessee

2. **File Articles of Organization**
   - **Where:** Tennessee Secretary of State
   - **Online:** https://sos.tn.gov/business-services/file-online
   - **Cost:** $50 per member (minimum $50, max $3000)
   - **Time:** Usually processed in 1-2 business days

3. **Get EIN (Employer Identification Number)**
   - **Where:** https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-ein-online
   - **Cost:** FREE
   - **Time:** Instant online, or 4-5 weeks by mail
   - **Why:** Needed for business bank account, tax filing, Stripe

4. **Operating Agreement** (Recommended)
   - Document how LLC will be run
   - Can use online templates (LegalZoom, Rocket Lawyer)
   - Cost: $0-200

**Total Cost:** ~$50-300 (depending on members)

---

### Option B: Sole Proprietorship (Simplest, Less Protection)

**Why Consider:**
- No registration needed
- No fees
- Full control

**Downsides:**
- Personal liability (your assets at risk)
- Harder to get business bank account
- Less professional

**Recommendation:** Start as LLC if you're serious about this business.

---

## 2️⃣ BUSINESS BANK ACCOUNT

**Why You Need It:**
- Separate business and personal finances
- Required by most payment processors
- Easier accounting/taxes
- Professional credibility

**Requirements:**
- EIN (from IRS)
- LLC registration (if LLC)
- ID (driver's license)
- Initial deposit (varies by bank, usually $50-500)

**Recommended Banks:**
- **Local Bank/Credit Union** (support local, good service)
- **Chase Business** (if branches near you)
- **Bank of America Business**
- **Online:** Mercury, Novo (tech-friendly)

**What to Bring:**
- EIN letter from IRS
- LLC filing confirmation (if LLC)
- Driver's license
- Opening deposit check/cash

---

## 3️⃣ TAX REGISTRATION

### Federal Taxes

**EIN:** ✅ Already covered above

**Quarterly Estimated Taxes** (if LLC elects pass-through):
- If you expect to owe $1,000+ in taxes
- File quarterly: Jan 15, Apr 15, Jun 15, Sep 15
- Use Form 1040-ES

### Tennessee State Taxes

**1. Business Tax Registration**
   - **Where:** Tennessee Department of Revenue
   - **URL:** https://tntap.tn.gov/eservices/_/
   - **When:** Within 20 days of starting business
   - **Cost:** Varies by county/city (usually $15-50/year)

**2. Sales Tax** (if applicable)
   - Hustl is a service marketplace, so you likely don't collect sales tax on services
   - BUT you may need to pay business tax on revenue
   - Check with TN Department of Revenue

**3. State Income Tax**
   - Tennessee has NO state income tax ✅
   - Only federal income tax

**Get Help:**
- TN Small Business Development Center: https://www.tsbdc.org/
- Free business counseling

---

## 4️⃣ BUSINESS INSURANCE

### General Liability Insurance (Highly Recommended)

**Why You Need It:**
- Protects if a hustler gets hurt on a job
- Protects if customer property is damaged
- Covers legal fees if sued
- Some customers may require it

**Typical Coverage:**
- $1M per occurrence
- $2M aggregate
- Cost: $500-1500/year (depends on business type)

**Where to Get:**
- **Next Insurance** (online, tech-friendly)
- **Hiscox** (popular with small businesses)
- **Local insurance agent** (may bundle with other policies)
- **Stripe Insurance** (check if they offer marketplace insurance)

**Other Insurance to Consider:**
- **Cyber Liability:** Protects against data breaches
- **Professional Liability:** If you give advice
- **Workers' Comp:** Only if you have employees (not contractors)

---

## 5️⃣ STRIPE BUSINESS SETUP

**For Stripe Connect (Hustler Payouts):**

1. **Complete Stripe Business Profile**
   - Go to: https://dashboard.stripe.com/settings/business
   - Enter:
     - Business name (Hustl LLC)
     - Business type (Marketplace/Platform)
     - Business address
     - EIN (business tax ID)
     - Bank account details
     - Business verification documents

2. **Enable Stripe Connect**
   - Go to: https://dashboard.stripe.com/settings/connect
   - Enable Connect for your platform
   - Set up Connect terms/agreement
   - Configure payout schedule

3. **Webhook Setup**
   - Set webhook URL: `https://yourdomain.com/webhooks/stripe`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.captured`
     - `transfer.created`
     - `account.updated`

4. **Bank Account Verification**
   - Stripe will send 2 small deposits
   - Verify amounts in Stripe dashboard
   - Usually takes 1-2 business days

**Requirements:**
- EIN (business tax ID)
- Business bank account
- Business registration documents
- Identity verification (owner/authorized person)

---

## 6️⃣ DOMAIN NAME & WEBSITE

### Buying a Domain

**Recommended Providers:**
1. **Namecheap** - https://namecheap.com (~$12/year)
2. **Cloudflare Registrar** - https://cloudflare.com/products/registrar (~$8-10/year)
3. **Google Domains** - https://domains.google (~$12/year)

**Domain Options:**
- `hustl.app` - Short, memorable (~$20/year)
- `gethustl.com` - Clear, available (~$12/year)
- `hustl.work` - Relevant to jobs (~$15/year)
- `hustlapp.com` - Descriptive (~$12/year)

**Check Availability:**
- Go to any registrar
- Search for your desired domain
- Buy for multiple years (cheaper, prevents forgetting)

### Connecting Domain to Railway

1. **In Railway:**
   - Settings → Domains → Custom Domain
   - Enter your domain: `hustl.app` (or whatever you bought)
   - Railway will give you DNS records

2. **In Domain Registrar:**
   - Go to DNS Management
   - Add CNAME record Railway provides
   - Usually: `@` → `your-app.railway.app`

3. **Update Environment Variables:**
   - `APP_BASE_URL=https://yourdomain.com`
   - Railway will auto-get SSL certificate

**See:** `DOMAIN_SETUP.md` for detailed instructions

---

## 7️⃣ LEGAL DOCUMENTS

### Terms of Service & Privacy Policy

**Status:** ✅ Already created in `public/terms.html` and `public/privacy.html`

**Review Checklist:**
- [ ] Update business name/address
- [ ] Update contact email
- [ ] Verify fee structure (16% platform fee mentioned)
- [ ] Verify Tennessee jurisdiction mentioned
- [ ] Update "Last updated" date
- [ ] Review with lawyer (recommended before launch)

**Legal Review Recommended:**
- Get lawyer to review Terms & Privacy
- Cost: $500-1500 (one-time)
- Worth it to protect business
- Find business attorney on: https://www.avvo.com/ or local referral

---

## 8️⃣ TRADEMARK (Optional but Recommended)

**Why Consider It:**
- Prevents others from using "Hustl" name
- Protects your brand
- Easier to stop copycats
- More valuable business asset

**Where to File:**
- **USPTO (Federal):** https://www.uspto.gov/trademarks
- **Cost:** $250-350 per class
- **Time:** 8-12 months for approval

**Steps:**
1. Search existing trademarks: https://www.uspto.gov/trademarks/search
2. File application (can do yourself or use lawyer)
3. Wait for examination
4. Respond to any objections
5. Get registration

**Recommendation:**
- Start with Tennessee state trademark (cheaper, faster)
- Or file federal if you plan to expand nationwide
- Consider lawyer for federal filing ($500-1500)

---

## 9️⃣ BUSINESS EMAIL

**Options:**

1. **Google Workspace**
   - Email: `contact@hustl.app` or `hello@hustl.app`
   - Cost: $6/user/month
   - Professional, includes Google Drive, Docs, etc.

2. **Microsoft 365**
   - Email: `contact@hustl.app`
   - Cost: $6/user/month
   - Includes Office apps

3. **Zoho Mail**
   - Email: `contact@hustl.app`
   - Cost: $1/user/month (basic plan)
   - More affordable

4. **Cloudflare Email Routing** (Free)
   - Forward to personal email
   - Free but less professional

**Recommendation:** Google Workspace for professional email + tools

**Set Up:**
- After buying domain, set up email forwarding or business email
- Update contact email in Terms/Privacy pages
- Update email in Stripe business profile

---

## 🔟 ACCOUNTING & BOOKKEEPING

### Accounting Software

**Recommended:**
1. **QuickBooks Online** (~$25-50/month)
   - Industry standard
   - Tracks income/expenses
   - Generates tax reports
   - Integrates with bank account

2. **FreshBooks** (~$15-30/month)
   - Simpler interface
   - Good for service businesses
   - Easy invoicing

3. **Wave** (FREE)
   - Free for basic features
   - Good for starting out
   - Upgrade later if needed

**What to Track:**
- All income (platform fees)
- All expenses (hosting, domain, insurance, etc.)
- Stripe fees
- Mileage (if you drive for business)
- Home office (if working from home)

**Get Help:**
- Hire bookkeeper (when you have revenue)
- Or use software + tax professional end of year

---

## 1️⃣1️⃣ MONITORING & COMPLIANCE

### Data Protection

**GDPR (If You Have EU Users):**
- Add GDPR cookie consent (if applicable)
- Add data export/deletion features
- Update Privacy Policy with GDPR rights

**Tennessee TIPA:**
- Your Privacy Policy already mentions TIPA ✅
- Continue to follow as business grows

### Business Compliance

**Annual Reports:**
- Tennessee LLCs must file annual report
- Due: 1st day of 4th month after fiscal year end
- Cost: $50/year minimum
- File online: https://tnbear.tn.gov/

**Business License Renewal:**
- City/County business license (if required)
- Renew annually (check with local government)

---

## 📊 COST SUMMARY (First Year)

**One-Time Costs:**
- LLC Registration: $50-300
- Domain (2 years): $20-40
- Legal Review (optional): $500-1500
- Trademark (optional): $250-350

**Monthly/Annual Costs:**
- Business Bank Account: $0-25/month
- Insurance: $50-125/month ($600-1500/year)
- Accounting Software: $0-50/month
- Business Email: $6-12/month
- Hosting (Railway): $5-20/month
- Domain Renewal: $10-20/year
- Annual Report: $50/year minimum

**Total Startup:** ~$620-2390 (without legal/trademark)
**Monthly Ongoing:** ~$70-200/month

---

## ✅ LAUNCH CHECKLIST (Final Steps)

**Before Going Live:**

- [ ] Business structure formed (LLC or sole prop)
- [ ] EIN obtained
- [ ] Business bank account opened
- [ ] Business insurance purchased
- [ ] Stripe business profile complete
- [ ] Domain purchased and connected
- [ ] Business email set up
- [ ] Terms & Privacy reviewed/updated
- [ ] Stripe webhooks configured
- [ ] Environment variables updated
- [ ] SSL certificate active (HTTPS)
- [ ] Test payment flow end-to-end
- [ ] Test with small transactions ($1-5)
- [ ] Monitor for errors
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up analytics (Google Analytics, etc.)

**First Week After Launch:**
- [ ] Monitor payment transactions
- [ ] Monitor for bugs/errors
- [ ] Collect user feedback
- [ ] Make quick fixes as needed
- [ ] Start marketing/promotion

---

## 🆘 GET HELP

### Free Resources:
- **Tennessee Small Business Development Center:** https://www.tsbdc.org/
- **SCORE (Free Mentoring):** https://www.score.org/
- **IRS Small Business Resources:** https://www.irs.gov/businesses/small-businesses-self-employed
- **Tennessee Department of Revenue:** https://www.tn.gov/revenue

### Paid Help (When Ready):
- **Business Attorney:** Review Terms, help with LLC
- **Accountant:** Tax planning, bookkeeping help
- **Insurance Agent:** Business insurance advice

---

## 🎯 PRIORITY ORDER

**Week 1:**
1. Get EIN (free, instant online)
2. Form LLC (if going that route) - $50
3. Open business bank account
4. Complete Stripe business profile

**Week 2:**
5. Buy domain (~$12/year)
6. Connect domain to Railway
7. Update all URLs/environment variables
8. Get business insurance

**Week 3:**
9. Set up business email
10. Set up accounting software
11. Review Terms/Privacy with lawyer
12. Test everything end-to-end

**Before Launch:**
13. Final testing
14. Marketing prep
15. Launch! 🚀

---

## 💡 PRO TIPS

1. **Start Simple:**
   - Form LLC, get EIN, open bank account
   - You can add insurance/trademark later
   - Don't let paperwork delay launch

2. **Keep It Organized:**
   - Create a folder for all business documents
   - Save all receipts/invoices
   - Track everything from day 1

3. **Get Professional Help:**
   - Free resources first (SBDC, SCORE)
   - Hire lawyer/accountant when revenue comes in
   - Don't try to do everything yourself

4. **Stay Compliant:**
   - File annual reports on time
   - Keep insurance current
   - Update Terms/Privacy as needed
   - Track all income/expenses

---

## 📞 NEXT STEPS

1. **Today:** Get EIN from IRS (takes 5 minutes, free)
2. **This Week:** Form LLC + open business bank account
3. **Next Week:** Complete Stripe setup + buy domain
4. **Week 3:** Insurance + legal review + launch prep
5. **Week 4:** Launch! 🎉

---

**Remember:** You can launch with the basics (EIN + bank account + Stripe) and add insurance/legal review as you get revenue. Don't let perfectionism delay your launch!

**Good luck! You've got this! 🚀**


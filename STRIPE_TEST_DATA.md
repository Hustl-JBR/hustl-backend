# Stripe Test Data for Onboarding

## 🎯 Stripe Connect Onboarding Test Data

When you're redirected to Stripe's onboarding page, use this test data. **None of this is real** - it's all fake for testing.

---

## 📝 Business Information

### Business Type
- Select: **Individual** (easiest for testing)

### Business Name
- Use: `Test Business` or `John's Services` or your name

### Business Website
- Use: `https://test.example.com` or `https://hustljobs.com`

### Business Description
- Use: `Local services and handyman work`

---

## 👤 Personal Information

### First Name
- Use: `John` or any name

### Last Name
- Use: `Doe` or any name

### Email
- Use: Your actual test account email (the one you're logged in with)

### Phone Number
- Use: `555-555-5555` or any US phone format

### Date of Birth
- Use: `01/01/1990` (any date that makes you 18+)

### SSN (Social Security Number)
- **In test mode, you can use:** `000-00-0000` or `123-45-6789`
- Stripe accepts any format in test mode
- **No real SSN needed!**

### Address
- **Street:** `123 Test Street`
- **City:** `Nashville`
- **State:** `Tennessee` or `TN`
- **ZIP:** `37203` (any valid TN ZIP)

---

## 💳 Bank Account (for payouts)

### Account Type
- Select: **Checking** or **Savings**

### Account Number
- **In test mode, use:** `000123456789` (any numbers)
- Stripe accepts any account number in test mode

### Routing Number
- **In test mode, use:** `110000000` (this is Stripe's test routing number)
- Or any 9-digit number

### Account Holder Name
- Use: Your name or `Test Account`

**Important:** In test mode, Stripe doesn't actually verify bank accounts. You can use any numbers.

---

## 📋 Additional Information

### Industry/Type of Business
- Select: **Professional Services** or **Other**
- Or any option that seems relevant

### Tax ID (EIN) - Optional
- **Skip this** or use: `12-3456789` (fake EIN)
- Not required for individuals

---

## ✅ Quick Copy-Paste Test Data

**For Individual Account:**

```
Business Type: Individual
First Name: John
Last Name: Doe
Email: [your test email]
Phone: 555-555-5555
Date of Birth: 01/01/1990
SSN: 123-45-6789
Address: 123 Test Street, Nashville, TN 37203

Bank Account:
Type: Checking
Account Number: 000123456789
Routing Number: 110000000
Account Holder: John Doe
```

---

## 🎯 What Stripe Will Accept

**In test mode, Stripe is VERY lenient:**
- ✅ Any SSN format
- ✅ Any bank account number
- ✅ Any routing number
- ✅ Any address
- ✅ No real verification

**The only things that matter:**
- Email should be valid format (but doesn't need to be real)
- Phone should be valid format
- Address should be valid format

---

## ⚠️ Important Notes

1. **This is all fake** - No real data needed
2. **Test mode only** - Won't work in live mode
3. **No real money** - Bank account is fake
4. **Instant approval** - Account ready immediately in test mode

---

## 🔍 After Onboarding

**What to expect:**
- Redirects back to your profile
- URL: `https://hustljobs.com/profile?stripe_onboarding=success`
- Account is instantly ready
- Can receive test payouts immediately

**Verify it worked:**
- Check Profile → Payment Setup (should show "Connected")
- Or call: `GET /stripe-connect/status`
- Should return: `{ connected: true, accountId: "acct_test_xxx" }`

---

## 🚨 If Onboarding Fails

**Common issues:**
1. **Form validation errors** - Check format (dates, phone, etc.)
2. **Network errors** - Check internet connection
3. **Stripe errors** - Check backend logs

**Fix:**
- Use the exact formats shown above
- Make sure you're in test mode (Stripe Dashboard shows "Test mode")
- Check backend logs for errors

---

**Use this test data when you see Stripe's onboarding form. It's all fake and safe to use!**


# 🌐 How to Access Admin Dashboard on Production Website

## 📍 Admin Dashboard URL

The admin dashboard is accessible at:

**`https://hustljobs.com/admin.html`**

(Replace `hustljobs.com` with your actual domain if different)

---

## ✅ Steps to Access on Production

### Step 1: Make Your User an Admin (In Production Database)

**Important:** You need to update your user in the **production database**, not local.

1. **Go to Railway Dashboard:** https://railway.app
2. **Select your Hustl project**
3. **Click on your PostgreSQL database** (the production one, not local)
4. **Click "Query" tab**
5. **Run this SQL** (replace with your actual email):
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-actual-email@example.com';
   ```
6. **Click "Run" button**
7. **Verify it worked:**
   ```sql
   SELECT email, roles FROM users WHERE email = 'your-actual-email@example.com';
   ```
   Should show `{ADMIN}` or `{CUSTOMER,HUSTLER,ADMIN}`

### Step 2: Log In to Production Site

1. **Go to your production website:** `https://hustljobs.com` (or your domain)
2. **Log in** with the email you just made admin
3. **Important:** If you were already logged in, **log out and log back in** to refresh your session

### Step 3: Access Admin Dashboard

1. **In your browser, go to:**
   ```
   https://hustljobs.com/admin.html
   ```
   (Replace `hustljobs.com` with your actual domain)

2. **You should see the admin dashboard** with tabs:
   - 📊 Stats
   - 🔴 Refunds
   - 💰 Payouts
   - 💳 All Payments

---

## 🔒 Security Notes

- The admin dashboard **requires** the `ADMIN` role
- If you don't have the role, you'll get an error or be redirected
- Only users with `ADMIN` role can access it
- Make sure you're logged in with the correct account

---

## 🧪 Test if You Have Admin Access

**Option 1: Check in Browser Console**
1. Go to your production site: `https://hustljobs.com`
2. Log in
3. Press `F12` to open Developer Console
4. Go to Console tab
5. Run:
   ```javascript
   fetch('/users/me', {
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('hustl_token') }
   }).then(r => r.json()).then(u => console.log('My roles:', u.roles));
   ```
6. Should show `['ADMIN']` or include `'ADMIN'` in the array

**Option 2: Try Accessing Admin Dashboard**
- Go to: `https://hustljobs.com/admin.html`
- If you see the dashboard = ✅ You have access
- If you see an error or get redirected = ❌ You need to add ADMIN role

---

## 🚨 Troubleshooting

### "Access Denied" or Error When Accessing Admin

1. **Check if you're logged in:**
   - Make sure you're logged in on the production site
   - Try logging out and back in

2. **Verify admin role in database:**
   - Check Railway database
   - Run: `SELECT email, roles FROM users WHERE email = 'your-email@example.com';`
   - Should show `ADMIN` in roles

3. **Check if you're using the right account:**
   - Make sure you're logged in with the email you made admin
   - Check your email in the console (see test above)

4. **Clear browser cache:**
   - Sometimes old session data causes issues
   - Try incognito/private window
   - Or clear cookies for your site

### Admin Dashboard Shows But No Data

1. **Check if you have any data:**
   - The dashboard shows data from your production database
   - If you have no payments/payouts/refunds, it will be empty

2. **Check browser console for errors:**
   - Press `F12` → Console tab
   - Look for any red error messages

### Can't Access Database in Railway

1. **Make sure you're in the right project:**
   - Check you're in the production project, not a test/staging project

2. **Check database connection:**
   - Railway should show database connection info
   - Use the "Query" tab in Railway dashboard

---

## 📝 Quick Reference

**Admin Dashboard URL:**
```
https://hustljobs.com/admin.html
```

**Make User Admin (SQL):**
```sql
UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
```

**Check Your Roles:**
```javascript
fetch('/users/me', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('hustl_token') }
}).then(r => r.json()).then(u => console.log('Roles:', u.roles));
```

---

## 🎯 Summary

1. **Update your user in production database** to have ADMIN role
2. **Log in to production site** (`https://hustljobs.com`)
3. **Go to** `https://hustljobs.com/admin.html`
4. **You should see the admin dashboard!**

The admin dashboard file (`admin.html`) is already deployed because it's in the `public` folder, so it's automatically served by your server. You just need to:
- Make yourself admin in the database
- Be logged in
- Visit the URL

---

Need help? Let me know what happens when you try to access it!


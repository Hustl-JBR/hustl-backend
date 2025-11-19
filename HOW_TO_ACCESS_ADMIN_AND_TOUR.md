# 🎯 How to Access Admin Dashboard & Onboarding Tour

## 🔐 Access Admin Dashboard

### Step 1: Make Your User an Admin

You need to add the `ADMIN` role to your user account in the database.

**Option A: Using Railway Database (Recommended)**
1. Go to Railway Dashboard: https://railway.app
2. Select your Hustl project
3. Click on your PostgreSQL database
4. Click "Query" tab
5. Run this SQL (replace with your email):
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
   ```
6. Click "Run" button

**Option B: Using psql (Command Line)**
1. Get your database connection string from Railway
2. Connect to database:
   ```bash
   psql "your-database-connection-string"
   ```
3. Run SQL:
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
   ```

**Option C: Keep Other Roles Too**
If you want to keep your existing roles (CUSTOMER, HUSTLER) and add ADMIN:
```sql
UPDATE users SET roles = ARRAY['CUSTOMER', 'HUSTLER', 'ADMIN'] WHERE email = 'your-email@example.com';
```

### Step 2: Access Admin Dashboard

1. **Make sure you're logged in** to the app with your admin account
2. **Navigate to admin dashboard:**
   - **If running locally:** Go to `http://localhost:8080/admin.html`
   - **If on production:** Go to `https://hustljobs.com/admin.html`
3. You should see the admin dashboard with tabs:
   - 📊 Stats
   - 🔴 Refunds
   - 💰 Payouts
   - 💳 All Payments

### Step 3: Use Admin Dashboard

- Click tabs to switch between views
- Use filters to find specific records
- Click "Refund" button on any captured payment to manually process refunds
- Click "🔄 Refresh" to reload data

---

## 🎓 View Onboarding Tour

### Method 1: Clear localStorage (Easiest)

1. **Open your browser's Developer Console:**
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - Safari: Press `Cmd+Option+I` (Mac)

2. **Go to Console tab**

3. **Run this command:**
   ```javascript
   localStorage.removeItem('onboardingTourCompleted');
   ```

4. **Refresh the page** (F5 or Ctrl+R)

5. **The tour should appear automatically** after 2 seconds (if you're logged in)

### Method 2: Manual Trigger (If tour doesn't show)

1. **Open Developer Console** (F12)

2. **Run this command:**
   ```javascript
   localStorage.removeItem('onboardingTourCompleted');
   showOnboardingTour();
   ```

3. **The tour should appear immediately**

### Method 3: Check if Tour is Completed

To see if the tour has been completed:
1. Open Developer Console (F12)
2. Run:
   ```javascript
   localStorage.getItem('onboardingTourCompleted');
   ```
   - Returns `"true"` = tour completed
   - Returns `null` = tour not completed (will show on next login)

### Method 4: Force Show Tour (Even if Completed)

1. Open Developer Console (F12)
2. Run:
   ```javascript
   localStorage.removeItem('onboardingTourCompleted');
   location.reload();
   ```

---

## 🧪 Quick Test Commands

**Test Admin Access:**
```javascript
// Check if you're logged in
localStorage.getItem('hustl_token');

// Check your user roles (after making yourself admin)
fetch('/users/me', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('hustl_token') }
}).then(r => r.json()).then(console.log);
```

**Test Onboarding:**
```javascript
// Clear tour completion
localStorage.removeItem('onboardingTourCompleted');

// Manually trigger tour
showOnboardingTour();

// Check if tour is completed
localStorage.getItem('onboardingTourCompleted');
```

**Test Notifications:**
```javascript
// Check notifications
window.hustlAPI.notifications.list().then(console.log);
```

**Test Search:**
```javascript
// Search for jobs
window.hustlAPI.jobs.list({ search: 'moving' }).then(console.log);
```

---

## 📝 Troubleshooting

### Admin Dashboard Not Showing / Access Denied

1. **Check if you're logged in:**
   - Make sure you're logged in with the account you made admin

2. **Verify admin role:**
   - Run this in console:
     ```javascript
     fetch('/users/me', {
       headers: { 'Authorization': 'Bearer ' + localStorage.getItem('hustl_token') }
     }).then(r => r.json()).then(u => console.log('Roles:', u.roles));
     ```
   - Should show `['ADMIN']` or include `'ADMIN'`

3. **Check database:**
   - Make sure the SQL update actually ran
   - Verify in database: `SELECT email, roles FROM users WHERE email = 'your-email@example.com';`

4. **Try logging out and back in:**
   - Sometimes you need to refresh your session

### Onboarding Tour Not Showing

1. **Make sure you're logged in:**
   - Tour only shows for logged-in users

2. **Clear localStorage:**
   ```javascript
   localStorage.removeItem('onboardingTourCompleted');
   location.reload();
   ```

3. **Wait 2 seconds:**
   - Tour appears 2 seconds after page load

4. **Manually trigger:**
   ```javascript
   showOnboardingTour();
   ```

5. **Check console for errors:**
   - Open Developer Console (F12)
   - Look for any JavaScript errors

---

## 🎯 Quick Reference

**Admin Dashboard URL:**
- Local: `http://localhost:8080/admin.html`
- Production: `https://hustljobs.com/admin.html`

**Onboarding Tour:**
- Shows automatically on first login (if not completed)
- Can be triggered manually: `showOnboardingTour()`
- Clear completion: `localStorage.removeItem('onboardingTourCompleted')`

**Make User Admin (SQL):**
```sql
UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
```

---

Need help? Check the console for errors or let me know what's happening!


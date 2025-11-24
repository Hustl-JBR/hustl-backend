# ⚡ Quick Setup Steps - Copy & Paste Guide

Follow these steps **in order** to get everything working.

---

## 🔴 **STEP 1: Install WebSocket Package**

Open terminal/PowerShell in your project folder and run:

```bash
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
npm install ws
```

---

## 🔴 **STEP 2: Get Stripe Keys**

1. Go to: **https://dashboard.stripe.com**
2. Make sure you're in **Test Mode** (toggle in top right)
3. Go to: **Developers** → **API keys**
4. Copy these two keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) - Click "Reveal test key"

**Save these keys - you'll need them in Step 3!**

---

## 🔴 **STEP 3: Add Variables to Railway**

1. Go to: **https://railway.app**
2. Click on your **Hustl project**
3. Click on your **service** (the backend service)
4. Click **Variables** tab (or **Settings** → **Variables**)

### Add these variables (click "New Variable" for each):

```
Name: STRIPE_SECRET_KEY
Value: [paste your sk_test_... key from Step 2]
```

```
Name: STRIPE_PUBLISHABLE_KEY
Value: [paste your pk_test_... key from Step 2]
```

```
Name: JWT_SECRET
Value: [generate a random string - see below]
```

**To generate JWT_SECRET:**
- Open PowerShell and run: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))`
- Or use: https://randomkeygen.com/ (use "CodeIgniter Encryption Keys")
- Copy any long random string (at least 32 characters)

```
Name: APP_BASE_URL
Value: https://your-railway-app.up.railway.app
```
*(Find your Railway URL in the Railway dashboard - it's shown at the top of your service)*

```
Name: FRONTEND_BASE_URL
Value: https://your-railway-app.up.railway.app
```
*(Use the same Railway URL for now, or your custom domain if you have one)*

---

## 🔴 **STEP 4: Push Code to GitHub**

Open terminal/PowerShell and run:

```bash
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
git add .
git commit -m "Add WebSocket server and Stripe Payment Element endpoints"
git push origin main
```

---

## 🔴 **STEP 5: Wait for Railway to Deploy**

1. Go back to Railway dashboard
2. Click **Deployments** tab
3. Wait for deployment to finish (should show "Deployed successfully")
4. Check **Logs** tab - you should see:
   ```
   🚀 Hustl backend running on port 8080
   🔌 WebSocket server ready at ws://...
   ```

---

## ✅ **DONE!**

Your API is now ready! The frontend will automatically:
- Connect to WebSocket for real-time updates
- Use Stripe Payment Element for in-app payments

---

## 🐛 **If Something Goes Wrong:**

1. **WebSocket not connecting?**
   - Check `JWT_SECRET` is set in Railway
   - Check browser console for errors

2. **Payment Element not loading?**
   - Check `STRIPE_PUBLISHABLE_KEY` is set correctly
   - Make sure you're using test keys in test mode

3. **Deployment failed?**
   - Check Railway logs for errors
   - Make sure `ws` package is in `package.json` (run `npm install ws`)

---

## 📋 **Quick Checklist:**

- [ ] Ran `npm install ws`
- [ ] Got Stripe keys from dashboard
- [ ] Added all 5 variables to Railway
- [ ] Pushed code to GitHub
- [ ] Railway deployment succeeded
- [ ] Checked logs for WebSocket message

---

**That's it! You're all set! 🎉**



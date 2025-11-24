# 🔌 WebSocket Setup - Step by Step

The WebSocket is already coded in your app! You just need to install the package and set one environment variable.

---

## ✅ **STEP 1: Install WebSocket Package**

Open PowerShell or Command Prompt in your project folder and run:

```powershell
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
npm install ws
```

**Expected output:**
```
+ ws@8.16.0
added 1 package
```

---

## ✅ **STEP 2: Set JWT_SECRET in Railway**

The WebSocket needs a JWT secret to authenticate connections.

### 2.1 Go to Railway
- **URL:** https://railway.app
- Login to your account

### 2.2 Navigate to Your Project
1. Click on your **Hustl backend project**
2. Click on the **service** (usually "hustl-backend")
3. Click **Variables** tab (or **Settings** → **Variables**)

### 2.3 Add JWT_SECRET Variable

Click **"New Variable"** and add:

```
Name: JWT_SECRET
Value: [Generate a random string - see below]
```

**To generate JWT_SECRET:**

**Option 1 - PowerShell (Windows):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Option 2 - Online Generator:**
- Go to: https://randomkeygen.com/
- Use "CodeIgniter Encryption Keys" section
- Copy any key (they're all random)

**Option 3 - Any Random String:**
- Just type any long random string (at least 32 characters)
- Example: `my-super-secret-jwt-key-12345-abcdefg`

### 2.4 Save
- Railway will automatically redeploy after you add the variable
- Wait for deployment to complete (check **Deployments** tab)

---

## ✅ **STEP 3: Verify WebSocket is Working**

### 3.1 Check Server Logs
1. Go to Railway dashboard
2. Click **Logs** tab
3. Look for this message:
   ```
   🔌 WebSocket server ready at ws://0.0.0.0:8080/ws
   ```

If you see this, WebSocket server is running! ✅

### 3.2 Test in Browser
1. Open your app in browser
2. Open **Developer Console** (F12)
3. Log in to your app
4. Look for this message in console:
   ```
   [WebSocket] Connected
   ```

If you see this, WebSocket is connected! ✅

---

## 🐛 **Troubleshooting**

### Problem: "ws package not found" error
**Solution:**
```powershell
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
npm install ws
```

### Problem: WebSocket connection fails
**Solution:**
- Check `JWT_SECRET` is set in Railway
- Make sure you're logged in (WebSocket needs auth token)
- Check browser console for specific error

### Problem: "Invalid token" error
**Solution:**
- Make sure `JWT_SECRET` in Railway matches the one used to create JWT tokens
- Check that you're logged in (token should be in localStorage)

### Problem: WebSocket URL is wrong
**Solution:**
- In production: Should be `wss://your-railway-url.up.railway.app/ws` (secure)
- In development: Should be `ws://localhost:8080/ws`
- The frontend automatically detects this based on your `BACKEND_URL`

---

## 📋 **What the WebSocket Does**

Once set up, the WebSocket automatically:

1. **Real-time Messages** - New messages appear instantly (no refresh needed)
2. **Typing Indicators** - Shows "User is typing..." in real-time
3. **Job Updates** - Job status changes appear instantly
4. **Notifications** - Real-time notifications for offers, assignments, etc.
5. **Presence** - Shows when users are online/offline

---

## ✅ **Quick Checklist**

- [ ] Ran `npm install ws` (package installed)
- [ ] Added `JWT_SECRET` to Railway
- [ ] Railway deployment completed
- [ ] Server logs show "WebSocket server ready"
- [ ] Browser console shows "[WebSocket] Connected" when logged in

---

## 🎯 **That's It!**

Once you:
1. Install `ws` package ✅
2. Add `JWT_SECRET` to Railway ✅

The WebSocket will automatically:
- Connect when users log in
- Handle real-time updates
- Work seamlessly with your app

**No other configuration needed!** The frontend code is already set up to use it.

---

## 📞 **Still Having Issues?**

1. Check Railway logs for errors
2. Check browser console for WebSocket errors
3. Make sure you're logged in (WebSocket requires authentication)
4. Verify `JWT_SECRET` is set correctly in Railway


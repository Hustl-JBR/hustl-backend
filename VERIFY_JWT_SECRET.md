# ✅ Verify Your JWT_SECRET is Set Correctly

Since you already have a JWT_SECRET, you just need to make sure it's set in Railway for the WebSocket to work.

---

## 🔍 **STEP 1: Check if JWT_SECRET is in Railway**

1. Go to: **https://railway.app**
2. Click your **Hustl project** → **Service** → **Variables** tab
3. Look for `JWT_SECRET` in the list

**If you see it:** ✅ You're good! Skip to Step 3.

**If you DON'T see it:** Continue to Step 2.

---

## 🔧 **STEP 2: Add JWT_SECRET to Railway**

If it's not there, you need to add it:

1. In Railway **Variables** tab, click **"New Variable"**
2. Add:
   ```
   Name: JWT_SECRET
   Value: [Use the SAME value you're using for your auth tokens]
   ```

**Important:** Use the **SAME** JWT_SECRET value that your auth system is using. This is usually set in:
- Your `.env` file (for local development)
- Railway environment variables (for production)
- Or wherever you create JWT tokens

**Where to find your current JWT_SECRET:**
- Check your local `.env` file
- Check Railway variables (might be named differently)
- Check your auth code where `jwt.sign()` is called

---

## ✅ **STEP 3: Verify It's Working**

### 3.1 Check Railway Logs
1. Go to Railway → **Logs** tab
2. Look for:
   ```
   🔌 WebSocket server ready at ws://...
   ```

### 3.2 Test in Browser
1. Open your app
2. Press **F12** (open console)
3. **Log in** to your app
4. Look for:
   ```
   [WebSocket] Connected
   ```

If you see this, WebSocket is working! ✅

---

## 🐛 **Troubleshooting**

### Problem: "Invalid token" error in WebSocket
**This means:** The JWT_SECRET in Railway doesn't match the one used to create tokens.

**Solution:**
1. Find where you create JWT tokens (usually in `routes/auth.js`)
2. Check what `JWT_SECRET` value is used there
3. Make sure the **SAME** value is set in Railway

### Problem: Can't find your JWT_SECRET
**Check these places:**
1. Local `.env` file in your project
2. Railway variables (might be named `JWT_SECRET` or something else)
3. Your auth code - look for `jwt.sign(token, process.env.JWT_SECRET)`

### Problem: WebSocket connects but then disconnects
**This means:** Token is valid but might be expired.

**Solution:**
- Make sure you're logged in (token should be fresh)
- Check token expiration time in your auth code

---

## 📋 **Quick Checklist**

- [ ] Checked Railway variables for `JWT_SECRET`
- [ ] Added `JWT_SECRET` to Railway (if missing)
- [ ] Used the SAME value as your auth system
- [ ] Railway deployment completed
- [ ] Server logs show "WebSocket server ready"
- [ ] Browser console shows "[WebSocket] Connected" when logged in

---

## 🎯 **That's It!**

Once `JWT_SECRET` is set correctly in Railway:
- WebSocket will automatically connect when users log in
- Real-time features will work
- No other configuration needed!

The WebSocket uses the **same JWT_SECRET** as your authentication system to verify tokens.



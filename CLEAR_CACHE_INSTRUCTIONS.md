# 🚨 IMPORTANT: Clear Browser Cache to Fix Upload

## The Problem
The browser is using a **cached version** of `api-integration.js` that still has the old upload code (trying to PUT directly to R2, causing CORS errors).

## Solution: Hard Refresh Your Browser

### Option 1: Hard Refresh (Recommended)
**Windows/Linux:**
- Press `Ctrl + Shift + R`
- OR `Ctrl + F5`

**Mac:**
- Press `Cmd + Shift + R`

### Option 2: Clear Cache Manually

**Chrome/Edge:**
1. Press `F12` to open DevTools
2. Right-click the refresh button
3. Select **"Empty Cache and Hard Reload"**

**Or:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select **"Cached images and files"**
3. Click **"Clear data"**
4. Refresh the page

**Firefox:**
1. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
2. Select **"Cache"**
3. Click **"Clear Now"**
4. Refresh the page

**Safari:**
1. Press `Cmd + Option + E` to clear cache
2. Refresh the page

## Verify It's Working

After clearing cache, check the browser console (F12). You should see:
- `[Upload] Starting file upload through backend API...`
- `[Upload] Uploading to: https://hustljobs.com/r2/upload`

If you still see PUT requests to R2, the cache wasn't cleared properly.

## If Still Not Working

1. **Close all browser tabs** with hustljobs.com
2. **Close the browser completely**
3. **Reopen browser** and go to hustljobs.com
4. **Do a hard refresh** (`Ctrl + Shift + R`)

The new code uploads through the backend API (`/r2/upload`), which then uploads to R2 server-side, avoiding CORS completely.


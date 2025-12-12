# Mapbox Places Autocomplete - Complete Setup Guide

## Step 1: Create Mapbox Account & Get Token

1. **Go to Mapbox**: https://account.mapbox.com/
2. **Sign up** (or log in if you already have an account)
   - You can sign up with email or GitHub
   - Free tier includes 100,000 geocoding requests per month
3. **Get your Access Token**:
   - After logging in, go to **Account** → **Access tokens**
   - You'll see your **Default public token** (starts with `pk.eyJ...`)
   - **Copy this token** - you'll need it in the next step

## Step 2: Set Token in Railway (Recommended for Production)

### Option A: Railway Environment Variable (BEST for Production)

1. **Go to your Railway project**: https://railway.app/
2. **Navigate to your service** (the one running your backend)
3. **Click on "Variables" tab**
4. **Click "New Variable"**
5. **Add the variable**:
   - **Name**: `MAPBOX_TOKEN`
   - **Value**: Paste your Mapbox token (the `pk.eyJ...` one you copied)
6. **Click "Add"**
7. **Redeploy your service** (Railway will automatically redeploy when you add variables)

✅ **Done!** The backend will now serve the token to the frontend automatically.

### Option B: Set in Frontend Config (For Development/Testing)

If you want to test locally or set it directly in the code:

1. **Open** `public/index.html`
2. **Find** the config section (around line 3974):
   ```javascript
   window.HUSTL_CONFIG = {
     API_URL: 'https://hustl-production.up.railway.app'
   };
   ```
3. **Add** the MAPBOX_TOKEN:
   ```javascript
   window.HUSTL_CONFIG = {
     API_URL: 'https://hustl-production.up.railway.app',
     MAPBOX_TOKEN: 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNs...' // Your token here
   };
   ```

⚠️ **Note**: This exposes the token in your code. For production, use Railway environment variables (Option A).

## Step 3: Verify It Works

1. **Open your app** in a browser
2. **Go to "Post a Job"** form
3. **Click on "Pickup address" field**
4. **Start typing an address** (e.g., "123 Main St, Nashville")
5. **You should see** autocomplete suggestions appear below the field
6. **Click on a suggestion**
7. **Check that fields auto-fill**:
   - Street address → "Pickup address" field
   - Neighborhood → "Pickup area" field
   - City → "Pickup city" field
   - ZIP → "Pickup ZIP" field

## Step 4: Optional - Configure Address Privacy

By default, full addresses are hidden from hustlers until they're accepted for a job. To disable this:

In `public/index.html`, add to the config:
```javascript
window.HUSTL_CONFIG = {
  API_URL: 'https://hustl-production.up.railway.app',
  MAPBOX_TOKEN: 'pk.eyJ...',
  HIDE_ADDRESSES_FROM_HUSTLERS: false // Set to false to show addresses to everyone
};
```

## Troubleshooting

### ❌ "No autocomplete suggestions appear"

**Check:**
1. Is your Mapbox token set correctly?
   - Check Railway variables: `MAPBOX_TOKEN` should exist
   - Or check `window.HUSTL_CONFIG.MAPBOX_TOKEN` in browser console
2. Open browser console (F12) and look for errors
3. Check if you see: `"Mapbox token not configured"` warning
4. Verify token starts with `pk.eyJ...` (public token, not secret token)

### ❌ "Token errors in console"

- Make sure you're using the **Default public token** (starts with `pk.eyJ...`)
- Don't use secret tokens (start with `sk.eyJ...`)
- Check that your Mapbox account is active

### ❌ "Addresses not auto-filling"

- Check browser console for JavaScript errors
- Make sure all form fields exist (pickupArea, pickupCity, pickupZip, etc.)
- Try refreshing the page

### ❌ "Distance calculations still wrong"

- Make sure coordinates are being saved (check that `pickupLat`, `pickupLng`, etc. are in job requirements)
- Old jobs without coordinates will still use ZIP code estimation
- New jobs with autocomplete will have accurate distances

## How It Works

1. **User types address** → Mapbox suggests addresses
2. **User selects address** → System extracts:
   - Street address
   - Neighborhood/Area
   - City + State
   - ZIP code
   - Coordinates (lat/lng)
3. **Coordinates stored** → Used for accurate distance calculations
4. **Distance calculated** → Using Haversine formula (much more accurate than ZIP codes)

## Cost

- **Free tier**: 100,000 geocoding requests/month
- **After free tier**: $0.50 per 1,000 requests
- For most apps, the free tier is more than enough

## Security Notes

- ✅ Public tokens (`pk.eyJ...`) are safe to use in frontend code
- ❌ Never use secret tokens (`sk.eyJ...`) in frontend
- ✅ Railway environment variables are secure
- ✅ Token is served from backend endpoint (more secure than hardcoding)

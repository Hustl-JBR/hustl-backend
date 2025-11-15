# 📝 Add Mapbox & Cloudflare R2 Variables to Railway

## Yes! Add These to Railway Variables

### Mapbox (For Address Geocoding)

**Variable Name:** `MAPBOX_TOKEN`
**Value:** Your Mapbox API token

**What it does:**
- Converts addresses to coordinates when jobs are posted
- Used for location-based job searches
- **Optional but recommended** - jobs will still work without it, but location features won't

### Cloudflare R2 (For File Uploads - Profile Pictures)

**Variable Names:**
1. `R2_ACCOUNT_ID` - Your Cloudflare R2 account ID
2. `R2_ACCESS_KEY_ID` - Your R2 access key
3. `R2_SECRET_ACCESS_KEY` - Your R2 secret key
4. `R2_BUCKET` - Your R2 bucket name (e.g., "hustl-uploads")
5. `R2_PUBLIC_BASE` - Your R2 public URL (e.g., "https://your-bucket.r2.dev")

**What it does:**
- Stores profile pictures
- Handles file uploads
- **Optional** - app works without it, but profile picture uploads won't work

## How to Add to Railway:

1. **Go to Railway** → Your Service → **Variables** tab
2. **Click "New Variable"** for each one
3. **Add all variables:**

### Mapbox:
- Name: `MAPBOX_TOKEN`
- Value: `your_mapbox_token_here`

### Cloudflare R2:
- Name: `R2_ACCOUNT_ID`
- Value: `your_account_id`

- Name: `R2_ACCESS_KEY_ID`
- Value: `your_access_key_id`

- Name: `R2_SECRET_ACCESS_KEY`
- Value: `your_secret_access_key`

- Name: `R2_BUCKET`
- Value: `hustl-uploads` (or your bucket name)

- Name: `R2_PUBLIC_BASE`
- Value: `https://your-bucket.r2.dev` (your R2 public URL)

4. **Save each one**
5. **Railway will auto-redeploy**

## Complete Variable List:

After adding everything, you should have:

**Required:**
- ✅ DATABASE_URL
- ✅ JWT_SECRET
- ✅ STRIPE_SECRET_KEY
- ✅ PORT = 8080
- ✅ NODE_ENV = production
- ✅ FRONTEND_BASE_URL = https://hustl-production.up.railway.app

**Optional (but recommended):**
- ✅ RESEND_API_KEY (for emails)
- ✅ FEEDBACK_EMAIL (where feedback goes)
- ✅ MAPBOX_TOKEN (for address geocoding)
- ✅ R2_ACCOUNT_ID (for file uploads)
- ✅ R2_ACCESS_KEY_ID (for file uploads)
- ✅ R2_SECRET_ACCESS_KEY (for file uploads)
- ✅ R2_BUCKET (for file uploads)
- ✅ R2_PUBLIC_BASE (for file uploads)

## What Happens Without Them:

**Without Mapbox:**
- Jobs can still be posted
- Address geocoding won't work (location features disabled)
- Distance-based searches won't work

**Without R2:**
- App works fine
- Profile picture uploads won't work
- File uploads disabled

## Summary:

**Yes, add them!** They enable important features:
- Mapbox = Location features
- R2 = Profile picture uploads

Add them to Railway Variables and your app will have full functionality!


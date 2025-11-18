# Cloudflare R2 CORS Configuration

## ✅ Correct CORS Policy Format

Cloudflare R2 uses AWS S3-compatible CORS format. Here's the **correct** JSON:

```json
[
  {
    "AllowedOrigins": [
      "https://hustl-production.up.railway.app",
      "http://localhost:8080"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## 🔧 How to Apply in Cloudflare Dashboard

1. **Go to Cloudflare Dashboard** → **R2** → Select your bucket (`hustl-uploads`)
2. **Click "Settings"** tab
3. **Scroll to "CORS Policy"** section
4. **Paste the JSON above** (make sure it's valid JSON - no trailing commas!)
5. **Click "Save"**

## ⚠️ Common Issues

### Issue 1: Invalid JSON
- Make sure there are **no trailing commas**
- Make sure all strings are in **double quotes** (not single quotes)
- Make sure the entire thing is wrapped in **square brackets** `[]`

### Issue 2: Wrong Format
- R2 uses **array format** `[{...}]` not object format `{...}`
- Each origin must be a **separate string** in the array

### Issue 3: Missing Methods
- Make sure `PUT` is included (needed for uploads)
- `HEAD` is optional but recommended

## 🧪 Test After Applying

1. Try uploading a profile photo
2. Check browser console (F12) for CORS errors
3. Should see successful upload if CORS is correct

## 📝 Alternative: Minimal CORS (if above doesn't work)

If the above doesn't work, try this minimal version:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Note:** Using `"*"` for origins is less secure but will work for testing. You can restrict it later.

---

## ❌ About D1 Database

**You DON'T need D1 Database!**

- D1 is Cloudflare's SQLite database
- You're using **PostgreSQL on Railway** (which is better!)
- D1 is only needed if you're building a Cloudflare Workers/Pages app
- **Ignore the D1 prompt** - it's not relevant to your setup

Your database is already set up on Railway with PostgreSQL. No action needed!





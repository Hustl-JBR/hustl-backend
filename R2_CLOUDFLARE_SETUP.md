# Cloudflare R2 Setup & Verification Guide

This guide ensures R2/Cloudflare is properly configured and data is flowing correctly.

## ✅ Required Environment Variables

Add these to your Railway environment variables:

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET=hustl-uploads
R2_PUBLIC_BASE=https://pub-xxxxx.r2.dev
```

## 📋 Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **Create bucket**
3. Bucket name: `hustl-uploads`
4. Location: Choose closest to your users (usually `US East`)

## 📋 Step 2: Create API Token

1. In R2 dashboard, go to **Manage R2 API Tokens**
2. Click **Create API Token**
3. Name: `hustl-backend`
4. Permissions: **Object Read & Write**
5. Copy:
   - **Account ID** → `R2_ACCOUNT_ID`
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

## 📋 Step 3: Create Custom Domain (Optional but Recommended)

1. In R2 bucket settings, go to **Custom Domains**
2. Click **Connect Domain**
3. Enter a subdomain: `uploads.hustljobs.com`
4. Cloudflare will create DNS records automatically
5. Use this as `R2_PUBLIC_BASE`: `https://uploads.hustljobs.com`

**OR** use R2's default public URL:
- Go to bucket settings → **Public Access**
- Copy the public URL (e.g., `https://pub-xxxxx.r2.dev`)
- Use this as `R2_PUBLIC_BASE`

## 📋 Step 4: Enable Public Access (for uploads)

1. In bucket settings, go to **Public Access**
2. Enable **Public Access** for the bucket
3. OR configure **Bucket Policy** to allow public read:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::hustl-uploads/*"
       }
     ]
   }
   ```

## ✅ Verification Checklist

### 1. Environment Variables Check
- [ ] All 5 R2 env vars set in Railway
- [ ] `R2_BUCKET` matches your bucket name
- [ ] `R2_PUBLIC_BASE` is a full URL (starts with `https://`)

### 2. Backend Verification

Test the upload endpoint:

```bash
# Local test
curl -X POST http://localhost:8080/r2/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"

# Production test (replace with your domain)
curl -X POST https://hustljobs.com/r2/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
```

Expected response:
```json
{
  "fileKey": "uploads/1234567890-abc123-test-image.jpg",
  "publicUrl": "https://uploads.hustljobs.com/uploads/1234567890-abc123-test-image.jpg"
}
```

### 3. Frontend Verification

1. Go to Profile page
2. Click "Change Photo"
3. Upload an image
4. Verify:
   - [ ] Upload spinner appears
   - [ ] Image uploads successfully
   - [ ] Photo appears immediately on profile
   - [ ] Photo URL is from R2 (`R2_PUBLIC_BASE` domain)

### 4. Database Verification

Check that uploaded photos are stored in database:

```sql
SELECT id, name, photo_url 
FROM users 
WHERE photo_url IS NOT NULL 
LIMIT 10;
```

All `photo_url` values should start with your `R2_PUBLIC_BASE`.

## 🔧 Troubleshooting

### Issue: "Failed to upload file" error

**Check:**
1. R2 credentials are correct in Railway env vars
2. Bucket name matches `R2_BUCKET`
3. API token has Read & Write permissions
4. Bucket exists and is accessible

**Test:**
```bash
# Verify R2 client can connect
node -e "
const { S3Client } = require('@aws-sdk/client-s3');
const client = new S3Client({
  region: 'auto',
  endpoint: \`https://\${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
console.log('R2 client created successfully');
"
```

### Issue: Images not loading after upload

**Check:**
1. `R2_PUBLIC_BASE` is a full URL (includes `https://`)
2. Public access is enabled on bucket
3. Custom domain is configured (if using one)
4. DNS has propagated (can take 24-48 hours for custom domains)

**Test:**
```bash
# Check if public URL is accessible
curl -I https://uploads.hustljobs.com/uploads/test-file.jpg
# Should return 200 OK or 404 (404 means DNS works, file just doesn't exist)
```

### Issue: CORS errors when uploading

**Fix:**
1. In R2 bucket settings, go to **CORS**
2. Add CORS policy:
   ```json
   [
     {
       "AllowedOrigins": ["https://hustljobs.com", "https://www.hustljobs.com"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 📊 Monitoring R2 Usage

1. Go to Cloudflare Dashboard → **R2**
2. View **Usage** tab:
   - Storage used
   - Class A operations (writes)
   - Class B operations (reads)
   - Egress bandwidth

## 🚀 Production Checklist

Before going live:
- [ ] R2 bucket created and configured
- [ ] All 5 env vars set in Railway
- [ ] Public access enabled
- [ ] Custom domain configured (optional)
- [ ] CORS policy added (if needed)
- [ ] Test upload works from frontend
- [ ] Test upload works from backend
- [ ] Photos display correctly after upload
- [ ] Image URLs are accessible publicly

## 📝 Notes

- **Free Tier:** 10GB storage, 1M Class A ops/month, 10M Class B ops/month
- **Pricing:** Very cheap after free tier (~$0.015/GB/month storage)
- **Performance:** Global CDN, fast worldwide access
- **Security:** Private by default, enable public access only for public assets


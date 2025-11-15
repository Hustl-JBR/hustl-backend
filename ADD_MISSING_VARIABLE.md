# ➕ Add Missing Variable

## You're Missing One Variable!

You have:
✅ DATABASE_URL
✅ JWT_SECRET
✅ NODE_ENV
✅ PORT
✅ STRIPE_SECRET_KEY

## ❌ Missing: FRONTEND_BASE_URL

### Add It Now:

1. In Railway → Your Service → Variables tab
2. Click **"New Variable"** button
3. Add:
   - **Name**: `FRONTEND_BASE_URL`
   - **Value**: `https://hustl-production.up.railway.app`
4. Click **"Add"** or **"Save"**

Railway will automatically redeploy when you add it!

## Why This Is Important:

- Your app needs to know its own URL for:
  - CORS (security)
  - Payment redirects (Stripe)
  - Email links
  - API calls

## After Adding:

1. Wait 2-3 minutes for Railway to redeploy
2. Visit: https://hustl-production.up.railway.app
3. Test your app!

## Optional: Use Railway's Auto Variable

Railway provides `RAILWAY_PUBLIC_DOMAIN` which is your domain, but you still need to add `https://` prefix.

However, it's easier to just set `FRONTEND_BASE_URL` explicitly to:
`https://hustl-production.up.railway.app`

## Final Variable List:

After adding, you should have:
1. ✅ DATABASE_URL
2. ✅ JWT_SECRET
3. ✅ NODE_ENV = production
4. ✅ PORT = 8080
5. ✅ STRIPE_SECRET_KEY
6. ✅ FRONTEND_BASE_URL = https://hustl-production.up.railway.app

That's it! You're all set!


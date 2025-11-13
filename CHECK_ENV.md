# Check Your .env File

## You Already Have a .env File!

That's good! Now let's check if it has all the required values.

## How to View .env File

**Option 1: In File Explorer**
1. Open your folder: `C:\Users\jbrea\OneDrive\Desktop\hustl-backend`
2. Click "View" tab at the top
3. Check "Hidden items" checkbox
4. You should see `.env` file
5. Right-click → Open with → Notepad

**Option 2: In Command Prompt**
```cmd
notepad .env
```

## What Should Be in .env

Your `.env` file should have these variables (with your actual values):

```env
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=
MAPBOX_TOKEN=pk....
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=hustl-uploads
R2_PUBLIC_BASE=
RESEND_API_KEY=re_...
PORT=8080
APP_BASE_URL=http://localhost:8080
NODE_ENV=development
JWT_SECRET=...
```

## If Your .env is Empty or Missing Values

1. I just created `.env.example` in your folder
2. Open `.env.example` to see what you need
3. Copy the structure to your `.env` file
4. Fill in your actual API keys

## Next Steps

1. **Check your `.env` file** - make sure it has all the variables
2. **Fill in your API keys** (follow `STEP_BY_STEP_GUIDE.md` Step 3)
3. **Continue with database setup** (Step 5 in the guide)




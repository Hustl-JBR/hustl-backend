# 🧪 Setup Local Testing

## Step 1: Check Your Environment

You need a `.env` file with your database connection.

**Check if you have `.env` file:**
- If yes, make sure it has `DATABASE_URL`
- If no, we'll create one

## Step 2: Run Database Migration

Add the gender and bio columns to your local database:

```bash
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
npx prisma migrate dev --name add_gender_bio
```

This will:
- Create a migration file
- Add `bio` and `gender` columns to your database
- Update Prisma client

## Step 3: Start the Server

```bash
npm run dev
```

Server should start on `http://localhost:8080`

## Step 4: Test Locally

1. Open `http://localhost:8080` in your browser
2. Create a test account
3. Go to Profile
4. **Gender field should appear!**
5. Try Stripe button

## Step 5: Test Everything

Follow the testing checklist in `COMPREHENSIVE_TESTING_GUIDE.md`

## If You Get Errors

**Database connection error:**
- Check `.env` file has `DATABASE_URL`
- Make sure database is accessible

**Migration error:**
- If columns already exist, that's fine
- Migration will skip them

**Port already in use:**
- Change `PORT` in `.env` to something else (like 3000)
- Or stop whatever is using port 8080

Let's get it working locally first! 🚀


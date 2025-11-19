# 🔧 Troubleshooting 500 Error on Job Posting

## 🐛 **Issue**
Getting `500 Internal Server Error` when trying to post a job on the live site.

## 🔍 **Possible Causes**

### **1. JWT_SECRET Missing** ⚠️ **LIKELY**
- `JWT_SECRET` might not be set in Railway environment variables
- Without it, authentication fails → 500 error

### **2. Database Connection Issue**
- Prisma can't connect to database
- Check `DATABASE_URL` in Railway

### **3. Email Verification Check Failing**
- `emailVerified` field might not exist in database
- Schema might be out of date

### **4. Missing Environment Variables**
- Required variables not set in Railway

## ✅ **Fixes Applied**

### **1. Better Error Logging**
- Added detailed error logging to see exactly what's failing
- Console logs will show specific error messages

### **2. JWT_SECRET Check**
- Added check to ensure `JWT_SECRET` is set
- Returns clear error if missing

### **3. Email Verification Bypass (Temporary)**
- Added `REQUIRE_EMAIL_VERIFICATION=false` option
- Can disable email verification requirement for testing

### **4. Better Error Messages**
- More specific error messages for debugging
- Shows exact error cause

## 🔧 **Steps to Fix**

### **Step 1: Check Railway Environment Variables**

Make sure these are set in Railway:
- ✅ `JWT_SECRET` - **CRITICAL!** Generate with: `openssl rand -base64 32`
- ✅ `DATABASE_URL` - Neon PostgreSQL connection string
- ✅ `NODE_ENV=production`

### **Step 2: Check Server Logs**

1. Go to Railway dashboard
2. Click on your service
3. Check "Logs" tab
4. Look for error messages when posting job

### **Step 3: Test JWT Secret**

The logs will now show:
- `[Auth] JWT verification failed:` - Token issue
- `[POST /jobs] Email verification check error:` - Database/email issue
- `JWT_SECRET is not set` - Missing environment variable

### **Step 4: Temporary Bypass (For Testing)**

If you need to bypass email verification temporarily:
1. Add to Railway: `REQUIRE_EMAIL_VERIFICATION=false`
2. Redeploy

**Note:** Re-enable email verification after testing!

## 🔍 **Common Issues**

### **Issue 1: JWT_SECRET Mismatch**
**Symptom:** 401 errors, "Invalid token"
**Fix:** 
- Check `JWT_SECRET` in Railway matches local `.env`
- Generate new secret if needed: `openssl rand -base64 32`
- Update both Railway and `.env`

### **Issue 2: Database Connection**
**Symptom:** 500 errors, "Prisma" errors in logs
**Fix:**
- Check `DATABASE_URL` in Railway
- Verify database is accessible
- Check database migrations ran

### **Issue 3: Missing Schema Fields**
**Symptom:** 500 errors on email verification check
**Fix:**
- Run migrations: `npm run db:migrate`
- Check `emailVerified` field exists in User model

## 📋 **Checklist**

- [ ] `JWT_SECRET` is set in Railway
- [ ] `DATABASE_URL` is set in Railway
- [ ] Database is accessible
- [ ] Migrations have run
- [ ] Server logs show detailed errors
- [ ] Check Railway logs for specific error messages

## 🚀 **Next Steps**

1. Check Railway logs for exact error
2. Verify `JWT_SECRET` is set
3. Verify `DATABASE_URL` is correct
4. Check if database migrations ran
5. Test with detailed logging

**The improved error logging will help identify the exact issue!** 🔍


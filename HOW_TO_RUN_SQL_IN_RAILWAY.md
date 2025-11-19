# 🚂 How to Run SQL in Railway - Step by Step

## 📋 Step-by-Step Guide

### Option 1: Using Railway Dashboard (Recommended)

**Step 1: Access Railway Dashboard**
1. Go to: https://railway.app
2. Log in to your account

**Step 2: Find Your Database**
1. Click on your **Hustl project** (or whatever you named it)
2. Look for a service called **"Postgres"** or **"PostgreSQL"** or **"Neon"**
   - It might also be named something like "Database" or "Neon Postgres"
   - Look for a green or blue icon with a database symbol

**Step 3: Open Database Service**
1. **Click on the database service** to open it

**Step 4: Find the Query/Data Tab**
Once inside the database service, look for one of these tabs:
- **"Query"** tab (most common)
- **"Data"** tab
- **"SQL Editor"** tab
- **"Console"** tab
- **"Connect"** tab (sometimes has a query option)

**If you see a "Connect" tab:**
1. Click on **"Connect"** tab
2. You might see a **"Query"** button or link
3. Or look for a **"Open in pgAdmin"** or **"Open in DataGrip"** option

**Step 5: Run SQL**
1. Click on the **"Query"** tab (or whatever tab you found)
2. You should see a **text box** or **SQL editor**
3. Paste this SQL (replace with your actual email):
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
   ```
4. Click **"Run"** or **"Execute"** button
5. You should see a success message like "1 row affected"

---

### Option 2: Using Railway CLI (Command Line)

**Step 1: Install Railway CLI** (if not installed)
1. Download from: https://docs.railway.app/develop/cli
2. Or install via npm:
   ```bash
   npm install -g @railway/cli
   ```

**Step 2: Login**
```bash
railway login
```

**Step 3: Connect to Database**
```bash
railway connect
```
- This will give you a connection string or open psql

**Step 4: Run SQL**
- If it opens psql, run:
  ```sql
  UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
  ```

---

### Option 3: Using External Tool (pgAdmin, DBeaver, etc.)

**Step 1: Get Connection String from Railway**
1. Go to Railway Dashboard
2. Click on your database service
3. Go to **"Variables"** tab
4. Look for `DATABASE_URL` or `POSTGRES_URL` or similar
5. Copy the connection string

**Step 2: Connect with External Tool**
1. Open pgAdmin, DBeaver, or any PostgreSQL client
2. Create new connection using the connection string
3. Run the SQL:
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
   ```

---

### Option 4: Using Neon Dashboard (If Using Neon)

If you're using Neon Postgres through Railway:

1. Go to Railway Dashboard
2. Click on your database service
3. Look for a **"Open in Neon Dashboard"** button or link
4. Click it (opens Neon's website)
5. In Neon Dashboard:
   - Go to **"SQL Editor"** tab
   - Paste your SQL
   - Click **"Run"**

---

## 🔍 What to Look For in Railway

### Common Tab Names:
- ✅ **"Query"** - Most common
- ✅ **"Data"** - Sometimes has SQL option
- ✅ **"SQL Editor"** - Direct SQL editor
- ✅ **"Console"** - Command line interface
- ✅ **"Connect"** - Might have query option
- ✅ **"Settings"** - Sometimes has database access

### What the SQL Editor Looks Like:
- Usually a **white text box** at the top
- Has a **"Run"** or **"Execute"** button below it
- Might have tabs for "Query", "Results", etc.

---

## 🎯 Quick Alternative: Use Railway Variables

**If you still can't find the Query tab, try this:**

1. Go to Railway Dashboard
2. Click on your **project** (not database)
3. Click **"Variables"** tab
4. Look for your database connection string
5. Copy the `DATABASE_URL` value
6. Use it to connect with a PostgreSQL client (pgAdmin, DBeaver, etc.)

---

## 🆘 Still Can't Find It?

### Try These:

1. **Check if you're in the right project:**
   - Make sure you're looking at the production project, not a different one

2. **Check if it's a Neon database:**
   - Look for "Neon" in the database name
   - Neon has its own dashboard at https://neon.tech
   - Railway might link to it

3. **Check the database type:**
   - Railway supports multiple databases
   - Look for "Postgres", "PostgreSQL", "Neon", etc.

4. **Look for "Settings" or "Info" tab:**
   - Sometimes database access is under Settings
   - Or there might be a "Open in [tool]" link

---

## 📸 Screenshot Guide

**What Railway Dashboard looks like:**
```
Railway Dashboard
└── Your Project Name
    └── Services (tabs at top)
        ├── API Service
        ├── Database Service ← Click this!
        └── Other Services
    
    Inside Database Service:
    └── Tabs:
        ├── Deployments
        ├── Metrics
        ├── Variables
        ├── Query ← Look for this!
        ├── Connect
        └── Settings
```

---

## 🔧 Alternative: Use a Database Client

**If Railway's interface is confusing, use an external tool:**

1. **Install pgAdmin** (free): https://www.pgadmin.org/download/
2. **Get connection string from Railway:**
   - Railway Dashboard → Database → Variables → `DATABASE_URL`
3. **Connect with pgAdmin:**
   - Create new server
   - Paste connection string
   - Run SQL there

---

## ✅ Verify It Worked

After running the SQL, verify it worked:

1. In Railway Query tab, run:
   ```sql
   SELECT email, roles FROM users WHERE email = 'your-email@example.com';
   ```
2. Should show your email and `{ADMIN}` in roles column

---

**Still stuck?** 
- Try taking a screenshot of your Railway dashboard
- Or describe what tabs you see in the database service
- I can help guide you more specifically!


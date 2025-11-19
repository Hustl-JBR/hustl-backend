# ✅ EASIEST Way to Make Yourself Admin

## 🎯 Quick Method: Use a Node.js Script

Instead of trying to find SQL in Railway, use this simple script:

### Step 1: Create Script File

Create a file called `make-admin.js` in your project root:

```javascript
// make-admin.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeAdmin() {
  // CHANGE THIS to your actual email
  const yourEmail = 'your-email@example.com';
  
  try {
    const user = await prisma.user.update({
      where: { email: yourEmail },
      data: {
        roles: ['ADMIN'],
      },
    });
    
    console.log('✅ Success! User is now admin:');
    console.log('Email:', user.email);
    console.log('Roles:', user.roles);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2025') {
      console.error('User not found! Check your email address.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
```

### Step 2: Update Your Email

1. Open `make-admin.js` (or create it)
2. Change `'your-email@example.com'` to your actual email
3. Save the file

### Step 3: Set Production Database URL

**Option A: Set in Railway**
1. Go to Railway Dashboard → Your Project
2. Click on your **API service** (not database)
3. Go to **Variables** tab
4. Find `DATABASE_URL` or add it if missing
5. Copy the `DATABASE_URL` from your database service

**Option B: Set Locally (Temporary)**
1. Get `DATABASE_URL` from Railway:
   - Railway Dashboard → Database Service → Variables → `DATABASE_URL`
2. Run command:
   ```bash
   cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
   $env:DATABASE_URL="your-database-url-here"
   ```

### Step 4: Run the Script

**On Windows (PowerShell):**
```bash
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
node make-admin.js
```

**Or set DATABASE_URL inline:**
```bash
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
$env:DATABASE_URL="your-database-url"; node make-admin.js
```

### Step 5: Verify

The script will print:
```
✅ Success! User is now admin:
Email: your-email@example.com
Roles: [ 'ADMIN' ]
```

---

## 🔧 Alternative: Use Prisma Studio (Visual GUI)

### Step 1: Connect to Production Database

1. Get `DATABASE_URL` from Railway:
   - Railway Dashboard → Database Service → Variables → `DATABASE_URL`

2. Set it temporarily:
   ```bash
   cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
   $env:DATABASE_URL="your-database-url"
   ```

### Step 2: Open Prisma Studio

```bash
npx prisma studio
```

This opens a web interface at `http://localhost:5555`

### Step 3: Update User

1. In Prisma Studio, click **User** model
2. Find your user by email
3. Click on your user row
4. Find the **roles** field
5. Change it to: `["ADMIN"]` or just `ADMIN`
6. Click **Save 1 change**

---

## 🌐 Alternative: Use Neon Dashboard Directly

If you're using Neon Postgres through Railway:

### Step 1: Get Neon Dashboard Link

1. Go to Railway Dashboard
2. Click on your database service
3. Look for a button that says:
   - **"Open in Neon"**
   - **"View in Neon Dashboard"**
   - **"Neon Dashboard"**
   - Or a link to `neon.tech`

### Step 2: Access Neon Dashboard

1. Click the link (or go to https://neon.tech)
2. Log in with your account
3. Select your project

### Step 3: Run SQL in Neon

1. In Neon Dashboard, go to **SQL Editor** tab
2. Paste this SQL:
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
   ```
3. Click **Run** button
4. Should see "1 row affected"

---

## 📱 Alternative: Use DBeaver (Free Database Tool)

### Step 1: Download DBeaver

1. Go to: https://dbeaver.io/download/
2. Download DBeaver Community Edition (free)
3. Install it

### Step 2: Get Database Connection String

1. Go to Railway Dashboard
2. Click on your database service
3. Go to **Variables** tab
4. Copy `DATABASE_URL` value
   - Looks like: `postgresql://user:pass@host:port/dbname?sslmode=require`

### Step 3: Connect in DBeaver

1. Open DBeaver
2. Click **New Database Connection**
3. Select **PostgreSQL**
4. In Connection Settings:
   - Extract parts from `DATABASE_URL`:
     - **Host:** (from connection string)
     - **Port:** (from connection string)
     - **Database:** (from connection string)
     - **Username:** (from connection string)
     - **Password:** (from connection string)
5. Click **Test Connection**
6. Click **Finish**

### Step 4: Run SQL

1. Right-click on your database
2. Select **SQL Editor** → **New SQL Script**
3. Paste:
   ```sql
   UPDATE users SET roles = ARRAY['ADMIN'] WHERE email = 'your-email@example.com';
   ```
4. Click **Execute** button (or press Ctrl+Enter)
5. Should see "1 row(s) affected"

---

## 🎯 RECOMMENDED: Use the Node.js Script (Easiest!)

I'll create the script file for you. Just tell me your email address and I'll set it up!

**Or do it yourself:**

1. Create `make-admin.js` in your project root
2. Copy the script from above
3. Change the email
4. Run: `node make-admin.js`

---

## ✅ Verify It Worked

After making yourself admin, verify:

**Option 1: Check in Production Site**
1. Log out and log back in to production site
2. Go to: `https://hustljobs.com/admin.html`
3. Should see admin dashboard!

**Option 2: Check with Script**
```javascript
// verify-admin.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.findUnique({
  where: { email: 'your-email@example.com' },
  select: { email: true, roles: true }
}).then(u => {
  console.log('User:', u);
  console.log('Is Admin?', u.roles.includes('ADMIN'));
  prisma.$disconnect();
});
```

---

**The Node.js script is the EASIEST way! Want me to create it for you?**


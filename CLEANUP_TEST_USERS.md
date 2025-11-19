# 🧹 Cleanup Test Users Guide

## ✅ **Yes, you should delete test/fake users before going live!**

Test users can:
- Clutter your database
- Appear in search results
- Confuse real users
- Affect analytics
- Take up database space

## 🔍 **How to Identify Test Users**

The cleanup script identifies test users by:
- **Email patterns:** test@, fake@, demo@, @hustl.com, @example.com, @test.com, temp, dummy
- **Username patterns:** test*, fake*, demo*, example*, temp*, dummy*, admin, johndoe, janehustler
- **Name patterns:** Test, Fake, Demo, Example, Temp, Dummy, "Admin User", "John Customer", "Jane Hustler"

## 📋 **Step-by-Step Instructions**

### **Step 1: List Test Users (Dry Run)**

First, see what test users exist **without deleting anything**:

```bash
npm run cleanup:test-users
```

Or directly:
```bash
node scripts/cleanup-test-users.js --list
```

This will:
- ✅ Show all test users found
- ✅ Show their activity (jobs, offers, etc.)
- ✅ Show what will be deleted
- ✅ **NOT delete anything**

### **Step 2: Review the List**

Review the output carefully:
- Check if any "real" users were mistakenly flagged
- Verify the test users are actually test accounts
- Check how many jobs/offers will be deleted

### **Step 3: Delete Test Users (If Confirmed)**

**⚠️ WARNING: This permanently deletes data!**

Only run this after reviewing the list:

```bash
npm run cleanup:test-users:delete
```

Or directly:
```bash
node scripts/cleanup-test-users.js --delete
```

This will:
1. Show the list of test users again
2. Ask for confirmation (type "DELETE" to confirm)
3. Delete all test users and their related data:
   - User accounts
   - Jobs they created
   - Offers they made
   - Messages they sent
   - Reviews they gave/received
   - Payments associated with them

## 🗑️ **What Gets Deleted**

When a test user is deleted, the following **cascade deletes** (automatic):
- ✅ User account
- ✅ Jobs they created as customer
- ✅ Jobs assigned to them as hustler
- ✅ Offers they made
- ✅ Messages they sent
- ✅ Threads they're in
- ✅ Reviews they gave or received
- ✅ Payments associated with them

**Note:** This uses Prisma's cascade delete, so related data is automatically cleaned up.

## 📊 **Example Output**

```
📊 Total users: 25
🧪 Test users found: 8
✅ Real users: 17

🧪 TEST USERS TO DELETE:

────────────────────────────────────────────────────────────────────────────────
📧 Email: admin@hustl.com
👤 Username: admin
📛 Name: Admin User
🎭 Roles: ADMIN
📅 Created: 2024-01-15T10:30:00.000Z
📊 Activity: 0 jobs as customer, 0 jobs as hustler, 0 offers
🔍 Reason: email pattern
🆔 ID: cmhxr0nji0000136s706apnh6
────────────────────────────────────────────────────────────────────────────────

⚠️  WARNING: Deleting these users will also delete:
   - 5 jobs (created by or assigned to test users)
   - 12 offers (from test users)
   - All related messages, threads, reviews, and payments
```

## 🔒 **Safety Features**

1. **Dry run by default** - Lists users without deleting
2. **Confirmation required** - Must type "DELETE" to confirm
3. **Detailed output** - Shows exactly what will be deleted
4. **Error handling** - Continues even if one user fails

## ⚙️ **Customization**

If you need to add more test user patterns, edit `scripts/cleanup-test-users.js`:

```javascript
// Add more email patterns
const TEST_EMAIL_PATTERNS = [
  /your-custom-pattern/i,
  // ... existing patterns
];

// Add more username patterns
const TEST_USERNAME_PATTERNS = [
  /your-custom-pattern/i,
  // ... existing patterns
];
```

## 🚀 **Before Going Live**

1. ✅ Run `npm run cleanup:test-users` to see what will be deleted
2. ✅ Review the list carefully
3. ✅ Make sure no real users are flagged
4. ✅ Run `npm run cleanup:test-users:delete` to clean up
5. ✅ Verify the database is clean

## ❓ **FAQ**

**Q: What if a real user is mistakenly flagged?**
A: Review the patterns in the script and adjust them before deleting. The script shows the reason for each flag.

**Q: Can I undo the deletion?**
A: No, deletion is permanent. Make sure to review the list first!

**Q: Will this affect production data?**
A: This script runs on whatever database your `DATABASE_URL` points to. Make sure you're connected to the right database!

**Q: What about jobs/offers from test users?**
A: They are automatically deleted via cascade delete when the user is deleted.

## 📝 **Notes**

- The script uses Prisma's cascade delete, so related data is automatically removed
- Test users with active jobs/payments will still be deleted (be careful!)
- Always run `--list` first to review what will be deleted
- Make a database backup before deleting if you're unsure

---

**Ready to clean up? Run `npm run cleanup:test-users` to get started!** 🧹


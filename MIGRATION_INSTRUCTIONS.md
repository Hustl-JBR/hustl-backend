# Migration Instructions - Message Read Status

## ⚠️ IMPORTANT: Run This Migration

After pulling these changes, you **must** run the database migration to add message read status columns.

### Step 1: Generate Prisma Client
```bash
npx prisma generate
```

### Step 2: Run Migration
```bash
# For development
npx prisma migrate dev --name add_message_read_status

# For production (Railway)
npx prisma migrate deploy
```

### Step 3: Verify Migration
The migration will:
- Add `read` column (Boolean, default: false)
- Add `read_at` column (DateTime, nullable)
- Add `read_by` column (String, nullable)
- Create index on `read` column for performance
- Backfill existing messages to have `read = false`

### Step 4: Test
1. Send a message between two users
2. Check that message shows as unread
3. View the thread - message should be marked as read automatically
4. Verify unread count appears in threads list

---

## What Changed

### Database Schema
- **Message model**: Added `read`, `readAt`, `readBy` fields
- **Index**: Added on `read` field for faster queries

### Backend Routes
- **GET /threads**: Now includes `unreadCount` per thread
- **GET /threads/:id/messages**: Automatically marks messages as read when viewed
- **POST /threads/:id/messages/:messageId/read**: Mark specific message as read
- **POST /threads/:id/mark-all-read**: Mark all messages in thread as read

### Frontend API
- **hustlAPI.messages.markMessageRead(threadId, messageId)**: New method
- **hustlAPI.messages.markAllMessagesRead(threadId)**: New method

### Job Business Rules
- **Max 2 active jobs**: Enforced in POST /jobs
- **No delete after OTW**: Enforced in DELETE /jobs and POST /jobs/:id/cancel
- **Auto-cleanup**: Runs every 2 hours via `services/cleanup.js`

---

## After Migration

1. ✅ Messages will have read status tracking
2. ✅ Unread counts will appear in threads list
3. ✅ Notifications will only show unread messages
4. ✅ Job business rules will be enforced
5. ✅ Mode switching will refresh backend data

---

**If you encounter any issues, check the migration file:**
`prisma/migrations/20250120_add_message_read_status/migration.sql`


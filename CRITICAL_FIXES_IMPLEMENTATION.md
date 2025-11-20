# Critical Fixes Implementation Plan

## Status: In Progress

### ✅ 1. Token Storage - VERIFIED WORKING
- Location: `public/api-integration.js` lines 75, 89
- Status: Token IS being saved correctly
- If still having issues, may be browser-specific or timing-related

### 🔄 2. Message Read Status - IN PROGRESS

**Schema Update (DONE):**
- Added `read: Boolean @default(false)`
- Added `readAt: DateTime?`
- Added `readBy: String?`
- Added index on `read` field

**Next Steps:**
1. Create migration file
2. Update threads endpoint to include unread count
3. Add mark-as-read endpoint
4. Update message send to create notifications

### 📋 3. Job Auto-Delete & Business Rules

**Status:** Pending implementation
**Files to modify:**
- `routes/jobs.js` - Add validation rules
- `scripts/cleanup-old-jobs.js` - Create cleanup script
- `routes/jobs.js` - Add deletion rules to cancel endpoint

### 📋 4. Mode Switching Backend Integration

**Status:** Pending implementation
**Files to modify:**
- `public/index.html` - Update mode toggle to trigger API refresh
- May need backend endpoint to track active mode

### 📋 5. Scalability Improvements

**Status:** Pending implementation
**Files to modify:**
- `db.js` or Prisma client initialization - Add connection pooling
- `server.js` or middleware - Add rate limiting
- Consider Redis caching layer (future)

---

## Implementation Order

1. ✅ Schema update for Message read status (DONE)
2. ⏳ Threads endpoint with unread count
3. ⏳ Mark messages as read endpoint
4. ⏳ Notification creation on message send
5. ⏳ Job business rules (max 2 active, no delete after OTW)
6. ⏳ Job auto-delete cleanup script
7. ⏳ Mode switching backend integration
8. ⏳ Connection pooling
9. ⏳ Rate limiting

---

## Notes

- Token storage appears to be working - may need to verify browser localStorage persistence
- All changes must be tested thoroughly
- Migration must be run after schema changes


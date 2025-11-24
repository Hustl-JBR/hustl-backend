# Duplicate Import Fix ✅

## **Problem:**
App crashed with error: `SyntaxError: Identifier 'sendJobExpiringEmail' has already been declared`

## **Root Cause:**
Duplicate import statement in `services/cleanup.js`:
- Line 6: `const { sendJobExpiringEmail } = require('./email');`
- Line 7: `const { sendJobExpiringEmail } = require('./email');` ← **DUPLICATE**

## **Fix Applied:**
Removed the duplicate import on line 7.

## **Files Changed:**
- `services/cleanup.js` - Removed duplicate import

## **Commit Message:**
```
Fix duplicate import causing SyntaxError in cleanup.js
```

---

**App should now start without errors!** 🎉





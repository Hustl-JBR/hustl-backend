# Fix PowerShell Execution Policy

PowerShell is blocking npm from running. Here's how to fix it:

## Quick Fix (Recommended)

Run this command in PowerShell **as Administrator**:

1. **Right-click** on PowerShell icon
2. Click **"Run as Administrator"**
3. Run this command:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
4. Type `Y` and press Enter when asked
5. Close the admin PowerShell window
6. Open a **regular** PowerShell window (not admin)
7. Try `npm install` again

## Alternative: Use Command Prompt Instead

If you don't want to change PowerShell settings:

1. Press `Windows Key + R`
2. Type: `cmd` and press Enter
3. Run:
   ```cmd
   cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
   npm install
   ```

Command Prompt doesn't have this restriction, so npm will work there.

## What This Does

The execution policy is a Windows security feature. Setting it to `RemoteSigned` allows:
- Local scripts to run (like npm)
- Downloaded scripts to run if they're signed

This is safe and commonly needed for development.

## After Fixing

Once you've fixed it, go back to `STEP_BY_STEP_GUIDE.md` and continue with Step 1.





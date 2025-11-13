# Install Node.js First

You need to install Node.js before you can run `npm install`.

## Quick Install (5 minutes)

### Option 1: Official Installer (Recommended)

1. **Go to:** https://nodejs.org
2. **Download** the "LTS" version (Long Term Support)
   - It will say something like "Recommended For Most Users"
   - Click the big green button
3. **Run the installer:**
   - Double-click the downloaded file (usually in Downloads folder)
   - Click "Next" through all the prompts
   - **IMPORTANT:** Make sure "Add to PATH" is checked (it should be by default)
   - Click "Install"
   - Wait for it to finish
4. **Restart PowerShell:**
   - Close your current PowerShell window
   - Open a NEW PowerShell window
5. **Verify it worked:**
   ```powershell
   node --version
   npm --version
   ```
   You should see version numbers (like `v20.x.x` and `10.x.x`)

### Option 2: Using Winget (Windows Package Manager)

If you have Windows 11 or Windows 10 with winget:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then restart PowerShell and verify:
```powershell
node --version
npm --version
```

## After Installing Node.js

Once Node.js is installed, come back to `STEP_BY_STEP_GUIDE.md` and continue from Step 1.

## Verify Installation

Run these commands in PowerShell:

```powershell
node --version
npm --version
```

If you see version numbers, you're good to go! ✅

If you still get errors, you may need to:
1. Restart your computer
2. Or manually add Node.js to your PATH (see troubleshooting below)

## Troubleshooting

**Still says "npm is not recognized" after installing?**

1. Close ALL PowerShell/Command Prompt windows
2. Open a NEW PowerShell window
3. Try again

**Still not working?**

1. Check if Node.js is installed:
   - Press `Windows Key + R`
   - Type: `C:\Program Files\nodejs\`
   - Press Enter
   - If you see `node.exe` and `npm.cmd`, it's installed

2. If it's installed but not working:
   - Restart your computer
   - Or add to PATH manually (advanced - ask if needed)

## Next Steps

Once Node.js is installed:
1. Go back to `STEP_BY_STEP_GUIDE.md`
2. Continue with Step 1: `npm install`





# Backup & Cloud Storage Guide

## Current Location
`C:\Users\jbrea\OneDrive\Desktop\hustl-backend`

## Backup Options

### 1. OneDrive (Already Syncing)
✅ Your folder is in OneDrive, so it's already being backed up automatically!

**Check sync status:**
- Look for OneDrive icon in system tray
- Green checkmark = synced
- Blue spinning = syncing
- Red X = error

### 2. GitHub (Recommended for Code)
Your code should be in GitHub for version control.

**Setup:**
```bash
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Hustl-JBR/Hustl.git
git push -u origin main
```

**Important:** Add `.env` to `.gitignore` (never commit secrets!)

### 3. Additional Cloud Backups

#### Option A: Google Drive
1. Install Google Drive Desktop
2. Copy `hustl-backend` folder to Google Drive folder
3. It will sync automatically

#### Option B: Dropbox
1. Install Dropbox Desktop
2. Copy `hustl-backend` folder to Dropbox folder
3. It will sync automatically

#### Option C: External Hard Drive
1. Connect external drive
2. Copy entire `hustl-backend` folder
3. Keep in safe location

### 4. Railway (Production Backup)
Railway automatically backs up your deployed app. Your code is safe there too.

## What to Backup

### ✅ Must Backup:
- All code files (`server.js`, `routes/`, `services/`, etc.)
- `package.json` and `package-lock.json`
- `prisma/schema.prisma`
- `public/` folder (frontend files)
- `.env.example` (NOT `.env` - that has secrets!)

### ❌ Don't Backup:
- `node_modules/` (can reinstall with `npm install`)
- `.env` (contains secrets - keep secure!)
- `dist/` or `build/` folders (can rebuild)

## Automated Backup Script

Create `backup.ps1` in your project root:

```powershell
# Backup script for Hustl
$source = "C:\Users\jbrea\OneDrive\Desktop\hustl-backend"
$backup = "C:\Users\jbrea\Backups\hustl-backend-$(Get-Date -Format 'yyyy-MM-dd')"

# Create backup directory
New-Item -ItemType Directory -Force -Path $backup

# Copy files (exclude node_modules and .env)
Get-ChildItem -Path $source -Exclude node_modules,.env | 
    Copy-Item -Destination $backup -Recurse -Force

Write-Host "Backup complete: $backup"
```

Run it:
```powershell
.\backup.ps1
```

## Recommended Setup

1. **OneDrive** - Automatic daily sync ✅ (already set up)
2. **GitHub** - Version control & code backup
3. **Railway** - Production deployment & backup
4. **External Drive** - Monthly manual backup (optional)

## Security Notes

- Never commit `.env` to GitHub
- Use `.env.example` for sharing config structure
- Keep API keys secure
- Use Railway's environment variables for production secrets

## Quick Backup Checklist

- [ ] Code pushed to GitHub
- [ ] OneDrive sync active
- [ ] `.env` file secured (not in backups)
- [ ] Database backups configured (Neon has automatic backups)
- [ ] Railway deployment working





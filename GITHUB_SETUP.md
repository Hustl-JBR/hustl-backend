# GitHub Setup - Push Your Code

## Your Repository

- **Owner:** `Hustl-JBR`
- **Repository:** `Hustl`
- **Full URL:** `https://github.com/Hustl-JBR/Hustl`

## ⚠️ First: Install Git!

**You need Git installed first!** See `INSTALL_GIT.md` for instructions.

**Easiest option:** Install GitHub Desktop (includes Git and is easier to use)

---

## Step 1: Initialize Git (If Not Already Done)

Open Command Prompt in your project folder:

```cmd
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
git init
```

## Step 2: Add All Files

```cmd
git add .
```

**Important:** Make sure `.env` is in `.gitignore` (it should be) so you don't commit your API keys!

## Step 3: Make First Commit

```cmd
git commit -m "Initial commit - Hustl backend with Express API"
```

## Step 4: Connect to GitHub

```cmd
git branch -M main
git remote add origin https://github.com/Hustl-JBR/Hustl.git
```

## Step 5: Push to GitHub

```cmd
git push -u origin main
```

You'll be asked to log in to GitHub. Use your company email credentials.

## Verify

1. Go to: https://github.com/Hustl-JBR/Hustl
2. You should see all your files!

## Future Updates

Whenever you make changes:

```cmd
git add .
git commit -m "Description of changes"
git push
```

## Security Reminder

✅ **NEVER commit `.env` file!**
- It contains your API keys
- `.gitignore` should already exclude it
- Double-check before pushing!

## Troubleshooting

**"Repository not found"?**
→ Make sure the repository exists at https://github.com/Hustl-JBR/Hustl

**"Authentication failed"?**
→ You may need to set up a Personal Access Token instead of password

**"Permission denied"?**
→ Make sure you're logged into GitHub with the Hustl-JBR account


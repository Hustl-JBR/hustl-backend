# Pre-Commit Checklist ✅

**Before you commit and push files to GitHub, check these things:**

## 🔍 Quick Checks

### 1. **Test Locally First**
- [ ] Server starts without errors (`npm start`)
- [ ] No console errors in browser
- [ ] Test the feature you just changed
- [ ] Test on mobile view (resize browser)

### 2. **Check for Sensitive Data**
- [ ] No API keys in code (use environment variables)
- [ ] No passwords or secrets committed
- [ ] No `.env` file in commits (should be in `.gitignore`)
- [ ] Check `package.json` - no test keys

### 3. **Remove Debug Code**
- [ ] Remove `console.log()` statements (or comment them)
- [ ] Remove test/debug code
- [ ] Remove commented-out code blocks
- [ ] Remove TODO comments (or move to issues)

### 4. **File Cleanup**
- [ ] No temporary files (`.tmp`, `.bak`, `.old`)
- [ ] No large files (images, videos) - use R2/cloud storage
- [ ] No `node_modules` folder (should be in `.gitignore`)
- [ ] No build artifacts

### 5. **Code Quality**
- [ ] No obvious bugs
- [ ] Code is readable
- [ ] Variable names make sense
- [ ] No duplicate code

---

## 📝 Before Committing

### Step 1: Check What Changed
```powershell
git status
```
- Review the list of files that changed
- Make sure you're only committing what you want

### Step 2: Review Your Changes
```powershell
git diff
```
- Look through the changes
- Make sure nothing unexpected is included

### Step 3: Add Files Selectively
```powershell
# Add specific files
git add public/index.html
git add routes/jobs.js

# OR add all changes (be careful!)
git add .
```

### Step 4: Commit with Clear Message
```powershell
git commit -m "Add dark mode toggle in profile settings"
```

**Good commit messages:**
- ✅ "Add dark mode toggle in profile settings"
- ✅ "Fix unread message badge count"
- ✅ "Update job completion flow for hustlers"
- ✅ "Add pagination to jobs list"

**Bad commit messages:**
- ❌ "fix stuff"
- ❌ "update"
- ❌ "changes"
- ❌ "asdf"

---

## 🚀 Before Pushing

### 1. **Pull Latest Changes First**
```powershell
git pull origin main
```
- Gets any changes others made
- Resolves conflicts if needed

### 2. **Test One More Time**
- [ ] Run the server after pulling
- [ ] Quick smoke test
- [ ] Make sure nothing broke

### 3. **Push to GitHub**
```powershell
git push origin main
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ Don't Commit:
- `.env` files (secrets!)
- `node_modules/` folder
- Large files (>10MB)
- Personal notes or TODOs
- Test data or fake accounts
- API keys or passwords

### ❌ Don't Push:
- Broken code (test first!)
- Incomplete features (unless it's a WIP branch)
- Code with console errors
- Code that breaks existing features

### ✅ Do Commit:
- Working features
- Bug fixes
- UI improvements
- Documentation updates
- Configuration changes (without secrets)

---

## 🔐 Security Checklist

**NEVER commit these:**
- [ ] `.env` file
- [ ] API keys (Stripe, Mapbox, etc.)
- [ ] Database passwords
- [ ] JWT secrets
- [ ] Private keys
- [ ] OAuth client secrets

**If you accidentally committed secrets:**
1. **Don't panic!**
2. Change the secrets immediately (generate new keys)
3. Remove from git history (ask for help if needed)
4. Add to `.gitignore` for future

---

## 📋 Quick Command Reference

```powershell
# See what changed
git status

# See actual changes
git diff

# Add specific file
git add filename.js

# Add all changes
git add .

# Commit
git commit -m "Your message here"

# Pull latest
git pull origin main

# Push to GitHub
git push origin main

# See commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

---

## ✅ Final Checklist

Before you push, ask yourself:

1. ✅ Does the code work?
2. ✅ Did I test it?
3. ✅ No secrets in code?
4. ✅ No debug code left?
5. ✅ Clear commit message?
6. ✅ Pulled latest changes?
7. ✅ Ready to share?

**If all checked, you're good to push! 🚀**

---

## 🆘 Need Help?

If something goes wrong:
- `git status` - See what's happening
- `git log` - See recent commits
- `git diff` - See what changed
- Ask for help before force pushing!

**Remember:** It's better to ask than to break something! 😊


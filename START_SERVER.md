# 🚀 EXACT POWERSHELL COMMANDS TO START SERVER

## Step-by-Step Commands

### 1. Open PowerShell
- Press `Windows Key + X`
- Click "Windows PowerShell" or "Terminal"
- OR search for "PowerShell" in Start menu

### 2. Navigate to Project Folder
```powershell
cd "C:\Users\jbrea\OneDrive\Desktop\hustl-backend"
```

### 3. Start the Server
```powershell
npm start
```

## ✅ That's It!

You should see output like:
```
Server running on http://localhost:3000
```

## 🔄 If Server Won't Start

### Check if Node.js is installed:
```powershell
node --version
```

### Check if npm is installed:
```powershell
npm --version
```

### Install dependencies (if needed):
```powershell
npm install
```

### Check if port 3000 is already in use:
```powershell
netstat -ano | findstr :3000
```

If something is using port 3000, you can:
- Stop that process
- OR change PORT in `.env` file

## 🛑 To Stop the Server

Press `Ctrl + C` in PowerShell

## 📝 Full Command Sequence (Copy & Paste)

```powershell
cd "C:\Users\jbrea\OneDrive\Desktop\hustl-backend"
npm start
```

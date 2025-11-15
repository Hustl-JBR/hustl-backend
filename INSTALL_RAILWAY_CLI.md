# Install Railway CLI on Windows

## Method 1: Using PowerShell (Recommended)

Open PowerShell as Administrator and run:

```powershell
iwr https://railway.com/install.sh -useb | iex
```

## Method 2: Using npm (If you have Node.js)

```powershell
npm install -g @railway/cli
```

## After Installation:

1. **Login:**
   ```powershell
   railway login
   ```

2. **Link to your project:**
   ```powershell
   railway link -p 768ba9f9-789f-48b7-bfcb-def498deda80
   ```

3. **Get your URL:**
   ```powershell
   railway domain
   ```

4. **Check status:**
   ```powershell
   railway status
   ```

5. **View logs:**
   ```powershell
   railway logs
   ```

## But honestly...

**The web interface is easier!** You don't need the CLI unless you want to deploy from command line.


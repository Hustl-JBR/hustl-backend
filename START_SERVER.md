# How to Start the Server

## Quick Start

1. **Open Command Prompt or PowerShell**
   - Press `Win + R`
   - Type `cmd` or `powershell`
   - Press Enter

2. **Navigate to the project folder**
   ```
   cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
   ```

3. **Start the server**
   ```
   npm run dev
   ```

4. **Wait for the message**
   You should see:
   ```
   🚀 Hustl backend running at http://localhost:8080
   📁 Serving static files from: C:\Users\jbrea\OneDrive\Desktop\hustl-backend\public
   ```

5. **Open your browser**
   - Go to: `http://localhost:8080`
   - The app should load!

## If You Get Errors

### "npm is not recognized"
- Make sure Node.js is installed
- Restart your terminal after installing Node.js

### "Port 8080 already in use"
- Another server might be running
- Change the port in `.env` file: `PORT=8081`
- Or close the other program using port 8080

### "Cannot find module"
- Run: `npm install`
- This installs all dependencies

## What I Fixed

- ✅ Fixed the `public` folder path in `server.js`
- ✅ Server now correctly serves files from the `public` folder

## Keep the Server Running

- **Don't close the terminal window** while using the app
- The server needs to stay running
- To stop: Press `Ctrl + C` in the terminal




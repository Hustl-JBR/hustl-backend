# How to Start the Backend Server

## Quick Start

1. Open a terminal/command prompt
2. Navigate to the project directory:
   ```
   cd "C:\Users\jbrea\OneDrive\Desktop\hustl-backend"
   ```

3. Start the server:
   ```
   npm start
   ```
   
   OR for development with auto-reload:
   ```
   npm run dev
   ```

4. You should see output like:
   ```
   Server running on http://localhost:8080
   ```

5. Keep this terminal open - you'll see all the error logs here!

## If you get errors:

- Make sure you have Node.js installed: `node --version`
- Install dependencies: `npm install`
- Check your `.env` file has the required variables

## To see the error logs:

When you enter the 6-digit code, watch the terminal where the server is running. You'll see detailed error messages like:
- `[confirm-complete] Job marked as COMPLETED: ...`
- `[confirm-complete] Error updating job status: ...`

This will help us identify exactly what's failing!

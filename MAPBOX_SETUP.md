# Mapbox Places Autocomplete Setup Guide

## Step 1: Get Your Mapbox Access Token

1. Go to [https://account.mapbox.com/](https://account.mapbox.com/)
2. Sign up or log in to your Mapbox account
3. Navigate to **Account** → **Access tokens**
4. Copy your **Default public token** (starts with `pk.eyJ...`)

## Step 2: Set the Token in Your Application

You have two options:

### Option A: Set in Frontend Config (Recommended for Development)

Add this to your `public/index.html` in the config section (around line 3968):

```javascript
window.HUSTL_CONFIG = {
  API_URL: 'https://hustl-production.up.railway.app',
  MAPBOX_TOKEN: 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNs...' // Your token here
};
```

### Option B: Set as Environment Variable (Recommended for Production)

Add to your Railway environment variables:
- Variable name: `MAPBOX_TOKEN`
- Value: Your Mapbox public token

Then update `public/index.html` to read from environment:

```javascript
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || window.MAPBOX_TOKEN || window.HUSTL_CONFIG?.MAPBOX_TOKEN;
```

## Step 3: Verify It Works

1. Open the Post Job form
2. Click on the "Pickup address" field
3. Start typing an address (e.g., "123 Main St, Nashville")
4. You should see autocomplete suggestions appear
5. Select an address
6. The fields should auto-fill: street, neighborhood, city, ZIP

## Features

- **Address Autocomplete**: As you type, Mapbox suggests addresses
- **Auto-fill**: When you select an address, it automatically fills:
  - Street address
  - Neighborhood/Area
  - City
  - ZIP code
  - Coordinates (lat/lng) - stored in hidden fields
- **Accurate Distance**: Distance calculations now use actual coordinates (Haversine formula) instead of ZIP code differences
- **Privacy**: Full addresses are hidden from hustlers until they're accepted for the job

## Troubleshooting

- **No autocomplete suggestions**: Check that your Mapbox token is set correctly
- **Token errors in console**: Verify your token is valid and has the correct permissions
- **Addresses not auto-filling**: Check browser console for JavaScript errors

## Cost

Mapbox offers a free tier:
- 100,000 geocoding requests per month (free)
- After that, $0.50 per 1,000 requests

For most applications, the free tier is sufficient.


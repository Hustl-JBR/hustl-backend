# GPS Tracking Setup Guide

## Overview
Live GPS tracking allows hustlers to share their location with customers in real-time when heading to a job. Customers can see the hustler's location on a map and track their progress.

## Features Implemented

### For Hustlers:
- **Start Tracking Button**: Appears in job details when job is ASSIGNED or IN_PROGRESS
- **Automatic Location Updates**: Sends GPS coordinates to backend every few seconds
- **Stop Tracking**: Button to stop sharing location when arrived
- **Privacy**: Only shares location when actively tracking

### For Customers:
- **Live Map View**: See hustler's location on Google Maps
- **Distance Display**: Shows how far away the hustler is
- **Real-time Updates**: Map updates automatically via WebSocket
- **Path Visualization**: Shows recent location history

## Setup Instructions

### 1. Database Migration
Run Prisma migration to add the `LocationUpdate` model:
```bash
npx prisma migrate dev --name add_location_tracking
```

### 2. Google Maps API Key (Required)
The tracking feature uses Google Maps to display the hustler's location. You need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable "Maps Embed API"
4. Create an API key
5. Add the key to your environment variables or frontend config

**Update the key in `index.html`:**
- Search for `YOUR_GOOGLE_MAPS_API_KEY`
- Replace with your actual API key
- Or better: Add to environment variables and inject at build time

### 3. Environment Variables
No additional backend environment variables needed (uses existing JWT_SECRET for WebSocket auth).

### 4. Testing
1. As a hustler, accept a job
2. Open job details
3. Click "Start Sharing Location"
4. Grant GPS permission when prompted
5. As customer, open the same job details
6. You should see the live map with hustler's location

## API Endpoints

- `POST /tracking/start/:jobId` - Start tracking (hustler only)
- `POST /tracking/update/:jobId` - Update location (hustler only)
- `GET /tracking/:jobId` - Get latest location (customer/hustler)
- `POST /tracking/stop/:jobId` - Stop tracking (hustler only)

## WebSocket Events

- `location_update` - Broadcasts location updates to customer in real-time

## Privacy & Security

- Location is only shared when hustler actively starts tracking
- Location updates stop automatically when job details are closed
- Only customer assigned to the job can view tracking
- Location data is stored in database for path visualization (last 10 minutes)

## Browser Compatibility

- Requires HTTPS for GPS access (except localhost)
- Works on modern browsers with Geolocation API support
- Mobile browsers have better GPS accuracy

## Notes

- GPS accuracy depends on device and environment
- Indoor locations may have reduced accuracy
- Battery usage: Continuous GPS tracking uses more battery
- Consider adding "battery saver" mode with less frequent updates



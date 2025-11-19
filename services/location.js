/**
 * Location Utilities
 * Helper functions for calculating distances and filtering by location
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 * Production-ready with validation and error handling
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  // Validate inputs
  if (lat1 === null || lat1 === undefined || lng1 === null || lng1 === undefined ||
      lat2 === null || lat2 === undefined || lng2 === null || lng2 === undefined) {
    return null;
  }
  
  // Convert to numbers and validate
  const numLat1 = parseFloat(lat1);
  const numLng1 = parseFloat(lng1);
  const numLat2 = parseFloat(lat2);
  const numLng2 = parseFloat(lng2);
  
  if (isNaN(numLat1) || isNaN(numLng1) || isNaN(numLat2) || isNaN(numLng2)) {
    return null;
  }
  
  // Validate coordinate ranges
  if (numLat1 < -90 || numLat1 > 90 || numLat2 < -90 || numLat2 > 90 ||
      numLng1 < -180 || numLng1 > 180 || numLng2 < -180 || numLng2 > 180) {
    return null;
  }
  
  try {
    const R = 3959; // Earth's radius in miles
    const dLat = toRadians(numLat2 - numLat1);
    const dLng = toRadians(numLng2 - numLng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(numLat1)) *
        Math.cos(toRadians(numLat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Validate result
    if (isNaN(distance) || !isFinite(distance) || distance < 0) {
      return null;
    }
    
    return distance;
  } catch (error) {
    console.error('[Location] Error calculating distance:', error);
    return null;
  }
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Get bounding box for a location and radius
 * Returns { minLat, maxLat, minLng, maxLng }
 * Production-ready with validation
 */
function getBoundingBox(lat, lng, radiusMiles) {
  // Validate inputs
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  const numRadius = parseFloat(radiusMiles);
  
  if (isNaN(numLat) || isNaN(numLng) || isNaN(numRadius)) {
    throw new Error('Invalid coordinates or radius for bounding box');
  }
  
  // Validate coordinate ranges
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    throw new Error('Coordinates out of valid range');
  }
  
  // Validate radius (max 500 miles for safety)
  if (numRadius < 0 || numRadius > 500) {
    throw new Error('Radius must be between 0 and 500 miles');
  }
  
  // Approximate: 1 degree latitude ≈ 69 miles
  // 1 degree longitude ≈ 69 * cos(latitude) miles
  const latDelta = numRadius / 69;
  const lngDelta = numRadius / (69 * Math.cos(toRadians(numLat)));
  
  return {
    minLat: numLat - latDelta,
    maxLat: numLat + latDelta,
    minLng: numLng - lngDelta,
    maxLng: numLng + lngDelta,
  };
}

/**
 * Format distance for display
 */
function formatDistance(miles) {
  if (miles === null || miles === undefined) return 'Distance unknown';
  if (miles < 1) return `${Math.round(miles * 10) / 10} mi`;
  if (miles < 10) return `${Math.round(miles * 10) / 10} mi`;
  return `${Math.round(miles)} mi`;
}

module.exports = {
  calculateDistance,
  getBoundingBox,
  formatDistance,
};


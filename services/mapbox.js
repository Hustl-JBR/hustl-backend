const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

// Simple in-memory cache for geocoding results (zip codes don't change)
// Cache key: address string, value: { result, timestamp }
const geocodeCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Clean cache periodically (remove entries older than TTL)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of geocodeCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      geocodeCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

async function geocodeAddress(address, options = {}) {
  const { useCache = true, timeout = 5000 } = options;
  
  // Check cache first (for zip codes especially)
  if (useCache && geocodeCache.has(address)) {
    const cached = geocodeCache.get(address);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }
    // Cache expired, remove it
    geocodeCache.delete(address);
  }
  
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=US`;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Geocoding request timed out');
      }
      throw fetchError;
    }
    
    if (!response.ok) {
      // Handle rate limiting gracefully
      if (response.status === 429) {
        console.warn('[Mapbox] Rate limit hit, using fallback');
        throw new Error('Rate limit exceeded');
      }
      if (response.status === 401) {
        console.error('[Mapbox] Invalid API token');
        throw new Error('Geocoding service unavailable');
      }
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error('Address not found');
    }

    const feature = data.features[0];
    const [lng, lat] = feature.center;
    
    // Extract address components
    const context = feature.context || [];
    let zip = null;
    let city = null;
    let state = null;
    let neighborhood = null;
    
    for (const item of context) {
      if (item.id && item.id.startsWith('postcode')) {
        zip = item.text;
      } else if (item.id && item.id.startsWith('place')) {
        city = item.text;
      } else if (item.id && item.id.startsWith('region')) {
        state = item.text;
      } else if (item.id && item.id.startsWith('neighborhood') || item.id && item.id.startsWith('locality')) {
        neighborhood = item.text;
      }
    }
    
    const result = {
      lat,
      lng,
      address: feature.place_name,
      street: feature.text || '',
      zip,
      city,
      state,
      neighborhood,
      fullAddress: feature.place_name,
    };
    
    // Cache the result
    if (useCache) {
      geocodeCache.set(address, { result, timestamp: Date.now() });
    }
    
    return result;
  } catch (error) {
    console.error('[Mapbox Geocoding] Error:', error.message);
    
    // For production: Don't throw errors, return null and let caller handle it
    // This prevents location filtering from breaking the entire job listing
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Mapbox Geocoding] Returning null due to error (production mode)');
      return null;
    }
    
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
}

async function reverseGeocode(lat, lng, options = {}) {
  const { timeout = 5000 } = options;
  
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=US`;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Reverse geocoding request timed out');
      }
      throw fetchError;
    }
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[Mapbox] Rate limit hit on reverse geocoding');
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error('Location not found');
    }

    return data.features[0].place_name;
  } catch (error) {
    console.error('[Mapbox Reverse Geocoding] Error:', error.message);
    
    // For production: Return null instead of throwing
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    
    throw new Error(`Failed to reverse geocode: ${error.message}`);
  }
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
};

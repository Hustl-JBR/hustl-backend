const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

async function geocodeAddress(address) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error('Address not found');
    }

    const [lng, lat] = data.features[0].center;
    const context = data.features[0].context || [];
    const properties = data.features[0].properties || {};
    
    // Extract state and zip from context
    let state = null;
    let zip = null;
    let region = null;
    let isTennessee = false;
    
    // Log full context for debugging
    console.log('[Mapbox Geocoding] Full context:', JSON.stringify(context, null, 2));
    
    // PRIMARY METHOD: Look for short_code: "US-TN" anywhere in context array
    for (const item of context) {
      if (item.short_code) {
        const shortCode = item.short_code.toUpperCase();
        console.log(`[Mapbox Geocoding] Found short_code: "${shortCode}" in context item:`, item.id);
        
        // Check if this is US-TN (Tennessee)
        if (shortCode === 'US-TN') {
          isTennessee = true;
          region = 'US-TN';
          state = 'TN';
          console.log(`[Mapbox Geocoding] ✓ Found US-TN in context!`);
        } else if (shortCode === 'TN' && !region) {
          // Also accept just "TN" as state code
          region = 'US-TN';
          state = 'TN';
        }
      }
      
      // Postcode (zip code)
      if (item.id && item.id.startsWith('postcode')) {
        zip = item.text;
      }
      
      // Also capture state text for display
      if (item.id && item.id.startsWith('region') && !state) {
        state = item.text || state;
      }
    }
    
    // FALLBACK: Check properties for short_code
    if (!isTennessee && properties.short_code) {
      const propShortCode = properties.short_code.toUpperCase();
      if (propShortCode === 'US-TN' || propShortCode === 'TN') {
        isTennessee = true;
        region = 'US-TN';
        state = 'TN';
        console.log(`[Mapbox Geocoding] ✓ Found US-TN in properties!`);
      }
    }
    
    console.log(`[Mapbox Geocoding] Extracted - state: ${state}, region: ${region}, zip: ${zip}, isTennessee: ${isTennessee}`);
    
    return { lat, lng, state, zip, region, isTennessee };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to geocode address');
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      throw new Error('Location not found');
    }

    return data.features[0].place_name;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw new Error('Failed to reverse geocode');
  }
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
};

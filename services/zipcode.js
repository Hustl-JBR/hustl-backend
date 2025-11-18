// Zip Code Validation Service
// Validates if a zip code is in Tennessee

const ZIPCODE_API_KEY = process.env.ZIPCODE_API_KEY || process.env.ZIPCODEAPI_KEY;

/**
 * Comprehensive list of Tennessee ZIP code ranges
 * Tennessee ZIP codes range from 37000-38999
 */
const TENNESSEE_ZIP_RANGES = [
  // All Tennessee ZIP codes fall in the 37000-38999 range
  { start: 37000, end: 38999 }
];

/**
 * Check if a zip code falls within Tennessee ranges
 */
function isInTennesseeRange(zipCode) {
  if (!zipCode) {
    console.log('[Tennessee Range Check] No zip code provided');
    return false;
  }
  
  const zipStr = zipCode.toString().trim();
  const zip = parseInt(zipStr, 10);
  
  console.log(`[Tennessee Range Check] Input: "${zipCode}" -> Parsed: ${zip} (isNaN: ${isNaN(zip)})`);
  
  if (isNaN(zip)) {
    console.log(`[Tennessee Range Check] ✗ Invalid zip code format: "${zipStr}"`);
    return false;
  }
  
  for (const range of TENNESSEE_ZIP_RANGES) {
    const inRange = zip >= range.start && zip <= range.end;
    console.log(`[Tennessee Range Check] Checking ${zip} against range ${range.start}-${range.end}: ${inRange ? '✓ IN RANGE' : '✗ OUT OF RANGE'}`);
    if (inRange) {
      return true;
    }
  }
  
  console.log(`[Tennessee Range Check] ✗ Zip ${zip} is NOT in any Tennessee range`);
  return false;
}

/**
 * Validate if a zip code is in Tennessee
 * Uses ZipCodeAPI if available, otherwise falls back to comprehensive range check
 */
async function validateTennesseeZip(zipCode) {
  if (!zipCode) {
    console.log('[Tennessee Validation] No zip code provided');
    return false;
  }
  
  const zip = zipCode.toString().trim();
  console.log(`[Tennessee Validation] Validating zip code: ${zip}`);
  
  // First, do a quick range check (fast and reliable)
  if (isInTennesseeRange(zip)) {
    console.log(`[Tennessee Validation] ✓ Zip ${zip} is in Tennessee range (37000-38999)`);
    
    // If we have an API key, verify with API for extra accuracy
    if (ZIPCODE_API_KEY) {
      try {
        const url = `https://www.zipcodeapi.com/rest/${ZIPCODE_API_KEY}/info.json/${zip}/degrees`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          const state = data.state ? data.state.toUpperCase() : '';
          if (state === 'TN' || state === 'TENNESSEE') {
            console.log(`[Tennessee Validation] ✓ API confirmed zip ${zip} is in Tennessee`);
            return true;
          } else {
            // API says it's not TN, but range check says it is - trust the API
            console.log(`[Tennessee Validation] ⚠ Zip ${zip} is in TN range but API says state: ${state}`);
            return false;
          }
        }
      } catch (error) {
        console.error(`[Tennessee Validation] API error for ${zip}:`, error.message);
        // If API fails, trust the range check
        return true;
      }
    }
    
    // No API key or API failed - trust the range check
    return true;
  }
  
  // Not in Tennessee range, but try API if available (in case of edge cases)
  if (ZIPCODE_API_KEY) {
    try {
      const url = `https://www.zipcodeapi.com/rest/${ZIPCODE_API_KEY}/info.json/${zip}/degrees`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const state = data.state ? data.state.toUpperCase() : '';
        if (state === 'TN' || state === 'TENNESSEE') {
          console.log(`[Tennessee Validation] ✓ API confirmed zip ${zip} is in Tennessee (outside normal range)`);
          return true;
        }
      }
    } catch (error) {
      console.error(`[Tennessee Validation] API error for ${zip}:`, error.message);
    }
  }
  
  console.log(`[Tennessee Validation] ✗ Zip ${zip} is NOT in Tennessee`);
  return false;
}

/**
 * Get state from zip code using API
 */
async function getStateFromZip(zipCode) {
  if (!zipCode) return null;
  
  const zip = zipCode.toString().trim();
  
  if (ZIPCODE_API_KEY) {
    try {
      const url = `https://www.zipcodeapi.com/rest/${ZIPCODE_API_KEY}/info.json/${zip}/degrees`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return data.state || null;
      }
    } catch (error) {
      console.error('ZipCodeAPI error:', error);
    }
  }
  
  // Fallback: check if in Tennessee range
  if (isInTennesseeRange(zip)) {
    return 'TN';
  }
  
  return null;
}

module.exports = {
  validateTennesseeZip,
  getStateFromZip,
};


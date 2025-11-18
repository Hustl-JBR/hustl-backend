# Fix Job Posting Form - Remove Supabase, Use JWT API

## Problem
The form is using old Supabase code that:
1. Inserts directly into Supabase database (bypassing backend API)
2. Doesn't send `pickupZip` in the `requirements` object
3. Causes "please update profiles address" error

## Solution
The form needs to call `/api/jobs` with JWT token instead of using Supabase.

## What to Change

### In `public/index.html` around line 1570-1676:

**REPLACE THIS (old Supabase code):**
```javascript
const {
  data: { user },
} = await supabase.auth.getUser();
// ... Supabase profile check ...
const { error } = await supabase.from("jobs").insert({
  posted_by: user.id,
  // ... fields ...
});
```

**WITH THIS (JWT API call):**
```javascript
// Get JWT token from localStorage
const token = localStorage.getItem("hustl_token");
if (!token) {
  return showToast("You must be logged in to post jobs. Please log in first.");
}

// ... get all form values including pickupZip ...

// Build requirements object with pickupZip
const requirements = {
  pickupZip: pickupZip,
  estimatedDuration: estimatedDuration,
  toolsNeeded: toolsNeeded,
  teamSize: teamSize,
  onSiteOnly: onSiteOnly
};

// Call API
const response = await fetch("/api/jobs", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    title,
    category,
    description: desc,
    address, // Built from pickupAddress + pickupArea + pickupCity + pickupZip
    date: jobDate.toISOString(),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    pickupArea,
    pickupCity,
    pickupAddress,
    dropoffArea: onSiteOnly ? null : dropoffArea,
    dropoffCity: onSiteOnly ? null : dropoffCity,
    dropoffAddress: onSiteOnly ? null : dropoffAddress,
    payType: paymentType,
    amount: flat_amount_cents,
    hourlyRate: hourly_rate_cents,
    estHours: paymentType === "hourly" ? maxHours : null,
    notes,
    requirements // THIS IS CRITICAL - includes pickupZip
  })
});
```

## Key Points

1. **Get `pickupZip` from form**: `document.getElementById("pickupZip").value.trim()`
2. **Include in `requirements` object**: `{ pickupZip: pickupZip, ... }`
3. **Use JWT token**: `localStorage.getItem("hustl_token")`
4. **Call `/api/jobs`**: Not Supabase
5. **Validate ZIP frontend**: Check 37000-38999 range before submitting

## Testing

After the fix:
1. Log in (token should be stored in localStorage as "hustl_token")
2. Fill out job form with Tennessee ZIP (e.g., 37027)
3. Check browser Network tab - should see POST to `/api/jobs`
4. Check server console - should see validation logs with pickupZip
5. Job should post successfully

## If Token Not Found

If `localStorage.getItem("hustl_token")` returns null, you need to:
1. Update login code to store token: `localStorage.setItem("hustl_token", token)`
2. Or check what key the token is stored under


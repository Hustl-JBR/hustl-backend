# Remove Supabase and Fix Job Posting Form

## Current Problem
- Form uses old Supabase code that inserts directly into Supabase database
- You're using **Neon (PostgreSQL) + Prisma + JWT**, NOT Supabase
- Form doesn't send `pickupZip` in `requirements` object
- Error: "please update profiles address" (from Supabase database constraint)

## What to Fix

### 1. Remove Supabase Script (around line 1194)
**FIND:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.0/dist/umd/supabase.js"></script>
```

**REPLACE WITH:** (just remove the script tag, keep the `<script>` tag that follows)

### 2. Remove Supabase Config (around line 1196-1204)
**FIND:**
```javascript
// ==== Supabase config (MUST be first lines inside your <script>) ====
const SUPABASE_URL = "https://mzulamvduzvkdurcouhn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sbCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}
```

**REPLACE WITH:**
```javascript
// ==== JWT Auth Helper Functions ====
function getAuthToken() {
  return localStorage.getItem("hustl_token");
}

async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const response = await fetch("/api/users/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (response.ok) return await response.json();
  } catch (error) {
    console.error("Error getting current user:", error);
  }
  return null;
}
```

### 3. Fix Form Submission (around line 1651)
**FIND:**
```javascript
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) return showToast("You must be logged in...");

const { data: prof } = await supabase
  .from("profiles")
  .select("role")
  .eq("user_id", user.id)
  .single();
if (prof?.role !== "customer") return showToast("Switch your role...");

// ... form field collection ...

const { error } = await supabase.from("jobs").insert({
  posted_by: user.id,
  title,
  category,
  // ... other fields ...
});
```

**REPLACE WITH:**
```javascript
// Get JWT token
const token = localStorage.getItem("hustl_token");
if (!token) {
  return showToast("You must be logged in to post jobs. Please log in first.");
}

// ... get all form fields INCLUDING pickupZip ...
const pickupZip = document.getElementById("pickupZip")?.value.trim() || "";
const teamSize = Number(document.getElementById("teamSize")?.value || 1);
const estimatedDuration = document.getElementById("estimatedDuration")?.value || "";
const toolsNeeded = [];
if (document.getElementById("toolTruck")?.checked) toolsNeeded.push("truck");
if (document.getElementById("toolLadder")?.checked) toolsNeeded.push("ladder");
if (document.getElementById("toolPowerTools")?.checked) toolsNeeded.push("power-tools");
if (document.getElementById("toolHandTools")?.checked) toolsNeeded.push("hand-tools");
if (document.getElementById("toolDolly")?.checked) toolsNeeded.push("dolly");
if (document.getElementById("toolCleaning")?.checked) toolsNeeded.push("cleaning-supplies");
const toolsOther = document.getElementById("toolsOther")?.value.trim();
if (toolsOther) toolsNeeded.push(toolsOther);

// Validate
if (!estimatedDuration) return showToast("Please select an estimated duration.");
if (toolsNeeded.length === 0) return showToast("Please select at least one tool or equipment needed.");
if (!pickupZip) return showToast("Please enter a pickup zip code (required for Tennessee validation).");
const zipNum = parseInt(pickupZip, 10);
if (isNaN(zipNum) || zipNum < 37000 || zipNum > 38999) {
  return showToast("Please enter a valid Tennessee zip code (37000-38999).");
}

// Build address and requirements
const addressParts = [];
if (pickupAddress) addressParts.push(pickupAddress);
if (pickupArea) addressParts.push(pickupArea);
if (pickupCity) addressParts.push(pickupCity);
if (pickupZip) addressParts.push(pickupZip);
const address = addressParts.join(", ");

const requirements = {
  pickupZip: pickupZip,
  estimatedDuration: estimatedDuration,
  toolsNeeded: toolsNeeded,
  teamSize: teamSize,
  onSiteOnly: onSiteOnly
};

// Get date/time
const dateFilter = document.getElementById("jobDateFilter")?.value;
let jobDate = new Date();
if (dateFilter === "tomorrow") {
  jobDate.setDate(jobDate.getDate() + 1);
} else if (dateFilter === "custom") {
  const customDate = document.getElementById("jobDate")?.value;
  if (customDate) jobDate = new Date(customDate);
}

const timeFilter = document.getElementById("jobTimeFilter")?.value;
let startTime = new Date(jobDate);
let endTime = new Date(jobDate);

if (timeFilter === "custom") {
  const startTimeStr = document.getElementById("jobStartTime")?.value;
  const endTimeStr = document.getElementById("jobEndTime")?.value;
  if (startTimeStr) {
    const [hours, minutes] = startTimeStr.split(":");
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }
  if (endTimeStr) {
    const [hours, minutes] = endTimeStr.split(":");
    endTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }
} else {
  if (timeFilter === "morning") {
    startTime.setHours(6, 0, 0, 0);
    endTime.setHours(12, 0, 0, 0);
  } else if (timeFilter === "afternoon") {
    startTime.setHours(12, 0, 0, 0);
    endTime.setHours(17, 0, 0, 0);
  } else if (timeFilter === "evening") {
    startTime.setHours(17, 0, 0, 0);
    endTime.setHours(21, 0, 0, 0);
  } else if (timeFilter === "night") {
    startTime.setHours(21, 0, 0, 0);
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(6, 0, 0, 0);
  }
}

// Call API
try {
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
      address,
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
      requirements  // THIS IS CRITICAL - includes pickupZip
    })
  });
  
  const data = await response.json();
  if (!response.ok) {
    return showToast(data.error || "Post error: " + response.statusText);
  }
  
  showToast("Job posted.");
  setView("jobs");
  clearJobForm();
  renderJobs();
} catch (error) {
  console.error("Job posting error:", error);
  showToast("Error posting job: " + (error.message || "Unknown error"));
}
```

## Summary

1. **Remove Supabase script tag** (line ~1194)
2. **Replace Supabase config** with JWT helpers (line ~1196-1204)
3. **Replace form submission** to use `/api/jobs` with JWT token (line ~1570-1676)
4. **Add `pickupZip` collection** from form
5. **Include `pickupZip` in `requirements` object**

The backend is already fixed and ready - it just needs the form to send the data correctly!





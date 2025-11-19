# 📋 PAGINATION IMPLEMENTATION - STEP BY STEP GUIDE

## ✅ STEP 1: Backend is DONE (Already completed!)
- ✅ Added `page` and `limit` query params to `/routes/jobs.js`
- ✅ Backend now returns `{ jobs: [], pagination: { page, limit, total, totalPages, hasMore } }`
- ✅ Default: 20 jobs per page

## 📝 STEP 2: Update Frontend API Integration (Already done!)
- ✅ Updated `public/api-integration.js` to handle paginated response

## 🔧 STEP 3: Update renderJobs Function

**WHERE TO GO:**
1. Open `public/index.html` in your editor
2. Press `Ctrl+F` (or `Cmd+F` on Mac)
3. Search for: `async function renderJobs()`
4. You'll find it around **line 1680**

**WHAT TO CHANGE:**
Replace the entire `renderJobs()` function with the paginated version below.

**BEFORE (Current - uses Supabase):**
```javascript
async function renderJobs() {
  // ... uses supabase.from("jobs").select("*")
}
```

**AFTER (New - uses API with pagination):**
```javascript
// Pagination state
let currentJobsPage = 1;
let jobsPagination = { hasMore: false };
let allLoadedJobs = [];

async function renderJobs(reset = false) {
  const jobsList = document.getElementById("jobsList");
  const jobsCardTitle = document.getElementById("jobsCardTitle");
  const jobsFilterSummary = document.getElementById("jobsFilterSummary");

  // Reset pagination if needed
  if (reset) {
    currentJobsPage = 1;
    allLoadedJobs = [];
    jobsList.innerHTML = ""; // Clear existing jobs
  }

  try {
    // Get saved zip filter
    const savedZip = localStorage.getItem('savedZipFilter') || '';
    
    // Build filters
    const filters = {
      page: currentJobsPage,
      limit: 20,
    };
    
    if (savedZip) {
      filters.zip = savedZip;
    }

    // Load jobs from API
    const response = await window.hustlAPI.jobs.list(filters);
    
    // Handle paginated response
    const newJobs = response.jobs || [];
    const pagination = response.pagination || { hasMore: false };
    
    // Append new jobs to existing list
    allLoadedJobs = [...allLoadedJobs, ...newJobs];
    jobsPagination = pagination;

    // Filter by status (client-side for now)
    let filteredJobs = allLoadedJobs;
    if (activeJobsStatusFilter === "all") {
      filteredJobs = allLoadedJobs.filter((j) => j.status !== "COMPLETED");
    } else if (activeJobsStatusFilter) {
      filteredJobs = allLoadedJobs.filter((j) => j.status === activeJobsStatusFilter);
    }

    // Update card title
    const user = await window.hustlAPI.auth.getCurrentUser();
    let role = null;
    if (user) {
      // Get role from user data
      role = user.roles?.[0] || null;
    }
    
    let cardTitle = "Jobs near you";
    if (role === "CUSTOMER") cardTitle = "Your jobs & local jobs";
    if (role === "HUSTLER") cardTitle = "Jobs you can apply for";
    if (jobsCardTitle) jobsCardTitle.textContent = cardTitle;

    // Update summary
    if (jobsFilterSummary) {
      jobsFilterSummary.textContent = filteredJobs.length === 0 
        ? "No jobs yet." 
        : `Showing ${filteredJobs.length} job(s)${pagination.total ? ` of ${pagination.total}` : ''}`;
    }

    // Clear and re-render all jobs
    if (reset) {
      jobsList.innerHTML = "";
    }

    // Render each job card
    filteredJobs.forEach((job) => {
      // Check if job card already exists
      const existingCard = jobsList.querySelector(`[data-job-id="${job.id}"]`);
      if (existingCard) return; // Skip if already rendered

      const card = document.createElement("div");
      card.className = "job-card";
      card.dataset.jobId = job.id;

      // Top row: title and pay
      const titleRow = document.createElement("div");
      titleRow.className = "job-card-top";

      const titleEl = document.createElement("div");
      titleEl.className = "job-title";
      titleEl.textContent = job.title;
      titleRow.appendChild(titleEl);

      const pay = document.createElement("div");
      pay.className = "job-title";

      if (job.payType === "flat") {
        const total = job.amount || 0;
        pay.textContent = `$${total.toFixed(2)}`;
      } else {
        const hr = job.hourlyRate || 0;
        const maxH = job.estHours || 0;
        pay.textContent = `$${hr.toFixed(2)}/hr · max ${maxH}h`;
      }
      titleRow.appendChild(pay);
      card.appendChild(titleRow);

      // Category + time
      const meta = document.createElement("div");
      meta.className = "job-meta";

      const cat =
        job.category === "moving"
          ? "🚚 moving"
          : job.category === "yard"
          ? "🌿 yard"
          : job.category === "cleaning"
          ? "🧹 cleaning"
          : job.category === "furniture"
          ? "🛠 furniture"
          : "⭐ other";

      const createdMs = job.createdAt
        ? new Date(job.createdAt).getTime()
        : Date.now();

      meta.textContent = `${cat} • posted ${timeAgo(createdMs)}`;
      card.appendChild(meta);

      // Location line
      const loc = document.createElement("div");
      loc.className = "job-meta";

      const requirements = job.requirements || {};
      if (requirements.onSiteOnly || job.onSiteOnly) {
        loc.textContent = `📍 ${requirements.pickupArea || requirements.pickupCity || job.address || "TBD"} • On-site only`;
      } else {
        const pick = requirements.pickupArea || requirements.pickupCity || "TBD";
        const drop = requirements.dropoffArea || requirements.dropoffCity || "TBD";
        loc.textContent = `📍 Pickup: ${pick} → Dropoff: ${drop}`;
      }
      card.appendChild(loc);

      // Actions row
      const actions = document.createElement("div");
      actions.className = "job-card-actions";

      const left = document.createElement("div");
      const statusBadge = document.createElement("span");
      statusBadge.className = "badge";

      if (job.status === "OPEN") {
        statusBadge.classList.add("status-open");
        statusBadge.textContent = "Open";
      } else if (job.status === "ASSIGNED") {
        statusBadge.classList.add("status-assigned");
        statusBadge.textContent = "Assigned";
      } else if (job.status === "COMPLETED") {
        statusBadge.classList.add("status-completed");
        statusBadge.style.backgroundColor = "#9333ea";
        statusBadge.style.color = "#ffffff";
        statusBadge.textContent = "✓ Completed!";
      } else {
        statusBadge.textContent = job.status || "Open";
      }

      left.appendChild(statusBadge);
      actions.appendChild(left);

      const right = document.createElement("div");
      const viewBtn = document.createElement("button");
      viewBtn.className = "small-btn outline";
      viewBtn.textContent = "View";
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openJobDetails(job.id);
      });
      right.appendChild(viewBtn);
      actions.appendChild(right);

      card.appendChild(actions);

      // Clicking the whole card opens details
      card.addEventListener("click", () => openJobDetails(job.id));

      jobsList.appendChild(card);
    });

    // Add "Load More" button if there are more pages
    const existingLoadMore = jobsList.querySelector("#loadMoreJobsBtn");
    if (existingLoadMore) {
      existingLoadMore.remove();
    }

    if (pagination.hasMore) {
      const loadMoreBtn = document.createElement("button");
      loadMoreBtn.id = "loadMoreJobsBtn";
      loadMoreBtn.className = "btn btn-primary";
      loadMoreBtn.style.width = "100%";
      loadMoreBtn.style.marginTop = "1rem";
      loadMoreBtn.textContent = "Load More Jobs";
      loadMoreBtn.addEventListener("click", async () => {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading...";
        currentJobsPage++;
        await renderJobs(false); // Don't reset, just append
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = "Load More Jobs";
      });
      jobsList.appendChild(loadMoreBtn);
    }

  } catch (error) {
    console.error("Error loading jobs:", error);
    if (jobsList) {
      jobsList.innerHTML = "<div class='muted'>Error loading jobs. Please try again.</div>";
    }
  }
}
```

## 🔧 STEP 4: Make sure api-integration.js is loaded

**WHERE TO GO:**
1. Open `public/index.html`
2. Find the `<script>` tag around line 1194
3. Add this line BEFORE the existing script tag:

```html
<script src="/api-integration.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.0/dist/umd/supabase.js"></script>
```

## 🔧 STEP 5: Update filter changes to reset pagination

**WHERE TO GO:**
1. Search for: `activeJobsStatusFilter` in `public/index.html`
2. Find where the filter buttons are clicked
3. Make sure they call `renderJobs(true)` to reset pagination

**LOOK FOR:**
```javascript
// When filter button is clicked, reset pagination
renderJobs(true); // true = reset pagination
```

## 🚀 STEP 6: Start the Server

**IN POWERSHELL:**
1. Open PowerShell
2. Type: `cd "C:\Users\jbrea\OneDrive\Desktop\hustl-backend"`
3. Press Enter
4. Type: `npm start`
5. Press Enter

**YOU SHOULD SEE:**
```
Server running on http://localhost:3000
```

## ✅ TESTING CHECKLIST

- [ ] Server starts without errors
- [ ] Jobs load (first 20)
- [ ] "Load More" button appears if there are more jobs
- [ ] Clicking "Load More" loads next 20 jobs
- [ ] Filtering by status resets pagination
- [ ] Zip code filter works with pagination

## 🐛 TROUBLESHOOTING

**Problem: "window.hustlAPI is not defined"**
- Solution: Make sure `api-integration.js` is loaded before the main script

**Problem: "Cannot read property 'jobs' of undefined"**
- Solution: Check that backend is returning `{ jobs: [], pagination: {} }` format

**Problem: Server won't start**
- Solution: Check if port 3000 is already in use, or change PORT in `.env`




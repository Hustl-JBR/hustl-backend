# 🎨 Jobs Section Redesign Plan

## ✅ **Backend Fixes Completed:**
1. ✅ Auto-clean jobs: 48-72 hours unaccepted, 2 weeks max
2. ✅ Default sort changed to "newest" (was "distance")
3. ✅ Cleanup runs every 2 hours (was 6 hours)

## 🚧 **Frontend Redesign Needed:**

### **1. Clean Job Feed Layout (TaskRabbit-style)**
- **Simple job cards** with only:
  - Job title
  - Pay amount (prominent)
  - Location + distance
  - Time posted (e.g., "2 hours ago")
  - Short description preview (1-2 lines max)
  - "View Job" button
- **Remove clutter**: No wall of text, no complex status badges

### **2. Simple Filters at Top (Thumbtack-style)**
Add filter buttons:
- **Near Me** (default: 5-10 miles)
- **Newest** (default sort)
- **Highest Pay**
- **Hourly Jobs** / **Flat-Rate Jobs**
- **My ZIP Code** (auto-filter)
- **My Skills** (for hustlers)
- **Tennessee Only** (always ON - auto-filter)

### **3. Clean Job Details Page (Rover-style)**
When clicking a job:
- Title (large, clear)
- Full description
- Pay type (hourly/flat) + estimate if hourly
- Photos (if any) - gallery view
- Exact location on map
- **"Apply"** or **"Message Customer"** button (prominent)
- Job status badge (open, applied, accepted, etc.)

### **4. Local Results First**
- Start with user's ZIP
- Show 5-10 miles radius first
- Then expand to show more if scrolling
- Default radius: 10 miles (not 25)

### **5. Persistent Login**
- Store token in localStorage (already done)
- Auto-refresh token before expiry
- Stay logged in across page reloads
- Show loading state while checking auth

### **6. Real-time Updates**
- Poll for new jobs every 30 seconds (when on Jobs tab)
- Poll for new messages every 15 seconds
- Show "New jobs available" notification
- Smooth updates without full page reload

### **7. Smooth Navigation**
- Clean tab bar: Home | Jobs | Create | Messages | Profile
- 1-click Customer ↔ Hustler toggle
- Maintain view on page reload (URL routing)
- Smooth transitions between views

## 📋 **Implementation Priority:**

### **Phase 1: Critical Fixes** (Do First)
1. ✅ Backend: Auto-clean jobs (DONE)
2. ✅ Backend: Default sort to newest (DONE)
3. ⏳ Frontend: Change default sort to 'newest' in API call
4. ⏳ Frontend: Simplify job card design
5. ⏳ Frontend: Add simple filter buttons

### **Phase 2: UX Improvements**
6. ⏳ Frontend: Clean job details page
7. ⏳ Frontend: Local results first (10 miles default)
8. ⏳ Frontend: Persistent login (auto-refresh token)
9. ⏳ Frontend: Real-time polling for jobs/messages

### **Phase 3: Polish**
10. ⏳ Frontend: URL routing (maintain view on reload)
11. ⏳ Frontend: Smooth transitions
12. ⏳ Frontend: Loading states
13. ⏳ Frontend: Error handling

## 🎯 **Next Steps:**
1. Redesign job card component (simplify)
2. Add filter buttons at top
3. Update job details page
4. Add persistent login
5. Add real-time polling


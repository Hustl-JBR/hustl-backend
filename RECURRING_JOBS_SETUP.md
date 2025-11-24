# Recurring Jobs Setup Guide

## Overview
Recurring jobs allow customers to post jobs that automatically repeat weekly or monthly. This is perfect for regular services like lawn care, cleaning, pet care, etc.

## Features Implemented

### For Customers:
- **Recurring Job Option**: Checkbox in job posting form to make a job recurring
- **Frequency Selection**: Choose weekly or monthly repetition
- **End Date**: Optional end date for the recurring series
- **Manage Series**: Pause, resume, or cancel recurring job series from job details
- **Automatic Creation**: New job instances are created automatically based on schedule

### For Hustlers:
- **See All Instances**: Each recurring job instance appears as a separate job
- **Apply to Series**: Can apply to individual instances or the whole series
- **Same Details**: All instances have the same job details, just different dates

## Database Schema

The `Job` model now includes:
- `parentJobId`: Links child instances to parent job
- `recurrenceType`: "weekly" | "monthly" | null
- `recurrenceEndDate`: Optional end date for the series
- `recurrencePaused`: Boolean to pause/resume series
- `nextRecurrenceDate`: When the next instance should be created

## Setup Instructions

### 1. Database Migration
Run Prisma migration to add recurring job fields:
```bash
npx prisma migrate dev --name add_recurring_jobs
```

### 2. Scheduled Task (Cron Job)
You need to set up a scheduled task to run `generateRecurringJobs()` daily. This can be done via:

**Option A: Railway Cron Job**
- Add a cron job in Railway that calls your API endpoint daily
- Create endpoint: `POST /jobs/recurring/generate` (admin only)

**Option B: Node-cron (for self-hosted)**
```javascript
const cron = require('node-cron');
const { generateRecurringJobs } = require('./services/recurringJobs');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running recurring jobs generation...');
  await generateRecurringJobs();
});
```

**Option C: External Cron Service**
- Use a service like EasyCron or cron-job.org
- Set up HTTP request to your endpoint daily

### 3. API Endpoints

- `POST /jobs/:jobId/recurring/pause` - Pause recurring series
- `POST /jobs/:jobId/recurring/resume` - Resume recurring series  
- `POST /jobs/:jobId/recurring/cancel` - Cancel recurring series (deletes future instances)

## How It Works

1. **Customer posts recurring job**: Selects "Make this a recurring job" and chooses frequency
2. **First job created**: Initial job is posted with `recurrenceType` set
3. **Scheduled task runs**: Daily cron job checks for jobs needing new instances
4. **New instance created**: When `nextRecurrenceDate` arrives, a new job instance is created
5. **Parent updated**: Parent job's `nextRecurrenceDate` is updated to next occurrence
6. **Series continues**: Process repeats until end date or cancellation

## Job Details UI

When viewing a recurring job, customers will see:
- Badge indicating it's a recurring job
- Next occurrence date
- Buttons to pause/resume/cancel the series
- List of all instances in the series

## Notes

- **Parent vs Child**: Parent jobs have `parentJobId = null`, child instances have `parentJobId = parentJobId`
- **Status**: Each instance has its own status (OPEN, ASSIGNED, etc.)
- **Payment**: Each instance requires separate payment
- **Cancellation**: Cancelling a series only deletes future OPEN instances, not in-progress ones
- **Pausing**: Paused series won't generate new instances until resumed

## Testing

1. Post a recurring job with weekly frequency
2. Manually run `generateRecurringJobs()` to create next instance
3. Verify new job instance appears with correct date
4. Test pause/resume/cancel functionality


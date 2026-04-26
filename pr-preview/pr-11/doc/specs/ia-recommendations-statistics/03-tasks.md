# Phase Decomposition: IA Recommendations + Statistics

**Generated:** 2026-03-23
**Status:** Ready to Begin Phase A

---

## PHASE A: Rest Duration Capture (Days 1-2)

**Goal:** Users can record rest time between sets. Data persists locally + syncs to cloud.

**Status - Phase A:** ✅ COMPLETE (A1-A5 implemented, A6 deferred)

---

## PHASE B: Analytics Screen & Metrics (Days 3-4)

**Goal:** Display volume, RPE, adherence, recovery metrics with local insights.

**Status:** ✅ COMPLETE (All 7 tasks done)

---

### Task A1: Update Data Model
- **Status:** ✅ COMPLETED
- **File:** `index.html` - JavaScript state
- **Description:** Add `rest_duration_seconds` field to `currentExerciseSets[]` structure
- **Details:**
  - Modify set object: `{ weight, reps, unit, side, rpe, is_warmup_set, rest_duration_seconds: null }`
  - Default `null` until rest is logged
  - Store as integer (seconds)
  - Update `addSet()` function to initialize field
- **Testing:** Verify structure in console.log when saving workout

### Task A2: Expand Rest Timer Modal UI
- **File:** `index.html` - Section: `#restSheet`
- **Description:** Enhance existing rest timer modal with visual countdown
- **Details:**
  - Current #restSheet exists for rest presets; expand for timer
  - Add large countdown display (00:00 format) centered
  - Add "Ready" primary button (CTA)
  - Add "Skip Rest" secondary button
  - Add "Minimize" icon (collapses to small floating badge)
  - Styling: Large text (32px), high contrast, green "Ready" button
- **CSS:** Update `.bottom-sheet`, create `.timer-display` (mono font)
- **Testing:** Tap "Complete Set" → timer modal appears and counts up

### Task A3: Implement Timer Logic
- **File:** `index.html` - Section: JavaScript functions
- **Description:** Create `startRestTimer()` and related functions
- **Details:**
  ```js
  let restStartTime = null;
  let restTimerInterval = null;

  function startRestTimer() {
    restStartTime = Date.now();
    const restModal = document.getElementById('restSheet');
    restModal.classList.add('active');
    overlay.classList.add('active');

    restTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - restStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      document.getElementById('restDisplay').innerText =
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 100); // Update every 100ms for smooth feel
  }

  function markRestReady() {
    const elapsed = Math.floor((Date.now() - restStartTime) / 1000);
    currentExerciseSets[currentExerciseSets.length - 1].rest_duration_seconds = elapsed;
    clearInterval(restTimerInterval);
    // Close modal, show next set form
  }

  function skipRest() {
    currentExerciseSets[currentExerciseSets.length - 1].rest_duration_seconds = 0;
    // Close modal, continue
  }
  ```
- **Testing:** Timer counts up, "Ready" button logs duration, verify in currentExerciseSets

### Task A4: Persist Rest Data to Supabase
- **File:** `index.html` - `saveWorkout()` function
- **Description:** Include rest_duration_seconds when syncing to Supabase
- **Details:**
  - When saving workout, include rest_duration_seconds array in workouts table
  - Add Supabase migration (if not already done):
    ```sql
    ALTER TABLE workouts ADD COLUMN rest_durations_per_set INTEGER[] DEFAULT NULL;
    ```
  - Update `saveWorkout()` to POST `{ ..., rest_durations: [...] }`
  - Retrieve on `syncFromCloud()` and restore to localStorage
- **Testing:** Complete workout with rests → Save → Refresh app → Rest durations restored

### Task A5: Add Validation
- **File:** `index.html` - `markRestReady()` function
- **Description:** Validate rest durations (no negatives, reasonable max)
- **Details:**
  - Valid range: 0 - 600 seconds (10 minutes max)
  - If invalid, show toast: "Rest duration out of range"
  - Allow 0 seconds (immediate next set)
- **Testing:** Try various rest durations, verify validation

### Task A6: Mobile Testing
- **File:** N/A (testing phase)
- **Description:** Test timer UX on actual device
- **Details:**
  - Timer accuracy: compare with phone stopwatch
  - Button responsiveness (no lag)
  - Visual clarity (readable on small screen)
  - Minimize button works (can workout while timer in background)
- **Testing:** Record 3 sets with varied rest times, verify accuracy

---

## PHASE B: Analytics Screen & Metrics (Days 3-4)

**Goal:** Display volume, RPE, adherence, recovery metrics with local insights.

### Task B1: Create Analytics Screen Layout
- **File:** `index.html` - Add `#analyticsScreen` section
- **Description:** Create new screen replacing Routines
- **Details:**
  - Header: "Analytics" with date range selector (This Week / Last Week / All Time)
  - 4 metric cards in 2x2 grid:
    - Volume (lbs) with ↑↓ trend indicator
    - Intensity (avg RPE 0-10) with ↑↓ trend
    - Adherence (workouts/week) with ↑↓ trend
    - Recovery (avg rest in seconds) with ↑↓ trend
  - Mini chart under each metric (line chart, 7 data points)
  - "Get AI Insight" button (if Claude enabled) - calls Phase C
  - Exercise breakdown tab (collapsible)
- **CSS:** Create `.metric-card`, `.mini-chart`, responsive grid
- **Testing:** Layout responsive on mobile (320px+)

### Task B2: Implement Metric Calculation Functions
- **File:** `index.html` - New section "Analytics Functions"
- **Description:** Create 4 calculation functions
- **Details:**
  ```js
  function calculateVolume(workouts) {
    // Sum of (weight * reps) for all sets
    // Return: {current: number, trend: 'up'|'down'|'flat'}
  }

  function calculateIntensity(workouts) {
    // Average RPE across all sets
    // Return: {current: number, trend: 'up'|'down'|'flat'}
  }

  function calculateAdherence(workouts) {
    // Workouts per week count
    // Return: {current: number, trend: 'up'|'down'|'flat'}
  }

  function calculateRecovery(workouts) {
    // Average rest_duration_seconds
    // Return: {current: number, trend: 'up'|'down'|'flat'}
  }

  function getWeeklyData(weeks = 4) {
    const fourWeeksAgo = new Date(Date.now() - weeks*7*24*60*60*1000);
    return savedWorkouts.filter(w => new Date(w.date) > fourWeeksAgo);
  }
  ```
- **Testing:** Verify calculations with sample data (manual spot-check)

### Task B3: Implement Chart Rendering
- **File:** `index.html` - Add Chart.js library (lightweight)
- **Description:** Render mini charts for 4 metrics
- **Details:**
  - Add CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
  - Create 4 chart instances (one per metric card)
  - 7-day view (last 7 data points from 4-week window)
  - Simple line chart, no legend (save space)
  - Colors: primary blue for line, light gray background
  - Mobile-optimized (small canvas, no tooltip)
- **CSS:** `.mini-chart canvas { max-width: 100%; }`
- **Testing:** Charts render, update when new workouts added

### Task B4: Generate Local Insights
- **File:** `index.html` - Add `generateLocalInsights()` function
- **Description:** Implement 4 local analysis rules
- **Details:**
  ```js
  function generateLocalInsights(workoutsData) {
    if (workoutsData.length < 2) return null;

    // Rule 1: Volume Trend
    const volumeTrend = ...;
    if (volumeTrend === 'up') insights.push('📈 Progressive overload on track');

    // Rule 2: RPE Pattern
    const avgRPE = ...;
    if (avgRPE > 8.5) insights.push('⚠️ High RPE detected; add rest day');

    // Rule 3: Adherence
    const workoutsPerWeek = workoutsData.length / 4;
    if (workoutsPerWeek >= 3) insights.push('✅ Great consistency!');

    // Rule 4: Rest Duration
    const avgRest = ...;
    if (avgRest < 60) insights.push('⏱️ Short rest periods detected');

    return insights;
  }
  ```
- **Testing:** Verify rules trigger for various data patterns

### Task B5: Update Navigation
- **File:** `index.html` - `.bottom-nav` section
- **Description:** Replace Routines with Analytics tab
- **Details:**
  - Remove Routines nav item
  - Add Analytics nav item (stats icon)
  - Update click handler to show #analyticsScreen
  - Update activeState logic
- **Testing:** Click Analytics tab → screen appears, nav active state updates

### Task B6: Add Routines Context Menu
- **File:** `index.html` - Home & History screens
- **Description:** Access Routines via long-press context menu
- **Details:**
  - Home screen: Long-press "Start Workout" → menu appears with "Load Routine"
  - History screen: Long-press workout card → menu with "Use as Template"
  - Menu implementation: simple modal with 2-3 options
- **Testing:** Long-press → menu appears, "Load Routine" works

### Task B7: Test Metric Accuracy
- **File:** N/A (testing)
- **Description:** Verify all calculations with real workout data
- **Details:**
  - Create test workouts (5 different patterns)
  - Calculate metrics manually
  - Compare with app calculations
  - Document any discrepancies
- **Testing:** Manual spot-check of 5 sample workouts

---

## PHASE C: AI Recommendations (Days 5-6)

**Goal:** Weekly recommendations via Claude API + weekly insight card.

### Task C1: Create Edge Function Scaffold
- **File:** `supabase/functions/generate-weekly-recommendations/index.ts`
- **Description:** Endpoint structure with cron trigger capability
- **Details:**
  ```typescript
  import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

  serve(async (req) => {
    const { secret, targetDate } = await req.json()

    if (secret !== Deno.env.get("CRON_SECRET")) {
      return new Response("Unauthorized", { status: 401 })
    }

    const supabase = createClient(...)
    // TODO: Implement logic

    return new Response(JSON.stringify({ success: true }))
  })
  ```
- **Testing:** Deploy function, test with curl

### Task C2: Implement Metric Aggregation
- **File:** Edge Function - Main logic
- **Description:** Calculate metrics from past 4 weeks
- **Details:**
  - Query workouts for user (4 weeks prior)
  - Aggregate volume, avg RPE, workouts count, avg rest
  - Format for Claude prompt
  ```sql
  SELECT
    COUNT(*) as workout_count,
    AVG(rpe) as avg_rpe,
    SUM(weight * reps) as total_volume,
    AVG(rest_duration) as avg_rest
  FROM workouts
  WHERE user_id = $1 AND date > NOW() - INTERVAL '4 weeks'
  ```
- **Testing:** Verify calculations with test data

### Task C3: Integrate Claude API
- **File:** Edge Function - Claude call
- **Description:** Call Claude Opus for personalized insights
- **Details:**
  - Use Anthropic SDK (Node/Deno)
  - Build prompt with metrics + user's training_focus
  - Parse response (Markdown bullet points)
  - Handle errors gracefully (fallback to local insights)
  ```typescript
  const client = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY")
  })

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: buildPrompt(metrics, trainingFocus)
    }]
  })
  ```
- **Testing:** Test with real API (cost tracking)

### Task C4: Create `weekly_recommendations` Table
- **File:** `supabase/migrations/xxxx_create_recommendations_table.sql`
- **Description:** Storage for weekly insights
- **Details:**
  ```sql
  CREATE TABLE weekly_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    week_starting DATE NOT NULL,
    local_insights JSONB,
    claude_insights TEXT,
    generated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, week_starting)
  );

  CREATE INDEX idx_recommendations_user_week
  ON weekly_recommendations(user_id, week_starting DESC);
  ```
- **Testing:** Create migrations, test schema

### Task C5: Build "Get AI Insight" Button
- **File:** `index.html` - Analytics screen
- **Description:** Trigger on-demand recommendations
- **Details:**
  - Button in Analytics screen (after metric cards)
  - On click: send user data to Edge Function
  - Loading state: spinner, "Generating..."
  - Response: show Claude insights in modal
  - Fallback: if disabled, show "Enable Claude recommendations in settings"
- **Testing:** Click button → request sent → response displays

### Task C6: Add Weekly Insight Card to Home
- **File:** `index.html` - Home screen
- **Description:** Display latest weekly recommendation
- **Details:**
  - Card position: Below #weeklyStatsCard (existing)
  - Title: "📊 This Week's Training Insights"
  - Content: First 3 bullet points from claude_insights (or local_insights)
  - "View All" link → Analytics screen
  - "View Analytics" button
- **Testing:** Render on home, click link → Analytics screen

### Task C7: Implement Opt-in Toggle
- **File:** `index.html` - Profile/Settings section
- **Description:** UI for enabling Claude recommendations
- **Details:**
  - New toggle: "Get AI Insights"
  - Label: "Enable personalized recommendations from Claude AI"
  - Warning: "Your workout data will be sent to Claude API for analysis"
  - Saves to `profiles.claude_recommendations_enabled`
  - Default: OFF (privacy-first)
- **Testing:** Toggle on/off, verify in database

### Task C8: Set Up Cron Trigger
- **File:** External (EasyCron, AWS EventBridge, or similar)
- **Description:** Trigger Edge Function weekly
- **Details:**
  - URL: `https://your-project.supabase.co/functions/v1/generate-weekly-recommendations`
  - Frequency: Every Sunday 18:00 UTC
  - Payload: `{ "secret": "YOUR_SECRET", "targetDate": "2026-03-23" }`
  - Retry: If fails, retry 1x after 1 hour
  - Logging: Webhook logs in external service
- **Testing:** Verify cron triggers at scheduled time

### Task C9: Add Training Focus Selection
- **File:** `index.html` - Profile section
- **Description:** Let users choose training focus
- **Details:**
  - 3 radio buttons:
    - 💪 Strength (heavy, low reps, progressive overload)
    - 🔥 Hypertrophy (moderate, 8-12 reps, tempo)
    - 🏃 Endurance (high reps, short rest, circuits)
  - Saves to `profiles.training_focus`
  - Default: "Strength"
  - Affects Claude prompts
- **Testing:** Change focus → verify in database, recommendations adapt

---

## PHASE D: Polish & Optimization (Days 7+)

### Task D1: Cache Metric Calculations
- **File:** `index.html` - Caching layer
- **Description:** Don't recalculate metrics on every screen open
- **Details:**
  - Cache key: `metrics_cache_${weekStart}`
  - TTL: 1 hour (or until new workout added)
  - Invalidate on: `saveWorkout()`
  - Benefit: Analytics screen loads instantly
- **Testing:** Verify no lag opening Analytics 2x

### Task D2: Handle Cold-Start Cases
- **File:** `index.html` - Analytics screen
- **Description:** Show friendly messages when insufficient data
- **Details:**
  - < 2 workouts in 4 weeks: "Complete 2+ workouts for insights"
  - No rest durations logged: "Log rest times for recovery metrics"
  - Claude disabled: "Enable AI insights in settings"
- **Testing:** Test with fresh account

### Task D3: Error Handling & Fallbacks
- **File:** Edge Function + Frontend
- **Description:** Graceful degradation if API fails
- **Details:**
  - Claude API timeout: Show local insights instead
  - Network error: Cached previous week's insights
  - Database error: Show metric calculations only
  - User-facing: Toast notifications for errors
- **Testing:** Simulate API failures, verify fallbacks

### Task D4: Performance Profiling
- **File:** All files
- **Description:** Measure and optimize
- **Details:**
  - Metric calculation time: Target < 500ms
  - Analytics screen render: Target < 1s
  - Edge Function execution: Target < 5s
  - Use Chrome DevTools (Performance tab)
  - Optimize: Remove loops, memoize, lazy load charts
- **Testing:** Profile on slow device (Nexus 5X equivalent)

### Task D5: Accessibility Audit
- **File:** All files
- **Description:** WCAG AA compliance
- **Details:**
  - Color contrast: 4.5:1 for text
  - Focus states: Visible outline for keyboard navigation
  - Aria labels: For chart data, icons
  - Test with screen reader (NVDA, VoiceOver)
- **Testing:** Keyboard nav, screen reader test

### Task D6: Mobile Testing
- **File:** All files
- **Description:** Test on real devices (iOS + Android)
- **Details:**
  - iPhone 12, iPhone SE (small)
  - Android Galaxy A50, Pixel 4a
  - Timer accuracy, button size, chart legibility
  - Offline mode (Service Worker)
  - Viewport orientations (landscape)
- **Testing:** Use real devices, not emulators

### Task D7: User Testing & Feedback
- **File:** All files
- **Description:** Gather feedback from 3-5 test users
- **Details:**
  - Share beta link
  - Record usage (heatmaps, click patterns)
  - Collect feedback: survey or interview
  - Iterate on highest-impact issues
- **Testing:** Implement feedback, re-test

---

## Dependencies & Ordering

```
Phase A (Rest Tracking)
  ↓
Phase B (Analytics & Metrics)
  ↓
Phase C (AI Recommendations)
  ↓
Phase D (Polish & Optimization)
```

**Can be parallelized slightly:**
- A6 (mobile testing) can happen while starting B1
- C1-2 (Edge Function) can start while finishing B3

---

## Estimation Summary

| Phase | Hours | Days | Notes |
|-------|-------|------|-------|
| A | 3-4 | 1-2 | Straightforward, time spent testing |
| B | 4-5 | 2 | Chart library integration, metric math |
| C | 4-5 | 2 | API integration, setup complexity |
| D | 2-3 | 1+ | Open-ended, depends on feedback |
| **TOTAL** | **13-17** | **6-7** | Full feature ready |

---

## Next Step

→ Run `/spec:execute doc/specs/ia-recommendations-statistics/02-specification.md` to begin Phase A implementation.


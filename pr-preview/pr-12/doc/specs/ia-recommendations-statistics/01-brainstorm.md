# GymTracker: IA Recommendations + Statistics Module

**Slug:** ia-recommendations-statistics
**Author:** Claude Code
**Date:** 2026-03-23
**Branch:** preflight/ia-recommendations-statistics
**Related:** N/A

---

## 1) Intent & Assumptions

**Task Brief:**
Implement an advanced analytics and AI-powered recommendations system for GymTracker that captures comprehensive workout data (including rest durations between sets), generates insightful statistics, and provides personalized training recommendations based on RPE trends, adherence patterns, and performance data.

**Assumptions:**
- Supabase backend is available with migrations capability
- GymTracker v1.17.1 provides stable foundation with working auth & core workout tracking
- Users have completed at least 2 workouts to generate meaningful statistics
- Mobile-first PWA architecture continues (single-file HTML preferred for simplicity)
- AI recommendations will use Claude API via Edge Functions (Supabase)
- Rest duration tracking is critical for workout quality assessment
- Weekly feedback cycles are preferred over daily/monthly (better adherence signal)

**Out of Scope:**
- Changing core workout input/recording flow (weight, reps, RPE capture stays same)
- Integration with third-party fitness APIs (Fitbit, Apple Health)
- Offline sync improvements beyond current localStorage persistence
- Video analysis or real-time form correction
- Coach-managed athlete workflows

---

## 2) Pre-reading Log

**Current State:**
- `index.html` (v1.17.1): PWA with Supabase auth, exercise selection, set recording (weight, reps, RPE), workout history
- `sw.js`: Service Worker with cache management (v31)
- Architecture: Single-file client + Supabase backend + Edge Functions
- Existing captures: exercise name, equipment, weight, reps, RPE per set, completion timestamp
- Missing: rest duration between sets, comprehensive statistics, AI analysis

**Key Findings:**
- PWA structure is optimized for rapid iteration—adding new screens/sheets is straightforward
- Supabase schema already supports exercises, workouts, users via `profiles` table
- Edge Functions available for server-side AI calls (Claude API)
- Weekly feedback was partially implemented in v1.17.0 but minimal—can be expanded significantly
- Session persistence uses localStorage (ACTIVE_SESSION_KEY)—state recovery is robust

---

## 3) Codebase Map

**Primary Screens & Modules:**
- `#homeScreen` - Home/summary page (stats, recent workouts, weekly feedback)
- `#workoutScreen` - Active workout recording (exercise selection, sets, rest timer)
- `#historyScreen` - Past workouts list + filtering
- `#routinesScreen` - Routine templates
- `#profileScreen` - User profile + settings
- `.bottom-nav` - Navigation footer (5 main routes)

**Data Flow:**
1. User auth → `getSession()` → Supabase session token
2. Workout start → select exercise → add sets (weight, reps, RPE) → save to `savedWorkouts` → sync to Supabase `workouts` table
3. Cloud sync → `syncFromCloud()` → pulls latest workouts + profiles
4. Statistics calculation → analyze `savedWorkouts` → aggregated metrics + weekly trends
5. Recommendations → Edge Function call → Claude API → personalized feedback

**Key Variables & State:**
- `savedWorkouts` (array) - Local workout history
- `currentExerciseSets` (array) - Active workout sets
- `userProfile` (object) - User preferences + settings
- `workoutStartTime`, `currentExerciseName`, `completedExercises` - Session state
- `isWarmupSet`, `restCount` - Set attributes (v1.17.0)

**Shared Dependencies:**
- Supabase JS client (`window.supabase`)
- LocalStorage (persistence)
- Service Worker (offline cache)
- CSS design tokens (--primary, --success, etc.)

**Feature Flags & Config:**
- `CACHE_NAME` (v31 in sw.js)
- Rest presets UI exists (`#restSheet`) but timer logic incomplete
- Weekly feedback partial: `generateWeeklyFeedback()` exists but minimal scoring

**Potential Blast Radius:**
- Adding rest tracking requires schema changes (workouts table + new columns)
- Statistics screen is new (no conflicts)
- Recommendations integrate via Edge Function (isolated, no client breakage)
- Weekly feedback expansion affects home screen layout (manageable)

---

## 4) Root Cause Analysis

**N/A** - This is a new feature, not a bug fix. No reproduction steps or root cause analysis required.

---

## 5) Research

**Challenge:** How to implement rest duration tracking without disrupting existing UX?

**Potential Solutions:**

1. **Automatic Timer with Manual Logging**
   - Show REST_TIMER when "Complete Set" clicked
   - User can mark "ready" → automatically logs duration
   - Pros: Accurate, minimal user input
   - Cons: Requires UI redesign in workout screen

2. **Post-Workout Estimation**
   - User logs rest durations after workout (review sheet)
   - Based on workout templates or previous similar sessions
   - Pros: Non-disruptive, simpler
   - Cons: Less accurate, requires discipline

3. **Hybrid Approach (RECOMMENDED)**
   - Optional timer starts when set completes
   - User can skip (estimates from profile average)
   - Logged per-set in `currentExerciseSets[].rest_duration_seconds`
   - Pros: Flexible, accurate for engaged users, fallback for lazy logging
   - Cons: Slightly more UI complexity

**Challenge:** How to generate meaningful AI recommendations?

**Potential Solutions:**

1. **Claude API + Edge Function**
   - Aggregate workout metrics → send to Edge Function → Claude generates feedback
   - Pros: Flexible, can analyze trends deeply
   - Cons: Requires API key management, slight latency

2. **Client-Side ML (TensorFlow.js)**
   - Lightweight model in browser
   - Pros: Fast, no server cost
   - Cons: Limited sophistication, harder to update

3. **Hybrid (RECOMMENDED)**
   - Simple rules client-side (e.g., "RPE trending ↓ = rest improvement")
   - Claude API for deep analysis + personalized writing (weekly summary only)
   - Pros: Fast UI feedback + rich insights
   - Cons: Two-tier implementation

**Challenge:** How to structure statistics screens?

**Potential Solutions:**

1. **Home Screen Expansion**
   - Add stats tabs above recent workouts
   - Quick metrics: total volume, avg RPE, adherence %
   - Pros: Discoverable, minimal navigation
   - Cons: Screen gets crowded

2. **Dedicated Statistics Screen (RECOMMENDED)**
   - New tab in bottom nav replacing "Routines" or adding 6th tab
   - Comprehensive view: charts, trends, filters by muscle group/exercise
   - Pros: Dedicated space, scalable for future features
   - Cons: One more nav item

---

## 6) Domain Expertise Considerations

**Database/Schema:**
- New columns needed in `workouts` table:
  - `rest_durations_per_set` (array of integers, seconds)
  - `perceived_difficulty` (1-10 scale, optional)
  - `workout_quality_score` (0-100, calculated)
  - `muscle_groups_hit` (array of strings)

**Analytics:**
- Key metrics to track:
  - **Volume:** Total weight × reps per session + weekly trend
  - **Intensity:** Average RPE + max RPE per exercise
  - **Adherence:** Workouts/week, consistency streak
  - **Recovery:** Average rest duration per exercise
  - **Progress:** RPE-adjusted 1RM estimates (using Brzycki or Epley)

**AI/Recommendations:**
- Input data for Claude:
  - Last 4 weeks of workout history
  - Personal PRs and lifting experience
  - Current average RPE (overtraining indicator if >8)
  - Adherence trends

- Output format: Markdown bullet points with actionable feedback

**Performance:**
- Statistics calculations should be cached (recalculate weekly)
- Edge Function calls throttled (1-2 per user per day to avoid quota)
- Charts rendered client-side (Chart.js or similar lightweight library)

---

## 7) Clarification Questions (RESOLVED)

1. ~~Rest Tracking Priority: Should we start with manual timer (Phase A) or estimation fallback (simpler MVP)?~~ ✅ (RESOLVED)
   **Answer:** Full Timer UX - Accurate tracking with visual timer when set completes. User marks "ready" → logs duration automatically.

2. ~~Statistics Scope: Which metrics are MVP vs. future?~~ ✅ (RESOLVED)
   **Answer:** MVP includes ALL four: Volume, Intensity (RPE), Adherence, Recovery. Future phases can add 1RM estimates, muscle group balance, exercise PRs.

3. ~~Recommendations Frequency: Generate weekly or on-demand?~~ ✅ (RESOLVED)
   **Answer:** Hybrid - Automatic weekly generation (Sunday evening) + manual trigger available anytime in Analytics tab.

4. ~~Screen Layout: Replace existing nav item or add new tab?~~ ✅ (RESOLVED)
   **Answer:** Replace "Routines" Tab with "Analytics". Routines stay accessible via context menu in home or history screens.

5. ~~Data Retention: How many weeks of history to analyze for recommendations?~~ ✅ (RESOLVED)
   **Answer:** 4 weeks - Standard fitness cycle, good balance between trends and recency. Allows ~16-20 workouts minimum for meaningful patterns.

6. ~~AI Customization: Should recommendations account for user input?~~ ✅ (RESOLVED)
   **Answer:** Customizable - Users select focus area (strength, hypertrophy, or endurance) in settings. Simple UX, good personalization.

7. ~~Privacy: Are users comfortable sending workout history to Claude API?~~ ✅ (RESOLVED)
   **Answer:** Opt-in + Local Analysis First - Default: app provides rule-based insights (no API calls). Option in settings to enable Claude API for deeper analysis with clear disclosure.

---

## 7b) Follow-up Clarifications (RESOLVED)

1. ~~Automatic Weekly Triggering: Cron job vs. on-first-access?~~ ✅ (RESOLVED)
   **Answer:** Background Cron Job - Edge Function runs every Sunday evening. All users get fresh insights automatically, consistent timing.

2. ~~Local Analysis Rules: Which quick insights before Claude API?~~ ✅ (RESOLVED)
   **Answer:** All four:
   - Volume Trend Analysis (total weight/reps up = good, down = overtraining)
   - RPE Pattern Detection (high RPE = suggest rest, low RPE = increase intensity)
   - Adherence Metrics (workouts/week, days missed, streaks)
   - Rest Duration Insights (shorter rest = fatigue, longer = deload phase)

3. ~~Routines Access After Tab Replacement~~ ✅ (RESOLVED)
   **Answer:** Context Menu in Home Screen - Long-press on recent workout or "Start Workout" button reveals "Load Routine" option.

---

## 8) Implementation Roadmap (Phases)

**Phase A: Rest Duration Capture (Days 1-3)**
- Add timer UI to workout screen
- Schema: `workouts.rest_durations_per_set`
- Store locally + sync to Supabase
- Basic validation (no negative values, realistic ranges)

**Phase B: Statistics Screen & Metrics (Days 4-6)**
- Create dedicated Analytics tab
- Implement volume, RPE intensity, adherence calculations
- Chart rendering (lightweight library)
- Weekly metrics aggregation

**Phase C: AI Recommendations (Days 7-9)**
- Create Supabase Edge Function
- Integrate Claude API
- Format recommendations (markdown)
- Display on home screen + analytics screen

**Phase D: Polish & Optimization (Days 10+)**
- Performance profiling (cache statistics)
- Edge case handling
- User testing + feedback
- Refinement of recommendation quality

---

## 9) Next Steps

1. **User Clarification:** Answer the 7 questions above to refine scope
2. **Database Setup:** Create Supabase migrations for new columns + Edge Function placeholder
3. **Design Mockups:** Sketch rest timer UI + analytics screen layout
4. **Spec Generation:** Convert this brainstorm → detailed specification with API contracts


# GymTracker: IA Recommendations + Statistics - Technical Specification

**Version:** 1.0
**Author:** Claude Code
**Date:** 2026-03-23
**Status:** Ready for Implementation
**Related Brainstorm:** `01-brainstorm.md`

---

## 1) Executive Summary

Implement a comprehensive analytics and AI-powered recommendations system for GymTracker. The system captures rest durations between sets, calculates 4 key metrics (volume, intensity, adherence, recovery), generates local rule-based insights automatically, and offers optional Claude API integration for deeper personalized recommendations.

**Key Decisions:**
- Full Timer UX for rest duration capture (automatic when set completes)
- MVP includes all 4 metrics: Volume, RPE Intensity, Adherence, Recovery
- Hybrid recommendations: automatic weekly (Sunday via cron) + on-demand manual trigger
- Replace Routines tab with Analytics; access Routines via context menu in Home
- 4-week data window for analysis (balance between trends and recency)
- Customizable focus area (strength/hypertrophy/endurance)
- Privacy-first: local analysis by default, opt-in for Claude API

---

## 2) User Stories & Workflows

### Story 1: Rest Duration Tracking
**As a** user performing sets during a workout
**I want to** automatically track rest duration between sets
**So that** I can understand my recovery patterns and workout intensity

**Workflow:**
1. User taps "Complete Set" after entering weight, reps, RPE
2. Rest timer modal appears (bottom sheet)
3. Timer counts up automatically (00:00)
4. User performs rest activities (can close modal, move around)
5. User taps "Ready" when finished resting
6. Duration logged to current set: `currentExerciseSets[i].rest_duration_seconds`
7. Next set form appears

**Acceptance Criteria:**
- Timer starts immediately when "Complete Set" is tapped
- User can minimize/ignore timer (continues in background)
- Rest duration accurate to nearest second
- Data persists if user navigates away during rest
- Mobile-friendly timer UI (large buttons, clear countdown)

---

### Story 2: View Weekly Analytics
**As a** user after completing workouts
**I want to** see my stats for the week (volume, RPE, adherence, recovery)
**So that** I can track progress and identify patterns

**Workflow:**
1. User taps "Analytics" tab in bottom nav (replaces Routines)
2. Analytics screen shows:
   - Week summary card (dates, workout count)
   - 4 metric cards: Volume, Intensity (avg RPE), Adherence (workouts/week), Recovery (avg rest)
   - Mini charts showing trend lines
   - Local insights generated automatically (e.g., "RPE trending up → increase rest day")
3. User can tap each metric for detailed breakdown (by exercise)
4. Optionally tap "Get AI Insight" button to trigger Claude API (if enabled)

**Acceptance Criteria:**
- Metrics calculated from last 4 weeks of data
- Charts render smoothly on mobile
- Local rules provide instant feedback (no API call delay)
- Settings link accessible to enable/disable Claude recommendations

---

### Story 3: Receive Automatic Weekly Recommendations
**As a** a user
**I want to** get AI-powered recommendations every Sunday evening
**So that** I stay informed about my training progress and next steps

**Workflow:**
1. Edge Function triggers Sunday 18:00 UTC (or local TZ if available)
2. Function aggregates last 4 weeks of user's workouts
3. If user has 2+ workouts in period AND enabled Claude recommendations:
   - Builds summary: volume trend, RPE patterns, adherence, focus area preference
   - Calls Claude API with prompt
   - Stores response in recommendations table
   - User sees notification/badge on home screen: "📊 New Weekly Insight"
4. User taps card to expand weekly insight

**Acceptance Criteria:**
- Runs automatically every Sunday (configurable)
- Only runs if user has minimum 2 workouts in 4-week window
- Respects opt-in privacy setting
- Response cached (don't re-run if viewed multiple times)
- Graceful fallback if API fails (show local insights instead)

---

### Story 4: Customize Recommendations Focus Area
**As a** user with specific training goals
**I want to** set my training focus (strength, hypertrophy, or endurance)
**So that** recommendations are tailored to my goals

**Workflow:**
1. User goes to Profile / Settings
2. Under "Training Preferences", selects focus area:
   - 💪 Strength (heavy weight, low reps, progressive overload)
   - 🔥 Hypertrophy (moderate weight, 8-12 reps, controlled tempo)
   - 🏃 Endurance (high reps, short rest, circuit style)
3. Selection saved to `profiles.training_focus`
4. Claude prompts adapted based on selection

**Acceptance Criteria:**
- Default focus is "Strength"
- Change persists across sessions
- Synced to Supabase profiles table

---

## 3) Technical Architecture

### 3.1 Data Model Changes

**Supabase Schema Updates:**

**Table: workouts (existing, add columns)**
```sql
ALTER TABLE workouts ADD COLUMN (
  rest_durations_per_set INTEGER[] DEFAULT NULL, -- [60, 90, 75] in seconds
  perceived_difficulty INT CHECK (perceived_difficulty BETWEEN 1 AND 10),
  workout_quality_score INT CHECK (workout_quality_score BETWEEN 0 AND 100),
  muscle_groups_hit TEXT[] DEFAULT NULL -- ['chest', 'triceps']
);
```

**Table: weekly_recommendations (new)**
```sql
CREATE TABLE weekly_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  week_starting DATE NOT NULL,
  analysis_period_start DATE, -- 4 weeks back from week_starting
  analysis_period_end DATE,

  -- Local Analysis (always computed)
  local_insights JSONB, -- {volumeTrend, rpePattern, adherence, rest}

  -- Claude API Results (if opted in)
  claude_insights TEXT, -- Markdown formatted
  claude_tokens_used INT,
  generated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, week_starting)
);
```

**Table: user_analytics_cache (new)**
```sql
CREATE TABLE user_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  metric_week_start DATE NOT NULL,

  -- 4 Metrics
  total_volume_lbs INT,
  avg_rpe NUMERIC(3,1),
  workouts_count INT,
  avg_rest_duration_seconds INT,

  cached_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, metric_week_start)
);
```

**profiles table (existing, add columns)**
```sql
ALTER TABLE profiles ADD COLUMN (
  training_focus VARCHAR(20) DEFAULT 'strength', -- 'strength', 'hypertrophy', 'endurance'
  claude_recommendations_enabled BOOLEAN DEFAULT FALSE,
  last_recommendation_generated DATE
);
```

---

### 3.2 Frontend Components

**New Screens:**

1. **Analytics Screen** (`#analyticsScreen`)
   - Replaces `#routinesScreen` in nav
   - 4 metric cards (Volume, Intensity, Adherence, Recovery)
   - Mini chart per metric (chart.js or lightweight library)
   - "Get AI Insight" button (if Claude enabled)
   - Weekly summary card with trend indicators (↑↓→)
   - Exercise breakdown tab (optional)

2. **Rest Timer Modal** (`#restSheet`)
   - Bottom sheet, already exists but needs expansion
   - Large countdown display (00:00 format)
   - "Ready" button (primary)
   - "Skip Rest" button (secondary)
   - Minimize/background option
   - Auto-dismiss after user marks ready

3. **Weekly Insight Card** (Home Screen)
   - New card below weekly stats
   - Headline: "This Week's Training Insights"
   - Bullet points with emoji (✓ strength, ⚠️ warning, 💡 tip)
   - "View Analytics" link

4. **Training Preferences** (Settings, new)
   - Radio buttons: Strength / Hypertrophy / Endurance
   - Toggle: "Get AI Insights" (opt-in)
   - Privacy notice: "Data shared with Claude API for deeper analysis"
   - Manage focus area

---

### 3.3 Backend: Edge Function

**Function:** `functions/generate-weekly-recommendations.ts`

**Trigger:** HTTP (called by cron external service)

**Input:**
```ts
interface CronPayload {
  secret: string; // Validate against env var
  targetDate: string; // ISO date of recommendation week
}
```

**Logic:**
```
1. Validate secret
2. For each active user (training_focus is set):
   a. Query workouts from 4 weeks prior to targetDate
   b. Calculate metrics (volume, rpe_avg, adherence, rest_avg)
   c. Store in weekly_recommendations.local_insights
   d. If claude_recommendations_enabled:
      - Build prompt with metrics + focus area
      - Call Claude API (claude-opus-4-6 or -4-5)
      - Store response in claude_insights
   e. Update profiles.last_recommendation_generated = targetDate
3. Return summary (users processed, errors)
```

**Claude Prompt Template:**
```
You are a fitness coach analyzing {user.training_focus} training.

User's last 4 weeks:
- Total volume: {volume} lbs
- Average RPE: {rpe_avg}/10
- Workouts completed: {workouts_count}/week
- Average rest between sets: {rest_avg} seconds

Provide 3-4 specific, actionable recommendations as bullet points.
Format: "• {Emoji} {Advice}"

Examples of good advice:
• 💪 Increase weight by 5-10 lbs on squats (RPE trending low)
• 🔄 Add 20 seconds more rest between chest sets (fatigue detected)
• 📈 Volume trending up but RPE stable (good progression!)
```

**Cron Trigger:**
- External cron service (e.g., EasyCron, AWS EventBridge, Google Cloud Scheduler)
- POST to Edge Function every Sunday 18:00 UTC
- Or: first time user opens app after Sunday → manual generation

---

### 3.4 Local Analysis Rules (Client-Side)

Implemented in `generateLocalInsights()` function:

```js
function generateLocalInsights(workoutsData) {
  const fourWeeksAgo = new Date(Date.now() - 28*24*60*60*1000);
  const recentWorkouts = workoutsData.filter(w => new Date(w.date) > fourWeeksAgo);

  if (recentWorkouts.length < 2) return null; // Not enough data

  // 1. Volume Trend
  const volumeByWeek = [...];
  const volumeTrend = volumeByWeek[last] > volumeByWeek[first] ? 'up' : 'down';

  // 2. RPE Pattern
  const avgRPE = recentWorkouts.reduce((sum, w) =>
    sum + average(w.sets.map(s => s.rpe)), 0) / recentWorkouts.length;
  const rpeStatus = avgRPE > 8.5 ? 'overtraining' : avgRPE < 5 ? 'undertraining' : 'balanced';

  // 3. Adherence
  const workoutsPerWeek = recentWorkouts.length / 4;
  const consistency = hasConsecutentDays ? 'good' : 'sporadic';

  // 4. Rest Duration
  const avgRest = averageRestDuration(recentWorkouts);
  const trend = restIsDecreasing(recentWorkouts) ? 'shortening' : 'stable';

  return {
    volumeTrend,
    rpeStatus,
    adherence: workoutsPerWeek,
    consistency,
    avgRest,
    restTrend: trend
  };
}
```

**Insight Messages:**
- Volume up + RPE up = "📈 Progressive overload looking good!"
- Volume flat + RPE down = "💡 Increase weight or reps to continue progressing"
- RPE > 8.5 for 2+ weeks = "⚠️ High RPE detected; consider extra rest day"
- Rest shortening = "⏱️ Rest durations decreasing; watch for fatigue"

---

## 4) Implementation Phases

### Phase A: Rest Duration Capture (Days 1-2, ~3-4 hours)
**Goal:** Users can record rest time between sets

**Tasks:**
- [ ] Modify `currentExerciseSets[]` schema to include `rest_duration_seconds`
- [ ] Create Rest Timer modal UI (expand existing #restSheet)
- [ ] Implement timer logic (start, pause, reset, ready)
- [ ] Sync rest durations to Supabase when saving workout
- [ ] Basic validation (no negative values, reasonable max 5 min)
- [ ] Test on device (visual timer, accuracy)

**Deliverable:** Users can complete sets with rest tracking. Data persists locally + syncs to cloud.

---

### Phase B: Analytics Screen & Metrics (Days 3-4, ~4-5 hours)
**Goal:** Display volume, RPE, adherence, recovery metrics

**Tasks:**
- [ ] Create `#analyticsScreen` layout
- [ ] Implement metric calculation functions (4 metrics)
- [ ] Create simple chart rendering (lightweight library or SVG)
- [ ] Add local insights generation
- [ ] Replace Routines nav with Analytics
- [ ] Add context menu for Routines access
- [ ] Test metric calculations (verify math accuracy)

**Deliverable:** Users see their weekly stats in Analytics tab. Local rules provide instant insights.

---

### Phase C: AI Recommendations (Days 5-6, ~4-5 hours)
**Goal:** Automatic weekly recommendations via Claude API + weekly insight card

**Tasks:**
- [ ] Create Supabase Edge Function skeleton
- [ ] Implement metric aggregation in Edge Function
- [ ] Integrate Claude API call (test with dev data)
- [ ] Create `weekly_recommendations` table migrations
- [ ] Build "Get AI Insight" button in Analytics
- [ ] Add weekly insight card to Home screen
- [ ] Implement opt-in toggle in Settings
- [ ] Set up external cron trigger (or manual trigger for MVP)

**Deliverable:** Recommendations generate weekly (or on-demand). Users can opt-in to Claude insights.

---

### Phase D: Polish & Optimization (Days 7+, ~2-3 hours)
**Goal:** Performance, edge cases, user feedback

**Tasks:**
- [ ] Cache metric calculations (weekly aggregation)
- [ ] Handle cold-start (users with < 2 weeks data)
- [ ] Error handling (API failures, offline mode)
- [ ] Accessibility audit (contrast, focus states)
- [ ] Mobile testing (timer UX, chart rendering on small screens)
- [ ] Performance profiling (SW cache, metric calculation time)
- [ ] User testing feedback + refinement

**Deliverable:** Polished, performant system ready for production.

---

## 5) API & Integration Points

### 5.1 Edge Function Endpoint

**POST** `/functions/v1/generate-weekly-recommendations`

**Request:**
```json
{
  "secret": "YOUR_SECRET_KEY",
  "targetDate": "2026-03-23"
}
```

**Response:**
```json
{
  "success": true,
  "usersProcessed": 145,
  "withClaudeInsights": 78,
  "errors": 0,
  "executionTimeMs": 2345
}
```

### 5.2 Claude API Call

**Model:** `claude-opus-4-6` (or `-4-5`)
**Max Tokens:** 200
**Temperature:** 0.7

**System Prompt:**
```
You are a knowledgeable fitness coach. Provide 3-4 specific,
actionable recommendations for the user's training based on
their workout data. Be encouraging but honest. Format as
bullet points with relevant emojis.
```

**Example User Message:**
```
Training focus: Strength
Last 4 weeks:
- Total volume: 45,000 lbs
- Avg RPE: 7.2/10
- Workouts: 14 sessions
- Avg rest: 85 seconds

What should I focus on next week?
```

### 5.3 RPC / Database Functions

**`calculate_weekly_metrics(user_id, week_start_date)`** (SQL function)
```sql
-- Returns: volume, avg_rpe, workouts_count, avg_rest
-- Used by Edge Function to aggregate metrics
```

---

## 6) Testing Strategy

### Unit Tests
- Metric calculation functions (volume, RPE, adherence, rest)
- Local insight generation rules
- Rest timer logic (start, stop, formatting)

### Integration Tests
- End-to-end workout with rest tracking
- Metric calculations from real workout data
- Edge Function (mock Claude API)

### Manual Testing
- Rest timer UX (timer accuracy, mobile feel)
- Analytics screen rendering (charts, responsiveness)
- Weekly insight card display
- Settings: enabling/disabling Claude recommendations
- Privacy: verify data not sent without opt-in

### Performance Tests
- Analytics screen load time (with 52 weeks of data)
- Metric calculation time (should be < 500ms)
- Edge Function execution time (should be < 5 seconds)

---

## 7) Success Criteria

**Phase A (Rest Tracking):**
- ✅ Rest duration captured for 100% of sets
- ✅ Timer UI responsive (no lag on button tap)
- ✅ Data syncs reliably to Supabase

**Phase B (Metrics):**
- ✅ All 4 metrics calculate accurately
- ✅ Charts render smoothly (30 fps on mobile)
- ✅ Local insights provided instantly (no API latency)

**Phase C (AI):**
- ✅ Weekly recommendations generate automatically
- ✅ Claude API calls successful (>95% success rate)
- ✅ Recommendations relevant to user's focus area
- ✅ Opt-in privacy respected (no data sent without consent)

**Phase D (Polish):**
- ✅ Edge cases handled (low data, API failures, offline)
- ✅ Accessibility compliant (WCAG AA)
- ✅ Performance profiled & optimized
- ✅ User testing feedback integrated

---

## 8) Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Claude API quota exceeded | Users can't get recommendations | Implement rate limiting (1 per user per day) + cache responses |
| Rest timer inaccuracy on slow devices | User frustration | Use `Date.now()` (reliable), test on old devices |
| Metric calculation bugs | Wrong insights shown | Unit test all calculation functions, manual spot-check |
| Privacy concerns (opt-in not honored) | Regulatory/trust issue | Validate before every API call, log all requests |
| Cold-start (new user, < 2 weeks data) | Recommendations unavailable | Show placeholder: "Complete 2 workouts for insights" |

---

## 9) Out of Scope (Deferred)

- 1RM estimates (Brzycki formula - Phase D)
- Muscle group balance analysis (requires exercise tagging enhancement)
- Coach/athlete workflows
- Wearable integrations (Apple Watch, Fitbit)
- Video form analysis
- Nutritional recommendations

---

## 10) Changelog

**2026-03-23 - Initial Specification**
- Clarifications resolved
- Phases defined
- API contracts established
- Ready for implementation


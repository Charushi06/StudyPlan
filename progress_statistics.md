# 📊 Feature Specification: StudyPlan Progress Statistics Dashboard

This document provides the complete, step-by-step implementation blueprint to add a premium **Progress Statistics Dashboard** to **StudyPlan**.

---

## 🎨 Visual & Functional Architecture

The dashboard inserts a responsive visual row at the top of your workspace (right below your motivational quote card and above the calendar), providing real-time cognitive metrics on your study tasks.

```
+---------------------------------------------------------------------------------------+
|  [ DAILY PROGRESS: 65% ]  |  [ TOTAL: 12 ]  |  [ OVERDUE: 1 ]  |  [ CONFIDENCE: 85% ] |
|  [================----]  |                 |  (High Alert)    |  (High Competency)  |
+---------------------------------------------------------------------------------------+
```

### 📈 Core Metrics Captured
1. **Daily Progress Rate**: A sleek progress bar computing `(Completed Tasks / Total Tasks) * 100`.
2. **Total Task Load**: The raw volume of active tasks in the current view.
3. **Overdue Task Alert**: Highlights tasks where the deadline is in the past and status is not yet marked `'Done'`.
4. **Study Confidence Meter**: Aggregates the average of the student's confidence scores from SQLite!

---

## 🛠️ Step-by-Step Implementation Recipe

No code changes have been applied to your files. Below are the precise modifications to integrate this feature:

### 📥 1. Structural Insertion (`StudyPlan/index.html`)

Open [index.html](file:///c:/Users/tejj1/OneDrive/Desktop/New%20folder%20(2)/New%20folder/StudyPlan/index.html) and locate the **Dashboard Greeting** block (near line 127). Insert the stats container directly below the quote widget:

```html
<!-- Locate this block near line 127: -->
<div class="dashboard-greeting" style="padding: 16px 24px 0; display: flex; justify-content: center;">
  <div class="quote-widget">
    ...
  </div>
</div>

<!-- ==================== INSERT STATS DASHBOARD HERE ==================== -->
<div class="stats-dashboard" id="stats-dashboard">
  <!-- Stat Card 1: Progress Rate -->
  <div class="stat-card">
    <div class="stat-header">
      <span class="stat-label">Daily Progress</span>
      <span id="stats-progress-percent" class="stat-percent">0%</span>
    </div>
    <div class="progress-bar-container">
      <div id="stats-progress-fill" class="progress-fill"></div>
    </div>
  </div>

  <!-- Stat Card 2: Total Tasks -->
  <div class="stat-card">
    <span class="stat-label">Total Tasks</span>
    <span id="stats-total" class="stat-value">0</span>
  </div>

  <!-- Stat Card 3: Overdue Tasks -->
  <div class="stat-card highlight-danger">
    <span class="stat-label">Overdue Tasks</span>
    <span id="stats-overdue" class="stat-value danger-text">0</span>
  </div>

  <!-- Stat Card 4: Study Confidence -->
  <div class="stat-card highlight-purple">
    <span class="stat-label">Average Confidence</span>
    <span id="stats-confidence" class="stat-value">0%</span>
  </div>
</div>
<!-- ===================================================================== -->

<!-- Followed by Calendar: -->
<div class="cal-section">
  ...
```

---

### 🎨 2. Theme Styles (`StudyPlan/css/index.css`)

Open [index.css](file:///c:/Users/tejj1/OneDrive/Desktop/New%20folder%20(2)/New%20folder/StudyPlan/css/index.css) and append these custom UI properties to the bottom of the stylesheet:

```css
/* ==================== PROGRESS STATS DASHBOARD ==================== */
.stats-dashboard {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 16px 24px 8px 24px;
  flex-shrink: 0;
  animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.stat-card {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-secondary);
  box-shadow: var(--shadow-md);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.1;
}

.stat-percent {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-success);
}

/* Progress bar styling */
.progress-bar-container {
  height: 8px;
  background: var(--color-background-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 6px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  width: 0%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Custom Highlight States */
.stat-card.highlight-danger:hover {
  border-color: var(--color-text-danger);
  background: linear-gradient(135deg, rgba(var(--color-danger-rgb), 0.04) 0%, var(--color-background-primary) 100%);
}

.stat-card.highlight-purple:hover {
  border-color: var(--color-text-purple);
  background: linear-gradient(135deg, rgba(60, 52, 137, 0.04) 0%, var(--color-background-primary) 100%);
}

.danger-text {
  color: var(--color-text-danger) !important;
}

/* Responsive grid layout */
@media (max-width: 768px) {
  .stats-dashboard {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 12px 16px;
  }
}
```

---

### ⚙️ 3. Logical Bindings (`StudyPlan/js/app.js`)

Open [app.js](file:///c:/Users/tejj1/OneDrive/Desktop/New%20folder%20(2)/New%20folder/StudyPlan/js/app.js) and add the core analytics updater function:

#### Step A: Define the Dashboard Engine
Add this new function in `app.js` (you can place it right below the `renderTasks()` definition):

```javascript
// Add to js/app.js
function renderStats() {
  const tasks = store.tasks.filter(t => !t.archived);
  const total = tasks.length;

  const fillEl = document.getElementById('stats-progress-fill');
  const percentEl = document.getElementById('stats-progress-percent');
  const totalEl = document.getElementById('stats-total');
  const overdueEl = document.getElementById('stats-overdue');
  const confidenceEl = document.getElementById('stats-confidence');

  if (!fillEl || !percentEl || !totalEl || !overdueEl || !confidenceEl) return;

  if (total === 0) {
    fillEl.style.width = '0%';
    percentEl.textContent = '0%';
    totalEl.textContent = '0';
    overdueEl.textContent = '0';
    confidenceEl.textContent = 'N/A';
    return;
  }

  // 1. Completion Progress
  const completed = tasks.filter(t => t.status === 'Done').length;
  const progressPercent = Math.round((completed / total) * 100);

  // 2. Overdue calculation
  const now = new Date();
  const overdue = tasks.filter(t => t.status !== 'Done' && t.due_at && new Date(t.due_at) < now).length;

  // 3. Average confidence extraction
  const confidenceTasks = tasks.filter(t => t.confidence_score !== null && t.confidence_score !== undefined);
  const avgConfidence = confidenceTasks.length
    ? Math.round(confidenceTasks.reduce((sum, t) => sum + t.confidence_score, 0) / confidenceTasks.length)
    : 100;

  // Render to DOM
  fillEl.style.width = `${progressPercent}%`;
  percentEl.textContent = `${progressPercent}%`;
  totalEl.textContent = total;
  overdueEl.textContent = overdue;
  confidenceEl.textContent = `${avgConfidence}%`;
}
```

#### Step B: Hook into store updates
Scroll to the bottom of `app.js` where the reactive store is subscribed. Update the listener to fire `renderStats()` every time tasks update:

```javascript
// Update subscription block in js/app.js
store.subscribe(() => {
  renderSidebarSubjects();
  renderFocusTasks();
  renderTasks();
  renderStats(); // <-- ADD THIS LINE HERE
});
```

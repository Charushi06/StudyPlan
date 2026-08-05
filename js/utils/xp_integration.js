/**
 * xp_integration.js
 *
 * Drop-in integration patch for your existing main.js / index.js.
 *
 * USAGE — add these lines at the top of your main.js:
 *
 *   import { XPClient, XPWidget, integrateXpWithStore, attachXpToTimer } from './xp_client.js';
 *   import { initXP } from './xp_integration.js';
 *
 * Then call once after `store.fetchInitialData()`:
 *
 *   const xp = initXP(store);
 *
 * That's it.  The widget mounts, task completions earn XP, and
 * the Focus Mode timer auto-tracks study time.
 */

import { XPClient, XPWidget, integrateXpWithStore, attachXpToTimer } from './xp_client.js';
import { Toast } from './utils/toast.js';

/**
 * Initialise the XP subsystem and return the client for advanced use.
 *
 * @param {object} store          — your existing store object
 * @param {object} [opts]
 * @param {string} [opts.userId]  — user identifier (default 'default')
 * @returns {XPClient}
 */
export function initXP(store, opts = {}) {
    const xpClient = new XPClient({
        userId: opts.userId || 'default',
        onXpChange: (newTotal, delta, reason, data) => {
            if (delta <= 0) return;

            // Level-up toast
            const prevLevel = xpClient._level;
            if (data.level > prevLevel) {
                Toast.show(`🎉 Level up! You reached Level ${data.level}!`, 'success');
            } else {
                const label = {
                    task_done: '📝 Task completed',
                    topic_done: '📚 Topic completed',
                    notes_done: '🗒️ Notes completed',
                    study_time: '⏱ Study session',
                }[reason] || 'Activity';
                Toast.show(`+${delta} XP — ${label}`, 'success');
            }
        },
    });

    // Mount the floating badge
    new XPWidget(xpClient, { position: 'top-right' }).mount();

    // Wire store task toggles → XP awards
    integrateXpWithStore(store, xpClient);

    // Wire Focus Mode timer → study-time XP
    // (runs after DOM is ready; activeFocusTaskId is the module-level variable in main.js)
    document.addEventListener('DOMContentLoaded', () => {
        attachXpToTimer(xpClient, () => {
            // Return the currently focused task id — adjust if your variable is named differently
            return window._activeFocusTaskId || null;
        });
    });

    // Warm cache
    xpClient.init();

    return xpClient;
}

/*
─────────────────────────────────────────────────────────────────────────────
  SERVER SETUP (server.js / app.js)
─────────────────────────────────────────────────────────────────────────────

  const xpRouter = require('./xp_system');     // CommonJS
  xpRouter.setDb(db);                           // pass your existing SQLite db handle
  app.use('/api/xp', xpRouter);

  That's all the server-side wiring needed.

─────────────────────────────────────────────────────────────────────────────
  API ENDPOINTS SUMMARY
─────────────────────────────────────────────────────────────────────────────

  GET  /api/xp                        → { user_id, xp, level, xp_into_level, xp_for_next_level, progress_pct }
  GET  /api/xp/ledger?limit=50        → { xp, level, transactions: [...] }

  POST /api/xp/award                  → generic award  { amount, reason, [metadata] }
  POST /api/xp/study-time             → { minutes, [session_token], [task_id] }   → 2 XP/min
  POST /api/xp/task-done              → { task_id, [xp_override] }                → 20 XP default
  POST /api/xp/topic-done             → { topic_id, [topic_name] }                → 50 XP fixed
  POST /api/xp/notes-done             → { note_id, [xp_override] }                → 30 XP default

  All POST responses include updated { xp, level, progress_pct, … }.

─────────────────────────────────────────────────────────────────────────────
  XP RATES (configurable in xp_system.js › XP_RATES)
─────────────────────────────────────────────────────────────────────────────

  study_time → 2 XP per minute  (capped at 120 min/call)
  task_done  → 20 XP  (overridable per call via xp_override)
  topic_done → 50 XP  (fixed, once per topic per day)
  notes_done → 30 XP  (overridable per call via xp_override)

─────────────────────────────────────────────────────────────────────────────
  ANTI-ABUSE GUARDS
─────────────────────────────────────────────────────────────────────────────

  • task_done  — each task_id can only earn XP once (lifetime).
  • topic_done — each topic_id can only earn XP once per calendar day.
  • notes_done — each note_id can only earn XP once (lifetime).
  • study_time — session_token dedup prevents double-submission.
                 Hard cap: max 120 minutes per API call.

─────────────────────────────────────────────────────────────────────────────
  LEVEL FORMULA
─────────────────────────────────────────────────────────────────────────────

  Level N requires  N × 100  XP to advance.
  Cumulative thresholds: Lv1→2: 100 XP | Lv2→3: 200 XP | Lv3→4: 300 XP …

  Example:
    0 XP   → Level 1
    100 XP → Level 2
    300 XP → Level 3
    600 XP → Level 4
    1000XP → Level 5
*/
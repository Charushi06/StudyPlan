/**
 * xp_client.js
 * 
 * Browser-side XP client.  Drop this next to your existing JS files and import
 * it in main.js (or index.js):
 *
 *   import { XPClient, XPWidget } from './xp_client.js';
 *
 * The XPWidget auto-mounts a floating XP badge into the DOM and listens to
 * store events so it stays in sync without any extra plumbing.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  XPClient — thin wrapper around /api/xp endpoints
// ─────────────────────────────────────────────────────────────────────────────

export class XPClient {
    /**
     * @param {object} opts
     * @param {string} [opts.baseUrl='/api/xp']
     * @param {string} [opts.userId='default']
     * @param {function} [opts.onXpChange]  — called with (newTotal, delta, reason, levelInfo)
     */
    constructor(opts = {}) {
        this.baseUrl = opts.baseUrl || '/api/xp';
        this.userId = opts.userId || 'default';
        this.onXpChange = opts.onXpChange || null;

        // Local cache so we can derive deltas
        this._xp = 0;
        this._level = 1;
        this._ready = false;

        // Study-time session state
        this._studySessionToken = null;
        this._studySessionStart = null;
        this._studySessionTaskId = null;
        this._studyFlushTimer = null;
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    /** Fetch current XP and warm the cache. */
    async init() {
        try {
            const data = await this._get('');
            this._apply(data);
            this._ready = true;
            return data;
        } catch (e) {
            console.warn('[XPClient] init failed:', e.message);
            return null;
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    /** Fetch fresh XP total from server. */
    async fetchXp() {
        const data = await this._get('');
        this._apply(data);
        return data;
    }

    /**
     * Award XP for a completed task.
     * @param {string|number} taskId
     * @param {number} [xpOverride]   override default 20 XP
     */
    async taskDone(taskId, xpOverride) {
        const body = { user_id: this.userId, task_id: String(taskId) };
        if (xpOverride) body.xp_override = xpOverride;
        const data = await this._post('/task-done', body);
        if (data.xp_earned > 0) this._notify(data, 'task_done');
        return data;
    }

    /**
     * Award 50 XP for completing a topic/subject.
     * @param {string|number} topicId
     * @param {string} [topicName]
     */
    async topicDone(topicId, topicName) {
        const data = await this._post('/topic-done', {
            user_id: this.userId,
            topic_id: String(topicId),
            topic_name: topicName || '',
        });
        if (data.xp_earned > 0) this._notify(data, 'topic_done');
        return data;
    }

    /**
     * Award XP for completing notes.
     * @param {string|number} noteId
     * @param {number} [xpOverride]
     */
    async notesDone(noteId, xpOverride) {
        const body = { user_id: this.userId, note_id: String(noteId) };
        if (xpOverride) body.xp_override = xpOverride;
        const data = await this._post('/notes-done', body);
        if (data.xp_earned > 0) this._notify(data, 'notes_done');
        return data;
    }

    // ── Study-time session helpers ──────────────────────────────────────────────

    /**
     * Call when user starts studying.
     * @param {string|number} [taskId]  — optional task being studied
     */
    startStudySession(taskId = null) {
        if (this._studySessionToken) return; // already running
        this._studySessionToken = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this._studySessionStart = Date.now();
        this._studySessionTaskId = taskId;

        // Flush every 5 minutes so XP isn't lost on tab close
        this._studyFlushTimer = setInterval(() => this._flushStudySession(false), 5 * 60 * 1000);

        // Flush on page hide/close
        this._pageHideHandler = () => this._flushStudySession(true);
        window.addEventListener('pagehide', this._pageHideHandler);
        window.addEventListener('beforeunload', this._pageHideHandler);

        console.debug('[XPClient] study session started', this._studySessionToken);
    }

    /** Call when user stops/pauses studying.  Returns XP earned. */
    async stopStudySession() {
        if (!this._studySessionToken) return 0;
        clearInterval(this._studyFlushTimer);
        window.removeEventListener('pagehide', this._pageHideHandler);
        window.removeEventListener('beforeunload', this._pageHideHandler);
        return this._flushStudySession(false, true);
    }

    /** Internal: commit elapsed study time to server. */
    async _flushStudySession(useBeacon = false, clearSession = false) {
        if (!this._studySessionToken || !this._studySessionStart) return 0;

        const elapsedMs = Date.now() - this._studySessionStart;
        const minutes = Math.floor(elapsedMs / 60000);
        if (minutes < 1) return 0;

        const payload = {
            user_id: this.userId,
            minutes,
            session_token: this._studySessionToken,
            task_id: this._studySessionTaskId,
        };

        if (clearSession) {
            this._studySessionToken = null;
            this._studySessionStart = null;
            this._studySessionTaskId = null;
        } else {
            // Slide start forward so we don't double-count next flush
            this._studySessionStart = Date.now();
        }

        if (useBeacon && navigator.sendBeacon) {
            navigator.sendBeacon(
                `${this.baseUrl}/study-time`,
                new Blob([JSON.stringify(payload)], { type: 'application/json' })
            );
            return minutes * 2;
        }

        try {
            const data = await this._post('/study-time', payload);
            if (data.xp_earned > 0) this._notify(data, 'study_time');
            return data.xp_earned || 0;
        } catch (e) {
            console.warn('[XPClient] study flush failed:', e.message);
            return 0;
        }
    }

    // ── Internals ───────────────────────────────────────────────────────────────

    _apply(data) {
        this._xp = data.xp ?? this._xp;
        this._level = data.level ?? this._level;
    }

    _notify(data, reason) {
        const prev = this._xp;
        this._apply(data);
        const delta = data.xp_earned || (data.xp - prev);
        if (this.onXpChange) {
            this.onXpChange(data.xp, delta, reason, data);
        }
        // Dispatch custom DOM event so any widget can listen
        window.dispatchEvent(new CustomEvent('xp:change', {
            detail: { xp: data.xp, delta, reason, level: data.level, ...data }
        }));
    }

    async _get(path) {
        const r = await fetch(`${this.baseUrl}${path}?user_id=${encodeURIComponent(this.userId)}`);
        if (!r.ok) throw new Error(`XP API ${r.status}`);
        return r.json();
    }

    async _post(path, body) {
        const r = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`XP API ${r.status}`);
        return r.json();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  XPWidget — floating badge that auto-updates
// ─────────────────────────────────────────────────────────────────────────────

export class XPWidget {
    /**
     * @param {XPClient} client
     * @param {object}   [opts]
     * @param {string}   [opts.position]  — 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
     */
    constructor(client, opts = {}) {
        this.client = client;
        this.position = opts.position || 'top-right';
        this._el = null;
        this._animating = false;
    }

    /** Mount the widget into the DOM. */
    mount() {
        this._injectStyles();
        this._el = document.createElement('div');
        this._el.className = `xp-widget xp-widget--${this.position}`;
        this._el.innerHTML = this._template(0, 1, 0, 100, 0);
        document.body.appendChild(this._el);

        // Listen for XP changes
        window.addEventListener('xp:change', (e) => {
            this._update(e.detail);
        });

        // Initial data
        this.client.fetchXp().then(data => {
            if (data) this._update({ ...data, delta: 0 });
        });

        return this;
    }

    _template(xp, level, xpInto, xpForNext, pct) {
        return `
      <div class="xp-widget__inner">
        <div class="xp-widget__top">
          <span class="xp-widget__level">Lv ${level}</span>
          <span class="xp-widget__total">${xp.toLocaleString()} XP</span>
        </div>
        <div class="xp-widget__bar-wrap" title="${xpInto}/${xpForNext} XP to next level">
          <div class="xp-widget__bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="xp-widget__sub">${xpInto} / ${xpForNext} XP</div>
      </div>
      <div class="xp-widget__delta" aria-live="polite"></div>
    `;
    }

    _update(data) {
        if (!this._el) return;
        const { xp = 0, level = 1, xp_into_level = 0, xp_for_next_level = 100, progress_pct = 0, delta = 0 } = data;

        this._el.querySelector('.xp-widget__level').textContent = `Lv ${level}`;
        this._el.querySelector('.xp-widget__total').textContent = `${xp.toLocaleString()} XP`;
        this._el.querySelector('.xp-widget__bar-fill').style.width = `${progress_pct}%`;
        this._el.querySelector('.xp-widget__sub').textContent = `${xp_into_level} / ${xp_for_next_level} XP`;

        if (delta > 0) {
            this._showDelta(delta, data.reason);
        }
    }

    _showDelta(delta, reason) {
        if (this._animating) return;
        this._animating = true;
        const deltaEl = this._el.querySelector('.xp-widget__delta');
        const label = REASON_LABELS[reason] || '';
        deltaEl.textContent = `+${delta} XP ${label}`;
        deltaEl.classList.add('xp-widget__delta--show');
        setTimeout(() => {
            deltaEl.classList.remove('xp-widget__delta--show');
            this._animating = false;
        }, 2200);
    }

    _injectStyles() {
        if (document.getElementById('xp-widget-styles')) return;
        const posMap = {
            'top-right': 'top:80px; right:24px;',
            'top-left': 'top:80px; left:24px;',
            'bottom-right': 'bottom:24px; right:24px;',
            'bottom-left': 'bottom:24px; left:24px;',
        };
        const style = document.createElement('style');
        style.id = 'xp-widget-styles';
        style.textContent = `
      .xp-widget {
        position: fixed;
        ${posMap[this.position] || posMap['top-right']}
        z-index: 9000;
        min-width: 170px;
        background: var(--color-background-primary, #fff);
        border: 1px solid var(--color-border-tertiary, rgba(0,0,0,.08));
        border-radius: 14px;
        padding: 10px 14px 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,.12);
        font-family: 'Inter', system-ui, sans-serif;
        user-select: none;
        backdrop-filter: blur(10px);
        transition: transform .2s ease, box-shadow .2s ease;
      }
      .xp-widget:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0,0,0,.16);
      }
      .xp-widget__inner {}
      .xp-widget__top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .xp-widget__level {
        font-size: 11px;
        font-weight: 700;
        color: var(--color-text-tertiary, #9c9a92);
        text-transform: uppercase;
        letter-spacing: .06em;
      }
      .xp-widget__total {
        font-size: 14px;
        font-weight: 700;
        color: var(--color-text-primary, #1a1a18);
      }
      .xp-widget__bar-wrap {
        height: 5px;
        border-radius: 99px;
        background: var(--color-border-tertiary, rgba(0,0,0,.08));
        overflow: hidden;
        margin-bottom: 4px;
      }
      .xp-widget__bar-fill {
        height: 100%;
        border-radius: 99px;
        background: linear-gradient(90deg, var(--color-text-success, #166534), #4ade80);
        transition: width 1s cubic-bezier(.16,1,.3,1);
      }
      .xp-widget__sub {
        font-size: 10px;
        color: var(--color-text-tertiary, #9c9a92);
        font-weight: 500;
      }
      .xp-widget__delta {
        position: absolute;
        top: -8px;
        right: 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--color-text-success, #166534);
        background: var(--color-background-success, #eaf3de);
        border: 1px solid var(--color-border-success, rgba(22,101,52,.35));
        border-radius: 99px;
        padding: 2px 8px;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity .25s ease, transform .25s ease;
        white-space: nowrap;
      }
      .xp-widget__delta--show {
        opacity: 1;
        transform: translateY(-4px);
        animation: xpDeltaLife 2.2s ease forwards;
      }
      @keyframes xpDeltaLife {
        0%   { opacity: 0; transform: translateY(4px); }
        15%  { opacity: 1; transform: translateY(-6px); }
        75%  { opacity: 1; transform: translateY(-6px); }
        100% { opacity: 0; transform: translateY(-14px); }
      }
    `;
        document.head.appendChild(style);
    }
}

const REASON_LABELS = {
    task_done: '📝 Task done',
    topic_done: '📚 Topic done',
    notes_done: '🗒️ Notes done',
    study_time: '⏱ Study time',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Store integration helper
//  Call `integrateXpWithStore(store, xpClient)` after your store is set up.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the XP client into the existing store so that task completions
 * automatically trigger XP awards.
 *
 * @param {object}   store      — your existing store object
 * @param {XPClient} xpClient
 */
export function integrateXpWithStore(store, xpClient) {
    // Patch toggleTaskStatus
    const _origToggle = store.toggleTaskStatus.bind(store);
    store.toggleTaskStatus = async function (taskId) {
        const task = store.tasks.find(t => String(t.id) === String(taskId));
        const wasDone = task && task.status === 'Done';
        _origToggle(taskId);

        // Re-find after toggle
        const updated = store.tasks.find(t => String(t.id) === String(taskId));
        if (updated && updated.status === 'Done' && !wasDone) {
            try {
                await xpClient.taskDone(taskId);
            } catch (e) {
                console.warn('[XP] taskDone award failed', e);
            }
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Convenience: attach XP to Focus Mode timer
//  Call after timer elements exist in DOM.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {XPClient} xpClient
 * @param {string}   [taskId]  — current focused task id
 */
export function attachXpToTimer(xpClient, getActiveTaskId) {
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resetBtn = document.getElementById('timer-reset-btn');

    if (!startBtn) return;

    startBtn.addEventListener('click', () => {
        const tid = getActiveTaskId ? getActiveTaskId() : null;
        xpClient.startStudySession(tid);
    });

    const stopSession = () => xpClient.stopStudySession();
    if (pauseBtn) pauseBtn.addEventListener('click', stopSession);
    if (resetBtn) resetBtn.addEventListener('click', stopSession);
}
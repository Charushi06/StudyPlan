# Changes — Image Task Extraction + Priority Board

This document summarizes everything added/changed in this branch, for review and for the PR description.

## Summary

Two features, plus two bug fixes found while building them:

1. **Image task extraction** — upload a photo/screenshot (WhatsApp message, LMS page, handwritten note, timetable) and get structured tasks extracted automatically, the same way pasted text already works.
2. **Priority Board** — the top navbar "Tasks" link now opens a dedicated view that groups every task into High / Medium / Low priority columns, each with a consistent color. The calendar's deadline dots now use the same priority colors, and clicking a calendar date offers a way to jump straight to that day's tasks in the board.
3. **Fix:** toast notifications (`Toast.show()` / `Toast.confirm()`) had no CSS anywhere in the project — they rendered as unstyled text at the bottom of the page instead of floating notifications, and never got removed from the DOM after their timeout (no animation existed to trigger the removal listener).
4. **Fix:** the right-hand "Smart Paste" panel had `overflow: hidden` with no scroll — once its content grew taller than the fixed app height, whatever was below the fold (like the "Add to planner" button) became completely unreachable.

---

## 1. Image Task Extraction

**Flow:** `Image upload → Gemini 2.5 Flash (multimodal vision) → structured tasks`, with automatic fallback to **Tesseract.js OCR + the existing heuristic parser** if Gemini fails 5 times in a row or no API key is configured. The fallback reason is always reported back to the UI.

### New files
- `backend/controllers/imageExtract.controller.js` — handles the upload, the 5-retry Gemini vision loop, and the OCR fallback path.
- `backend/routers/imageExtract.router.js` — `POST /api/extract/image`, multer memory-storage upload (PNG/JPEG, 8MB max).
- `backend/utils/nlpTextExtractor.js` — the existing ~200-line regex/heuristic NLP fallback, **moved out of `server.js`** (not rewritten) so both the text route and the new image route can share it without duplicating it.
- `js/utils/imageExtract.js` — client-side upload UI logic (drag/drop, file picker, progress states, OCR-preview panel for fallback mode).

### Files touched
- `server.js` — two additive lines to mount the new router, plus the `nlpTextExtractor.js` extraction described above. No behavior changes (verified byte-identical output before/after the move).
- `index.html` — new "Upload a photo or screenshot" section in the Smart Paste panel, separate from the existing text-paste drop zone (which is untouched).
- `js/app.js` — one import + one init call for the new module.
- `css/index.css` — new styles for the image upload UI, additive only.
- `package.json` / `package-lock.json` — added `multer` and `tesseract.js`.
- `.gitignore` — Tesseract's downloaded OCR language data (`*.traineddata`, `backend/.tesseract-cache/`) is excluded so it doesn't get committed.

### Testing performed
- Verified Gemini vision extraction end-to-end with real images (WhatsApp-style, notice-board style), including hashtag (`#urgent`) preservation.
- Verified the "no API key" fallback path skips straight to OCR.
- Verified the "5 failed attempts" fallback path (simulated with an invalid key) retries exactly 5 times, then falls back to OCR with a clear, human-readable reason.
- Regression-tested the existing text-paste `/api/extract` route — unchanged output before/after the `nlpTextExtractor.js` move.

---

## 2. Priority Board

### New UI
- Clicking **Tasks** in the top navbar (previously duplicated the sidebar's "All Tasks" view) now opens a **Task Priority Board**: three columns (High / Medium / Low), each with a colored header/dot and a running count, cards color-coded to match.
- Sidebar and Smart Paste panel stay visible — only the main calendar area is replaced.
- **Colors are consistent app-wide:** red = high, amber = medium, green = low (reusing the existing `--color-text-danger` / `--color-text-warning` / `--color-text-success` design tokens).

### Calendar integration
- Calendar day dots now reflect task **priority** instead of subject color, so newly extracted/added tasks (from text or image) are automatically highlighted by urgency the moment they're added.
- The calendar legend was updated to match (High/Medium/Low priority instead of the old "Study session"/"Deadline" labels).
- Clicking a calendar date keeps its existing behavior (in-place task list + "mark day complete") **and** adds a new **"View in Task Board →"** button that jumps to the board pre-filtered to that date, with a "Clear filter" option.

### Files touched
- `index.html` — new `#priority-board-section` markup, updated calendar legend.
- `js/app.js` — `showPriorityBoard()` / `hidePriorityBoard()` / `renderPriorityBoard()`, a `PRIORITY_COLORS` helper, the navbar "Tasks" handler rewired to the new view, and `hidePriorityBoard()` calls added to every other view-switch handler so views stay mutually exclusive.
- `css/index.css` — new priority-board styles, additive only.

### Testing performed
- Seeded high/medium/low priority tasks and confirmed calendar dot colors and board columns match.
- Confirmed checking a task complete in the board updates counts live.
- Confirmed date-click → "View in Task Board" → correct date-filtered results → "Clear filter" round-trips correctly.
- Regression-tested Calendar, All Tasks (sidebar), Focus Mode, and Profile views — all correctly hide the board when navigated away from, no console errors.

---

## 3. Bug fix: toast notifications had no CSS

`js/utils/toast.js` (`Toast.show()`, `Toast.confirm()`) existed and was already used throughout the app, but `.toast-container`, `.toast-notification`, `.custom-confirm-backdrop`, and `.custom-confirm-modal` had **zero matching CSS anywhere in `css/index.css`**. Symptoms:
- Toasts rendered as plain unstyled text at the very bottom of the page instead of a floating notification.
- `.toast-hiding` had no animation, so the `animationend` listener that removes a toast from the DOM never fired — toasts leaked and could stack up indefinitely.

Fixed with additive CSS only: fixed-position bottom-right toast container, colored by type, slide-in/out animation, and confirm-dialog backdrop/modal styling (`fadeOut`/`slideUp`/`slideDown` keyframes, which were referenced by `toast.js` but never defined).

## 4. Bug fix: Smart Paste panel had no scroll

`.panel` (the right-hand Smart Paste column) had `overflow: hidden` with a fixed-height parent (`.app { height: 720px }`). Once panel content grew past that height (easy to do now with the new image-upload section), anything below the fold — including the "Add to planner" button — became unreachable with no way to scroll to it. Fixed by changing `.panel` to `overflow-y: auto` (all three duplicate copies of the rule in the file, including the two dark-mode variants) and making `.panel-header` sticky so "Smart Paste" stays visible while scrolling.

---

## New dependencies

- `multer` — multipart file upload handling for `/api/extract/image`.
- `tesseract.js` — OCR fallback when Gemini vision is unavailable.

## Not touched

Everything else — auth, CSV/ICS export, subjects, existing task CRUD, focus mode timer, streaks — is unchanged. The one non-additive touch to pre-existing code is the `nlpTextExtractor.js` extraction from `server.js` (a verified behavior-preserving move, not a rewrite).

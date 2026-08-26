// Pure keyboard-shortcut mapping for StudyPlan.
// No DOM access here so the logic is unit-testable in plain Node.

// Normalize a keyboard event into a canonical shortcut key.
// Examples: "p", "shift+p", "ctrl+enter", "meta+enter", "?", "escape".
export function normalizeKey(e) {
  const key = e.key;
  const mod = e.ctrlKey || e.metaKey;
  const lower = key.length === 1 ? key.toLowerCase() : key.toLowerCase();

  // Single printable char with a modifier (e.g. Ctrl+Enter) -> "ctrl+enter".
  if (mod && key.length === 1 && key !== ' ') {
    return `ctrl+${lower}`;
  }
  if (mod) {
    return `ctrl+${lower}`;
  }
  return lower;
}

// Map a normalized key + current view to a semantic action name.
// `view` is one of: 'calendar' | 'all-tasks' | 'archived' | 'focus' | 'profile' | 'review'.
// Returns null when no action is bound.
export function mapKeyToAction(key, view) {
  // Global navigation shortcuts work in every view.
  switch (key) {
    case 'p': return 'go-calendar';
    case 'c': return 'go-all-tasks';
    case 'f': return 'go-focus';
    case 'n': return 'new-task';
    case '?': return 'toggle-help';
    case 'escape': return 'escape';
    default: break;
  }

  // Task-list actions only make sense in list/board views.
  if (view === 'calendar' || view === 'all-tasks' || view === 'archived') {
    switch (key) {
      case 'arrowdown': return 'focus-next';
      case 'arrowup': return 'focus-prev';
      case 'arrowright': return 'focus-next';
      case 'arrowleft': return 'focus-prev';
      case 'enter': return 'open-task';
      case ' ': return 'open-task';
      case 'ctrl+enter': return 'complete-task';
      case 'delete': return 'delete-task';
      case 'a': return view === 'archived' ? 'restore-task' : 'archive-task';
      default: return null;
    }
  }

  // Focus session shortcuts.
  if (view === 'focus') {
    switch (key) {
      case ' ': return 'toggle-timer';
      case 'arrowdown': return 'focus-next';
      case 'arrowup': return 'focus-prev';
      default: return null;
    }
  }

  return null;
}

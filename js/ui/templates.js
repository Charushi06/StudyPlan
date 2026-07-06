import { escapeHtml, formatDate, getPillClass } from '../utils/dom.js';

const GROUP_TITLE_CLASS = {
  danger: 'tasks-group-header__label--danger',
  muted: 'tasks-group-header__label--muted',
  default: 'tasks-group-header__label',
};

export function groupTitle(text, tone = 'default') {
  const cls = GROUP_TITLE_CLASS[tone] || GROUP_TITLE_CLASS.default;
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

export function boardEditForm(task, subjects) {
  const subjectOptions = subjects
    .map((s) => `<option value="${escapeHtml(s.id)}" ${s.id === task.subject_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
  const localDate = task.due_at ? new Date(task.due_at).toISOString().substring(0, 16) : '';
  const isHigh = task.priority === 'high';

  return `
    <div class="task-item task-item--editing" data-id="${escapeHtml(task.id)}">
      <div class="form-field">
        <label class="form-field__label">Subject</label>
        <select class="board-edit-subject form-field__select">${subjectOptions}</select>
      </div>
      <div class="form-field">
        <label class="form-field__label">Task name</label>
        <input class="board-edit-title form-field__input" type="text" value="${escapeHtml(task.title)}">
      </div>
      <div class="form-field">
        <label class="form-field__label">Deadline</label>
        <input class="board-edit-date form-field__input" type="datetime-local" value="${localDate}">
      </div>
      <div class="form-field">
        <label class="form-field__label">Notes</label>
        <input class="board-edit-notes form-field__input" type="text" value="${escapeHtml(task.notes || '')}" placeholder="Notes…">
      </div>
      <div class="form-field">
        <label class="form-field__label">Priority</label>
        <select class="board-edit-priority form-field__select">
          <option value="medium" ${!isHigh ? 'selected' : ''}>Medium</option>
          <option value="high" ${isHigh ? 'selected' : ''}>High</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--small cancel-board-edit-btn" data-id="${escapeHtml(task.id)}">Cancel</button>
        <button type="button" class="btn btn-primary btn--small save-board-edit-btn" data-id="${escapeHtml(task.id)}">Save</button>
      </div>
    </div>`;
}

export function taskListItem(task, subject, { isUrgent, showArchiveActions }) {
  const isDone = task.status === 'Done';
  const pillClass = getPillClass(subject);
  const actions = showArchiveActions
    ? `<button type="button" class="task-btn edit-task-btn" data-id="${escapeHtml(task.id)}" title="Edit task">Edit</button>
       <button type="button" class="task-btn archive-task-btn" data-id="${escapeHtml(task.id)}" title="Archive task">Archive</button>`
    : `<button type="button" class="task-btn edit-task-btn" data-id="${escapeHtml(task.id)}" title="Edit task">Edit</button>
       <button type="button" class="task-btn task-btn-info restore-task-btn" data-id="${escapeHtml(task.id)}" title="Restore task">Restore</button>
       <button type="button" class="task-btn task-btn-danger delete-task-btn" data-id="${escapeHtml(task.id)}" title="Delete permanently">Delete</button>`;

  return `
    <div class="task-item ${isUrgent ? 'urgent' : ''} ${isDone ? 'done' : ''}" data-id="${escapeHtml(task.id)}">
      <div class="task-check ${isDone ? 'done' : ''}" role="checkbox" aria-checked="${isDone}" tabindex="0" aria-label="Mark ${escapeHtml(task.title)} complete"></div>
      <div class="task-info">
        <div class="task-name">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="task-pill ${isDone ? 'pill-green' : (isUrgent ? 'pill-red' : 'pill-amber')}">${isDone ? 'Done' : 'Due ' + escapeHtml(formatDate(task.due_at))}</span>
          <span class="task-pill ${pillClass}">${escapeHtml(subject?.short_code || '—')}</span>
        </div>
      </div>
      <div class="task-actions">${actions}</div>
    </div>`;
}

export function extractEditCard(item, index, subjects) {
  const subjectOptions = subjects
    .map((s) => `<option value="${escapeHtml(s.id)}" ${s.id === item.subject_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
    .join('');
  const localDate = item.due_at ? new Date(item.due_at).toISOString().substring(0, 16) : '';

  return `
    <div class="extract-card extract-card--editing">
      <div class="form-field">
        <label class="form-field__label">Subject</label>
        <select class="edit-subject-input form-field__select" data-index="${index}">${subjectOptions}</select>
      </div>
      <div class="form-field">
        <label class="form-field__label">Task name</label>
        <input class="edit-title-input form-field__input" type="text" value="${escapeHtml(item.title)}" data-index="${index}">
      </div>
      <div class="form-field">
        <label class="form-field__label">Deadline</label>
        <input class="edit-date-input form-field__input" type="datetime-local" value="${localDate}" data-index="${index}">
      </div>
      <div class="form-field">
        <label class="form-field__label">Notes</label>
        <input class="edit-notes-input form-field__input" type="text" value="${escapeHtml(item.notes || '')}" data-index="${index}" placeholder="Notes…">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn--small save-edit-btn" data-index="${index}">Save changes</button>
      </div>
    </div>`;
}

export function extractPreviewCard(item, index, subject) {
  const confClass = item.confidence_score > 75 ? 'conf-fill--high' : 'conf-fill--medium';
  return `
    <div class="extract-card" style="animation-delay: ${index * 0.1}s">
      <div class="extract-subject" style="color:${subject.color}">${escapeHtml(subject.name)}</div>
      <div class="extract-task-name">${escapeHtml(item.title)}</div>
      <div class="extract-row"><span class="extract-icon" aria-hidden="true">${item.icon || '📅'}</span> ${escapeHtml(formatDate(item.due_at))}</div>
      <div class="extract-row"><span class="extract-icon" aria-hidden="true">📎</span> ${escapeHtml(item.notes || 'No notes attached')}</div>
      <div class="conf-bar"><div class="conf-fill ${confClass}" style="width:0%" data-width="${item.confidence_score}"></div></div>
      <div class="conf-label">${item.confidence_score}% confidence <span class="conf-edit" data-index="${index}" tabindex="0" role="button">Edit</span></div>
    </div>`;
}

export function activeFocusTaskPanel(task, subject) {
  return `
    <div class="task-info task-info--focus">
      <div class="task-name task-name--focus">${escapeHtml(task.title)}</div>
      <div class="task-meta">
        <span class="task-pill pill-amber">Due ${escapeHtml(formatDate(task.due_at))}</span>
        <span class="task-pill">${escapeHtml(subject?.name || 'General')}</span>
      </div>
      <div class="focus-task-actions">
        <button type="button" class="btn btn-primary complete-focus-task-btn" data-id="${escapeHtml(task.id)}">Mark done</button>
        <button type="button" class="btn clear-focus-task-btn">Clear</button>
      </div>
    </div>`;
}

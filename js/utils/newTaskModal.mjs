export function buildDefaultNewTaskDateValue(selectedDate) {
  if (!selectedDate) return '';

  const deadline = new Date(selectedDate);
  deadline.setHours(18, 0, 0, 0);

  const year = deadline.getFullYear();
  const month = String(deadline.getMonth() + 1).padStart(2, '0');
  const day = String(deadline.getDate()).padStart(2, '0');
  const hours = String(deadline.getHours()).padStart(2, '0');
  const minutes = String(deadline.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function captureNewTaskFormState({ subjectId = '', title = '', notes = '', dueAt = '' } = {}) {
  return {
    subjectId: String(subjectId),
    title: String(title).trim(),
    notes: String(notes).trim(),
    dueAt: String(dueAt),
  };
}

export function isNewTaskFormDirty(initialState, currentState) {
  if (!initialState) return false;

  return (
    initialState.subjectId !== currentState.subjectId ||
    initialState.title !== currentState.title ||
    initialState.notes !== currentState.notes ||
    initialState.dueAt !== currentState.dueAt
  );
}

export function buildPostSaveCalendarState(currentView, dueAt) {
  if (currentView !== 'calendar' || !dueAt) {
    return null;
  }

  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  return {
    selectedDate: new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()),
    currentMonthDate: new Date(dueDate.getFullYear(), dueDate.getMonth(), 1),
  };
}

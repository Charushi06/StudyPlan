export async function extractTasksFromText(text) {
  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!res.ok) {
      console.error('Extraction failed', await res.text());
      return [];
    }
    
    return normalizeExtractedTasks(await res.json());
  } catch (e) {
    console.error('Error hitting extract endpoint', e);
    return [];
  }
}

function normalizeExtractedTasks(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.tasks)
      ? data.tasks
      : Array.isArray(data?.items)
        ? data.items
        : data && typeof data === 'object'
          ? [data]
          : [];

  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      ...item,
      title: String(item.title || '').trim(),
      subject_name: String(item.subject_name || item.subject || 'General').trim(),
      notes: String(item.notes || '').trim(),
      confidence_score: Number(item.confidence_score ?? item.confidence ?? 60),
      priority: item.priority || 'medium'
    }))
    .filter(item => item.title && item.due_at);
}

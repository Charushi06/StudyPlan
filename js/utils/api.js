import { Toast } from './toast.js';

export async function extractTasksFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    Toast.show('Please paste some text to extract tasks from', 'warning');
    return [];
  }
  if (trimmed.length < 5) {
    Toast.show('Pasted text is too short to extract tasks from', 'warning');
    return [];
  }

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('Extraction failed', errText);
      Toast.show('Failed to extract tasks. Server error.', 'error');
      return [];
    }
    
    return await res.json();
  } catch (e) {
    console.error('Error hitting extract endpoint', e);
    Toast.show('Network error. Failed to reach server.', 'error');
    return [];
  }
}

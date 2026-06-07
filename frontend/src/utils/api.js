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
    
    return await res.json();
  } catch (e) {
    console.error('Error hitting extract endpoint', e);
    return [];
  }
}

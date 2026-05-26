export async function extractTasksFromText(text) {
  try {
    const user = JSON.parse(localStorage.getItem('studyplan_user') || '{}');
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': user.token ? `Bearer ${user.token}` : ''
      },
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

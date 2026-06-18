const { GoogleGenAI } = require('@google/genai');
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

async function getMoodSuggestion(req, res) {
  const { mood, room_id } = req.body || {};
  if (!mood) return res.status(400).json({ message: 'Mood required' });

  const normalized = String(mood).toLowerCase();
  const fallback = {
    tired: { study_duration_minutes: 15, break_duration_minutes: 5, task_difficulty: 'easy', message: 'Take it slow: focus on small, achievable tasks.' },
    energetic: { study_duration_minutes: 35, break_duration_minutes: 5, task_difficulty: 'hard', message: 'Ride the energy: tackle the most important task now!' },
    stressed: { study_duration_minutes: 20, break_duration_minutes: 10, task_difficulty: 'easy', message: 'Breathe. Try a short, focused session and a calm break.' },
  };

  if (!ai) {
    return res.json(fallback[normalized] || fallback.tired);
  }

  // Ask Gemini to return a JSON object with the suggested fields
  const prompt = `You are a study coach. Given the mood '${normalized}', suggest a study plan as a JSON object with keys: study_duration_minutes (int), break_duration_minutes (int), task_difficulty (easy|medium|hard), message (short encouraging tip). Keep values reasonable for the mood.`;

  try {
    const response = await ai.generate({
      model: 'models/text-bison-001',
      prompt,
      temperature: 0.3,
      maxOutputTokens: 300,
    });

    // Try to extract JSON from the response text
    const txt = response?.candidates?.[0]?.content || response?.output?.[0]?.content || '';
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.json(parsed);
    }
    return res.json(fallback[normalized] || fallback.tired);
  } catch (err) {
    console.error('Gemini mood suggestion failed:', err);
    return res.json(fallback[normalized] || fallback.tired);
  }
}

module.exports = { getMoodSuggestion };

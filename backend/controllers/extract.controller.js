const { GoogleGenAI } = require('@google/genai');
const { nlpExtractTasksFromText } = require('../utils/nlp.js');

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const extractTasks = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  if (ai) {
    try {
      const prompt = `
You are an AI study planner assistant. Extract ALL tasks and deadlines from the text below.
Return ONLY a raw JSON array (no markdown, no backticks, no explanation).
Each object must have: title (string), subject_name (string), due_at (ISO 8601 datetime), notes (string), confidence_score (number 0-100), priority ("low"|"medium"|"high"), icon (emoji).

Text: "${text}"
`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let rawText = (typeof response.text === 'function' ? response.text() : response.text).trim();
      if (rawText.startsWith('```')) rawText = rawText.replace(/```json|```/g, '').trim();

      const data = JSON.parse(rawText);
      return res.json(data);

    } catch (e) {
      console.error('Gemini failed, falling back to NLP heuristic:', e.message);
    }
  }

  // NLP heuristic fallback (no API key, or Gemini failed)
  const tasks = nlpExtractTasksFromText(text);
  return res.json(tasks);
};

module.exports = {
  extractTasks
};
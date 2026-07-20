const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const Tesseract = require('tesseract.js');
const { nlpExtractTasksFromText } = require('../utils/nlpTextExtractor.js');

// Keeps Tesseract's downloaded language data (~5MB) out of the project
// root; it's cached here after the first OCR run instead of re-downloading
// per request.
const TESSERACT_CACHE_PATH = path.join(__dirname, '..', '.tesseract-cache');

// Own Gemini client instance — reads the same process.env populated by
// dotenv at server startup. Kept separate from server.js's own `ai`
// instance so this controller has no import-time dependency on server.js
// (avoids any risk of circular requires touching the existing routes).
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const MAX_VISION_ATTEMPTS = 5;

function buildVisionPrompt() {
  return `
You are an AI study planner assistant. The attached image is a photo or screenshot a student took of an assignment notice — this could be a WhatsApp/LMS screenshot, a printed notice board photo, a handwritten note, or a timetable. The layout may be messy, rotated, or informal.

Read the image and extract ALL tasks and deadlines you can find.
Return ONLY a raw JSON array (no markdown, no backticks, no explanation).
Each object must have: title (string), subject_name (string), due_at (ISO 8601 datetime), notes (string), confidence_score (number 0-100), priority ("low"|"medium"|"high"), icon (emoji).
If a date is ambiguous or missing, make a reasonable guess and lower the confidence_score accordingly.
IMPORTANT: Do not strip hashtags from the task description! If the image contains hashtag labels (e.g. #urgent, #Group), include them at the end of the 'title' field.
Ignore chat UI chrome such as timestamps, read receipts, sender names, and profile pictures — focus only on assignment/deadline content.
If the image contains no discernible tasks, return an empty JSON array [].
`;
}

function parseModelJson(rawText) {
  let text = (typeof rawText === 'function' ? rawText() : rawText || '').trim();
  if (text.startsWith('```')) text = text.replace(/```json|```/g, '').trim();
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Model response was not a JSON array');
  return data;
}

async function tryGeminiVisionExtraction(buffer, mimeType) {
  const prompt = buildVisionPrompt();
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_VISION_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: prompt },
          { inlineData: { mimeType, data: buffer.toString('base64') } },
        ],
      });

      const tasks = parseModelJson(response.text);
      return { tasks, attempts: attempt, error: null };
    } catch (e) {
      lastError = e;
      console.error(`Image extraction attempt ${attempt}/${MAX_VISION_ATTEMPTS} failed:`, e.message);
    }
  }

  return { tasks: null, attempts: MAX_VISION_ATTEMPTS, error: lastError };
}

function friendlyErrorMessage(error) {
  const raw = error?.message || 'unknown error';
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || raw;
  } catch {
    return raw;
  }
}

function cleanOcrText(rawText) {
  return String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function runOcrFallback(buffer) {
  const { data } = await Tesseract.recognize(buffer, 'eng', { cachePath: TESSERACT_CACHE_PATH });
  return cleanOcrText(data.text);
}

async function extractFromImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const { buffer, mimetype } = req.file;

  try {
    if (ai) {
      const { tasks, attempts, error } = await tryGeminiVisionExtraction(buffer, mimetype);

      if (tasks) {
        return res.json({
          success: true,
          method: 'gemini-vision',
          attempts,
          fallbackUsed: false,
          tasks,
        });
      }

      // 5 attempts exhausted — fall back to OCR, and report why.
      return await respondWithOcrFallback(res, buffer, {
        attempts,
        reason: `Gemini vision extraction failed after ${attempts} attempt(s). Last error: ${friendlyErrorMessage(error)}`,
      });
    }

    // No Gemini key configured at all — go straight to OCR fallback.
    return await respondWithOcrFallback(res, buffer, {
      attempts: 0,
      reason: 'GEMINI_API_KEY is not configured, so image extraction cannot use Gemini vision. Falling back to local OCR + heuristic parsing.',
    });
  } catch (e) {
    console.error('Unexpected error in image extraction:', e);
    return res.status(500).json({ error: 'Unexpected server error during image extraction' });
  }
}

async function respondWithOcrFallback(res, buffer, { attempts, reason }) {
  try {
    const ocrText = await runOcrFallback(buffer);

    const tasks = ocrText.length > 5
      ? nlpExtractTasksFromText(ocrText)
      : [{
          title: 'Could not read any text from this image',
          subject_name: 'General',
          due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'OCR found little to no readable text — please try a clearer photo or enter this task manually.',
          icon: '❓',
          confidence_score: 10,
          priority: 'medium',
        }];

    return res.json({
      success: true,
      method: 'ocr-fallback',
      attempts,
      fallbackUsed: true,
      fallbackReason: reason,
      ocrText,
      tasks,
    });
  } catch (ocrError) {
    console.error('OCR fallback failed:', ocrError);
    return res.status(500).json({
      success: false,
      fallbackUsed: true,
      fallbackReason: `${reason} OCR fallback also failed: ${ocrError.message}`,
      error: 'Image extraction failed on both Gemini vision and the OCR fallback.',
    });
  }
}

module.exports = { extractFromImage };

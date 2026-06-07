
// Heuristic NLP fallback — used client-side when Gemini API is unavailable.

import { extractDate } from './nlpDateExtractor.js';
import { detectSubject } from './nlpSubjectExtractor.js';

const TASK_VERBS = [
  'submit', 'finish', 'complete', 'hand in', 'turn in', 'upload',
  'send', 'write', 'prepare', 'present', 'review', 'read', 'study',
  'practice', 'do', 'work on', 'draft', 'revise', 'email',
];

const ICONS = {
  'Computer Science': '💻',
  'Mathematics': '📐',
  'English Lit': '📖',
  'Physics': '⚗️',
  default: '📚',
};

function splitIntoSegments(text) {
  return text
    .split(/[\n\r]+|(?<=\.)\s+(?=[A-Z])|(?:\d+[.)]\s*)/)
    .map(s => s.trim())
    .filter(s => s.length > 8);
}

function taskLikelihood(segment) {
  const lower = segment.toLowerCase();
  let score = 0;

  for (const verb of TASK_VERBS) {
    if (lower.includes(verb)) { score += 30; break; }
  }

  const dateSignals = [
    'due', 'deadline', 'by', 'before', 'submit', 'tomorrow', 'next',
    'today', 'week', 'month', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday', 'sunday',
    /\d+\/\d+/, /\d{1,2}(st|nd|rd|th)/,
  ];
  for (const sig of dateSignals) {
    if (sig instanceof RegExp ? sig.test(lower) : lower.includes(sig)) {
      score += 25; break;
    }
  }

  if (segment.length > 15 && segment.length < 300) score += 15;
  if (detectSubject(segment)) score += 20;

  const fillers = ['hi ', 'hello', 'hey ', 'dear ', 'regards', 'thanks', 'sincerely'];
  for (const f of fillers) {
    if (lower.startsWith(f)) { score -= 40; break; }
  }

  return Math.max(0, Math.min(100, score));
}

function extractTitle(segment) {
  let title = segment
    .replace(/^(please|kindly|remember to|don't forget to|make sure to)\s+/i, '')
    .replace(/\s+(by|before|due|on|at)\s+.*/i, '')
    .trim();

  if (title.length > 80) title = title.substring(0, 77) + '...';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function getFallbackDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

function buildNotes(segment, due_at) {
  if (!due_at) return 'No deadline found — please set manually.';
  const quoted = segment.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  const afterColon = segment.match(/:\s*(.{10,60})/);
  if (afterColon) return afterColon[1].trim();
  return 'Extracted by heuristic NLP parser.';
}

export function extractTasksFromText(text) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const now = new Date();
      const segments = splitIntoSegments(text);
      const results = [];
      const seen = new Set();

      for (const segment of segments) {
        if (taskLikelihood(segment) < 30) continue;

        const due_at = extractDate(segment, now) || getFallbackDate();
        const subjectName = detectSubject(segment);
        const title = extractTitle(segment);

        if (!title || title.length < 4) continue;

        const key = title.toLowerCase().substring(0, 20);
        if (seen.has(key)) continue;
        seen.add(key);

        const confidence = Math.min(
          95,
          taskLikelihood(segment) + (extractDate(segment, now) ? 10 : 0) + (subjectName ? 10 : 0)
        );

        results.push({
          subject_name: subjectName || 'General',
          title,
          due_at,
          notes: buildNotes(segment, extractDate(segment, now)),
          icon: ICONS[subjectName] || ICONS.default,
          confidence_score: confidence,
          priority: confidence > 70 ? 'high' : 'medium',
        });
      }

      // Fallback if nothing detected
      if (results.length === 0 && text.trim().length > 5) {
        results.push({
          subject_name: 'General',
          title: text.trim().substring(0, 60),
          due_at: getFallbackDate(),
          notes: 'Could not parse details — please edit manually.',
          icon: '❓',
          confidence_score: 30,
          priority: 'medium',
        });
      }

      resolve(results.slice(0, 10));
    }, 800);
  });
}
// Mapping the raw text to a subject name using keyword heuristics.
const SUBJECT_KEYWORDS = {
  'Computer Science': [
    'comp sci','computer science','cs', 'programming',
    'coding', 'program', 'code', 'algorithm',
    'data structure', 'software', 'python', 'java', 'javascript', 'html',
    'css', 'database', 'sql', 'network', 'operating system', 'os', 'web',
    'cybersecurity', 'machine learning', 'ai', 'artificial intelligence',
    'project', 'repo', 'github', 'assignment', 'lab report'
  ],
  'Mathematics': [
    'maths', 'math', 'mathematics', 'calculus', 'calc', 'algebra', 'algebr', 'geometry',
    'statistics', 'probability', 'theorem', 'proof', 'equation', 'eqn',
    'integral', 'derivative', 'matrix', 'vector', 'vec', 'trigonometry', 'trigo',
    'problem set', 'probm set', 'pset', 'worksheet'
  ],
  'English Lit': [
    'english', 'eng', 'literature', 'essay', 'lit', 'novel', 'poem', 'poetry',
    'shakespeare', 'writing', 'prose', 'narrative', 'analysis', 'literary',
    'book report', 'reading', 'chapter', 'author', 'character', 'plot',
    'thesis', 'draft', 'revision', 'bibliography'
  ],
  'Physics': [
    'physics', 'mechanics', 'thermodynamics', 'optics', 'electromagnetism',
    'quantum', 'relativity', 'velocity', 'acceleration', 'force', 'energy',
    'momentum', 'lab', 'experiment', 'wave', 'particle', 'newton',
    'circuit', 'resistance', 'voltage', 'current'
  ],
};

/**
 * @param {string} text
 * @returns {string|null}
 */
export function detectSubject(text) {
  const lower = text.toLowerCase();
  const scores = {};

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    scores[subject] = 0;
    for (const kw of keywords) {

      // Word-boundary match scores higher for short keywords
      const re = kw.includes(' ') ? new RegExp(escapeRegex(kw), 'gi') : new RegExp(`\\b${escapeRegex(kw)}\\b`, 'gi');
      const matches = lower.match(re);
      if (matches) {
        // Longer keywords = stronger signal
        scores[subject] += matches.length* (kw.length > 5 ? 2 : 1);;
      }
    }
  }

  const sortedSubjects = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const best = sortedSubjects[0];

  if (!best || best[1] <= 0) {
  return null;
}
  return best[0];
  
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
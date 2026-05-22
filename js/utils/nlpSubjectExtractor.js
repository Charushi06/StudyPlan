// Mapping the raw text to a subject name using keyword heuristics.
const SUBJECT_KEYWORDS = {
  'Computer Science': [
    'cs', 'comp sci', 'computer science', 'programming', 'program',
    'code', 'coding', 'algorithm', 'data structure', 'software',
    'python', 'java', 'javascript', 'html', 'css', 'database',
    'sql', 'network', 'operating system', 'os', 'web',
    'cybersecurity', 'machine learning', 'ai',
    'artificial intelligence', 'project', 'repo',
    'github', 'assignment', 'lab report'
  ],

  'Mathematics': [
    'maths', 'math', 'calc', 'mathematics', 'calculus',
    'algebra', 'algeb', 'geometry', 'statistics',
    'probability', 'theorem', 'proof', 'equation',
    'integral', 'derivative', 'matrix', 'vector',
    'trigonometry', 'problem set', 'pset', 'worksheet'
  ],

  'English Lit': [
    'english', 'eng', 'lit', 'literature', 'essay',
    'summary', 'novel', 'poem', 'poetry', 'shakespeare',
    'writing', 'prose', 'narrative', 'analysis',
    'literary', 'book report', 'reading', 'chapter',
    'author', 'character', 'plot', 'thesis',
    'draft', 'revision', 'bibliography'
  ],

  'Physics': [
    'physics', 'phy', 'phys', 'mechanics',
    'thermodynamics', 'optics', 'electromagnetism',
    'quantum', 'relativity', 'velocity',
    'acceleration', 'force', 'energy', 'momentum',
    'lab', 'experiment', 'wave', 'particle',
    'newton', 'circuit', 'resistance',
    'voltage', 'current'
  ],
};

/**
 * Compare typo similarity between words
 */
function isSimilar(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();

  // Ignore very different lengths
  if (Math.abs(a.length - b.length) > 2) {
    return false;
  }

  let differences = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      differences++;
    }
  }

  differences += Math.abs(a.length - b.length);

  return differences <= 2;
}

/**
 * Detect subject from raw text
 * @param {string} text
 * @returns {string|null}
 */
export function detectSubject(text) {
  const lower = text.toLowerCase();
  const scores = {};

  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    scores[subject] = 0;

    for (const kw of keywords) {

      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'gi');
      const matches = lower.match(re);

      // Exact keyword matches
      if (matches) {
        scores[subject] += matches.length * (kw.length > 5 ? 2 : 1);
      }

      // Typo tolerant matching for single-word keywords
      else if (!kw.includes(' ')) {

        const words = lower.split(/\s+/);

        for (const word of words) {

          if (isSimilar(word, kw)) {
            scores[subject] += 1;
          }

        }
      }
    }
  }

  const best = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  return best && best[1] > 0 ? best[0] : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
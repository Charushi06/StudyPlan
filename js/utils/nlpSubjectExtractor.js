// Mapping the raw text to a subject name using keyword heuristics.
const SUBJECT_KEYWORDS = {
  'Computer Science': [
    'cs', 'computer science', 'programming', 'code', 'coding', 'algorithm',
    'data structure', 'software', 'python', 'java', 'javascript', 'html',
    'css', 'database', 'sql', 'network', 'operating system', 'os', 'web',
    'cybersecurity', 'machine learning', 'ai', 'artificial intelligence',
    'project', 'repo', 'github', 'assignment', 'lab report', 'typescript',
    'react', 'node', 'api', 'backend', 'frontend', 'deployment', 'debug'
  ],
  'Mathematics': [
    'maths', 'math', 'mathematics', 'calculus', 'algebra', 'geometry',
    'statistics', 'probability', 'theorem', 'proof', 'equation',
    'integral', 'derivative', 'matrix', 'vector', 'trigonometry',
    'problem set', 'pset', 'worksheet', 'formula', 'linear algebra',
    'number theory', 'discrete math'
  ],
  'English Lit': [
    'english', 'literature', 'essay', 'novel', 'poem', 'poetry',
    'shakespeare', 'writing', 'prose', 'narrative', 'analysis', 'literary',
    'book report', 'reading', 'chapter', 'author', 'character', 'plot',
    'thesis', 'draft', 'revision', 'bibliography', 'composition',
    'rhetoric', 'grammar', 'vocabulary'
  ],
  'Physics': [
    'physics', 'mechanics', 'thermodynamics', 'optics', 'electromagnetism',
    'quantum', 'relativity', 'velocity', 'acceleration', 'force', 'energy',
    'momentum', 'lab', 'experiment', 'wave', 'particle', 'newton',
    'circuit', 'resistance', 'voltage', 'current', 'photon', 'collision'
  ],
  'Chemistry': [
    'chemistry', 'chem', 'chemical', 'molecule', 'atom', 'compound',
    'reaction', 'organic', 'inorganic', 'acid', 'base', 'pH', 'equilibrium',
    'stoichiometry', 'periodic table', 'valence', 'oxidation', 'lab report'
  ],
  'Biology': [
    'biology', 'cell', 'organism', 'evolution', 'genetics', 'gene',
    'dna', 'protein', 'ecosystem', 'photosynthesis', 'respiration',
    'anatomy', 'physiology', 'microbiology', 'lab', 'specimen'
  ],
  'History': [
    'history', 'historical', 'world war', 'revolution', 'ancient',
    'medieval', 'renaissance', 'era', 'period', 'civilization', 'empire',
    'primary source', 'secondary source', 'timeline', 'research paper'
  ],
  'Economics': [
    'economics', 'econ', 'business', 'finance', 'market', 'supply',
    'demand', 'inflation', 'gdp', 'trade', 'investment', 'accounting'
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
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'gi');
      const matches = lower.match(re);
      if (matches) {
        // Longer keywords = stronger signal
        scores[subject] += matches.length * (kw.length > 5 ? 2 : 1);
      }
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
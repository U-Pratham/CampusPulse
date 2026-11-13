/**
 * CampusPulse - Duplicate Detection Engine
 * 
 * Detects potentially redundant tickets based on:
 * 1. Location proximity (MUST be in the same building and compatible room/area)
 * 2. Textual similarity (Token overlap, Jaccard index, shared technical keywords)
 * 3. Unresolved status filter (Ignores tickets already closed/resolved)
 * 
 * NOTE: Issues in different buildings are NEVER considered duplicates.
 */

const DuplicateDetector = (() => {
  const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
    'by', 'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
    'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
    'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just',
    'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
    'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
    'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself'
  ]);

  /**
   * Tokenize text removing punctuation and stopwords
   */
  function cleanTokens(text) {
    if (!text) return new Set();
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
    return new Set(words);
  }

  /**
   * Calculate Jaccard similarity between two token sets
   */
  function jaccardSimilarity(setA, setB) {
    if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0;
    let intersectionCount = 0;
    for (const item of setA) {
      if (setB.has(item)) {
        intersectionCount++;
      }
    }
    const unionCount = setA.size + setB.size - intersectionCount;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
  }

  /**
   * Normalize room / area strings (e.g. "Room 204", "Lab-204", "204" -> "204")
   */
  function normalizeLocationString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/^(room|hall|lab|block|floor|fl|rm)[\s\-_.]*/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Check if a new complaint matches any existing unresolved complaint
   * @param {Object} newComplaint - { building, room, title, description, category }
   * @param {Array} existingComplaints - list of all stored complaints
   * @returns {Object} result with isDuplicate flag, matched ticket, and match details
   */
  function checkDuplicate(newComplaint, existingComplaints = []) {
    if (!newComplaint || !newComplaint.building || !newComplaint.title) {
      return { isDuplicate: false, candidates: [] };
    }

    const newBuilding = (newComplaint.building || '').trim().toLowerCase();
    const newRoomNorm = normalizeLocationString(newComplaint.room || '');
    const newTokens = cleanTokens(`${newComplaint.title} ${newComplaint.description || ''}`);

    const candidates = [];

    // Filter to unresolved active complaints
    const activeComplaints = existingComplaints.filter(c => {
      const s = (c.status || '').toLowerCase();
      return s !== 'resolved' && s !== 'rejected' && c.id !== newComplaint.id;
    });

    for (const existing of activeComplaints) {
      const existBuilding = (existing.building || '').trim().toLowerCase();
      
      // RULE 1: Different buildings are NEVER duplicates!
      if (newBuilding !== existBuilding) {
        continue;
      }

      const existRoomNorm = normalizeLocationString(existing.room || '');
      const existTokens = cleanTokens(`${existing.title} ${existing.description || ''}`);

      // Check Room match within the same building
      let roomMatchScore = 0;
      let isCommonArea = false;

      const combinedRooms = `${newComplaint.room} ${existing.room}`.toLowerCase();
      if (combinedRooms.includes('corridor') || combinedRooms.includes('hallway') || 
          combinedRooms.includes('washroom') || combinedRooms.includes('lobby') || 
          combinedRooms.includes('staircase')) {
        isCommonArea = true;
      }

      if (newRoomNorm && existRoomNorm) {
        if (newRoomNorm === existRoomNorm) {
          roomMatchScore = 1.0;
        } else if (newRoomNorm.includes(existRoomNorm) || existRoomNorm.includes(newRoomNorm)) {
          roomMatchScore = 0.8;
        } else if (isCommonArea) {
          // If in the same building's common area
          roomMatchScore = 0.5;
        } else {
          // Explicitly different rooms (e.g. 101 vs 405) in the same building
          roomMatchScore = 0.0;
        }
      } else {
        // If room is unspecified, give partial location score only if common area
        roomMatchScore = isCommonArea ? 0.4 : 0.2;
      }

      // If rooms are explicitly different specific rooms in the same building, DO NOT mark as duplicate
      if (newRoomNorm && existRoomNorm && roomMatchScore === 0.0) {
        continue;
      }

      // Check text similarity
      const textSimilarity = jaccardSimilarity(newTokens, existTokens);

      // Shared important tokens
      const sharedWords = [];
      for (const w of newTokens) {
        if (existTokens.has(w)) sharedWords.push(w);
      }

      // Must have at least 1 shared significant keyword
      if (sharedWords.length === 0 && textSimilarity < 0.2) {
        continue;
      }

      const sameCategory = newComplaint.category && existing.category && 
                           newComplaint.category === existing.category;

      // Composite calculation (Requires same location + description overlap)
      let compositeScore = 0.35 * (roomMatchScore >= 0.8 ? 1.0 : roomMatchScore);
      compositeScore += textSimilarity * 0.45;
      if (sameCategory) compositeScore += 0.1;
      if (sharedWords.length >= 2) compositeScore += 0.1;

      // Duplicate threshold requires strong match:
      // Either exact room match + shared keywords, or composite score >= 0.50
      const isCandidate = (roomMatchScore >= 0.8 && sharedWords.length >= 1) || compositeScore >= 0.50;

      if (isCandidate) {
        const reasons = [];
        if (roomMatchScore >= 0.8) {
          reasons.push(`Same location: ${existing.building} (${existing.room})`);
        } else {
          reasons.push(`Same building common area: ${existing.building}`);
        }

        if (sharedWords.length > 0) {
          reasons.push(`Shared keywords: ${sharedWords.slice(0, 4).join(', ')}`);
        }

        candidates.push({
          existingTicket: existing,
          matchScore: Math.min(Math.round(compositeScore * 100), 99),
          sharedWords,
          reasons
        });
      }
    }

    candidates.sort((a, b) => b.matchScore - a.matchScore);

    const isDuplicate = candidates.length > 0;
    const topMatch = isDuplicate ? candidates[0] : null;

    return {
      isDuplicate,
      confidence: topMatch ? topMatch.matchScore : 0,
      matchedComplaint: topMatch ? topMatch.existingTicket : null,
      reasons: topMatch ? topMatch.reasons : [],
      candidates
    };
  }

  return {
    checkDuplicate,
    cleanTokens,
    jaccardSimilarity,
    normalizeLocationString
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DuplicateDetector;
} else {
  window.DuplicateDetector = DuplicateDetector;
}

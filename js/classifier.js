/**
 * CampusPulse - Rule-Based Keyword Classification Engine
 * 
 * NOTE: This is a deterministic, rule-based keyword classification system
 * designed for zero-latency, transparent, explainable categorization and priority assignment.
 * It is NOT a machine learning or black-box model.
 */

const IssueClassifier = (() => {
  // Keyword dictionaries for Category detection
  const CATEGORY_RULES = {
    Safety: [
      'fire', 'smoke', 'spark', 'sparks', 'hazard', 'hazardous', 'shock', 'electric shock',
      'exposed wire', 'exposed wires', 'exposed electrical wires', 'exposed cables',
      'bare wire', 'live wire', 'live wires', 'burning', 'gas leak', 'chemical', 'chemical spill',
      'flame', 'flames', 'fire hazard', 'fire hazards', 'structural collapse', 'broken glass',
      'danger', 'dangerous', 'injury', 'panic', 'fire extinguisher', 'emergency'
    ],
    Electrical: [
      'wire', 'wires', 'switch', 'switchboard', 'light', 'lights', 'tube light', 'bulb',
      'fan', 'ceiling fan', 'socket', 'plug', 'power', 'blackout', 'short circuit',
      'breaker', 'mcb', 'cable', 'cables', 'outlet', 'lamp', 'generator', 'inverter',
      'voltage', 'flickering', 'no power', 'tripped', 'ac not working', 'air conditioner',
      'projector power'
    ],
    Plumbing: [
      'leak', 'leaking', 'leakage', 'pipe', 'pipes', 'tap', 'faucet', 'flush', 'drain',
      'drainage', 'water', 'sink', 'basin', 'toilet', 'urinal', 'overflow', 'overflowing',
      'blockage', 'blocked', 'sewage', 'dripping', 'clogged', 'puddle', 'no water',
      'water pressure', 'pipeline', 'tank'
    ],
    Cleanliness: [
      'dirty', 'dirt', 'dust', 'dusty', 'trash', 'garbage', 'smell', 'odor', 'stink',
      'stinking', 'waste', 'litter', 'stain', 'stains', 'sweep', 'sweeping', 'mop',
      'unhygienic', 'bin', 'dustbin', 'pest', 'cockroach', 'rat', 'rodent', 'spider web',
      'washroom dirty', 'bad smell', 'muddy', 'unclean', 'restroom', 'washroom', 'clean', 'cleaning',
      'overflowing bin', 'overflowing dustbin'
    ],
    Infrastructure: [
      'door', 'doors', 'window', 'windows', 'desk', 'desks', 'bench', 'chair', 'chairs',
      'furniture', 'wall', 'walls', 'ceiling', 'crack', 'cracks', 'tile', 'tiles',
      'plaster', 'lock', 'handle', 'hinge', 'board', 'blackboard', 'whiteboard',
      'podium', 'projector screen', 'stair', 'stairs', 'railing', 'elevator', 'lift',
      'roof', 'floor', 'curtain', 'paint'
    ]
  };

  // Severity indicator keywords for Priority assignment
  const PRIORITY_RULES = {
    High: [
      'spark', 'sparks', 'exposed wire', 'exposed wires', 'exposed electrical wires',
      'live wire', 'bare wire', 'exposed cables', 'fire', 'fire hazard', 'fire hazards',
      'flame', 'flames', 'smoke', 'burning', 'shock', 'electric shock', 'hazard',
      'severe leak', 'flooding', 'gushing water', 'structural crack', 'falling ceiling',
      'broken glass', 'chemical spill', 'gas smell', 'gas leak', 'emergency', 'critical',
      'dangerous', 'danger', 'immediate', 'risk of fire'
    ],
    Medium: [
      'broken fan', 'fan not working', 'damaged chair', 'broken desk', 'broken chair',
      'damaged furniture', 'projector', 'air conditioner', 'ac', 'door lock',
      'window broken', 'light not working', 'flickering light', 'water blockage',
      'faucet broken', 'dripping tap', 'slow drain', 'lift not working', 'elevator',
      'no water', 'water overflow', 'tank overflow', 'toilet overflow'
    ],
    Low: [
      'minor', 'cosmetic', 'dust', 'dusty', 'unclean washroom', 'trash can full',
      'dustbin full', 'overflowing bin', 'overflowing dustbin', 'smell', 'odor',
      'paint peeling', 'stain', 'loose notice', 'spider web', 'squeaky door',
      'dirty board', 'minor leak', 'routine', 'dirty', 'trash', 'garbage', 'restroom',
      'needs cleaning'
    ]
  };

  /**
   * Tokenize and normalize input text
   */
  function tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /**
   * Classify category and priority based on text input (title + description)
   * @param {string} title
   * @param {string} description
   * @returns {Object} classification result
   */
  function classify(title = '', description = '') {
    const fullText = `${title} ${description}`.toLowerCase();
    const tokens = tokenize(fullText);

    // 1. Determine Category
    const categoryScores = {
      Safety: 0,
      Electrical: 0,
      Plumbing: 0,
      Cleanliness: 0,
      Infrastructure: 0
    };

    const matchedCategoryKeywords = {
      Safety: [],
      Electrical: [],
      Plumbing: [],
      Cleanliness: [],
      Infrastructure: []
    };

    // Check multi-word phrases and tokens
    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
      for (const kw of keywords) {
        if (kw.includes(' ')) {
          if (fullText.includes(kw)) {
            // High priority weight for multi-word safety and technical phrases
            categoryScores[category] += category === 'Safety' ? 6 : 4;
            matchedCategoryKeywords[category].push(kw);
          }
        } else {
          const count = tokens.filter(t => t === kw).length;
          if (count > 0) {
            categoryScores[category] += count;
            matchedCategoryKeywords[category].push(kw);
          }
        }
      }
    }

    // Safety regex boost: exposed wires and fire hazards always boost Safety
    if (/\b(exposed|bare|loose|dangling|live)\s+(\w+\s+)?(wires?|cables?)\b/i.test(fullText) ||
        /\bfire(\s+hazards?)?\b/i.test(fullText)) {
      categoryScores.Safety += 8;
      matchedCategoryKeywords.Safety.push('hazard pattern detected');
    }

    let detectedCategory = 'Other';
    let maxCategoryScore = 0;

    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > maxCategoryScore) {
        maxCategoryScore = score;
        detectedCategory = category;
      }
    }

    // 2. Determine Priority
    let detectedPriority = 'Medium';
    let priorityRationale = 'Standard maintenance issue requiring standard operational schedule.';
    const matchedPriorityKeywords = [];

    // Check High priority first (Safety hazards, immediate dangers)
    let hasHighTrigger = false;
    for (const kw of PRIORITY_RULES.High) {
      if (fullText.includes(kw)) {
        hasHighTrigger = true;
        matchedPriorityKeywords.push(kw);
      }
    }

    if (/\b(exposed|bare|live)\s+(\w+\s+)?wires?\b/i.test(fullText) || /\bfire\b/i.test(fullText)) {
      hasHighTrigger = true;
    }

    if (hasHighTrigger || detectedCategory === 'Safety') {
      detectedPriority = 'High';
      const triggers = matchedPriorityKeywords.slice(0, 3).join(', ');
      priorityRationale = triggers 
        ? `High Priority: Identified critical hazard keywords (${triggers}). Requires immediate containment.`
        : 'High Priority: Categorized under Safety hazard. Requires urgent response.';
    } else {
      // Check Low priority triggers
      let hasLowTrigger = false;
      for (const kw of PRIORITY_RULES.Low) {
        if (fullText.includes(kw)) {
          hasLowTrigger = true;
          matchedPriorityKeywords.push(kw);
        }
      }

      // Check Medium triggers
      let hasMedTrigger = false;
      for (const kw of PRIORITY_RULES.Medium) {
        if (fullText.includes(kw)) {
          hasMedTrigger = true;
          matchedPriorityKeywords.push(kw);
        }
      }

      if (detectedCategory === 'Cleanliness' || (hasLowTrigger && !hasMedTrigger)) {
        detectedPriority = 'Low';
        const triggers = matchedPriorityKeywords.slice(0, 3).join(', ');
        priorityRationale = `Low Priority: Minor routine or cosmetic issue (${triggers || 'non-hazardous cleanliness'}).`;
      } else {
        detectedPriority = 'Medium';
        priorityRationale = 'Medium Priority: Operational disruption impacting classroom or facility usability.';
      }
    }

    return {
      category: detectedCategory,
      categoryScore: maxCategoryScore,
      priority: detectedPriority,
      matchedKeywords: matchedCategoryKeywords[detectedCategory] || [],
      priorityTriggers: matchedPriorityKeywords,
      rationale: priorityRationale,
      isRuleBased: true,
      engineNote: 'Rule-based dictionary classification (Deterministic keyword match)'
    };
  }

  return {
    classify,
    CATEGORY_RULES,
    PRIORITY_RULES
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IssueClassifier;
} else {
  window.IssueClassifier = IssueClassifier;
}

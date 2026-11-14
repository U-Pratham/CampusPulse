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
      'danger', 'dangerous', 'injury', 'panic', 'fire extinguisher', 'emergency',
      // Dangerous overhead fixture & falling fan conditions
      'verge of falling', 'about to fall', 'at risk of falling', 'ready to fall',
      'detached ceiling fan', 'detached fan', 'fan detached', 'detached fixture',
      'hanging from its mount', 'hanging from mount', 'hanging from ceiling',
      'hanging by wire', 'hanging by wires', 'hanging by cable', 'dangling from ceiling', 'dangling from mount',
      'falling electrical fixture', 'falling ceiling fixture', 'falling fixture', 'falling fan', 'fan falling',
      'loose ceiling fan', 'loose ceiling fixture', 'unstable ceiling fan', 'unstable fan mount',
      'fan wobbling violently', 'wobbling violently', 'violently wobbling', 'shaking violently', 'wobbling severely'
    ],
    Electrical: [
      'wire', 'wires', 'switch', 'switchboard', 'light', 'lights', 'tube light', 'bulb',
      'fan', 'ceiling fan', 'socket', 'plug', 'power', 'blackout', 'short circuit',
      'breaker', 'mcb', 'cable', 'cables', 'outlet', 'lamp', 'generator', 'inverter',
      'voltage', 'flickering', 'no power', 'tripped', 'ac not working', 'air conditioner',
      'projector power', 'fan noise', 'fan humming', 'fan slow', 'speed regulator', 'capacitor'
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
      'overflowing bin', 'overflowing dustbin', 'dirty fan', 'dusty fan', 'unclean fan', 'cobweb', 'cobwebs'
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
      'dangerous', 'danger', 'immediate', 'risk of fire',
      // Dangerous overhead fixture & falling fan conditions
      'verge of falling', 'about to fall', 'at risk of falling', 'ready to fall',
      'detached ceiling fan', 'detached fan', 'fan detached', 'detached fixture',
      'fan hanging from its mount', 'hanging from mount', 'hanging by wire', 'hanging by wires',
      'falling electrical fixture', 'falling ceiling fixture', 'falling fixture', 'falling fan',
      'loose ceiling fan', 'loose ceiling fixture', 'unstable ceiling fan',
      'fan wobbling violently', 'wobbling violently', 'violently wobbling', 'shakes violently'
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
      'needs cleaning', 'fan noise', 'fan making noise', 'noisy fan', 'squeaking fan',
      'fan hum', 'fan humming', 'fan slow', 'fan speed', 'slow fan'
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

    // Safety regex boost: exposed wires, fire hazards, and dangerous falling overhead fixtures
    if (/\b(exposed|bare|loose|dangling|live)\s+(\w+\s+)?(wires?|cables?)\b/i.test(fullText) ||
        /\bfire(\s+hazards?)?\b/i.test(fullText) ||
        /\b(fan|fixture|light)\s+(on\s+the\s+verge\s+of\s+falling|about\s+to\s+fall|ready\s+to\s+fall|falling|detached|loose|unstable)\b/i.test(fullText) ||
        /\b(verge\s+of\s+falling|about\s+to\s+fall|hanging\s+from\s+(its\s+)?mount|detached\s+(ceiling\s+)?fan|falling\s+(electrical\s+|ceiling\s+)?fixture|loose\s+ceiling\s+(fan|fixture)|(fan\s+)?wobbl(ing|e)\s+violently|violently\s+wobbl(ing|e))\b/i.test(fullText)) {
      categoryScores.Safety += 12;
      matchedCategoryKeywords.Safety.push('falling hazard / dangerous overhead fixture detected');
    }

    // Cleanliness boost: dirty/dusty fans and fixtures
    if (/\b(dirty|dusty|cleaning|unclean|cobwebs?)\b/i.test(fullText) && /\bfan\b/i.test(fullText) && !/\b(spark|wire|burn|fall|drop|loose|wobbl)\b/i.test(fullText)) {
      categoryScores.Cleanliness += 8;
      matchedCategoryKeywords.Cleanliness.push('fan housekeeping');
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

    // Check High priority first (Safety hazards, immediate dangers, falling fixtures)
    let hasHighTrigger = false;
    for (const kw of PRIORITY_RULES.High) {
      if (fullText.includes(kw)) {
        hasHighTrigger = true;
        matchedPriorityKeywords.push(kw);
      }
    }

    if (/\b(exposed|bare|live)\s+(\w+\s+)?wires?\b/i.test(fullText) || 
        /\bfire\b/i.test(fullText) ||
        /\b(verge\s+of\s+falling|about\s+to\s+fall|hanging\s+from\s+(its\s+)?mount|detached\s+(ceiling\s+)?fan|falling\s+(electrical\s+|ceiling\s+)?fixture|loose\s+ceiling\s+(fan|fixture)|(fan\s+)?wobbl(ing|e)\s+violently|violently\s+wobbl(ing|e))\b/i.test(fullText)) {
      hasHighTrigger = true;
      matchedPriorityKeywords.push('dangerous overhead fixture condition');
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
    classifyComplaint: classify,
    CATEGORY_RULES,
    PRIORITY_RULES
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IssueClassifier;
} else {
  window.IssueClassifier = IssueClassifier;
}

/**
 * CampusPulse - Impact-Based Complaint Prioritization Engine
 * 
 * CORE INNOVATION:
 * Instead of simple FIFO (First-In, First-Out) or subjective user-chosen priority,
 * CampusPulse evaluates every issue using an explainable, deterministic mathematical model:
 * 
 * Impact Score (0 - 100) = Severity (Max 40) + Location Criticality (Max 30) + Affected Population (Max 30)
 * 
 * EMERGENCY OVERRIDE:
 * Safety-critical hazards (exposed electrical wires, fire hazards, sparks, structural failure)
 * bypass normal queuing and automatically lock to maximum score: 100 (P0 - EMERGENCY).
 * 
 * NOTE: Fully deterministic and explainable. No black-box machine learning.
 */

const ImpactEngine = (() => {
  // Emergency trigger string keywords
  const EMERGENCY_TRIGGERS = [
    'exposed wire', 'exposed wires', 'live wire', 'live wires', 'bare wire', 'bare wires',
    'exposed electrical wires', 'exposed electrical wire', 'sparks', 'sparking', 'spark',
    'electric shock', 'shock hazard', 'fire', 'fire hazard', 'fire hazards', 'flame', 'flames',
    'smoke', 'burning smell', 'gas leak', 'structural collapse', 'ceiling falling',
    'chemical spill', 'explosion hazard'
  ];

  // Emergency regex patterns for robust phrase variations
  const EMERGENCY_PATTERNS = [
    /\b(exposed|bare|loose|dangling|live)\s+(\w+\s+)?(wires?|cables?)\b/i,
    /\b(electric(al)?\s+)?(sparks?|sparking)\b/i,
    /\belectric(al)?\s+shock\b/i,
    /\bfire(\s+hazards?|\s+alarm)?\b/i,
    /\bflames?\b/i,
    /\bsmoke\b/i,
    /\bburning(\s+smell)?\b/i,
    /\bgas\s+leak\b/i,
    /\bstructural\s+(collapse|crack|failure)\b/i,
    /\b(falling|collapsed)\s+ceiling(?!\s+fan)\b/i,
    /\bchemical\s+spill\b/i,
    /\bexplosion(\s+hazard)?\b/i
  ];

  // Location Importance / Criticality Tiers (Max 30 points)
  const LOCATION_WEIGHTS = {
    // Tier 1: High-Risk / Specialized Infrastructure (30 pts)
    'Engineering Workshop': { weight: 30, tier: 'Tier 1 (High Hazard / Workshop)', reason: 'High voltage machinery, mechanical hazard risk' },
    'Science Complex': { weight: 26, tier: 'Tier 1 (Laboratory & Research)', reason: 'Chemical, specimen & high-density research labs' },

    // Tier 2: High-Density Assembly & Academic Cores (22-25 pts)
    'CS & IT Block': { weight: 24, tier: 'Tier 2 (High-Density Academic)', reason: 'Intensive computer labs & accredited seminar halls' },
    'Central Library': { weight: 22, tier: 'Tier 2 (High-Traffic Study Facility)', reason: 'Concentrated student population & silent study space' },
    'Student Center & Mess': { weight: 25, tier: 'Tier 2 (Dining & Public Assembly)', reason: 'Mass student dining, hygiene & food safety hotspot' },

    // Tier 3: Standard Academic (16-18 pts)
    'Academic Block A': { weight: 18, tier: 'Tier 3 (Core Lecture Classrooms)', reason: 'Primary scheduled undergraduate lectures' },
    'Academic Block B': { weight: 18, tier: 'Tier 3 (Core Lecture Classrooms)', reason: 'Scheduled departmental lectures and tutorials' },
    'Admin Tower': { weight: 16, tier: 'Tier 3 (Administrative Operations)', reason: 'Campus staff, examinations, and registrar offices' },

    // Tier 4: Sports & Auxiliary (12 pts)
    'Sports Complex': { weight: 12, tier: 'Tier 4 (Auxiliary / Recreational)', reason: 'Recreational grounds and physical training spaces' }
  };

  // Specific room keywords modifier (adds to location criticality up to max 30)
  const ROOM_MODIFIERS = [
    { pattern: /(lab|workshop|server|substation|panel)/i, bonus: 4, reason: 'Technical laboratory / electrical distribution point' },
    { pattern: /(auditorium|hall|seminar|mess|canteen|lh[\s-]?\d+|lt[\s-]?\d+|lecture\s*(hall|theatre|room))/i, bonus: 4, reason: 'Large capacity lecture hall / assembly hall' },
    { pattern: /(washroom|restroom|toilet)/i, bonus: 2, reason: 'Essential daily hygiene facility' },
    { pattern: /(corridor|hallway|staircase|stair|exit|gate)/i, bonus: 3, reason: 'Primary evacuation & transit route' }
  ];

  /**
   * 1. Calculate Severity Dimension (Strictly between 0 and 40 points)
   */
  function calculateSeverity(category, text) {
    const lower = (text || '').toLowerCase();
    let score = 15; // baseline
    let rationale = 'Routine operational wear and tear.';

    const emergency = checkEmergencyOverride(text, '', category);

    // 1. Immediate Safety Emergency (40 pts)
    if (emergency.isEmergency) {
      score = 40;
      rationale = 'Critical Safety Hazard: Immediate emergency danger of physical harm, electric shock, fire, or structural collapse.';
    }
    // 2. Critical Overhead Falling / Detachment Hazard (38 pts)
    else if (/\b(on\s+the\s+verge\s+of\s+falling|about\s+to\s+fall|ready\s+to\s+fall|at\s+risk\s+of\s+falling|detached\s+(ceiling\s+)?fan|fan\s+detached|hanging\s+from\s+(its\s+)?mount|falling\s+(electrical\s+|ceiling\s+)?fixture|falling\s+fan|fan\s+falling)\b/i.test(lower)) {
      score = 38;
      rationale = 'Critical Safety Concern: Overhead ceiling fan or fixture at immediate risk of falling, posing severe blunt-force head trauma hazard.';
    }
    // 3. Major utility disruption causing shutdown or flooding (35 pts)
    else if (lower.includes('severe leak') || lower.includes('flooding') || lower.includes('short circuit') || lower.includes('blackout')) {
      score = 35;
      rationale = 'High Severity: Major utility disruption causing facility shutdown or structural damage.';
    }
    // 4. High Severity Overhead Instability / Violent Wobble / Loose Mounting (30 pts)
    else if (/\b(wobbl(ing|e)\s+violently|violently\s+wobbl(ing|e)|wobbl(ing|e)\s+severely|severe\s+wobble|violent\s+wobble|shakes?\s+violently|violently\s+shaking|loose\s+ceiling\s+(fan|fixture)|loose\s+fan|unstable\s+(ceiling\s+)?fan|fan\s+blade\s+loose|loose\s+bracket)\b/i.test(lower)) {
      score = 30;
      rationale = 'High Severity: Ceiling fan mounting instability or violent wobbling posing active structural detachment risk.';
    }
    // 5. Active Plumbing water hazard (30 pts)
    else if (category === 'Plumbing' && (lower.includes('overflow') || lower.includes('clogged') || lower.includes('gushing'))) {
      score = 30;
      rationale = 'High-Medium Severity: Active water hazard requiring prompt isolation.';
    }
    // 6. Other General Safety Issues (32 pts)
    else if (category === 'Safety') {
      score = 32;
      rationale = 'Safety Hazard: Physical risk requiring expedited inspection and containment.';
    }
    // 7. Structural / furniture damage (22 pts)
    else if (category === 'Infrastructure' && (lower.includes('broken') || lower.includes('sharp') || lower.includes('crack'))) {
      score = 22;
      rationale = 'Medium Severity: Structural or furniture damage causing student inconvenience or injury risk.';
    }
    // 8. Minor fan noise / humming / slow speed (Low severity: 10 pts)
    else if (lower.includes('fan') && (lower.includes('noise') || lower.includes('squeak') || lower.includes('hum') || lower.includes('slow') || lower.includes('regulator') || lower.includes('capacitor'))) {
      score = 10;
      rationale = 'Low Severity: Minor acoustic annoyance or routine fan maintenance without mechanical detachment hazard.';
    }
    // 9. Standard non-hazardous electrical failure (20 pts)
    else if (category === 'Electrical' && (lower.includes('fan') || lower.includes('ac') || lower.includes('light'))) {
      score = 20;
      rationale = 'Medium Severity: Non-hazardous electrical appliance failure causing thermal/comfort disruption.';
    }
    // 10. Cleanliness issues (8-15 pts)
    else if (category === 'Cleanliness' || (lower.includes('fan') && (lower.includes('cobweb') || lower.includes('dust') || lower.includes('dirty')))) {
      if (lower.includes('overflowing') || lower.includes('odor') || lower.includes('stink')) {
        score = 15;
        rationale = 'Moderate Sanitation Issue: Unhygienic public condition requiring janitorial dispatch.';
      } else {
        score = 8;
        rationale = 'Low Severity: Minor cosmetic or routine housekeeping requirement.';
      }
    } else {
      score = 15;
      rationale = 'Standard maintenance issue with moderate disruption.';
    }

    // Strict boundary enforcement: 0 to 40
    const clampedScore = Math.max(0, Math.min(score, 40));

    return {
      score: clampedScore,
      max: 40,
      rationale
    };
  }

  /**
   * 2. Calculate Location Criticality (Strictly between 0 and 30 points)
   */
  function calculateLocationWeight(building, room = '') {
    const bldgData = LOCATION_WEIGHTS[building] || { weight: 15, tier: 'Standard Area', reason: 'General campus location' };
    let score = bldgData.weight;
    let rationale = `${bldgData.tier}: ${bldgData.reason}`;

    // Apply room modifiers
    for (const mod of ROOM_MODIFIERS) {
      if (mod.pattern.test(room)) {
        score += mod.bonus;
        rationale += ` + ${mod.reason}`;
        break;
      }
    }

    // Strict boundary enforcement: 0 to 30
    const clampedScore = Math.max(0, Math.min(score, 30));

    return {
      score: clampedScore,
      max: 30,
      tier: bldgData.tier,
      rationale
    };
  }

  /**
   * 3. Calculate Affected Population (Strictly between 0 and 30 points)
   */
  function calculatePopulationImpact(room = '', building = '', duplicateCount = 0) {
    const text = `${building} ${room}`.toLowerCase();
    let score = 14;
    let estimatedHeadcount = '20–50 students';
    let rationale = 'Standard cohort classroom or localized department space.';

    if (text.includes('mess') || text.includes('canteen') || text.includes('auditorium') || 
        text.includes('corridor') || text.includes('hallway') || text.includes('library')) {
      score = 26;
      estimatedHeadcount = '150–500+ students';
      rationale = 'High-traffic common thoroughfare / primary public facility.';
    } else if (text.includes('lecture hall') || text.includes('lecture theatre') || text.includes('seminar') || text.includes('lab') || /\b(lh|lt)[\s-]?\d+/i.test(text)) {
      score = 20;
      estimatedHeadcount = '60–120 students';
      rationale = 'Large multi-batch academic lecture space.';
    } else if (text.includes('office') || text.includes('cabin') || text.includes('study room')) {
      score = 8;
      estimatedHeadcount = '1–5 staff/students';
      rationale = 'Low density personal or administrative enclosure.';
    }

    // Duplicate complaint escalation boost: each duplicate complaint adds +4 to population score
    if (duplicateCount > 0) {
      const boost = Math.min(duplicateCount * 4, 12);
      score += boost;
      rationale += ` (Escalated by ${duplicateCount} duplicate student reports / endorsements)`;
    }

    // Strict boundary enforcement: 0 to 30
    const clampedScore = Math.max(0, Math.min(score, 30));

    return {
      score: clampedScore,
      max: 30,
      estimatedHeadcount,
      rationale
    };
  }

  /**
   * 4. Check Emergency Override
   * Detects safety-critical hazards including exposed wires and fire hazards.
   */
  function checkEmergencyOverride(title = '', description = '', category = '') {
    const text = `${title}. ${description}`.toLowerCase();
    const matchedTriggers = [];

    // Exact keyword checks
    for (const kw of EMERGENCY_TRIGGERS) {
      if (text.includes(kw)) {
        matchedTriggers.push(kw);
      }
    }

    // Regex pattern checks (handles words in-between like "exposed electrical wires")
    for (const pat of EMERGENCY_PATTERNS) {
      const match = text.match(pat);
      if (match && !matchedTriggers.includes(match[0].toLowerCase())) {
        matchedTriggers.push(match[0].toLowerCase());
      }
    }

    const isEmergency = matchedTriggers.length > 0 || 
      (category === 'Safety' && (
        /\b(exposed|bare|live)\s+(\w+\s+)?wires?\b/i.test(text) || 
        /\b(sparks?|sparking)\b/i.test(text) || 
        /\b(fire|flames?|gas\s+leak|chemical\s+spill|explosion)\b/i.test(text) ||
        /\bstructural\s+collapse\b/i.test(text) ||
        /\b(ceiling\s+fell|fan\s+fell|hanging\s+by\s+(wires?|cables?))\b/i.test(text)
      ));

    return {
      isEmergency,
      triggers: matchedTriggers,
      reason: isEmergency 
        ? `SAFETY EMERGENCY OVERRIDE TRIGGERED: Identified critical hazard (${matchedTriggers.slice(0, 3).join(', ') || 'acute safety risk'}). Automated safety bypass activated.`
        : null
    };
  }

  /**
   * 5. Compute Full Multi-Factor Impact Score
   * @param {Object} complaint - { title, description, category, building, room, duplicateCount }
   * @returns {Object} Complete impact score evaluation
   */
  function evaluateImpact(complaint) {
    const title = complaint.title || '';
    const description = complaint.description || '';
    const fullText = `${title}. ${description}`;
    const category = complaint.category || 'Other';
    const building = complaint.building || 'Academic Block A';
    const room = complaint.room || '';
    const duplicateCount = complaint.duplicateCount || (complaint.duplicateReports ? complaint.duplicateReports.length : 0);

    // Dimension evaluations (each strictly clamped to its max)
    const severity = calculateSeverity(category, fullText);
    const location = calculateLocationWeight(building, room);
    const population = calculatePopulationImpact(room, building, duplicateCount);
    const emergency = checkEmergencyOverride(title, description, category);

    // Raw calculated score (severity + location + population)
    const rawScore = severity.score + location.score + population.score;

    let finalScore = rawScore;
    let priorityTier = 'Medium Impact';
    let priorityCode = 'P2';

    if (emergency.isEmergency) {
      finalScore = 100;
      priorityTier = 'CRITICAL EMERGENCY (P0)';
      priorityCode = 'P0';
    } else if (rawScore >= 80 || (severity.score >= 35 && rawScore >= 65)) {
      priorityTier = 'HIGH IMPACT (P1)';
      priorityCode = 'P1';
    } else if (rawScore >= 50) {
      priorityTier = 'MEDIUM IMPACT (P2)';
      priorityCode = 'P2';
    } else {
      priorityTier = 'LOW IMPACT (P3)';
      priorityCode = 'P3';
    }

    // Strict boundary enforcement: Total score NEVER exceeds 100
    const clampedFinalScore = Math.min(Math.max(finalScore, 5), 100);

    return {
      finalScore: clampedFinalScore,
      rawScore: Math.min(rawScore, 100),
      isEmergency: emergency.isEmergency,
      emergencyReason: emergency.reason,
      priorityTier,
      priorityCode,
      breakdown: {
        severity: {
          weight: severity.score,
          max: severity.max,
          percentage: Math.round((severity.score / severity.max) * 100),
          rationale: severity.rationale
        },
        location: {
          weight: location.score,
          max: location.max,
          percentage: Math.round((location.score / location.max) * 100),
          tier: location.tier,
          rationale: location.rationale
        },
        population: {
          weight: population.score,
          max: population.max,
          percentage: Math.round((population.score / population.max) * 100),
          headcount: population.estimatedHeadcount,
          rationale: population.rationale
        }
      },
      formulaSummary: emergency.isEmergency 
        ? 'Override: Safety Hazard Trigger -> Max 100 pts (P0 Emergency)'
        : `Score = Severity (${severity.score}/40) + Location (${location.score}/30) + Population (${population.score}/30) = ${clampedFinalScore}/100`
    };
  }

  return {
    evaluateImpact,
    calculateSeverity,
    calculateLocationWeight,
    calculatePopulationImpact,
    checkEmergencyOverride,
    LOCATION_WEIGHTS,
    EMERGENCY_TRIGGERS,
    EMERGENCY_PATTERNS
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImpactEngine;
} else {
  window.ImpactEngine = ImpactEngine;
}

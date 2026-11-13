/**
 * CampusPulse - LocalStorage Store & State Management
 * 
 * Powered by the Impact-Based Prioritization Engine:
 * - Computes multi-factor impact score (0-100)
 * - Assigns ranking based on actual campus disruption
 * - Anti-inflation duplicate endorsement with population capping
 * - Infrastructure Heatmap & Recurring issue pattern detection
 * - Real SLA response tracking & Overdue complaint analysis
 * - Accurate resolution time statistics based on stored timestamps
 */

const Store = (() => {
  const _ImpactEngine = typeof ImpactEngine !== 'undefined' 
    ? ImpactEngine 
    : (typeof window !== 'undefined' && window.ImpactEngine 
      ? window.ImpactEngine 
      : (typeof require !== 'undefined' ? require('./impactEngine.js') : null));

  const STORAGE_KEY = 'campuspulse_complaints_v3';
  const STAFF_STORAGE_KEY = 'campuspulse_staff_v3';

  // Available buildings on campus
  const BUILDINGS = [
    'Academic Block A',
    'Academic Block B',
    'CS & IT Block',
    'Science Complex',
    'Engineering Workshop',
    'Central Library',
    'Student Center & Mess',
    'Sports Complex',
    'Admin Tower'
  ];

  // SLA Response Thresholds in Hours by Priority Tier
  const SLA_THRESHOLDS = {
    P0: 2,   // Emergency: 2 hours
    P1: 24,  // High Impact: 24 hours
    P2: 48,  // Medium Impact: 48 hours
    P3: 72   // Low Impact: 72 hours
  };

  // Campus Maintenance Staff Directory
  const DEFAULT_STAFF = [
    { id: 'STF-01', name: 'Rajesh Kumar', department: 'Electrical', role: 'Senior Electrician', activeTasks: 1 },
    { id: 'STF-02', name: 'Suresh Murthy', department: 'Plumbing', role: 'Plumbing Lead', activeTasks: 1 },
    { id: 'STF-03', name: 'Anita Desai', department: 'Infrastructure', role: 'Facilities Supervisor', activeTasks: 0 },
    { id: 'STF-04', name: 'Sunita Rawat', department: 'Cleanliness', role: 'Sanitation Lead', activeTasks: 0 },
    { id: 'STF-05', name: 'Vikram Singh', department: 'Safety', role: 'Campus Safety Officer', activeTasks: 1 }
  ];

  // Inline SVG generator for reliable offline visuals
  function createSampleSvg(iconType, bgGradient, titleText) {
    let iconSvg = '';
    if (iconType === 'fan') {
      iconSvg = `<circle cx="100" cy="100" r="16" fill="#f8fafc"/>
        <path d="M100 84 C100 40 130 30 145 45 C155 55 140 85 100 84 Z" fill="#cbd5e1" opacity="0.9"/>
        <path d="M116 100 C160 100 170 130 155 145 C145 155 115 140 116 100 Z" fill="#cbd5e1" opacity="0.9"/>
        <path d="M100 116 C100 160 70 170 55 155 C45 145 60 115 100 116 Z" fill="#cbd5e1" opacity="0.9"/>
        <path d="M84 100 C40 100 30 70 45 55 C55 45 85 60 84 100 Z" fill="#cbd5e1" opacity="0.9"/>
        <line x1="100" y1="100" x2="150" y2="150" stroke="#ef4444" stroke-width="4" stroke-dasharray="4"/>`;
    } else if (iconType === 'water') {
      iconSvg = `<path d="M100 40 C100 40 60 95 60 125 A40 40 0 0 0 140 125 C140 95 100 40 100 40 Z" fill="#38bdf8"/>
        <ellipse cx="90" cy="115" rx="10" ry="18" fill="#bae6fd" opacity="0.7"/>
        <path d="M40 70 L90 70 L90 85 L40 85 Z" fill="#64748b"/>
        <line x1="75" y1="85" x2="75" y2="160" stroke="#0284c7" stroke-width="5" stroke-linecap="round"/>`;
    } else if (iconType === 'furniture') {
      iconSvg = `<rect x="50" y="80" width="100" height="15" rx="4" fill="#d97706"/>
        <rect x="55" y="95" width="10" height="55" fill="#78350f"/>
        <rect x="135" y="95" width="10" height="55" fill="#78350f"/>
        <line x1="90" y1="80" x2="110" y2="95" stroke="#ef4444" stroke-width="4"/>
        <circle cx="105" cy="85" r="4" fill="#ef4444"/>`;
    } else if (iconType === 'spark') {
      iconSvg = `<rect x="60" y="55" width="80" height="90" rx="8" fill="#334155" stroke="#94a3b8" stroke-width="3"/>
        <circle cx="85" cy="90" r="8" fill="#1e293b"/>
        <circle cx="115" cy="90" r="8" fill="#1e293b"/>
        <path d="M115 90 L145 60 L130 95 L160 85 L125 130" stroke="#eab308" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <polygon points="120,50 125,65 140,65 128,75 132,90 120,80 108,90 112,75 100,65 115,65" fill="#f59e0b"/>`;
    } else if (iconType === 'clean') {
      iconSvg = `<rect x="65" y="80" width="70" height="75" rx="6" fill="#64748b"/>
        <rect x="55" y="70" width="90" height="12" rx="3" fill="#475569"/>
        <line x1="100" y1="50" x2="100" y2="70" stroke="#94a3b8" stroke-width="4"/>
        <path d="M75 100 Q100 115 125 100" stroke="#f1f5f9" stroke-width="3" fill="none"/>
        <circle cx="85" cy="120" r="5" fill="#cbd5e1"/>
        <circle cx="115" cy="125" r="4" fill="#cbd5e1"/>`;
    } else {
      iconSvg = `<circle cx="100" cy="100" r="45" fill="#6366f1"/>
        <text x="100" y="112" font-size="32" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">!</text>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <linearGradient id="bg_${iconType}" x1="0%" y1="0%" x2="100%" y2="100%">
          ${bgGradient}
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="12" fill="url(#bg_${iconType})"/>
      ${iconSvg}
      <text x="100" y="185" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#f8fafc" text-anchor="middle" letter-spacing="0.5">${titleText}</text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // Realistic sample seed data evaluated through the Impact Engine
  function getSampleSeedData() {
    const now = Date.now();
    const HOUR = 3600 * 1000;

    const rawSeeds = [
      {
        id: 'CP-101',
        title: 'Exposed live wires and sparks from wall switchboard',
        description: 'The main switchboard near the CNC station in Machine Lab 2 has loose dangling wires and emits visible sparks when high-load equipment turns on. Serious safety hazard for students.',
        building: 'Engineering Workshop',
        room: 'Machine Lab 2 (Ground Floor)',
        category: 'Safety',
        priority: 'High',
        status: 'In Progress',
        submittedBy: 'Pooja Hegde (EE-2024)',
        userEmail: 'pooja.h@campus.edu',
        createdAt: new Date(now - 3.5 * HOUR).toISOString(), // > 2h SLA threshold -> Overdue Emergency!
        updatedAt: new Date(now - 1 * HOUR).toISOString(),
        assignedTo: 'Vikram Singh (Campus Safety Officer)',
        assignedStaffId: 'STF-05',
        imageUrl: createSampleSvg('spark', '<stop offset="0%" stop-color="#7f1d1d"/><stop offset="100%" stop-color="#991b1b"/>', 'LIVE SPARKS DETECTED'),
        imageFileName: 'workshop_sparks.jpg',
        duplicateCount: 1,
        duplicateReports: ['Aarav K.'],
        endorsedBy: ['Aarav K.'],
        resolutionNotes: 'Emergency breaker tripped. Safety perimeter cordoned off. Electrician team on-site replacing damaged conduit.',
        timeline: [
          { status: 'Pending', note: 'Emergency Override Triggered: High-voltage sparks detected in Workshop Lab. Pinned to Max Score (100).', timestamp: new Date(now - 3.5 * HOUR).toISOString() },
          { status: 'In Progress', note: 'Assigned to Vikram Singh. Lab power isolated for containment.', timestamp: new Date(now - 1 * HOUR).toISOString() }
        ]
      },
      {
        id: 'CP-102',
        title: 'Severe water leakage from overhead pipe flooding corridor',
        description: 'Ceiling plumbing joint has ruptured outside the 1st-floor washroom. Continuous stream of water pooling in the main corridor, creating slipping risk for students entering classrooms.',
        building: 'Academic Block A',
        room: '1st Floor Washroom Hallway',
        category: 'Plumbing',
        priority: 'High',
        status: 'In Progress',
        submittedBy: 'Meera Patel (EC-2025)',
        userEmail: 'meera.p@campus.edu',
        createdAt: new Date(now - 5 * HOUR).toISOString(),
        updatedAt: new Date(now - 3 * HOUR).toISOString(),
        assignedTo: 'Suresh Murthy (Plumbing Lead)',
        assignedStaffId: 'STF-02',
        imageUrl: createSampleSvg('water', '<stop offset="0%" stop-color="#0c4a6e"/><stop offset="100%" stop-color="#0369a1"/>', 'PIPE LEAKAGE HALLWAY'),
        imageFileName: 'corridor_flood.jpg',
        duplicateCount: 2,
        duplicateReports: ['Karan S.', 'Rhea T.'],
        endorsedBy: ['Karan S.', 'Rhea T.'],
        resolutionNotes: 'Main riser valve closed temporarily. Replacement PVC union joint and sealant being fitted.',
        timeline: [
          { status: 'Pending', note: 'Ticket submitted with photo proof. Evaluated Impact Score: 87/100 (High-traffic hallway flooding).', timestamp: new Date(now - 5 * HOUR).toISOString() },
          { status: 'In Progress', note: 'Dispatched Suresh Murthy. Water shutoff valve engaged.', timestamp: new Date(now - 3 * HOUR).toISOString() }
        ]
      },
      {
        id: 'CP-103',
        title: 'Broken ceiling fan wobbling severely and grinding',
        description: 'The center ceiling fan above row 3 makes an unbearable screeching grinding sound and shakes violently at speed 3 or higher. Disables lecture audio and poses falling hazard.',
        building: 'CS & IT Block',
        room: 'Room 204 (2nd Floor)',
        category: 'Electrical',
        priority: 'Medium',
        status: 'In Progress',
        submittedBy: 'Aarav Sharma (CS-2024)',
        userEmail: 'aarav.s@campus.edu',
        createdAt: new Date(now - 18 * HOUR).toISOString(),
        updatedAt: new Date(now - 12 * HOUR).toISOString(),
        assignedTo: 'Rajesh Kumar (Senior Electrician)',
        assignedStaffId: 'STF-01',
        imageUrl: createSampleSvg('fan', '<stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#334155"/>', 'WOBBLING CEILING FAN'),
        imageFileName: 'fan_damaged.jpg',
        duplicateCount: 1,
        duplicateReports: ['Vivek J.'],
        endorsedBy: ['Vivek J.'],
        resolutionNotes: 'Motor ball bearing seized. Replacement unit requisitioned from central store.',
        timeline: [
          { status: 'Pending', note: 'Reported by CS student representative. Impact Score: 68/100.', timestamp: new Date(now - 18 * HOUR).toISOString() },
          { status: 'In Progress', note: 'Assigned to Rajesh Kumar. Fan switched off and tagged.', timestamp: new Date(now - 12 * HOUR).toISOString() }
        ]
      },
      {
        id: 'CP-104',
        title: 'Broken lecture bench with exposed sharp metal frame',
        description: 'Third-row wooden desk bench is fractured in two pieces with sharp jagged metal bracket protruding outwards. A student tore their bag on it earlier today.',
        building: 'Science Complex',
        room: 'Lecture Hall B-12',
        category: 'Infrastructure',
        priority: 'Medium',
        status: 'Pending',
        submittedBy: 'Rohan Verma (ME-2023)',
        userEmail: 'rohan.v@campus.edu',
        createdAt: new Date(now - 6 * HOUR).toISOString(),
        updatedAt: new Date(now - 6 * HOUR).toISOString(),
        assignedTo: 'Unassigned',
        assignedStaffId: null,
        imageUrl: createSampleSvg('furniture', '<stop offset="0%" stop-color="#451a03"/><stop offset="100%" stop-color="#78350f"/>', 'BROKEN WOODEN BENCH'),
        imageFileName: 'broken_bench.jpg',
        duplicateCount: 0,
        duplicateReports: [],
        endorsedBy: [],
        resolutionNotes: '',
        timeline: [
          { status: 'Pending', note: 'New issue logged by student. Impact Score: 64/100 (Tier 1 Science complex lecture hall).', timestamp: new Date(now - 6 * HOUR).toISOString() }
        ]
      },
      {
        id: 'CP-106',
        title: 'Air conditioner in Seminar Hall 1 blowing warm air',
        description: 'The split AC unit on the left wall runs fan mode only; cooling compressor fails to engage. The hall is hot during afternoon lectures with 80+ students.',
        building: 'CS & IT Block',
        room: 'Seminar Hall 1 (Ground Floor)',
        category: 'Electrical',
        priority: 'Medium',
        status: 'Pending',
        submittedBy: 'Neha Kulkarni (CS-2025)',
        userEmail: 'neha.k@campus.edu',
        createdAt: new Date(now - 8 * HOUR).toISOString(),
        updatedAt: new Date(now - 8 * HOUR).toISOString(),
        assignedTo: 'Unassigned',
        assignedStaffId: null,
        imageUrl: createSampleSvg('ac', '<stop offset="0%" stop-color="#312e81"/><stop offset="100%" stop-color="#4338ca"/>', 'AC FAULT SEMINAR HALL'),
        imageFileName: 'ac_unit.jpg',
        duplicateCount: 0,
        duplicateReports: [],
        endorsedBy: [],
        resolutionNotes: '',
        timeline: [
          { status: 'Pending', note: 'Impact Score: 62/100 (Seminar hall thermal disruption).', timestamp: new Date(now - 8 * HOUR).toISOString() }
        ]
      },
      {
        id: 'CP-105',
        title: 'Unclean washroom with overflowing dustbin and odor',
        description: 'Ground floor west-wing washroom is not cleaned. Trash bins are overflowing with paper napkins and floor has muddy footprints. Needs sanitization.',
        building: 'Central Library',
        room: 'Ground Floor Restroom (West Wing)',
        category: 'Cleanliness',
        priority: 'Low',
        status: 'Resolved',
        submittedBy: 'Kunal Das (IT-2026)',
        userEmail: 'kunal.d@campus.edu',
        createdAt: new Date(now - 28 * HOUR).toISOString(),
        updatedAt: new Date(now - 4 * HOUR).toISOString(), // 24 hours resolution time
        resolvedAt: new Date(now - 4 * HOUR).toISOString(),
        assignedTo: 'Sunita Rawat (Sanitation Lead)',
        assignedStaffId: 'STF-04',
        imageUrl: createSampleSvg('clean', '<stop offset="0%" stop-color="#14532d"/><stop offset="100%" stop-color="#166534"/>', 'WASHROOM CLEANED'),
        imageFileName: 'restroom_clean.jpg',
        duplicateCount: 0,
        duplicateReports: [],
        endorsedBy: [],
        resolutionNotes: 'Deep cleaned, sanitized and waste bins cleared by morning sanitation crew. Air freshener installed.',
        timeline: [
          { status: 'Pending', note: 'Issue reported. Impact Score: 35/100.', timestamp: new Date(now - 28 * HOUR).toISOString() },
          { status: 'In Progress', note: 'Assigned to Housekeeping Team.', timestamp: new Date(now - 20 * HOUR).toISOString() },
          { status: 'Resolved', note: 'Sanitation completed and inspected by supervisor.', timestamp: new Date(now - 4 * HOUR).toISOString() }
        ]
      },
      {
        id: 'CP-107',
        title: 'Flickering corridor tube lights creating dark patches',
        description: 'Three continuous fluorescent tube lights in the secondary staircase are flickering intermittently and humming.',
        building: 'Academic Block A',
        room: 'Staircase A2 (Between Fl 2 & 3)',
        category: 'Electrical',
        priority: 'Low',
        status: 'Resolved',
        submittedBy: 'Ananya Sen (EC-2026)',
        userEmail: 'ananya.s@campus.edu',
        createdAt: new Date(now - 40 * HOUR).toISOString(),
        updatedAt: new Date(now - 14 * HOUR).toISOString(), // 26 hours resolution time
        resolvedAt: new Date(now - 14 * HOUR).toISOString(),
        assignedTo: 'Rajesh Kumar (Senior Electrician)',
        assignedStaffId: 'STF-01',
        imageUrl: createSampleSvg('light', '<stop offset="0%" stop-color="#713f12"/><stop offset="100%" stop-color="#854d0e"/>', 'LIGHTS REPLACED'),
        imageFileName: 'corridor_light.jpg',
        duplicateCount: 0,
        duplicateReports: [],
        endorsedBy: [],
        resolutionNotes: 'Faulty electronic ballasts and tubes replaced with energy-efficient LED batten fixtures.',
        timeline: [
          { status: 'Pending', note: 'Reported. Impact Score: 28/100.', timestamp: new Date(now - 40 * HOUR).toISOString() },
          { status: 'In Progress', note: 'Replacement lights issued.', timestamp: new Date(now - 24 * HOUR).toISOString() },
          { status: 'Resolved', note: 'All fixtures verified operational.', timestamp: new Date(now - 14 * HOUR).toISOString() }
        ]
      }
    ];

    return rawSeeds.map(seed => {
      const evaluation = _ImpactEngine 
        ? _ImpactEngine.evaluateImpact(seed) 
        : { finalScore: 50, isEmergency: false, priorityCode: 'P2', priorityTier: 'Medium', breakdown: {} };
      return {
        ...seed,
        impactScore: evaluation.finalScore,
        isEmergencyOverride: evaluation.isEmergency,
        priorityCode: evaluation.priorityCode,
        priorityTier: evaluation.priorityTier,
        impactBreakdown: evaluation.breakdown,
        formulaSummary: evaluation.formulaSummary
      };
    });
  }

  // Event Listeners for State Changes
  const listeners = [];
  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  function notify(event, payload) {
    for (const fn of listeners) {
      try {
        fn(event, payload);
      } catch (err) {
        console.error('Store subscription error:', err);
      }
    }
  }

  // Check Overdue SLA Status based on actual creation timestamp
  function checkOverdueStatus(complaint) {
    if (!complaint || complaint.status === 'Resolved' || complaint.status === 'Rejected') {
      return { isOverdue: false, elapsedHours: 0, slaHours: 0, overdueByHours: 0 };
    }

    const createdTime = new Date(complaint.createdAt).getTime();
    const elapsedHours = (Date.now() - createdTime) / (3600 * 1000);
    const slaHours = SLA_THRESHOLDS[complaint.priorityCode] || 48;

    const isOverdue = elapsedHours > slaHours;
    const overdueByHours = isOverdue ? Math.round((elapsedHours - slaHours) * 10) / 10 : 0;

    return {
      isOverdue,
      elapsedHours: Math.round(elapsedHours * 10) / 10,
      slaHours,
      overdueByHours
    };
  }

  // Load complaints from localStorage (or seed if empty)
  function getComplaints(sortBy = 'impact') {
    let list = [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        list = getSampleSeedData();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } else {
        list = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to parse complaints from storage', e);
      list = getSampleSeedData();
    }

    // Ensure all items have impactScore, breakdown, and overdue metadata computed
    list = list.map(item => {
      if (item.impactScore === undefined || !item.impactBreakdown) {
        const ev = _ImpactEngine 
          ? _ImpactEngine.evaluateImpact(item) 
          : { finalScore: 50, isEmergency: false, priorityCode: 'P2', priorityTier: 'Medium', breakdown: {} };
        item.impactScore = ev.finalScore;
        item.isEmergencyOverride = ev.isEmergency;
        item.priorityCode = ev.priorityCode;
        item.priorityTier = ev.priorityTier;
        item.impactBreakdown = ev.breakdown;
        item.formulaSummary = ev.formulaSummary;
      }
      
      const overdueInfo = checkOverdueStatus(item);
      item.isOverdue = overdueInfo.isOverdue;
      item.overdueByHours = overdueInfo.overdueByHours;
      item.elapsedHours = overdueInfo.elapsedHours;
      item.slaHours = overdueInfo.slaHours;

      return item;
    });

    // Assign ranking based on Emergency override first, then impactScore descending
    const sortedByImpact = [...list].sort((a, b) => {
      if (a.isEmergencyOverride && !b.isEmergencyOverride) return -1;
      if (!a.isEmergencyOverride && b.isEmergencyOverride) return 1;
      if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const rankMap = new Map();
    sortedByImpact.forEach((item, index) => {
      rankMap.set(item.id, index + 1);
    });

    list.forEach(item => {
      item.impactRank = rankMap.get(item.id) || 1;
    });

    // Sort as requested
    if (sortBy === 'impact') {
      list.sort((a, b) => {
        if (a.isEmergencyOverride && !b.isEmergencyOverride) return -1;
        if (!a.isEmergencyOverride && b.isEmergencyOverride) return 1;
        if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } else if (sortBy === 'time') {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  }

  function saveComplaints(complaints) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
      notify('complaints_updated', complaints);
    } catch (e) {
      console.error('Failed to save complaints to storage', e);
    }
  }

  function getStaff() {
    try {
      const data = localStorage.getItem(STAFF_STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(DEFAULT_STAFF));
        return DEFAULT_STAFF;
      }
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_STAFF;
    }
  }

  function generateNextId(complaints) {
    let max = 100;
    for (const c of complaints) {
      if (c.id && c.id.startsWith('CP-')) {
        const num = parseInt(c.id.replace('CP-', ''), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    return `CP-${max + 1}`;
  }

  // Add a new complaint with Impact Scoring
  function addComplaint(complaintData) {
    const list = getComplaints();
    const newId = generateNextId(list);
    const nowIso = new Date().toISOString();

    const evaluation = _ImpactEngine 
      ? _ImpactEngine.evaluateImpact(complaintData) 
      : { finalScore: 50, isEmergency: false, priorityCode: 'P2', priorityTier: 'Medium', breakdown: {} };

    const newTicket = {
      id: newId,
      title: complaintData.title.trim(),
      description: (complaintData.description || '').trim(),
      building: complaintData.building,
      room: (complaintData.room || '').trim(),
      category: complaintData.category || 'Other',
      priority: evaluation.isEmergency ? 'High' : (complaintData.priority || 'Medium'),
      status: 'Pending',
      submittedBy: complaintData.submittedBy || 'Student User',
      userEmail: complaintData.userEmail || 'student@campus.edu',
      createdAt: nowIso,
      updatedAt: nowIso,
      assignedTo: 'Unassigned',
      assignedStaffId: null,
      imageUrl: complaintData.imageUrl || createSampleSvg('generic', '<stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/>', 'ISSUE ATTACHMENT'),
      imageFileName: complaintData.imageFileName || 'attachment.png',
      isDuplicate: !!complaintData.isDuplicate,
      duplicateOf: complaintData.duplicateOf || null,
      duplicateCount: 0,
      duplicateReports: [],
      endorsedBy: [],
      resolutionNotes: '',

      impactScore: evaluation.finalScore,
      isEmergencyOverride: evaluation.isEmergency,
      priorityCode: evaluation.priorityCode,
      priorityTier: evaluation.priorityTier,
      impactBreakdown: evaluation.breakdown,
      formulaSummary: evaluation.formulaSummary,

      timeline: [
        {
          status: 'Pending',
          note: evaluation.isEmergency 
            ? `🚨 EMERGENCY OVERRIDE ACTIVATED: Critical safety hazard detected (${evaluation.breakdown.severity.rationale}). Score locked to 100 (P0).`
            : `Issue logged with Impact Score: ${evaluation.finalScore}/100 (${evaluation.priorityTier}). ${evaluation.formulaSummary}`,
          timestamp: nowIso
        }
      ]
    };

    list.unshift(newTicket);
    saveComplaints(list);
    return newTicket;
  }

  /**
   * Endorse an existing ticket when duplicate is detected
   * PRIORITY 4: Anti-inflation mechanism:
   * - Prevents the same student/user from endorsing twice
   * - Strictly caps duplicate population boost to max +10 pts
   */
  function endorseComplaint(id, studentName = 'Another student') {
    const list = getComplaints();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const ticket = list[idx];
    if (!ticket.endorsedBy) ticket.endorsedBy = [];

    // Check if this student already endorsed this issue (prevent duplicate endorsement inflation)
    const normalizedStudent = (studentName || '').trim().toLowerCase();
    const alreadyEndorsed = ticket.endorsedBy.some(name => name.trim().toLowerCase() === normalizedStudent);
    if (alreadyEndorsed && normalizedStudent !== 'another student') {
      return {
        alreadyEndorsed: true,
        ticket
      };
    }

    ticket.endorsedBy.push(studentName);
    ticket.duplicateCount = ticket.endorsedBy.length;
    if (!ticket.duplicateReports) ticket.duplicateReports = [];
    ticket.duplicateReports.push(studentName);

    // Re-evaluate impact score with anti-inflation capping
    const reEval = _ImpactEngine ? _ImpactEngine.evaluateImpact(ticket) : { finalScore: ticket.impactScore };
    const oldScore = ticket.impactScore;
    ticket.impactScore = reEval.finalScore;
    ticket.priorityCode = reEval.priorityCode;
    ticket.priorityTier = reEval.priorityTier;
    ticket.impactBreakdown = reEval.breakdown;
    ticket.formulaSummary = reEval.formulaSummary;
    ticket.updatedAt = new Date().toISOString();

    if (!ticket.timeline) ticket.timeline = [];
    ticket.timeline.push({
      status: ticket.status,
      note: `Duplicate endorsement: ${studentName} verified and endorsed this issue. Crowd count: ${ticket.duplicateCount}. Impact escalated from ${oldScore} to ${ticket.impactScore}/100.`,
      timestamp: new Date().toISOString()
    });

    list[idx] = ticket;
    saveComplaints(list);
    return {
      alreadyEndorsed: false,
      ticket
    };
  }

  // Update complaint status & assignment
  function updateComplaint(id, updates) {
    const list = getComplaints();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const current = list[idx];
    const nowIso = new Date().toISOString();

    const updated = {
      ...current,
      ...updates,
      updatedAt: nowIso
    };

    if (updates.status === 'Resolved' && !updated.resolvedAt) {
      updated.resolvedAt = nowIso;
    }

    if (updates.status && updates.status !== current.status) {
      if (!updated.timeline) updated.timeline = [];
      updated.timeline.push({
        status: updates.status,
        note: updates.timelineNote || `Status updated from ${current.status} to ${updates.status}`,
        timestamp: nowIso
      });
    } else if (updates.assignedTo && updates.assignedTo !== current.assignedTo) {
      if (!updated.timeline) updated.timeline = [];
      updated.timeline.push({
        status: current.status,
        note: `Assigned to technician: ${updates.assignedTo}`,
        timestamp: nowIso
      });
    }

    list[idx] = updated;
    saveComplaints(list);
    return updated;
  }

  // Reset to original demo data
  function resetDemoData() {
    const initial = getSampleSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(DEFAULT_STAFF));
    notify('demo_data_reset', initial);
    return initial;
  }

  /**
   * PRIORITY 2: Campus Infrastructure Heatmap Data
   * Aggregates active unresolved complaints, total impact score, max severity, and risk status per building.
   */
  function getHeatmapData() {
    const list = getComplaints();
    const heatmap = {};

    for (const bldg of BUILDINGS) {
      heatmap[bldg] = {
        building: bldg,
        activeCount: 0,
        totalResolved: 0,
        totalImpact: 0,
        maxImpactScore: 0,
        hasEmergency: false,
        categories: {},
        riskTier: 'LOW',
        colorClass: 'heatmap-healthy'
      };
    }

    for (const c of list) {
      const bldg = c.building || 'Academic Block A';
      if (!heatmap[bldg]) {
        heatmap[bldg] = {
          building: bldg,
          activeCount: 0,
          totalResolved: 0,
          totalImpact: 0,
          maxImpactScore: 0,
          hasEmergency: false,
          categories: {},
          riskTier: 'LOW',
          colorClass: 'heatmap-healthy'
        };
      }

      const h = heatmap[bldg];
      if (c.status === 'Resolved') {
        h.totalResolved++;
      } else {
        h.activeCount++;
        h.totalImpact += c.impactScore;
        if (c.impactScore > h.maxImpactScore) h.maxImpactScore = c.impactScore;
        if (c.isEmergencyOverride) h.hasEmergency = true;

        h.categories[c.category] = (h.categories[c.category] || 0) + 1;
      }
    }

    // Determine risk tiers
    for (const bldg of Object.keys(heatmap)) {
      const h = heatmap[bldg];
      if (h.hasEmergency || h.maxImpactScore === 100) {
        h.riskTier = 'CRITICAL (P0)';
        h.colorClass = 'heatmap-critical';
      } else if (h.maxImpactScore >= 80 || h.activeCount >= 2) {
        h.riskTier = 'HIGH RISK';
        h.colorClass = 'heatmap-high';
      } else if (h.activeCount >= 1) {
        h.riskTier = 'MODERATE';
        h.colorClass = 'heatmap-moderate';
      } else {
        h.riskTier = 'NORMAL';
        h.colorClass = 'heatmap-healthy';
      }
    }

    return heatmap;
  }

  /**
   * PRIORITY 2 & 3: Recurring Issue Pattern Detector
   * Analyzes multi-ticket concentrations by location & category.
   */
  function getRecurringIssues() {
    const list = getComplaints();
    const groups = new Map();

    for (const c of list) {
      const key = `${c.building}:::${c.category}`;
      if (!groups.has(key)) {
        groups.set(key, {
          building: c.building,
          category: c.category,
          count: 0,
          activeCount: 0,
          tickets: []
        });
      }
      const g = groups.get(key);
      g.count++;
      if (c.status !== 'Resolved') g.activeCount++;
      g.tickets.push(c);
    }

    const recurring = [];
    for (const [key, data] of groups.entries()) {
      if (data.count >= 2) {
        let recommendation = `Schedule targeted preventive inspection for ${data.category.toLowerCase()} systems in ${data.building}.`;
        if (data.category === 'Electrical') {
          recommendation = `Recurring electrical faults detected in ${data.building}. Recommend central distribution board & circuit load audit.`;
        } else if (data.category === 'Plumbing') {
          recommendation = `Repeated water pressure/leak incidents in ${data.building}. Recommend riser valve and seal replacement.`;
        }

        recurring.push({
          building: data.building,
          category: data.category,
          totalReports: data.count,
          activeReports: data.activeCount,
          ticketIds: data.tickets.map(t => `#${t.id}`),
          recommendation
        });
      }
    }

    return recurring;
  }

  /**
   * PRIORITY 3: Real Calculated Resolution Time Statistics
   * Computed strictly from actual stored timestamps (createdAt -> resolvedAt / updatedAt).
   * Does NOT invent statistics.
   */
  function calculateResolutionStats() {
    const list = getComplaints();
    const resolvedTickets = list.filter(c => c.status === 'Resolved');

    if (resolvedTickets.length === 0) {
      return {
        sampleSize: 0,
        averageHours: 0,
        averageFormatted: 'No resolved data yet',
        fastestHours: 0,
        slowestHours: 0,
        breakdownByPriority: {}
      };
    }

    let totalDurationMs = 0;
    const durations = [];

    for (const c of resolvedTickets) {
      const created = new Date(c.createdAt).getTime();
      const resolved = new Date(c.resolvedAt || c.updatedAt).getTime();
      const durationMs = Math.max(0, resolved - created);
      totalDurationMs += durationMs;
      durations.push(durationMs / (3600 * 1000));
    }

    durations.sort((a, b) => a - b);
    const avgHours = totalDurationMs / resolvedTickets.length / (3600 * 1000);
    const roundedAvg = Math.round(avgHours * 10) / 10;

    return {
      sampleSize: resolvedTickets.length,
      averageHours: roundedAvg,
      averageFormatted: `${roundedAvg} hrs`,
      fastestHours: Math.round(durations[0] * 10) / 10,
      slowestHours: Math.round(durations[durations.length - 1] * 10) / 10
    };
  }

  // Get aggregated dashboard statistics
  function getStats() {
    const list = getComplaints();
    const total = list.length;
    const pending = list.filter(c => c.status === 'Pending').length;
    const inProgress = list.filter(c => c.status === 'In Progress').length;
    const resolved = list.filter(c => c.status === 'Resolved').length;
    const emergencies = list.filter(c => c.isEmergencyOverride && c.status !== 'Resolved').length;
    const overdueCount = list.filter(c => c.isOverdue && c.status !== 'Resolved').length;

    const resolutionStats = calculateResolutionStats();
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const byCategory = {
      Electrical: 0,
      Plumbing: 0,
      Cleanliness: 0,
      Infrastructure: 0,
      Safety: 0,
      Other: 0
    };

    const byPriority = {
      High: 0,
      Medium: 0,
      Low: 0
    };

    for (const c of list) {
      if (byCategory[c.category] !== undefined) {
        byCategory[c.category]++;
      } else {
        byCategory['Other']++;
      }

      if (byPriority[c.priority] !== undefined) {
        byPriority[c.priority]++;
      }
    }

    return {
      total,
      pending,
      inProgress,
      resolved,
      emergencies,
      overdueCount,
      resolutionRate,
      averageResolutionHours: resolutionStats.averageHours,
      averageResolutionFormatted: resolutionStats.averageFormatted,
      byCategory,
      byPriority
    };
  }

  return {
    getComplaints,
    addComplaint,
    endorseComplaint,
    updateComplaint,
    resetDemoData,
    getStats,
    getStaff,
    getHeatmapData,
    getRecurringIssues,
    calculateResolutionStats,
    checkOverdueStatus,
    BUILDINGS,
    SLA_THRESHOLDS,
    subscribe
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
} else {
  window.Store = Store;
}

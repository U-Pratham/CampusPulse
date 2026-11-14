/**
 * CampusPulse - SQLite Database Layer
 * 
 * Powered by native Node 24 SQLite engine (node:sqlite DatabaseSync).
 * Provides ACID-compliant persistence, relational tables, foreign key constraints,
 * and deterministic impact ranking queries.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'campuspulse.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
      department TEXT,
      room TEXT,
      avatar TEXT,
      password_hash TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 2. Staff Directory Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      specialties TEXT,
      shift TEXT
    );
  `);

  // 3. Complaints / Prioritization Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      building TEXT NOT NULL,
      room TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      priority_tier TEXT NOT NULL,
      priority_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Resolved')),
      impact_score INTEGER NOT NULL DEFAULT 0,
      impact_rank INTEGER NOT NULL DEFAULT 999,
      is_emergency_override INTEGER NOT NULL DEFAULT 0,
      emergency_rule TEXT,
      submitted_by TEXT NOT NULL,
      user_email TEXT NOT NULL,
      assigned_to TEXT DEFAULT 'Unassigned',
      assigned_staff_id TEXT,
      image_url TEXT,
      image_file_name TEXT,
      is_duplicate INTEGER DEFAULT 0,
      duplicate_of TEXT,
      duplicate_count INTEGER DEFAULT 0,
      resolution_notes TEXT,
      impact_breakdown_json TEXT,
      formula_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);

  // 4. Crowd Endorsements Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS endorsements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(complaint_id, user_email)
    );
  `);

  // 5. Timeline / Audit Log Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      author TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // 6. Active Auth Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // Indices for rapid query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_complaints_impact ON complaints(impact_score DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_building ON complaints(building);
    CREATE INDEX IF NOT EXISTS idx_endorsements_complaint ON endorsements(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_complaint ON timeline(complaint_id);
  `);

  // Seed default data if database is empty
  seedDatabaseIfEmpty(db);
}

const DEFAULT_USERS = [
  {
    email: 'aarav.s@campus.edu',
    name: 'Aarav Sharma',
    role: 'student',
    department: 'CS & IT Dept',
    room: 'Room 204 • B.Tech 2024',
    avatar: 'ST',
    password_hash: 'campus2026'
  },
  {
    email: 'anita.d@campus.edu',
    name: 'Anita Desai (Supervisor)',
    role: 'admin',
    department: 'Facility Management Ops',
    room: 'Central Admin Wing',
    avatar: 'AD',
    password_hash: 'admin2026'
  }
];

const DEFAULT_STAFF = [
  { id: 'STF-01', name: 'Rajesh Verma (Senior Electrician)', role: 'Senior Electrician', department: 'Electrical Maintenance', email: 'rajesh.v@facility.campus.edu', phone: '+91 98765 43210', specialties: 'High-voltage circuits, switchboards, wiring, generators', shift: 'Morning (08:00 - 16:00)' },
  { id: 'STF-02', name: 'Suresh Murthy (Plumbing Lead)', role: 'Plumbing Lead', department: 'Plumbing & Water Works', email: 'suresh.m@facility.campus.edu', phone: '+91 98765 43211', specialties: 'Pipe joints, drainage, overhead tanks, washroom fittings', shift: 'General (09:00 - 17:00)' },
  { id: 'STF-03', name: 'Ramesh Kumar (HVAC & Fixtures)', role: 'HVAC Specialist', department: 'Mechanical Systems', email: 'ramesh.k@facility.campus.edu', phone: '+91 98765 43212', specialties: 'Elevators, AC chillers, ventilation fans, motors', shift: 'Rotational (24/7 on-call)' },
  { id: 'STF-04', name: 'Priya Sharma (Hygiene Supervisor)', role: 'Sanitation Lead', department: 'Campus Hygiene & Waste', email: 'priya.s@facility.campus.edu', phone: '+91 98765 43213', specialties: 'Biohazard spills, deep sanitation, washroom audits', shift: 'Morning (06:00 - 14:00)' },
  { id: 'STF-05', name: 'Vikram Singh (Campus Safety Officer)', role: 'Safety Compliance Officer', department: 'Emergency & Safety Desk', email: 'vikram.s@facility.campus.edu', phone: '+91 98765 43214', specialties: 'Fire safety, emergency evacuation, hazardous materials', shift: 'All-Day Incident Lead' }
];

function createSampleSvg(type, gradientStops, label) {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">${gradientStops}</linearGradient></defs><rect width="600" height="400" fill="url(%23bg)"/><rect x="30" y="30" width="540" height="340" rx="16" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="20" font-weight="700" letter-spacing="1">${label}</text><text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-family="monospace" font-size="13">CampusPulse Field Evidence Document</text></svg>`;
}

function getSeedComplaints() {
  const now = Date.now();
  const HOUR = 3600 * 1000;

  return [
    {
      id: 'CP-101',
      title: 'Exposed high-voltage switchboard sparking near CNC machine',
      description: 'Main workshop electrical breaker box has exposed wiring. Sparks observed when student operated CNC mill. Extreme electric shock and fire risk for 40+ engineering students in the lab.',
      building: 'Engineering Workshop',
      room: 'Machine Lab 2',
      category: 'Safety',
      priority: 'High',
      priority_tier: 'Critical',
      priority_code: 'P0',
      status: 'In Progress',
      impact_score: 100,
      impact_rank: 1,
      is_emergency_override: 1,
      emergency_rule: 'EXPOSED ELECTRICAL WIRES / SPARKS',
      submitted_by: 'Pooja Hegde (EE-2024)',
      user_email: 'pooja.h@campus.edu',
      assigned_to: 'Vikram Singh (Campus Safety Officer)',
      assigned_staff_id: 'STF-05',
      image_url: createSampleSvg('spark', '<stop offset="0%" stop-color="#7f1d1d"/><stop offset="100%" stop-color="#991b1b"/>', 'LIVE SPARKS DETECTED'),
      image_file_name: 'workshop_sparks.jpg',
      is_duplicate: 0,
      duplicate_of: null,
      duplicate_count: 1,
      resolution_notes: 'Emergency breaker tripped. Safety perimeter cordoned off. Electrician team on-site replacing damaged conduit.',
      impact_breakdown_json: JSON.stringify({
        severity: { weight: 40, max: 40, percentage: 100, rationale: 'Emergency override: exposed high-voltage wiring with live sparks' },
        location: { weight: 30, max: 30, percentage: 100, tier: 'Engineering Lab', rationale: 'Heavy machinery environment' },
        population: { weight: 30, max: 30, percentage: 100, headcount: '40+ students', rationale: 'Active lab session at capacity' }
      }),
      formula_summary: 'Safety Emergency Override -> Pinned to Max 100 pts (P0)',
      created_at: new Date(now - 3.5 * HOUR).toISOString(),
      updated_at: new Date(now - 1 * HOUR).toISOString(),
      resolved_at: null,
      endorsements: [{ name: 'Aarav K.', email: 'aarav.k@campus.edu' }],
      timeline: [
        { status: 'Pending', note: 'Emergency Override Triggered: High-voltage sparks detected in Workshop Lab. Pinned to Max Score (100).', author: 'System', timestamp: new Date(now - 3.5 * HOUR).toISOString() },
        { status: 'In Progress', note: 'Assigned to Vikram Singh. Lab power isolated for containment.', author: 'Anita Desai', timestamp: new Date(now - 1 * HOUR).toISOString() }
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
      priority_tier: 'High',
      priority_code: 'P1',
      status: 'In Progress',
      impact_score: 87,
      impact_rank: 2,
      is_emergency_override: 0,
      emergency_rule: null,
      submitted_by: 'Meera Patel (EC-2025)',
      user_email: 'meera.p@campus.edu',
      assigned_to: 'Suresh Murthy (Plumbing Lead)',
      assigned_staff_id: 'STF-02',
      image_url: createSampleSvg('water', '<stop offset="0%" stop-color="#0c4a6e"/><stop offset="100%" stop-color="#0369a1"/>', 'PIPE LEAKAGE HALLWAY'),
      image_file_name: 'corridor_flood.jpg',
      is_duplicate: 0,
      duplicate_of: null,
      duplicate_count: 2,
      resolution_notes: 'Main riser valve closed temporarily. Replacement PVC union joint and sealant being fitted.',
      impact_breakdown_json: JSON.stringify({
        severity: { weight: 35, max: 40, percentage: 87.5, rationale: 'High: active pipe burst causing pooling water' },
        location: { weight: 26, max: 30, percentage: 86.7, tier: 'Academic Corridor', rationale: 'Central hallway access' },
        population: { weight: 26, max: 30, percentage: 86.7, headcount: '100+ students', rationale: 'Main thoroughfare between lecture halls' }
      }),
      formula_summary: 'S (35/40) + L (26/30) + P (26/30) = 87 / 100 (P1)',
      created_at: new Date(now - 5 * HOUR).toISOString(),
      updated_at: new Date(now - 3 * HOUR).toISOString(),
      resolved_at: null,
      endorsements: [
        { name: 'Karan S.', email: 'karan.s@campus.edu' },
        { name: 'Rhea T.', email: 'rhea.t@campus.edu' }
      ],
      timeline: [
        { status: 'Pending', note: 'Ticket submitted with photo proof. Evaluated Impact Score: 87/100 (High-traffic hallway flooding).', author: 'Meera Patel', timestamp: new Date(now - 5 * HOUR).toISOString() },
        { status: 'In Progress', note: 'Assigned to Suresh Murthy. Water isolation valve shut.', author: 'Anita Desai', timestamp: new Date(now - 3 * HOUR).toISOString() }
      ]
    },
    {
      id: 'CP-103',
      title: 'Central library elevator halted between floors with grinding noise',
      description: 'Passenger lift B stopped between Ground and 1st floor. Sensor displays error code E-42. Elevator doors are stuck partially open. Disables wheelchair access to upper stacks.',
      building: 'Central Library',
      room: 'Ground Floor Elevator Bay',
      category: 'Infrastructure',
      priority: 'High',
      priority_tier: 'High',
      priority_code: 'P1',
      status: 'Pending',
      impact_score: 72,
      impact_rank: 3,
      is_emergency_override: 0,
      emergency_rule: null,
      submitted_by: 'Devendra Joshi (ME-2023)',
      user_email: 'dev.j@campus.edu',
      assigned_to: 'Ramesh Kumar (HVAC & Fixtures)',
      assigned_staff_id: 'STF-03',
      image_url: createSampleSvg('lift', '<stop offset="0%" stop-color="#4a044e"/><stop offset="100%" stop-color="#701a75"/>', 'ELEVATOR FAULT E-42'),
      image_file_name: 'elevator_error.jpg',
      is_duplicate: 0,
      duplicate_of: null,
      duplicate_count: 0,
      resolution_notes: null,
      impact_breakdown_json: JSON.stringify({
        severity: { weight: 30, max: 40, percentage: 75, rationale: 'High: elevator entrapment / total mechanical failure' },
        location: { weight: 24, max: 30, percentage: 80, tier: 'Central Library', rationale: 'Critical accessibility transit' },
        population: { weight: 18, max: 30, percentage: 60, headcount: 'Campus wide', rationale: 'Impacts all students requiring accessible routes' }
      }),
      formula_summary: 'S (30/40) + L (24/30) + P (18/30) = 72 / 100 (P1)',
      created_at: new Date(now - 7 * HOUR).toISOString(),
      updated_at: new Date(now - 7 * HOUR).toISOString(),
      resolved_at: null,
      endorsements: [],
      timeline: [
        { status: 'Pending', note: 'Elevator fault logged. Evaluated Impact: 72/100. Dispatched to mechanical maintenance.', author: 'Devendra Joshi', timestamp: new Date(now - 7 * HOUR).toISOString() }
      ]
    },
    {
      id: 'CP-104',
      title: 'Flickering ceiling light fixture humming loudly during lectures',
      description: 'Tube fixture near projector screen keeps buzzing and flashing intermittently, distracting professor and 60 students during data structures classes.',
      building: 'CS & IT Block',
      room: 'Lecture Hall 104',
      category: 'Electrical',
      priority: 'Medium',
      priority_tier: 'Medium',
      priority_code: 'P2',
      status: 'Pending',
      impact_score: 56,
      impact_rank: 4,
      is_emergency_override: 0,
      emergency_rule: null,
      submitted_by: 'Ananya Roy (CS-2026)',
      user_email: 'ananya.r@campus.edu',
      assigned_to: 'Unassigned',
      assigned_staff_id: null,
      image_url: createSampleSvg('light', '<stop offset="0%" stop-color="#14532d"/><stop offset="100%" stop-color="#166534"/>', 'FLICKERING TUBE LIGHT'),
      image_file_name: 'lecture_light.jpg',
      is_duplicate: 0,
      duplicate_of: null,
      duplicate_count: 0,
      resolution_notes: null,
      impact_breakdown_json: JSON.stringify({
        severity: { weight: 18, max: 40, percentage: 45, rationale: 'Medium: ballast flicker causing classroom visual distraction' },
        location: { weight: 20, max: 30, percentage: 66.7, tier: 'Classroom LH104', rationale: 'Active instructional space' },
        population: { weight: 18, max: 30, percentage: 60, headcount: '60 students', rationale: 'Scheduled batch in session' }
      }),
      formula_summary: 'S (18/40) + L (20/30) + P (18/30) = 56 / 100 (P2)',
      created_at: new Date(now - 12 * HOUR).toISOString(),
      updated_at: new Date(now - 12 * HOUR).toISOString(),
      resolved_at: null,
      endorsements: [],
      timeline: [
        { status: 'Pending', note: 'Reported by student. Queued for replacement electronic ballast.', author: 'Ananya Roy', timestamp: new Date(now - 12 * HOUR).toISOString() }
      ]
    },
    {
      id: 'CP-105',
      title: 'Broken handrail mount on exterior staircase near Chemistry Wing',
      description: 'Bolts have loosened from the concrete anchor on the 2nd-floor outdoor escape stairs. Handrail sways when leaned against.',
      building: 'Science Block',
      room: 'Staircase 2B (Exterior)',
      category: 'Safety',
      priority: 'Medium',
      priority_tier: 'Medium',
      priority_code: 'P2',
      status: 'Resolved',
      impact_score: 48,
      impact_rank: 5,
      is_emergency_override: 0,
      emergency_rule: null,
      submitted_by: 'Rohit Sen (CH-2024)',
      user_email: 'rohit.s@campus.edu',
      assigned_to: 'Ramesh Kumar (HVAC & Fixtures)',
      assigned_staff_id: 'STF-03',
      image_url: createSampleSvg('rail', '<stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#312e81"/>', 'STAIRCASE HANDRAIL REPAIRED'),
      image_file_name: 'stair_rail.jpg',
      is_duplicate: 0,
      duplicate_of: null,
      duplicate_count: 0,
      resolution_notes: 'Drilled 4 new M10 expansion wedge anchors and welded bracket to steel upright. Stress tested up to 200 kg lateral load. Safe for use.',
      impact_breakdown_json: JSON.stringify({
        severity: { weight: 22, max: 40, percentage: 55, rationale: 'Medium: structural play on safety barrier' },
        location: { weight: 14, max: 30, percentage: 46.7, tier: 'Exterior Stair', rationale: 'Secondary circulation path' },
        population: { weight: 12, max: 30, percentage: 40, headcount: '25-50 users', rationale: 'Moderate daily footfall' }
      }),
      formula_summary: 'S (22/40) + L (14/30) + P (12/30) = 48 / 100 (P2)',
      created_at: new Date(now - 30 * HOUR).toISOString(),
      updated_at: new Date(now - 4 * HOUR).toISOString(),
      resolved_at: new Date(now - 4 * HOUR).toISOString(),
      endorsements: [],
      timeline: [
        { status: 'Pending', note: 'Reported loose handrail bracket.', author: 'Rohit Sen', timestamp: new Date(now - 30 * HOUR).toISOString() },
        { status: 'In Progress', note: 'Assigned to Ramesh Kumar. Anchor hardware staged.', author: 'Anita Desai', timestamp: new Date(now - 14 * HOUR).toISOString() },
        { status: 'Resolved', note: 'Wedge anchors drilled, bracket welded, load test passed.', author: 'Ramesh Kumar', timestamp: new Date(now - 4 * HOUR).toISOString() }
      ]
    },
    {
      id: 'CP-106',
      title: 'Restroom tap dripping continuously causing mineral buildup',
      description: 'Washbasin faucet #3 in ground floor restroom does not shut off completely. Constant slow drip.',
      building: 'Hostel Block B',
      room: 'Ground Floor Restroom 03',
      category: 'Plumbing',
      priority: 'Low',
      priority_tier: 'Low',
      priority_code: 'P3',
      status: 'Resolved',
      impact_score: 28,
      impact_rank: 6,
      is_emergency_override: 0,
      emergency_rule: null,
      submitted_by: 'Siddharth Rao (CS-2025)',
      user_email: 'siddharth.r@campus.edu',
      assigned_to: 'Suresh Murthy (Plumbing Lead)',
      assigned_staff_id: 'STF-02',
      image_url: createSampleSvg('faucet', '<stop offset="0%" stop-color="#022c22"/><stop offset="100%" stop-color="#064e3b"/>', 'WASHER REPLACED'),
      image_file_name: 'faucet_drip.jpg',
      is_duplicate: 0,
      duplicate_of: null,
      duplicate_count: 0,
      resolution_notes: 'Replaced worn ceramic cartridge valve. Cleaned aerator mesh. Zero drips confirmed.',
      impact_breakdown_json: JSON.stringify({
        severity: { weight: 10, max: 40, percentage: 25, rationale: 'Low: minor water seepage from tap seal' },
        location: { weight: 10, max: 30, percentage: 33.3, tier: 'Hostel Restroom', rationale: 'Residential facility basin' },
        population: { weight: 8, max: 30, percentage: 26.7, headcount: 'Wing occupants', rationale: '3 other working basins available' }
      }),
      formula_summary: 'S (10/40) + L (10/30) + P (8/30) = 28 / 100 (P3)',
      created_at: new Date(now - 48 * HOUR).toISOString(),
      updated_at: new Date(now - 22 * HOUR).toISOString(),
      resolved_at: new Date(now - 22 * HOUR).toISOString(),
      endorsements: [],
      timeline: [
        { status: 'Pending', note: 'Tap drip reported.', author: 'Siddharth Rao', timestamp: new Date(now - 48 * HOUR).toISOString() },
        { status: 'In Progress', note: 'Work order dispatched to Suresh Murthy.', author: 'Anita Desai', timestamp: new Date(now - 28 * HOUR).toISOString() },
        { status: 'Resolved', note: 'Cartridge replaced, leak resolved.', author: 'Suresh Murthy', timestamp: new Date(now - 22 * HOUR).toISOString() }
      ]
    }
  ];
}

function seedDatabaseIfEmpty(db) {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM complaints').get();
  if (countRow.count === 0) {
    seedData(db);
  }
}

function seedData(db) {
  // 1. Seed Users
  const userInsert = db.prepare(`
    INSERT OR REPLACE INTO users (email, name, role, department, room, avatar, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const u of DEFAULT_USERS) {
    userInsert.run(u.email, u.name, u.role, u.department, u.room, u.avatar, u.password_hash, new Date().toISOString());
  }

  // 2. Seed Staff
  const staffInsert = db.prepare(`
    INSERT OR REPLACE INTO staff (id, name, role, department, email, phone, specialties, shift)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of DEFAULT_STAFF) {
    staffInsert.run(s.id, s.name, s.role, s.department, s.email, s.phone, s.specialties, s.shift);
  }

  // 3. Clear existing complaints, endorsements, timeline
  db.exec('DELETE FROM timeline;');
  db.exec('DELETE FROM endorsements;');
  db.exec('DELETE FROM complaints;');

  // 4. Seed Complaints
  const complaintInsert = db.prepare(`
    INSERT INTO complaints (
      id, title, description, building, room, category, priority, priority_tier, priority_code,
      status, impact_score, impact_rank, is_emergency_override, emergency_rule,
      submitted_by, user_email, assigned_to, assigned_staff_id, image_url, image_file_name,
      is_duplicate, duplicate_of, duplicate_count, resolution_notes, impact_breakdown_json,
      formula_summary, created_at, updated_at, resolved_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const endorsementInsert = db.prepare(`
    INSERT INTO endorsements (complaint_id, user_name, user_email, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const timelineInsert = db.prepare(`
    INSERT INTO timeline (complaint_id, status, note, author, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seedComplaints = getSeedComplaints();

  for (const c of seedComplaints) {
    complaintInsert.run(
      c.id, c.title, c.description, c.building, c.room, c.category, c.priority, c.priority_tier, c.priority_code,
      c.status, c.impact_score, c.impact_rank, c.is_emergency_override, c.emergency_rule,
      c.submitted_by, c.user_email, c.assigned_to, c.assigned_staff_id, c.image_url, c.image_file_name,
      c.is_duplicate, c.duplicate_of, c.duplicate_count, c.resolution_notes, c.impact_breakdown_json,
      c.formula_summary, c.created_at, c.updated_at, c.resolved_at
    );

    if (c.endorsements && Array.isArray(c.endorsements)) {
      for (const e of c.endorsements) {
        endorsementInsert.run(c.id, e.name, e.email, c.created_at);
      }
    }

    if (c.timeline && Array.isArray(c.timeline)) {
      for (const t of c.timeline) {
        timelineInsert.run(c.id, t.status, t.note, t.author || 'System', t.timestamp);
      }
    }
  }

  recalculateImpactRanks(db);
}

/**
 * Dynamic Impact Prioritization Reranking
 * Safety emergencies (is_emergency_override=1) are guaranteed Rank #1..k.
 * All subsequent issues ordered strictly by impact_score DESC, then created_at ASC.
 */
function recalculateImpactRanks(db) {
  const rows = db.prepare(`
    SELECT id, is_emergency_override, impact_score, created_at
    FROM complaints
    ORDER BY
      is_emergency_override DESC,
      impact_score DESC,
      created_at ASC
  `).all();

  const updateStmt = db.prepare('UPDATE complaints SET impact_rank = ? WHERE id = ?');
  for (let i = 0; i < rows.length; i++) {
    updateStmt.run(i + 1, rows[i].id);
  }
}

// Generate Next Ticket ID
function getNextComplaintId(db) {
  const rows = db.prepare("SELECT id FROM complaints WHERE id LIKE 'CP-%'").all();
  let max = 100;
  for (const r of rows) {
    const num = parseInt(r.id.replace('CP-', ''), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return `CP-${max + 1}`;
}

module.exports = {
  getDb,
  seedData,
  recalculateImpactRanks,
  getNextComplaintId,
  DB_PATH
};

/**
 * CampusPulse - Server REST API Router
 * 
 * Handles all REST endpoints with SQLite persistence, deterministic impact evaluations,
 * SLA monitoring, and role-based access control.
 */

const { getDb, seedData, recalculateImpactRanks, getNextComplaintId } = require('./db.js');
const auth = require('./auth.js');
const Classifier = require('../js/classifier.js');
const ImpactEngine = require('../js/impactEngine.js');
const DuplicateDetector = require('../js/duplicateDetector.js');

const SLA_HOURS = {
  P0: 2,   // Emergency safety: 2 hours
  P1: 24,  // High impact: 24 hours
  P2: 48,  // Medium: 48 hours
  P3: 72   // Low: 72 hours
};

function formatComplaintRow(row, db) {
  if (!row) return null;

  // Fetch endorsements
  const endorsements = db.prepare('SELECT user_name, user_email FROM endorsements WHERE complaint_id = ?').all(row.id);
  const endorsedBy = endorsements.map(e => e.user_name);

  // Fetch timeline
  const timeline = db.prepare('SELECT status, note, author, timestamp FROM timeline WHERE complaint_id = ? ORDER BY id ASC').all(row.id);

  // Parse breakdown
  let breakdown = null;
  try {
    breakdown = row.impact_breakdown_json ? JSON.parse(row.impact_breakdown_json) : null;
  } catch (e) {}

  // Compute SLA overdue status
  const prioCode = row.priority_code || 'P2';
  const threshold = SLA_HOURS[prioCode] || 48;
  const createdDate = new Date(row.created_at);
  const now = new Date();
  const ageHours = (now - createdDate) / (1000 * 3600);
  const isOverdue = row.status !== 'Resolved' && ageHours > threshold;
  const overdueByHours = isOverdue ? Math.max(1, Math.floor(ageHours - threshold)) : 0;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    building: row.building,
    room: row.room,
    category: row.category,
    priority: row.priority,
    priorityTier: row.priority_tier,
    priorityCode: row.priority_code,
    status: row.status,
    impactScore: row.impact_score,
    impactRank: row.impact_rank,
    isEmergencyOverride: Boolean(row.is_emergency_override),
    emergencyRule: row.emergency_rule,
    submittedBy: row.submitted_by,
    userEmail: row.user_email,
    assignedTo: row.assigned_to,
    assignedStaffId: row.assigned_staff_id,
    imageUrl: row.image_url,
    imageFileName: row.image_file_name,
    isDuplicate: Boolean(row.is_duplicate),
    duplicateOf: row.duplicate_of,
    duplicateCount: row.duplicate_count || 0,
    resolutionNotes: row.resolution_notes,
    impactBreakdown: breakdown,
    formulaSummary: row.formula_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    isOverdue,
    overdueByHours,
    endorsedBy,
    endorsements,
    timeline
  };
}

function handleApi(req, res, url, body) {
  const db = getDb();
  const method = req.method;
  const pathname = url.pathname;

  // Helper to send JSON response
  function sendJson(statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token'
    });
    res.end(JSON.stringify(data));
  }

  // Pre-flight CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token'
    });
    return res.end();
  }

  // Auth helper
  function getAuthUser() {
    const authHeader = req.headers['authorization'] || req.headers['x-auth-token'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token ? auth.verifySession(token) : null;
  }

  try {
    // 1. HEALTH CHECK
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(200, {
        status: 'ok',
        version: '2.0.0',
        engine: 'Impact Engine Deterministic Multi-Factor',
        database: 'SQLite 3 (WAL mode)',
        storage: 'data/campuspulse.db',
        timestamp: new Date().toISOString()
      });
    }

    // 2. AUTH: LOGIN
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password, role } = body || {};
      if (!email) {
        return sendJson(400, { error: 'Email is required' });
      }
      const session = auth.login(email, password, role);
      return sendJson(200, session);
    }

    // 3. AUTH: CURRENT USER
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = getAuthUser();
      if (!user) return sendJson(401, { error: 'Unauthorized session' });
      return sendJson(200, { user });
    }

    // 4. AUTH: LOGOUT
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const authHeader = req.headers['authorization'] || req.headers['x-auth-token'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) auth.logout(token);
      return sendJson(200, { success: true, message: 'Logged out successfully' });
    }

    // 5. COMPLAINTS: LIST (GET /api/complaints)
    if (pathname === '/api/complaints' && method === 'GET') {
      const sortMode = url.searchParams.get('sort') || 'impact'; // 'impact' | 'time'
      const categoryFilter = url.searchParams.get('category');
      const statusFilter = url.searchParams.get('status');
      const buildingFilter = url.searchParams.get('building');
      const prioFilter = url.searchParams.get('priority');
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();

      let query = 'SELECT * FROM complaints WHERE 1=1';
      const params = [];

      if (categoryFilter && categoryFilter !== 'ALL') {
        query += ' AND category = ?';
        params.push(categoryFilter);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        query += ' AND status = ?';
        params.push(statusFilter);
      }
      if (buildingFilter && buildingFilter !== 'ALL') {
        query += ' AND building = ?';
        params.push(buildingFilter);
      }
      if (prioFilter && prioFilter !== 'ALL') {
        query += ' AND priority_code = ?';
        params.push(prioFilter);
      }

      if (sortMode === 'time') {
        query += ' ORDER BY created_at DESC';
      } else {
        query += ' ORDER BY is_emergency_override DESC, impact_score DESC, created_at ASC';
      }

      const rows = db.prepare(query).all(...params);
      let complaints = rows.map(r => formatComplaintRow(r, db));

      if (search) {
        complaints = complaints.filter(c => 
          c.id.toLowerCase().includes(search) ||
          c.title.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search) ||
          c.building.toLowerCase().includes(search) ||
          c.room.toLowerCase().includes(search) ||
          (c.assignedTo && c.assignedTo.toLowerCase().includes(search))
        );
      }

      return sendJson(200, complaints);
    }

    // 6. COMPLAINTS: SINGLE (GET /api/complaints/:id)
    if (pathname.startsWith('/api/complaints/') && method === 'GET') {
      const id = pathname.replace('/api/complaints/', '').trim();
      const row = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      if (!row) return sendJson(404, { error: `Ticket #${id} not found` });
      return sendJson(200, formatComplaintRow(row, db));
    }

    // 7. COMPLAINTS: SUBMIT (POST /api/complaints)
    if (pathname === '/api/complaints' && method === 'POST') {
      const { title, description, building, room, category, submittedBy, userEmail, imageUrl, imageFileName, isDuplicate, duplicateOf } = body || {};

      if (!title || !building || !room || !description) {
        return sendJson(400, { error: 'Missing required complaint fields (title, building, room, description)' });
      }

      // 1. Run Server-Side Classifier if category omitted or generic
      let finalCategory = category;
      if (!finalCategory || finalCategory === 'Other') {
        const detected = Classifier.classify ? Classifier.classify(title, description) : Classifier.classifyComplaint(title, description);
        finalCategory = detected.category;
      }

      // 2. Run Server-Side Impact Prioritization Engine
      const evalResult = ImpactEngine.evaluateImpact({
        title,
        description,
        building,
        room,
        category: finalCategory
      });

      // 3. Generate New Ticket ID from SQLite sequence
      const newId = getNextComplaintId(db);
      const nowIso = new Date().toISOString();

      // 4. Insert into SQLite Database
      db.prepare(`
        INSERT INTO complaints (
          id, title, description, building, room, category, priority, priority_tier, priority_code,
          status, impact_score, impact_rank, is_emergency_override, emergency_rule,
          submitted_by, user_email, assigned_to, assigned_staff_id, image_url, image_file_name,
          is_duplicate, duplicate_of, duplicate_count, resolution_notes, impact_breakdown_json,
          formula_summary, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `).run(
        newId,
        title.trim(),
        description.trim(),
        building.trim(),
        room.trim(),
        finalCategory,
        evalResult.isEmergency ? 'High' : (evalResult.priorityTier === 'Critical' || evalResult.priorityTier === 'High' ? 'High' : 'Medium'),
        evalResult.priorityTier,
        evalResult.priorityCode,
        'Pending',
        evalResult.finalScore,
        999,
        evalResult.isEmergency ? 1 : 0,
        evalResult.isEmergency ? evalResult.breakdown.severity.rationale : null,
        submittedBy || 'Student User',
        userEmail || 'student@campus.edu',
        'Unassigned',
        null,
        imageUrl || null,
        imageFileName || null,
        isDuplicate ? 1 : 0,
        duplicateOf || null,
        0,
        null,
        JSON.stringify(evalResult.breakdown),
        evalResult.formulaSummary,
        nowIso,
        nowIso
      );

      // 5. Initial Timeline Log
      db.prepare(`
        INSERT INTO timeline (complaint_id, status, note, author, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        newId,
        'Pending',
        evalResult.isEmergency 
          ? `Emergency Safety Override Activated: Pinned to Rank #1 (Score: 100/100). Reason: ${evalResult.breakdown.severity.rationale}` 
          : `Ticket submitted. Evaluated Impact Score: ${evalResult.finalScore}/100 (${evalResult.priorityTier} - ${evalResult.priorityCode}).`,
        submittedBy || 'Student',
        nowIso
      );

      // 6. Recalculate dynamic ranks across entire backlog
      recalculateImpactRanks(db);

      const created = db.prepare('SELECT * FROM complaints WHERE id = ?').get(newId);
      return sendJson(201, formatComplaintRow(created, db));
    }

    // 8. COMPLAINTS: UPDATE / TRIAGE (PATCH /api/complaints/:id)
    if (pathname.startsWith('/api/complaints/') && method === 'PATCH') {
      const id = pathname.replace('/api/complaints/', '').trim();
      const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      if (!existing) return sendJson(404, { error: `Ticket #${id} not found` });

      const { status, assignedTo, assignedStaffId, resolutionNotes, timelineNote } = body || {};
      const nowIso = new Date().toISOString();

      let newStatus = status || existing.status;
      let newAssignee = assignedTo !== undefined ? assignedTo : existing.assigned_to;
      let newStaffId = assignedStaffId !== undefined ? assignedStaffId : existing.assigned_staff_id;
      let newNotes = resolutionNotes !== undefined ? resolutionNotes : existing.resolution_notes;
      let resolvedAt = existing.resolved_at;

      if (newStatus === 'Resolved' && existing.status !== 'Resolved') {
        resolvedAt = nowIso;
      } else if (newStatus !== 'Resolved') {
        resolvedAt = null;
      }

      db.prepare(`
        UPDATE complaints
        SET status = ?, assigned_to = ?, assigned_staff_id = ?, resolution_notes = ?, resolved_at = ?, updated_at = ?
        WHERE id = ?
      `).run(newStatus, newAssignee, newStaffId, newNotes, resolvedAt, nowIso, id);

      // Add timeline entry if status changed or note provided
      if (timelineNote || newStatus !== existing.status || newAssignee !== existing.assigned_to) {
        let note = timelineNote || `Operational Status updated to: ${newStatus}`;
        if (newAssignee !== existing.assigned_to && newAssignee !== 'Unassigned') {
          note += `. Assigned crew technician: ${newAssignee}`;
        }
        db.prepare(`
          INSERT INTO timeline (complaint_id, status, note, author, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, newStatus, note, 'Facility Ops', nowIso);
      }

      recalculateImpactRanks(db);

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      return sendJson(200, formatComplaintRow(updated, db));
    }

    // 9. COMPLAINTS: CROWD ENDORSEMENT (POST /api/complaints/:id/endorse)
    if (pathname.startsWith('/api/complaints/') && pathname.endsWith('/endorse') && method === 'POST') {
      const id = pathname.replace('/api/complaints/', '').replace('/endorse', '').trim();
      const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      if (!existing) return sendJson(404, { error: `Ticket #${id} not found` });

      const { studentName = 'Student', studentEmail = 'student@campus.edu' } = body || {};
      const cleanEmail = studentEmail.trim().toLowerCase();

      // Check for duplicate endorsement (Anti-Inflation Constraint)
      const existingEndorsement = db.prepare(`
        SELECT * FROM endorsements WHERE complaint_id = ? AND LOWER(user_email) = ?
      `).get(id, cleanEmail);

      if (existingEndorsement) {
        return sendJson(200, {
          alreadyEndorsed: true,
          message: 'You have already endorsed this complaint.',
          ticket: formatComplaintRow(existing, db)
        });
      }

      const nowIso = new Date().toISOString();

      // Insert endorsement into SQLite
      db.prepare(`
        INSERT INTO endorsements (complaint_id, user_name, user_email, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, studentName.trim(), cleanEmail, nowIso);

      // Count total endorsements
      const countRow = db.prepare('SELECT COUNT(*) as count FROM endorsements WHERE complaint_id = ?').get(id);
      const totalCount = countRow.count;

      // Re-evaluate impact score with capped duplicate crowd weight
      const reEval = ImpactEngine.evaluateImpact({
        title: existing.title,
        description: existing.description,
        building: existing.building,
        room: existing.room,
        category: existing.category,
        duplicateCount: totalCount
      });

      const oldScore = existing.impact_score;

      db.prepare(`
        UPDATE complaints
        SET impact_score = ?, priority_tier = ?, priority_code = ?, duplicate_count = ?,
            impact_breakdown_json = ?, formula_summary = ?, updated_at = ?
        WHERE id = ?
      `).run(
        reEval.finalScore,
        reEval.priorityTier,
        reEval.priorityCode,
        totalCount,
        JSON.stringify(reEval.breakdown),
        reEval.formulaSummary,
        nowIso,
        id
      );

      // Log crowd endorsement into timeline
      db.prepare(`
        INSERT INTO timeline (complaint_id, status, note, author, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        existing.status,
        `Duplicate endorsement: ${studentName} verified community impact. Verified count: ${totalCount}. Impact score escalated from ${oldScore} to ${reEval.finalScore}/100.`,
        studentName,
        nowIso
      );

      recalculateImpactRanks(db);

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      return sendJson(200, {
        success: true,
        message: `Endorsed #${id} successfully! Priority escalated.`,
        ticket: formatComplaintRow(updated, db)
      });
    }

    // 10. ANALYTICS: SUMMARY METRICS (GET /api/analytics/summary)
    if (pathname === '/api/analytics/summary' && method === 'GET') {
      const allRows = db.prepare('SELECT * FROM complaints').all();
      const complaints = allRows.map(r => formatComplaintRow(r, db));

      const total = complaints.length;
      const pending = complaints.filter(c => c.status === 'Pending').length;
      const inProgress = complaints.filter(c => c.status === 'In Progress').length;
      const resolved = complaints.filter(c => c.status === 'Resolved').length;
      const emergencies = complaints.filter(c => c.isEmergencyOverride && c.status !== 'Resolved').length;
      const overdue = complaints.filter(c => c.isOverdue).length;

      // Real Average Resolution Time from actual resolved timestamp deltas
      const resolvedWithTimestamps = complaints.filter(c => c.status === 'Resolved' && c.resolvedAt);
      let avgResolutionHours = 0;
      if (resolvedWithTimestamps.length > 0) {
        const totalDurationHours = resolvedWithTimestamps.reduce((sum, c) => {
          const delta = (new Date(c.resolvedAt) - new Date(c.createdAt)) / (1000 * 3600);
          return sum + Math.max(0, delta);
        }, 0);
        avgResolutionHours = Math.round(totalDurationHours / resolvedWithTimestamps.length);
      }

      return sendJson(200, {
        total,
        pending,
        inProgress,
        resolved,
        emergencies,
        overdue,
        avgResolutionHours,
        activeWorkloadCount: pending + inProgress
      });
    }

    // 11. ANALYTICS: HEATMAP SPATIAL CONCENTRATION (GET /api/analytics/heatmap)
    if (pathname === '/api/analytics/heatmap' && method === 'GET') {
      const buildings = [
        'Academic Block A',
        'Academic Block B',
        'Engineering Workshop',
        'Central Library',
        'CS & IT Block',
        'Science Block',
        'Administrative Block',
        'Hostel Block A',
        'Hostel Block B'
      ];

      const allComplaints = db.prepare('SELECT * FROM complaints').all().map(r => formatComplaintRow(r, db));

      const heatmap = buildings.map(building => {
        const bComplaints = allComplaints.filter(c => c.building === building);
        const unresolved = bComplaints.filter(c => c.status !== 'Resolved');
        const count = bComplaints.length;
        const highestScore = count > 0 ? Math.max(...bComplaints.map(c => c.impactScore)) : 0;
        const hasEmergency = bComplaints.some(c => c.isEmergencyOverride && c.status !== 'Resolved');

        let riskTier = 'LOW';
        let riskColor = '#10b981';

        if (hasEmergency) {
          riskTier = 'CRITICAL';
          riskColor = '#ef4444';
        } else if (highestScore >= 75 || unresolved.length >= 3) {
          riskTier = 'HIGH';
          riskColor = '#f97316';
        } else if (highestScore >= 50 || unresolved.length >= 2) {
          riskTier = 'MEDIUM';
          riskColor = '#f59e0b';
        }

        const categoryCounts = {};
        for (const c of bComplaints) {
          categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
        }

        return {
          building,
          totalIssues: count,
          unresolvedIssues: unresolved.length,
          highestImpactScore: highestScore,
          hasEmergency,
          riskTier,
          riskColor,
          categoryCounts
        };
      });

      return sendJson(200, heatmap);
    }

    // 12. ANALYTICS: RECURRING PATTERNS (GET /api/analytics/recurring)
    if (pathname === '/api/analytics/recurring' && method === 'GET') {
      const allComplaints = db.prepare('SELECT * FROM complaints').all().map(r => formatComplaintRow(r, db));
      const clusters = {};

      for (const c of allComplaints) {
        const key = `${c.building}::${c.category}`;
        if (!clusters[key]) {
          clusters[key] = {
            building: c.building,
            category: c.category,
            count: 0,
            tickets: [],
            rooms: new Set(),
            highestScore: 0
          };
        }
        clusters[key].count++;
        clusters[key].tickets.push(c.id);
        clusters[key].rooms.add(c.room);
        if (c.impactScore > clusters[key].highestScore) {
          clusters[key].highestScore = c.impactScore;
        }
      }

      const patterns = [];
      for (const [key, cluster] of Object.entries(clusters)) {
        if (cluster.count >= 2) {
          let rec = `Recurring ${cluster.category.toLowerCase()} issues detected across ${cluster.building}. Inspect central supply and junction boxes.`;
          if (cluster.category === 'Electrical') {
            rec = `Repeated power/lighting disruptions in ${cluster.building}. Schedule electrical circuit breaker audit.`;
          } else if (cluster.category === 'Plumbing') {
            rec = `Multiple water leaks detected in ${cluster.building}. Check water pressure regulator and riser pipes.`;
          }

          patterns.push({
            building: cluster.building,
            category: cluster.category,
            incidentCount: cluster.count,
            highestImpactScore: cluster.highestScore,
            affectedRooms: Array.from(cluster.rooms),
            ticketIds: cluster.tickets,
            predictiveRecommendation: rec
          });
        }
      }

      return sendJson(200, patterns);
    }

    // 13. STAFF: DIRECTORY (GET /api/staff)
    if (pathname === '/api/staff' && method === 'GET') {
      const staffRows = db.prepare('SELECT * FROM staff').all();
      const activeComplaints = db.prepare("SELECT assigned_to, assigned_staff_id FROM complaints WHERE status != 'Resolved'").all();

      const result = staffRows.map(s => {
        const activeCount = activeComplaints.filter(c => 
          (c.assigned_staff_id && c.assigned_staff_id === s.id) ||
          (c.assigned_to && c.assigned_to.includes(s.name.split(' ')[0]))
        ).length;

        return {
          id: s.id,
          name: s.name,
          role: s.role,
          department: s.department,
          email: s.email,
          phone: s.phone,
          specialties: s.specialties,
          shift: s.shift,
          activeWorkloadCount: activeCount
        };
      });

      return sendJson(200, result);
    }

    // 14. DEMO: RESET SEED DATA (POST /api/demo/reset)
    if (pathname === '/api/demo/reset' && method === 'POST') {
      seedData(db);
      return sendJson(200, {
        success: true,
        message: 'CampusPulse database reset to standard hackathon demo dataset.'
      });
    }

    // Unmatched API endpoint
    return sendJson(404, { error: `Endpoint ${pathname} not found on CampusPulse REST API` });

  } catch (err) {
    console.error('API Error:', err);
    return sendJson(500, {
      error: 'Internal server error',
      message: err.message
    });
  }
}

module.exports = {
  handleApi
};

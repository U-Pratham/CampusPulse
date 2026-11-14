/**
 * CampusPulse - Full-Stack Backend & SQLite Verification Suite
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('../server/server.js');
const { DB_PATH } = require('../server/db.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('⚡ STARTING FULL-STACK CAMPUSPULSE BACKEND & SQLITE AUDIT');
  console.log('======================================================================\n');

  // Start test server on dynamic port (e.g. 4040)
  const TEST_PORT = 4040;
  const serverInstance = await startServer(TEST_PORT);

  const baseOpt = {
    hostname: '127.0.0.1',
    port: TEST_PORT
  };

  try {
    // 1. Database File Persistence Check
    console.log('--- TEST SUITE 1: SQLITE DATABASE PERSISTENCE ---');
    assert(fs.existsSync(DB_PATH), `SQLite database file exists at ${DB_PATH}`);
    const stats = fs.statSync(DB_PATH);
    assert(stats.size > 0, `SQLite database file has active content (${stats.size} bytes)`);

    // 2. Health Check
    console.log('\n--- TEST SUITE 2: API HEALTH & METADATA ---');
    const health = await request({ ...baseOpt, path: '/api/health', method: 'GET' });
    assert(health.statusCode === 200, 'GET /api/health returned 200 OK');
    assert(health.data.database.includes('SQLite'), 'Database engine confirmed as SQLite in health response');
    assert(health.data.engine.includes('Impact Engine'), 'Impact Engine metadata present');

    // 3. Static Asset Serving
    console.log('\n--- TEST SUITE 3: STATIC ASSETS SERVING ---');
    const indexRes = await request({ ...baseOpt, path: '/', method: 'GET' });
    assert(indexRes.statusCode === 200, 'GET / returns index.html (200 OK)');
    assert(indexRes.headers['content-type'].includes('text/html'), 'Content-Type is text/html');
    assert(indexRes.raw.includes('CampusPulse'), 'HTML body contains CampusPulse branding');

    const cssRes = await request({ ...baseOpt, path: '/css/styles.css', method: 'GET' });
    assert(cssRes.statusCode === 200, 'GET /css/styles.css returns stylesheet (200 OK)');
    assert(cssRes.headers['content-type'].includes('text/css'), 'CSS Content-Type is text/css');

    // 4. Authentication & RBAC Sessions
    console.log('\n--- TEST SUITE 4: AUTHENTICATION & RBAC ---');
    const loginRes = await request({
      ...baseOpt,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'anita.d@campus.edu', password: 'admin2026', role: 'admin' });

    assert(loginRes.statusCode === 200, 'POST /api/auth/login returns 200 OK');
    assert(loginRes.data.token && loginRes.data.token.length > 20, 'Crypto session token generated');
    assert(loginRes.data.user.role === 'admin', 'Authenticated user role is admin');
    const adminToken = loginRes.data.token;

    const meRes = await request({
      ...baseOpt,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(meRes.statusCode === 200, 'GET /api/auth/me returns 200 with Bearer token');
    assert(meRes.data.user.email === 'anita.d@campus.edu', 'Session user identity verified');

    // 5. Complaints Backlog & Prioritization
    console.log('\n--- TEST SUITE 5: COMPLAINTS BACKLOG & IMPACT RANKING ---');
    const complaintsRes = await request({ ...baseOpt, path: '/api/complaints', method: 'GET' });
    assert(complaintsRes.statusCode === 200, 'GET /api/complaints returns 200 OK');
    assert(Array.isArray(complaintsRes.data), 'Complaints returned as JSON array');
    assert(complaintsRes.data.length >= 6, `Backlog contains seeded complaints (Count: ${complaintsRes.data.length})`);

    const topTicket = complaintsRes.data[0];
    assert(topTicket.impactRank === 1, 'First ticket has impactRank = 1');
    assert(topTicket.isEmergencyOverride === true, 'Top ticket is safety emergency override');
    assert(topTicket.impactScore === 100, 'Top ticket has locked max score of 100/100');

    // 6. Submitting New Complaint via REST API
    console.log('\n--- TEST SUITE 6: SERVER-SIDE CLASSIFICATION & IMPACT CALCULATION ---');
    const newComplaintPayload = {
      title: 'Fan on the verge of falling and vibrating violently',
      description: 'Ceiling fan mounting bolts are detached. Motor wobbling heavily above student seats in lecture hall.',
      building: 'Academic Block A',
      room: 'LH304',
      category: 'Other', // Intentional generic to test server-side classifier
      submittedBy: 'Aarav Sharma',
      userEmail: 'aarav.s@campus.edu'
    };

    const createRes = await request({
      ...baseOpt,
      path: '/api/complaints',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, newComplaintPayload);

    assert(createRes.statusCode === 201, 'POST /api/complaints returns 201 Created');
    assert(createRes.data.id && createRes.data.id.startsWith('CP-'), `Assigned sequence ID: #${createRes.data.id}`);
    assert(createRes.data.category === 'Safety', `Server-side classifier mapped to Safety (Got: ${createRes.data.category})`);
    assert(createRes.data.priorityCode === 'P1', `Elevated to high priority P1 (Got: ${createRes.data.priorityCode})`);
    assert(createRes.data.impactScore >= 75, `Impact score calculated deterministically: ${createRes.data.impactScore}/100`);

    const createdId = createRes.data.id;

    // 7. Crowd Endorsement & Anti-Inflation Constraint
    console.log('\n--- TEST SUITE 7: CROWD ENDORSEMENT & ANTI-INFLATION ---');
    const endorseRes1 = await request({
      ...baseOpt,
      path: `/api/complaints/${createdId}/endorse`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { studentName: 'Priya Verma', studentEmail: 'priya.v@campus.edu' });

    assert(endorseRes1.statusCode === 200 && endorseRes1.data.success === true, 'First crowd endorsement succeeded');
    assert(endorseRes1.data.ticket.duplicateCount === 1, 'Duplicate/endorsement count incremented to 1');

    // Repeated endorsement by same student
    const endorseRes2 = await request({
      ...baseOpt,
      path: `/api/complaints/${createdId}/endorse`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { studentName: 'Priya Verma', studentEmail: 'priya.v@campus.edu' });

    assert(endorseRes2.statusCode === 200, 'Duplicate check handled gracefully');
    assert(endorseRes2.data.alreadyEndorsed === true, 'Anti-inflation constraint blocked repeated endorsement from same email');

    // 8. Triage & Status Update
    console.log('\n--- TEST SUITE 8: OPERATIONAL TRIAGE & AUDIT TIMELINE ---');
    const updateRes = await request({
      ...baseOpt,
      path: `/api/complaints/${createdId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      status: 'In Progress',
      assignedTo: 'Ramesh Kumar (HVAC Specialist)',
      resolutionNotes: 'Maintenance dispatched with hydraulic scaffold.'
    });

    assert(updateRes.statusCode === 200, 'PATCH /api/complaints/:id returned 200 OK');
    assert(updateRes.data.status === 'In Progress', 'Status updated to In Progress in SQLite');
    assert(updateRes.data.assignedTo.includes('Ramesh Kumar'), 'Crew assigned in SQLite');
    assert(updateRes.data.timeline.length >= 2, 'Operational timeline recorded in SQLite');

    // 9. Analytics: Summary, Heatmap & Recurring
    console.log('\n--- TEST SUITE 9: INFRASTRUCTURE ANALYTICS & HEATMAP ---');
    const summaryRes = await request({ ...baseOpt, path: '/api/analytics/summary', method: 'GET' });
    assert(summaryRes.statusCode === 200, 'GET /api/analytics/summary returned 200 OK');
    assert(summaryRes.data.total > 0, `Total complaints counted: ${summaryRes.data.total}`);
    assert(summaryRes.data.avgResolutionHours >= 0, `Average resolution time: ${summaryRes.data.avgResolutionHours} hrs`);

    const heatmapRes = await request({ ...baseOpt, path: '/api/analytics/heatmap', method: 'GET' });
    assert(heatmapRes.statusCode === 200, 'GET /api/analytics/heatmap returned 200 OK');
    assert(heatmapRes.data.length === 9, 'All 9 campus buildings aggregated in heatmap');
    const workshopBldg = heatmapRes.data.find(b => b.building === 'Engineering Workshop');
    assert(workshopBldg.riskTier === 'CRITICAL', 'Engineering Workshop correctly classified as CRITICAL tier');

    const recurringRes = await request({ ...baseOpt, path: '/api/analytics/recurring', method: 'GET' });
    assert(recurringRes.statusCode === 200, 'GET /api/analytics/recurring returned 200 OK');
    assert(Array.isArray(recurringRes.data), 'Recurring patterns returned as array');

    // 10. Staff Directory
    console.log('\n--- TEST SUITE 10: STAFF WORKLOAD DIRECTORY ---');
    const staffRes = await request({ ...baseOpt, path: '/api/staff', method: 'GET' });
    assert(staffRes.statusCode === 200, 'GET /api/staff returned 200 OK');
    assert(staffRes.data.length === 5, '5 maintenance crew members returned');
    assert(staffRes.data[0].activeWorkloadCount !== undefined, 'Active workload count computed via SQL join');

    // 11. Demo Data Reset API
    console.log('\n--- TEST SUITE 11: DEMO RESET RESTORATION ---');
    const resetRes = await request({
      ...baseOpt,
      path: '/api/demo/reset',
      method: 'POST'
    });
    assert(resetRes.statusCode === 200, 'POST /api/demo/reset succeeded');
    const afterReset = await request({ ...baseOpt, path: '/api/complaints', method: 'GET' });
    assert(afterReset.data.length === 6, 'Complaints reset back to 6 base seed tickets in SQLite');

  } finally {
    serverInstance.close();
  }

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('🎉 ALL BACKEND & SQLITE TESTS PASSED WITH 100% SUCCESS RATE!');
  } else {
    console.error('⚠️ SOME TESTS FAILED');
  }
  console.log('======================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

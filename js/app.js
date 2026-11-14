/**
 * CampusPulse - Core Application Controller
 * 
 * Powered by the Impact-Based Prioritization Engine:
 * - Live multi-factor impact score calculator
 * - Safety emergency override triggers
 * - Duplicate detection & crowd endorsement (+Impact boost)
 * - Explainable score breakdown visualization modal
 * - Dynamic ranking (Impact vs Time)
 */

const App = (() => {
  const AUTH_STORAGE_KEY = 'campuspulse_auth_user';

  const DEMO_PERSONAS = {
    student: {
      name: 'Aarav Sharma',
      email: 'aarav.s@campus.edu',
      role: 'student',
      department: 'CS & IT Dept',
      room: 'Room 204 • B.Tech 2024',
      avatar: 'ST'
    },
    admin: {
      name: 'Anita Desai (Supervisor)',
      email: 'anita.d@campus.edu',
      role: 'admin',
      department: 'Facility Management Ops',
      room: 'Central Admin Wing',
      avatar: 'AD'
    }
  };

  let currentUser = null;
  let currentRole = 'student'; // 'student' | 'admin'
  let loginSelectedRole = 'student'; // 'student' | 'admin'
  let currentView = 'student-overview';
  let currentSortMode = 'impact'; // 'impact' (default) | 'time'
  let uploadedImageBase64 = null;
  let activeModalTicket = null;
  let latestClassification = null;
  let latestImpactEval = null;
  let activeDuplicateMatch = null;

  // Relative time helper
  function timeAgo(dateString) {
    if (!dateString) return 'recently';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval === 1 ? '1 day ago' : `${interval} days ago`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval === 1 ? '1 hour ago' : `${interval} hours ago`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval === 1 ? '1 min ago' : `${interval} mins ago`;
    return 'just now';
  }

  // Toast Notifications
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '🚨';

    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 3600);
  }

  // Initialize
  function init() {
    populateBuildingDropdowns();
    populateStaffDropdowns();
    setupFormLiveListeners();
    setupDragDropZone();

    // Store update subscriptions
    Store.subscribe((event, payload) => {
      refreshAllViews();
    });

    checkAuth();
    refreshAllViews();

    setTimeout(() => {
      showToast('Impact-Based Prioritization Engine active. Tickets ranked by campus disruption.', 'success');
    }, 600);
  }

  function populateBuildingDropdowns() {
    const bldgSelect = document.getElementById('complaintBuilding');
    if (!bldgSelect) return;
    bldgSelect.innerHTML = '<option value="">Select Campus Building...</option>';
    for (const bldg of Store.BUILDINGS) {
      const opt = document.createElement('option');
      opt.value = bldg;
      opt.textContent = bldg;
      bldgSelect.appendChild(opt);
    }
  }

  function populateStaffDropdowns() {
    const staffSelect = document.getElementById('modalAssignSelect');
    if (!staffSelect) return;
    staffSelect.innerHTML = '<option value="">Unassigned</option>';
    const staffList = Store.getStaff();
    for (const staff of staffList) {
      const opt = document.createElement('option');
      opt.value = `${staff.name} (${staff.role})`;
      opt.textContent = `${staff.name} — ${staff.role} (${staff.department})`;
      staffSelect.appendChild(opt);
    }
  }

  function updateQuickCategoryPills(activeCat) {
    const pills = document.querySelectorAll('.quick-cat-pill');
    pills.forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-cat') === activeCat);
    });
  }

  function selectQuickCategory(cat) {
    const catSelect = document.getElementById('detectedCategorySelect');
    if (catSelect) {
      catSelect.value = cat;
    }
    updateQuickCategoryPills(cat);

    const titleInput = document.getElementById('complaintTitle');
    const descInput = document.getElementById('complaintDescription');
    const bldgSelect = document.getElementById('complaintBuilding');
    const roomInput = document.getElementById('complaintRoom');

    const title = titleInput ? titleInput.value : '';
    const desc = descInput ? descInput.value : '';
    const bldg = bldgSelect ? bldgSelect.value : '';
    const room = roomInput ? roomInput.value : '';

    if (title.length > 2 || bldg) {
      latestImpactEval = ImpactEngine.evaluateImpact({
        title,
        description: desc,
        category: cat,
        building: bldg,
        room
      });
      updateLiveImpactMeter(latestImpactEval);
    }
  }

  // Live Listeners for Classification, Duplicate Detection & Impact Engine
  function setupFormLiveListeners() {
    const titleInput = document.getElementById('complaintTitle');
    const descInput = document.getElementById('complaintDescription');
    const bldgSelect = document.getElementById('complaintBuilding');
    const roomInput = document.getElementById('complaintRoom');
    const catSelect = document.getElementById('detectedCategorySelect');

    const handleFormInputs = () => {
      const title = titleInput ? titleInput.value : '';
      const desc = descInput ? descInput.value : '';
      const bldg = bldgSelect ? bldgSelect.value : '';
      const room = roomInput ? roomInput.value : '';

      // 1. Rule-Based Classification
      if (title.length > 2 || desc.length > 2) {
        latestClassification = IssueClassifier.classify(title, desc);
        if (catSelect && latestClassification.category) {
          catSelect.value = latestClassification.category;
          updateQuickCategoryPills(latestClassification.category);
        }
      }

      const activeCat = catSelect ? catSelect.value : (latestClassification ? latestClassification.category : 'Other');
      updateQuickCategoryPills(activeCat);

      // 2. Real-Time Impact Evaluation
      if (title.length > 2 || bldg) {
        latestImpactEval = ImpactEngine.evaluateImpact({
          title,
          description: desc,
          category: activeCat,
          building: bldg,
          room
        });
        updateLiveImpactMeter(latestImpactEval);
      } else {
        resetLiveImpactMeter();
      }

      // 3. Duplicate Detection
      if (bldg && (title.length > 3 || room.length > 1)) {
        const dupResult = DuplicateDetector.checkDuplicate({
          building: bldg,
          room: room,
          title: title,
          description: desc,
          category: activeCat
        }, Store.getComplaints());

        activeDuplicateMatch = dupResult.isDuplicate ? dupResult : null;
        updateDuplicateBanner(dupResult);
      } else {
        updateDuplicateBanner({ isDuplicate: false });
      }
    };

    if (titleInput) titleInput.addEventListener('input', handleFormInputs);
    if (descInput) descInput.addEventListener('input', handleFormInputs);
    if (bldgSelect) bldgSelect.addEventListener('change', handleFormInputs);
    if (roomInput) roomInput.addEventListener('input', handleFormInputs);
    if (catSelect) catSelect.addEventListener('change', () => {
      if (catSelect) updateQuickCategoryPills(catSelect.value);
      handleFormInputs();
    });
  }

  // Live Impact Meter UI updater
  function updateLiveImpactMeter(evaluation) {
    const card = document.getElementById('liveImpactCard');
    const scoreBox = document.getElementById('liveImpactScore');
    const tierLabel = document.getElementById('liveScoreTier');
    const formulaHint = document.getElementById('liveFormulaSummary');
    const enginePill = document.getElementById('liveEnginePill');

    const sevLabel = document.getElementById('liveSeverityLabel');
    const sevBar = document.getElementById('liveSeverityBar');
    const locLabel = document.getElementById('liveLocationLabel');
    const locBar = document.getElementById('liveLocationBar');
    const popLabel = document.getElementById('livePopulationLabel');
    const popBar = document.getElementById('livePopulationBar');

    if (!scoreBox) return;

    scoreBox.textContent = evaluation.finalScore;

    if (evaluation.isEmergency) {
      if (card) card.classList.add('emergency-border');
      scoreBox.style.color = '#ef4444';
      if (tierLabel) tierLabel.innerHTML = `<span style="color: #f87171;">🚨 P0 - EMERGENCY OVERRIDE</span>`;
      if (formulaHint) formulaHint.textContent = 'Safety Hazard Bypass: Locked to Max Score (100 pts)';
      if (enginePill) {
        enginePill.style.background = 'rgba(239, 68, 68, 0.25)';
        enginePill.style.color = '#f87171';
        enginePill.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        enginePill.textContent = 'Emergency Trigger';
      }
    } else {
      if (card) card.classList.remove('emergency-border');
      if (enginePill) {
        enginePill.style.background = 'rgba(79, 70, 229, 0.2)';
        enginePill.style.color = '#818cf8';
        enginePill.style.borderColor = 'rgba(79, 70, 229, 0.4)';
        enginePill.textContent = 'Multi-Factor Engine';
      }

      if (evaluation.priorityCode === 'P1' || evaluation.finalScore >= 80) {
        scoreBox.style.color = '#fb923c';
        if (tierLabel) tierLabel.innerHTML = `<span style="color: #fb923c;">P1 - High Impact</span>`;
      } else if (evaluation.priorityCode === 'P2' || evaluation.finalScore >= 50) {
        scoreBox.style.color = '#60a5fa';
        if (tierLabel) tierLabel.innerHTML = `<span style="color: #60a5fa;">P2 - Medium Impact</span>`;
      } else {
        scoreBox.style.color = '#34d399';
        if (tierLabel) tierLabel.innerHTML = `<span style="color: #34d399;">P3 - Low Impact</span>`;
      }
      if (formulaHint) formulaHint.textContent = evaluation.formulaSummary;
    }

    // Dimensions progress
    const b = evaluation.breakdown;
    if (sevLabel) sevLabel.textContent = `${b.severity.weight} / ${b.severity.max} pts`;
    if (sevBar) sevBar.style.width = `${b.severity.percentage}%`;

    if (locLabel) locLabel.textContent = `${b.location.weight} / ${b.location.max} pts`;
    if (locBar) locBar.style.width = `${b.location.percentage}%`;

    if (popLabel) popLabel.textContent = `${b.population.weight} / ${b.population.max} pts`;
    if (popBar) popBar.style.width = `${b.population.percentage}%`;
  }

  function resetLiveImpactMeter() {
    const card = document.getElementById('liveImpactCard');
    const scoreBox = document.getElementById('liveImpactScore');
    const tierLabel = document.getElementById('liveScoreTier');
    const formulaHint = document.getElementById('liveFormulaSummary');

    if (card) card.classList.remove('emergency-border');
    if (scoreBox) { scoreBox.textContent = '--'; scoreBox.style.color = 'var(--text-main)'; }
    if (tierLabel) tierLabel.textContent = 'Awaiting Input';
    if (formulaHint) formulaHint.textContent = 'Fill title, building & room to calculate impact';
  }

  // Duplicate Warning Banner with Endorsement Action
  function updateDuplicateBanner(dupResult) {
    const banner = document.getElementById('duplicateAlertBox');
    const details = document.getElementById('duplicateDetailsText');
    const card = document.getElementById('duplicateTicketCard');

    if (!banner || !details || !card) return;

    if (dupResult.isDuplicate && dupResult.matchedComplaint) {
      const match = dupResult.matchedComplaint;
      banner.classList.add('active');
      details.innerHTML = `An existing complaint matches this location with <strong>${dupResult.confidence}% confidence</strong>: <strong>${dupResult.reasons.join(' • ')}</strong>.`;
      
      card.innerHTML = `
        <div>
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">
            #${match.id}: ${match.title}
          </div>
          <div style="font-size: 0.74rem; color: var(--text-dim); margin-top: 3px;">
            Current Impact: <span class="impact-badge impact-badge-${(match.priorityCode || 'p2').toLowerCase()}">${match.impactScore}/100</span> • Status: ${match.status}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="App.handleEndorseDuplicate('${match.id}')">
            👍 Endorse This Issue (+Impact)
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="App.openTicketModal('${match.id}')">
            View Ticket
          </button>
        </div>
      `;
    } else {
      banner.classList.remove('active');
      card.innerHTML = '';
    }
  }

  // Endorse Duplicate Issue Action with Anti-Inflation Protection
  function handleEndorseDuplicate(ticketId) {
    const submitterName = document.getElementById('submitterName')?.value.trim() || 'A student';
    const result = Store.endorseComplaint(ticketId, submitterName);
    if (!result) return;

    if (result.alreadyEndorsed) {
      showToast(`You have already endorsed #${ticketId}. Anti-inflation protection active: multiple endorsements from the same student are blocked.`, 'warning');
      return;
    }

    const updated = result.ticket;
    showToast(`Endorsed #${updated.id}! Crowd validation boosted Impact Score to ${updated.impactScore}/100.`, 'success');
    document.getElementById('complaintForm')?.reset();
    clearImagePreview();
    updateDuplicateBanner({ isDuplicate: false });
    resetLiveImpactMeter();
    navigate('student-reports');
  }

  // PRIORITY 2: Filter Operations Table from Heatmap Card Click
  function filterByBuilding(buildingName) {
    if (currentRole !== 'admin') {
      switchRole('admin');
    }
    navigate('admin-dashboard');
    const searchInput = document.getElementById('adminSearchInput');
    if (searchInput) {
      searchInput.value = buildingName;
      renderAdminTable();
    }
    showToast(`Operations filtered for ${buildingName}`, 'info');
  }

  // Drag & Drop Image Handling
  function setupDragDropZone() {
    const dropzone = document.getElementById('uploadDropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) processImageFile(files[0]);
    });
  }

  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) processImageFile(file);
  }

  function processImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image (JPG, PNG, WEBP)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file too large. Please select under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        uploadedImageBase64 = canvas.toDataURL('image/jpeg', 0.75);
        showImagePreview(uploadedImageBase64);
        showToast('Photo evidence attached.', 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showImagePreview(src) {
    const dropzone = document.getElementById('uploadDropzone');
    const container = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('previewImgElement');

    if (dropzone) dropzone.style.display = 'none';
    if (container) container.classList.add('active');
    if (imgEl) imgEl.src = src;
  }

  function clearImagePreview() {
    uploadedImageBase64 = null;
    const fileInput = document.getElementById('issueImageInput');
    if (fileInput) fileInput.value = '';

    const dropzone = document.getElementById('uploadDropzone');
    const container = document.getElementById('imagePreviewContainer');
    const imgEl = document.getElementById('previewImgElement');

    if (dropzone) dropzone.style.display = 'block';
    if (container) container.classList.remove('active');
    if (imgEl) imgEl.src = '';
  }

  // Handle Form Submission
  function handleComplaintSubmit(event) {
    event.preventDefault();

    const title = document.getElementById('complaintTitle').value.trim();
    const building = document.getElementById('complaintBuilding').value;
    const room = document.getElementById('complaintRoom').value.trim();
    const description = document.getElementById('complaintDescription').value.trim();
    const submitterName = document.getElementById('submitterName').value.trim() || (currentUser ? currentUser.name : 'Student User');
    const submitterEmail = document.getElementById('submitterEmail').value.trim() || (currentUser ? currentUser.email : 'student@campus.edu');
    const category = document.getElementById('detectedCategorySelect').value;

    if (!title || !building || !room || !description) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    const isDup = activeDuplicateMatch && activeDuplicateMatch.isDuplicate;

    const newTicket = Store.addComplaint({
      title,
      building,
      room,
      description,
      category,
      submittedBy: submitterName,
      userEmail: submitterEmail,
      imageUrl: uploadedImageBase64,
      imageFileName: uploadedImageBase64 ? 'student_upload.jpg' : null,
      isDuplicate: isDup,
      duplicateOf: isDup ? activeDuplicateMatch.matchedComplaint.id : null
    });

    event.target.reset();
    clearImagePreview();
    updateDuplicateBanner({ isDuplicate: false });
    resetLiveImpactMeter();
    activeDuplicateMatch = null;
    latestClassification = null;
    latestImpactEval = null;

    // Restore verified student credentials
    if (currentUser) {
      const nameEl = document.getElementById('submitterName');
      const emailEl = document.getElementById('submitterEmail');
      if (nameEl) nameEl.value = currentUser.name;
      if (emailEl) emailEl.value = currentUser.email;
    }

    showToast(`Ticket #${newTicket.id} logged! Impact Score: ${newTicket.impactScore}/100 (${newTicket.priorityTier})`, 'success');
    navigate('student-reports');
  }

  // ========================================================
  // AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
  // ========================================================
  function checkAuth() {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
      if (stored) {
        const user = JSON.parse(stored);
        if (user && user.role) {
          currentUser = user;
          currentRole = user.role;
          applyUserSession(currentUser, false);
          hideLoginOverlay();
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
    }

    // Default unauthenticated: display login portal
    currentUser = null;
    showLoginOverlay();
  }

  function showLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.add('active');
  }

  function hideLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function setLoginRole(role) {
    loginSelectedRole = role;
    const tabStudent = document.getElementById('loginTabStudent');
    const tabAdmin = document.getElementById('loginTabAdmin');
    const emailInput = document.getElementById('loginEmail');

    if (role === 'student') {
      if (tabStudent) tabStudent.classList.add('active');
      if (tabAdmin) tabAdmin.classList.remove('active');
      if (emailInput && (!emailInput.value || emailInput.value === 'anita.d@campus.edu')) {
        emailInput.value = 'aarav.s@campus.edu';
      }
    } else {
      if (tabAdmin) tabAdmin.classList.add('active');
      if (tabStudent) tabStudent.classList.remove('active');
      if (emailInput && (!emailInput.value || emailInput.value === 'aarav.s@campus.edu')) {
        emailInput.value = 'anita.d@campus.edu';
      }
    }
  }

  function quickDemoLogin(role) {
    const persona = DEMO_PERSONAS[role] || DEMO_PERSONAS.student;
    loginUser(persona);
  }

  function handleLoginFormSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const email = emailInput ? emailInput.value.trim() : '';

    let role = loginSelectedRole;
    if (email.toLowerCase().includes('admin') || email.toLowerCase().includes('anita')) {
      role = 'admin';
    }

    let persona = DEMO_PERSONAS[role];
    if (!persona) {
      persona = {
        name: email.split('@')[0] || (role === 'admin' ? 'Facility Admin' : 'Student User'),
        email: email || (role === 'admin' ? 'admin@campus.edu' : 'student@campus.edu'),
        role: role,
        department: role === 'admin' ? 'Facility Management Ops' : 'Student Body',
        room: role === 'admin' ? 'Central Admin Wing' : 'Campus Hostel',
        avatar: role === 'admin' ? 'AD' : 'ST'
      };
    } else if (email && email !== persona.email) {
      persona = Object.assign({}, persona, {
        email,
        name: email.split('@')[0].replace('.', ' ').toUpperCase()
      });
    }

    loginUser(persona);
  }

  function loginUser(user) {
    currentUser = user;
    currentRole = user.role;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('Storage quota exceeded or error:', e);
    }

    applyUserSession(user, true);
    hideLoginOverlay();

    showToast(`Welcome, ${user.name}! Signed into ${user.role === 'admin' ? 'Facility Operations Desk' : 'Student Portal'}.`, 'success');

    if (user.role === 'admin') {
      navigate('admin-dashboard');
    } else {
      navigate('student-overview');
    }
  }

  function logout() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {}

    currentUser = null;
    showToast('You have signed out of CampusPulse.', 'info');
    showLoginOverlay();
  }

  function applyUserSession(user, showNotice = false) {
    if (!user) return;
    currentRole = user.role;

    // Sidebar Session Card
    const sessionRoleBadge = document.getElementById('sessionRoleBadge');
    const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserDept = document.getElementById('sidebarUserDept');
    const studentNav = document.getElementById('studentNavSection');
    const adminNav = document.getElementById('adminNavSection');

    if (sessionRoleBadge) {
      sessionRoleBadge.textContent = user.role === 'admin' ? 'Facility Admin' : 'Student';
      sessionRoleBadge.style.color = user.role === 'admin' ? '#f59e0b' : 'var(--accent-cyan)';
    }
    if (sidebarUserAvatar) sidebarUserAvatar.textContent = user.avatar || (user.name[0] || 'U');
    if (sidebarUserName) sidebarUserName.textContent = user.name;
    if (sidebarUserDept) sidebarUserDept.textContent = user.department || (user.role === 'admin' ? 'Facility Management' : 'Student');

    // Header Profile & Badge
    const roleBadgeText = document.getElementById('roleBadgeText');
    const userAvatar = document.getElementById('userAvatar');
    const userNameLabel = document.getElementById('userNameLabel');
    const userRoleSub = document.getElementById('userRoleSub');

    if (roleBadgeText) {
      roleBadgeText.textContent = user.role === 'admin' ? 'Facility Admin / Ops' : 'Student Mode';
    }
    if (userAvatar) userAvatar.textContent = user.avatar || (user.name[0] || 'U');
    if (userNameLabel) userNameLabel.textContent = user.name;
    if (userRoleSub) userRoleSub.textContent = user.department || user.room || 'Campus User';

    // Submitter inputs for new complaints
    const submitterName = document.getElementById('submitterName');
    const submitterEmail = document.getElementById('submitterEmail');
    if (submitterName && user.role === 'student') submitterName.value = user.name;
    if (submitterEmail && user.role === 'student') submitterEmail.value = user.email;

    // RBAC: Dynamic Navigation
    if (user.role === 'student') {
      if (studentNav) studentNav.style.display = 'block';
      if (adminNav) adminNav.style.display = 'none';
    } else {
      // Admin has full operations + student views preview
      if (studentNav) studentNav.style.display = 'block';
      if (adminNav) adminNav.style.display = 'block';
    }

    refreshAllViews();
  }

  // Backward-compatible role switching
  function switchRole(role) {
    quickDemoLogin(role);
  }

  function toggleRole() {
    switchRole(currentRole === 'student' ? 'admin' : 'student');
  }

  // Navigation Logic with Route Guarding
  function navigate(viewId) {
    // RBAC Route Guard: Block students from accessing admin operational views
    if (currentUser && currentUser.role === 'student') {
      if (viewId === 'admin-dashboard' || viewId === 'admin-analytics' || viewId === 'admin-staff') {
        showToast('🚨 Access Restricted: Facility Admin credentials required for Operations Desk & Analytics.', 'error');
        viewId = 'student-overview';
      }
    }

    currentView = viewId;

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    const views = document.querySelectorAll('.page-view');
    views.forEach(v => {
      v.classList.toggle('active', v.id === `view-${viewId}`);
    });

    const titleEl = document.getElementById('pageTitle');
    const breadcrumbEl = document.getElementById('pageBreadcrumb');

    const VIEW_META = {
      'student-overview': { title: 'Dashboard Overview', breadcrumb: 'Student Portal / Overview' },
      'student-submit': { title: 'Report New Issue', breadcrumb: 'Student Portal / Submit Issue' },
      'student-reports': { title: 'Track by Campus Impact', breadcrumb: 'Student Portal / Impact Ranked Complaints' },
      'admin-dashboard': { title: 'Impact Operations Desk', breadcrumb: 'Admin Operations / Priority Queue' },
      'admin-analytics': { title: 'Impact Analytics & SLAs', breadcrumb: 'Admin Operations / Metrics' },
      'admin-staff': { title: 'Maintenance Staff', breadcrumb: 'Admin Operations / Crew Directory' }
    };

    if (VIEW_META[viewId]) {
      if (titleEl) titleEl.textContent = VIEW_META[viewId].title;
      if (breadcrumbEl) breadcrumbEl.textContent = VIEW_META[viewId].breadcrumb;
    }

    if (viewId === 'admin-analytics') {
      setTimeout(() => AnalyticsEngine.renderAll(), 50);
    }

    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  // Sorting Control
  function setSorting(mode) {
    currentSortMode = mode;
    
    ['Student', 'Admin'].forEach(role => {
      const btnImpact = document.getElementById(`btnSortImpact${role}`);
      const btnTime = document.getElementById(`btnSortTime${role}`);
      if (btnImpact && btnTime) {
        btnImpact.classList.toggle('active', mode === 'impact');
        btnTime.classList.toggle('active', mode === 'time');
      }
    });

    showToast(`Sorted complaints by: ${mode === 'impact' ? 'Highest Impact Score' : 'Submission Time'}`, 'info');
    renderStudentReports();
    renderAdminTable();
  }

  // Render & Synchronize all views
  function refreshAllViews() {
    const complaints = Store.getComplaints(currentSortMode);
    const stats = Store.getStats();

    const studentCounter = document.getElementById('navStudentCount');
    if (studentCounter) studentCounter.textContent = complaints.length;

    const adminCounter = document.getElementById('navAdminPendingCount');
    if (adminCounter) adminCounter.textContent = stats.pending;

    checkHazardBanner(complaints);
    renderStudentRecentList(complaints);
    renderStudentReports();
    renderAdminTable();
    renderStaffDirectory();
    AnalyticsEngine.renderAll();
  }

  function checkHazardBanner(complaints) {
    const banner = document.getElementById('hazardAlertBanner');
    const bannerText = document.getElementById('hazardAlertText');
    if (!banner) return;

    const emergencies = complaints.filter(c => c.isEmergencyOverride && c.status !== 'Resolved');
    if (emergencies.length > 0) {
      banner.style.display = 'flex';
      const top = emergencies[0];
      if (bannerText) {
        bannerText.innerHTML = `<strong>${top.title}</strong> in <strong>${top.building} (${top.room})</strong> is pinned to <strong>Rank #1 (Score: 100/100)</strong> under safety override.`;
      }
      const bannerBtn = banner.querySelector('button');
      if (bannerBtn) {
        bannerBtn.onclick = () => App.openScoreExplanationModal(top.id);
      }
    } else {
      banner.style.display = 'none';
    }
  }

  // Student Overview: Recent complaints list
  function renderStudentRecentList(complaints) {
    const container = document.getElementById('studentRecentList');
    if (!container) return;

    const recent = complaints.slice(0, 5);
    if (recent.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No issues logged</div></div>`;
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Impact Rank</th>
            <th>Ticket</th>
            <th>Issue Details</th>
            <th>Location</th>
            <th>Impact Score</th>
            <th>Status</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const c of recent) {
      const rankClass = c.impactRank <= 3 ? `rank-${c.impactRank}` : '';
      const tierBadgeClass = `impact-badge-${(c.priorityCode || 'p2').toLowerCase()}`;

      html += `
        <tr>
          <td><span class="rank-chip ${rankClass}">#${c.impactRank}</span></td>
          <td>
            <span class="ticket-cell-id">#${c.id}</span>
            ${c.isOverdue ? `<div style="margin-top: 3px;"><span class="badge badge-overdue" style="font-size: 0.62rem;">⏱️ Overdue</span></div>` : ''}
          </td>
          <td>
            <div class="ticket-thumb-wrap">
              <img src="${c.imageUrl}" alt="${c.title}" class="thumb-mini">
              <div class="ticket-title-desc">
                <span class="ticket-title-text" title="${c.title}">${c.title}</span>
                <span class="badge badge-cat-${c.category.toLowerCase()}">${c.category}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${c.building}</div>
            <div class="ticket-loc-text">${c.room}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="impact-badge ${tierBadgeClass}">
                ${c.isEmergencyOverride ? '🚨 100' : c.impactScore + ' pts'}
              </span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.7rem;" title="View Score Explanation" onclick="App.openScoreExplanationModal('${c.id}')">
                Explain
              </button>
            </div>
          </td>
          <td>
            <span class="badge badge-status-${c.status.toLowerCase().replace(' ', '')}">${c.status}</span>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="App.openTicketModal('${c.id}')">Track</button>
          </td>
        </tr>
      `;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // Student Reports Card Grid
  function renderStudentReports() {
    const grid = document.getElementById('studentTicketsGrid');
    if (!grid) return;

    const catFilter = document.getElementById('studentCategoryFilter')?.value || 'ALL';
    const statusFilter = document.getElementById('studentStatusFilter')?.value || 'ALL';

    let list = Store.getComplaints(currentSortMode);

    if (catFilter !== 'ALL') list = list.filter(c => c.category === catFilter);
    if (statusFilter !== 'ALL') list = list.filter(c => c.status === statusFilter);

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No matching complaints found</div>
          <div class="empty-state-desc">Try clearing your filters or report a new issue.</div>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('student-submit')">Submit New Report</button>
        </div>
      `;
      return;
    }

    let html = '';
    for (const c of list) {
      const tierBadgeClass = `impact-badge-${(c.priorityCode || 'p2').toLowerCase()}`;
      const rankClass = c.impactRank <= 3 ? `rank-${c.impactRank}` : '';

      html += `
        <div class="ticket-card ${c.isEmergencyOverride ? 'emergency-card' : ''}">
          <div class="ticket-card-media">
            <img src="${c.imageUrl}" alt="${c.title}" onclick="App.openFullImage('${c.imageUrl}')" style="cursor: pointer;">
            <div class="ticket-card-badges">
              <span class="rank-chip ${rankClass}" style="box-shadow: 0 2px 6px rgba(0,0,0,0.5);">Rank #${c.impactRank}</span>
              <span class="impact-badge ${tierBadgeClass}">
                ${c.isEmergencyOverride ? '🚨 100/100 (Emergency)' : c.impactScore + '/100'}
              </span>
            </div>
          </div>
          <div class="ticket-card-body">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="ticket-cell-id">#${c.id}</span>
                ${c.isOverdue ? `<span class="badge badge-overdue" title="Overdue by ${c.overdueByHours}h against SLA">⏱️ Overdue (+${c.overdueByHours}h)</span>` : ''}
              </div>
              <span class="badge badge-status-${c.status.toLowerCase().replace(' ', '')}">${c.status}</span>
            </div>
            <h4 class="ticket-card-title">${c.title}</h4>
            <p class="ticket-card-desc">${c.description}</p>
            <div style="font-size: 0.76rem; color: var(--text-dim); margin-bottom: 8px;">
              📍 <strong>${c.building}</strong> • ${c.room}
            </div>

            <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.72rem; color: var(--text-muted);">${c.priorityTier}</span>
              <button type="button" style="background: transparent; border: none; color: var(--accent-cyan); font-size: 0.72rem; font-weight: 600; cursor: pointer;" onclick="App.openScoreExplanationModal('${c.id}')">
                Explain Score ↗
              </button>
            </div>

            <div class="ticket-card-meta">
              <span>Reported ${timeAgo(c.createdAt)}</span>
              <button class="btn btn-secondary btn-sm" onclick="App.openTicketModal('${c.id}')">Track Progress</button>
            </div>
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  // Admin Management Table
  function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('adminCategoryFilter')?.value || 'ALL';
    const statusFilter = document.getElementById('adminStatusFilter')?.value || 'ALL';
    const prioFilter = document.getElementById('adminPriorityFilter')?.value || 'ALL';

    let list = Store.getComplaints(currentSortMode);

    if (catFilter !== 'ALL') list = list.filter(c => c.category === catFilter);
    if (statusFilter !== 'ALL') list = list.filter(c => c.status === statusFilter);
    if (prioFilter !== 'ALL') list = list.filter(c => (c.priorityCode || 'P2') === prioFilter);

    if (searchTerm) {
      list = list.filter(c => {
        return (
          c.id.toLowerCase().includes(searchTerm) ||
          c.title.toLowerCase().includes(searchTerm) ||
          c.description.toLowerCase().includes(searchTerm) ||
          c.building.toLowerCase().includes(searchTerm) ||
          c.room.toLowerCase().includes(searchTerm) ||
          (c.assignedTo && c.assignedTo.toLowerCase().includes(searchTerm))
        );
      });
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">No matching complaints in backlog</div>
              <div class="empty-state-desc">Adjust filters or search parameters.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    for (const c of list) {
      const assignedInitials = c.assignedTo && c.assignedTo !== 'Unassigned'
        ? c.assignedTo.split(' ').map(n => n[0]).slice(0, 2).join('')
        : '?';

      const tierBadgeClass = `impact-badge-${(c.priorityCode || 'p2').toLowerCase()}`;
      const rankClass = c.impactRank <= 3 ? `rank-${c.impactRank}` : '';

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="rank-chip ${rankClass}">#${c.impactRank}</span>
              <div>
                <span class="impact-badge ${tierBadgeClass}">
                  ${c.isEmergencyOverride ? '🚨 100' : c.impactScore}
                </span>
                <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px;">
                  <a href="javascript:void(0)" onclick="App.openScoreExplanationModal('${c.id}')" style="color: var(--accent-cyan); text-decoration: none;">Explain ↗</a>
                </div>
              </div>
            </div>
          </td>
          <td>
            <span class="ticket-cell-id">#${c.id}</span>
            ${c.isOverdue ? `<div style="margin-top: 4px;"><span class="badge badge-overdue" title="Breached SLA limit by ${c.overdueByHours}h">⏱️ Overdue (+${c.overdueByHours}h)</span></div>` : ''}
          </td>
          <td>
            <div class="ticket-thumb-wrap">
              <img src="${c.imageUrl}" alt="${c.title}" class="thumb-mini" onclick="App.openFullImage('${c.imageUrl}')" style="cursor: pointer;">
              <div class="ticket-title-desc">
                <span class="ticket-title-text" title="${c.title}">${c.title}</span>
                <span class="ticket-loc-text">📍 ${c.building} • ${c.room}</span>
              </div>
            </div>
          </td>
          <td><span class="badge badge-cat-${c.category.toLowerCase()}">${c.category}</span></td>
          <td>
            <select class="filter-select" style="padding: 4px 8px; font-size: 0.75rem;" onchange="App.handleQuickStatusChange('${c.id}', this.value)">
              <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
          </td>
          <td>
            <div class="assignee-chip">
              <div class="assignee-avatar">${assignedInitials}</div>
              <span title="${c.assignedTo || 'Unassigned'}">${c.assignedTo ? c.assignedTo.split(' ')[0] + ' ' + (c.assignedTo.split(' ')[1] || '') : 'Unassigned'}</span>
            </div>
          </td>
          <td style="color: var(--text-dim); font-size: 0.76rem; white-space: nowrap;">
            ${timeAgo(c.createdAt)}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-primary btn-sm" onclick="App.openTicketModal('${c.id}')">Manage</button>
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = html;
  }

  // Staff Directory Grid
  function renderStaffDirectory() {
    const grid = document.getElementById('adminStaffGrid');
    if (!grid) return;

    const staffList = Store.getStaff();
    const complaints = Store.getComplaints();

    let html = '';
    for (const s of staffList) {
      const activeCount = complaints.filter(c => c.assignedTo && c.assignedTo.includes(s.name) && c.status !== 'Resolved').length;
      const initials = s.name.split(' ').map(n => n[0]).join('');

      html += `
        <div class="ticket-card" style="padding: 20px;">
          <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px;">
            <div class="avatar-circle" style="width: 48px; height: 48px; font-size: 1.1rem; background: linear-gradient(135deg, #4f46e5, #06b6d4);">
              ${initials}
            </div>
            <div>
              <h3 style="font-size: 1.05rem; font-weight: 700;">${s.name}</h3>
              <div style="font-size: 0.78rem; color: var(--accent-cyan); font-weight: 500;">${s.role}</div>
            </div>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
            Department: <strong>${s.department}</strong>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-subtle); font-size: 0.8rem;">
            <span>Active Workload:</span>
            <span class="badge ${activeCount > 0 ? 'badge-status-inprogress' : 'badge-status-resolved'}">
              ${activeCount} Assigned ${activeCount === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  // Quick status change from Admin Table
  function handleQuickStatusChange(id, newStatus) {
    Store.updateComplaint(id, {
      status: newStatus,
      timelineNote: `Admin updated status to ${newStatus}`
    });
    showToast(`Ticket #${id} status changed to ${newStatus}`, 'success');
  }

  // Modal 1: Score Explanation Modal (Visual Inspection of Algorithm)
  function openScoreExplanationModal(ticketId) {
    const list = Store.getComplaints();
    const ticket = list.find(c => c.id === ticketId);
    if (!ticket) return;

    const b = ticket.impactBreakdown || ImpactEngine.evaluateImpact(ticket).breakdown;

    document.getElementById('impactModalTitle').textContent = `Score Breakdown: #${ticket.id}`;
    document.getElementById('impactModalTicketSummary').textContent = `${ticket.title} (${ticket.building} • ${ticket.room})`;
    document.getElementById('impactModalTotalScore').textContent = `${ticket.impactScore} / 100`;
    document.getElementById('impactModalRankBadge').textContent = `Rank #${ticket.impactRank}`;
    document.getElementById('impactModalTierBadge').textContent = ticket.priorityTier || 'Priority Tier';

    const overrideBanner = document.getElementById('impactModalOverrideBanner');
    const overrideText = document.getElementById('impactModalOverrideText');
    if (ticket.isEmergencyOverride) {
      if (overrideBanner) overrideBanner.style.display = 'flex';
      if (overrideText) overrideText.textContent = `CRITICAL EMERGENCY OVERRIDE ACTIVE: Triggered by severe safety hazard. Standard queue bypassed to Rank #1.`;
    } else {
      if (overrideBanner) overrideBanner.style.display = 'none';
    }

    // Severity
    const sevScore = document.getElementById('impactModalSeverityScore');
    const sevBar = document.getElementById('impactModalSeverityBar');
    const sevRat = document.getElementById('impactModalSeverityRationale');
    if (sevScore) sevScore.textContent = `${b.severity.weight} / ${b.severity.max} pts`;
    if (sevBar) sevBar.style.width = `${b.severity.percentage}%`;
    if (sevRat) sevRat.textContent = b.severity.rationale;

    // Location
    const locScore = document.getElementById('impactModalLocationScore');
    const locBar = document.getElementById('impactModalLocationBar');
    const locRat = document.getElementById('impactModalLocationRationale');
    if (locScore) locScore.textContent = `${b.location.weight} / ${b.location.max} pts`;
    if (locBar) locBar.style.width = `${b.location.percentage}%`;
    if (locRat) locRat.textContent = `${b.location.tier}: ${b.location.rationale}`;

    // Population
    const popScore = document.getElementById('impactModalPopulationScore');
    const popBar = document.getElementById('impactModalPopulationBar');
    const popRat = document.getElementById('impactModalPopulationRationale');
    if (popScore) popScore.textContent = `${b.population.weight} / ${b.population.max} pts`;
    if (popBar) popBar.style.width = `${b.population.percentage}%`;
    if (popRat) popRat.textContent = `Estimated Impact: ${b.population.headcount}. ${b.population.rationale}`;

    // Formula calculation
    const calcEl = document.getElementById('impactModalFormulaCalculation');
    if (calcEl) {
      if (ticket.isEmergencyOverride) {
        calcEl.textContent = `Formula: Safety Override Activated -> Max Score: 100 / 100 pts (P0 Emergency)`;
      } else {
        calcEl.textContent = `Impact = S (${b.severity.weight}/40) + L (${b.location.weight}/30) + P (${b.population.weight}/30) = ${ticket.impactScore} / 100`;
      }
    }

    document.getElementById('impactModal').classList.add('active');
  }

  function closeImpactModal() {
    document.getElementById('impactModal').classList.remove('active');
  }

  function handleImpactModalOverlayClick(e) {
    if (e.target.id === 'impactModal') closeImpactModal();
  }

  // Modal 2: Ticket Details & Action Drawer
  function openTicketModal(id) {
    const list = Store.getComplaints();
    const ticket = list.find(c => c.id === id);
    if (!ticket) return;

    activeModalTicket = ticket;

    document.getElementById('modalTicketId').textContent = `#${ticket.id}`;
    document.getElementById('modalTicketTitle').textContent = ticket.title;
    document.getElementById('modalTicketLocation').textContent = `${ticket.building} — ${ticket.room}`;
    document.getElementById('modalTicketSubmitter').textContent = `${ticket.submittedBy} (${ticket.userEmail})`;
    document.getElementById('modalTicketAssignee').textContent = ticket.assignedTo || 'Unassigned';
    document.getElementById('modalTicketDesc').textContent = ticket.description;
    document.getElementById('modalTicketImg').src = ticket.imageUrl;

    document.getElementById('modalTicketBadges').innerHTML = `
      <span class="badge badge-cat-${ticket.category.toLowerCase()}">${ticket.category}</span>
      <span class="badge badge-status-${ticket.status.toLowerCase().replace(' ', '')}">${ticket.status}</span>
    `;

    const rankEl = document.getElementById('modalTicketRank');
    const impactEl = document.getElementById('modalTicketImpactBadge');
    if (rankEl) rankEl.textContent = `Rank #${ticket.impactRank}`;
    if (impactEl) {
      impactEl.textContent = `${ticket.impactScore} / 100 (${ticket.priorityCode || 'P2'})`;
      impactEl.className = `impact-badge impact-badge-${(ticket.priorityCode || 'p2').toLowerCase()}`;
    }

    const whyScoreBtn = document.querySelector('#modalTicketImpactLine button');
    if (whyScoreBtn) {
      whyScoreBtn.onclick = () => App.openScoreExplanationModal(ticket.id);
    }

    // RBAC: Operations controls for Admin vs Community Endorsement for Student
    const adminControls = document.getElementById('modalAdminControls');
    const studentActions = document.getElementById('modalStudentActions');
    const btnSaveModal = document.getElementById('btnSaveModalChanges');

    const isAdmin = currentUser && currentUser.role === 'admin';

    if (isAdmin) {
      if (adminControls) adminControls.style.display = 'block';
      if (studentActions) studentActions.style.display = 'none';
      if (btnSaveModal) btnSaveModal.style.display = 'inline-flex';

      document.getElementById('modalStatusSelect').value = ticket.status;
      document.getElementById('modalAssignSelect').value = ticket.assignedTo || '';
      document.getElementById('modalResolutionNote').value = ticket.resolutionNotes || '';
    } else {
      if (adminControls) adminControls.style.display = 'none';
      if (studentActions) studentActions.style.display = 'block';
      if (btnSaveModal) btnSaveModal.style.display = 'none';

      updateModalStudentEndorseState(ticket);
    }

    // Render Timeline
    const timelineContainer = document.getElementById('modalTimelineList');
    let timelineHtml = '';
    const timeline = ticket.timeline || [];

    for (let i = timeline.length - 1; i >= 0; i--) {
      const item = timeline[i];
      let bulletClass = '';
      if (item.status === 'Resolved') bulletClass = 'resolved';
      if (item.status === 'In Progress') bulletClass = 'progress';

      timelineHtml += `
        <div class="timeline-item">
          <div class="timeline-bullet ${bulletClass}"></div>
          <div class="timeline-header">
            <span class="timeline-status">${item.status}</span>
            <span class="timeline-time">${timeAgo(item.timestamp)}</span>
          </div>
          <div class="timeline-note">${item.note}</div>
        </div>
      `;
    }
    timelineContainer.innerHTML = timelineHtml;

    document.getElementById('ticketModal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('ticketModal').classList.remove('active');
    activeModalTicket = null;
  }

  function handleModalOverlayClick(e) {
    if (e.target.id === 'ticketModal') closeModal();
  }

  function saveModalChanges() {
    if (!activeModalTicket) return;

    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Unauthorized: Only Facility Admins can update operational status.', 'error');
      return;
    }

    const newStatus = document.getElementById('modalStatusSelect').value;
    const newAssignee = document.getElementById('modalAssignSelect').value;
    const noteText = document.getElementById('modalResolutionNote').value.trim();

    const updates = {
      status: newStatus,
      assignedTo: newAssignee || 'Unassigned',
      resolutionNotes: noteText || activeModalTicket.resolutionNotes
    };

    if (noteText) {
      updates.timelineNote = `Operational Note: ${noteText}`;
    }

    Store.updateComplaint(activeModalTicket.id, updates);
    showToast(`Ticket #${activeModalTicket.id} updated.`, 'success');
    closeModal();
  }

  function updateModalStudentEndorseState(ticket) {
    const badge = document.getElementById('modalEndorseCountBadge');
    const btn = document.getElementById('btnModalEndorse');
    const btnText = document.getElementById('btnModalEndorseText');
    const hint = document.getElementById('modalEndorseHint');

    const endorsements = ticket.endorsedBy || [];
    if (badge) badge.textContent = `${endorsements.length} Endorsement${endorsements.length === 1 ? '' : 's'}`;

    const studentName = currentUser ? currentUser.name : 'Student';
    const hasEndorsed = endorsements.some(n => n.toLowerCase().trim() === studentName.toLowerCase().trim());

    if (!btn || !btnText) return;

    if (ticket.status === 'Resolved') {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
      btnText.textContent = '✅ Issue Resolved by Facility Team';
      if (hint) hint.textContent = 'This issue has been resolved. Further community endorsements are closed.';
    } else if (hasEndorsed) {
      btn.disabled = true;
      btn.style.opacity = '0.85';
      btn.style.cursor = 'default';
      btnText.textContent = '✅ You have endorsed this issue (+Boosted)';
      if (hint) hint.textContent = 'Thank you! Your endorsement has verified crowd impact and elevated this ticket in the dispatch queue.';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btnText.textContent = '👍 Endorse This Issue (+Community Impact Boost)';
      if (hint) hint.textContent = 'Are you also experiencing this disruption? Endorse to verify community impact and elevate its priority in the operations queue.';
    }
  }

  function handleModalEndorse() {
    if (!activeModalTicket || !currentUser) return;

    const studentName = currentUser.name || 'Verified Student';
    const result = Store.endorseComplaint(activeModalTicket.id, studentName);

    if (result && result.alreadyEndorsed) {
      showToast('You have already endorsed this complaint.', 'warning');
      return;
    }

    showToast(`Endorsed #${activeModalTicket.id}! Community weight added to ticket.`, 'success');
    refreshAllViews();

    const updated = Store.getComplaints().find(c => c.id === activeModalTicket.id);
    if (updated) {
      activeModalTicket = updated;
      openTicketModal(updated.id);
    }
  }

  // Fullscreen Lightbox
  function openFullImage(src) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    if (modal && img) {
      img.src = src;
      modal.classList.add('active');
    }
  }

  function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (modal) modal.classList.remove('active');
  }

  // Reset Demo Data
  function handleResetDemo() {
    if (confirm('Reset CampusPulse to realistic sample demo complaints? This will restore initial hackathon data and rankings.')) {
      Store.resetDemoData();
      showToast('Sample demo complaints and impact scores restored!', 'success');
      navigate('student-overview');
    }
  }

  // Export JSON
  function exportComplaintsJson() {
    const data = Store.getComplaints(currentSortMode);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campuspulse_impact_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Exported complaints JSON file', 'info');
  }

  // Auto-init on DOMContentLoaded
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init,
    checkAuth,
    setLoginRole,
    quickDemoLogin,
    handleLoginFormSubmit,
    loginUser,
    logout,
    switchRole,
    toggleRole,
    navigate,
    toggleSidebar,
    setSorting,
    handleComplaintSubmit,
    handleEndorseDuplicate,
    handleModalEndorse,
    handleImageSelect,
    clearImagePreview,
    handleQuickStatusChange,
    openTicketModal,
    closeModal,
    handleModalOverlayClick,
    saveModalChanges,
    openScoreExplanationModal,
    closeImpactModal,
    handleImpactModalOverlayClick,
    openFullImage,
    closeLightbox,
    handleResetDemo,
    exportComplaintsJson,
    renderStudentReports,
    renderAdminTable,
    selectQuickCategory,
    filterByBuilding,
    getCurrentUser: () => currentUser
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
} else {
  window.App = App;
}

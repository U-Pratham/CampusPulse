/**
 * CampusPulse - Analytics & Visual Charts Engine
 * 
 * Visualizes multi-factor impact distribution, category breakdowns,
 * and emergency SLA metrics with Chart.js and zero-dependency SVG fallbacks.
 */

const AnalyticsEngine = (() => {
  const _Store = typeof Store !== 'undefined' ? Store : (typeof require !== 'undefined' ? require('./store.js') : null);

  let charts = {
    category: null,
    status: null,
    priority: null
  };

  const THEME_COLORS = {
    Safety: '#ef4444',
    Electrical: '#f59e0b',
    Plumbing: '#06b6d4',
    Cleanliness: '#10b981',
    Infrastructure: '#8b5cf6',
    Other: '#64748b',
    Pending: '#f59e0b',
    InProgress: '#3b82f6',
    Resolved: '#10b981',
    P0: '#ef4444',
    P1: '#f97316',
    P2: '#3b82f6',
    P3: '#10b981'
  };

  function renderAll() {
    if (!_Store) return;
    const stats = _Store.getStats();
    const complaints = _Store.getComplaints();

    // Compute Impact Tier distribution
    const tierCounts = {
      P0: 0, // Critical Emergency (100)
      P1: 0, // High Impact (80-99)
      P2: 0, // Medium Impact (50-79)
      P3: 0  // Low Impact (<50)
    };

    for (const c of complaints) {
      if (c.isEmergencyOverride || c.impactScore >= 95) {
        tierCounts.P0++;
      } else if (c.impactScore >= 80) {
        tierCounts.P1++;
      } else if (c.impactScore >= 50) {
        tierCounts.P2++;
      } else {
        tierCounts.P3++;
      }
    }

    // Update KPI metric numbers in DOM
    updateKpiNumbers(stats, tierCounts);

    const hasChartJs = typeof Chart !== 'undefined';
    if (hasChartJs) {
      renderWithChartJs(stats, tierCounts);
    } else {
      renderSvgFallbacks(stats, tierCounts);
    }

    // Render Priority 2: Infrastructure Heatmap & Recurring Issues
    renderHeatmap();
    renderRecurringPatterns();
  }

  function updateKpiNumbers(stats, tierCounts) {
    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElem('kpi-total-tickets', stats.total);
    setElem('kpi-pending-tickets', stats.pending);
    setElem('kpi-inprogress-tickets', stats.inProgress);
    setElem('kpi-resolved-tickets', stats.resolved);
    setElem('kpi-emergencies-count', tierCounts.P0);

    // Admin overview cards
    setElem('admin-kpi-total', stats.total);
    setElem('admin-kpi-pending', stats.pending);
    setElem('admin-kpi-progress', stats.inProgress);
    setElem('admin-kpi-high', tierCounts.P0);
    setElem('admin-kpi-rate', `${stats.resolutionRate}%`);

    // Maintenance Intelligence real calculated KPIs
    setElem('admin-kpi-overdue', stats.overdueCount);
    setElem('admin-kpi-analytics-overdue', stats.overdueCount);
    setElem('admin-kpi-avg-time', stats.averageResolutionFormatted || `${stats.averageResolutionHours} hrs`);
  }

  function renderWithChartJs(stats, tierCounts) {
    // 1. Impact Tier Chart (P0 - P3)
    const prioCanvas = document.getElementById('chart-priority');
    if (prioCanvas) {
      const prioLabels = [
        'P0 - Critical Emergency (100)',
        'P1 - High Impact (80-99)',
        'P2 - Medium Impact (50-79)',
        'P3 - Low Impact (<50)'
      ];
      const prioData = [tierCounts.P0, tierCounts.P1, tierCounts.P2, tierCounts.P3];
      const prioColors = [THEME_COLORS.P0, THEME_COLORS.P1, THEME_COLORS.P2, THEME_COLORS.P3];

      if (charts.priority) {
        charts.priority.data.datasets[0].data = prioData;
        charts.priority.update();
      } else {
        charts.priority = new Chart(prioCanvas, {
          type: 'bar',
          data: {
            labels: prioLabels,
            datasets: [{
              label: 'Ranked Complaints',
              data: prioData,
              backgroundColor: prioColors,
              borderRadius: 6,
              maxBarThickness: 36
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1, color: '#64748b' },
                grid: { color: 'rgba(255,255,255,0.05)' }
              },
              x: {
                ticks: { color: '#94a3b8', font: { size: 10 } },
                grid: { display: false }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.raw} issues currently in this impact tier`
                }
              }
            }
          }
        });
      }
    }

    // 2. Complaints by Category Chart
    const catCanvas = document.getElementById('chart-category');
    if (catCanvas) {
      const catLabels = Object.keys(stats.byCategory);
      const catData = Object.values(stats.byCategory);
      const catColors = catLabels.map(l => THEME_COLORS[l] || '#64748b');

      if (charts.category) {
        charts.category.data.labels = catLabels;
        charts.category.data.datasets[0].data = catData;
        charts.category.data.datasets[0].backgroundColor = catColors;
        charts.category.update();
      } else {
        charts.category = new Chart(catCanvas, {
          type: 'doughnut',
          data: {
            labels: catLabels,
            datasets: [{
              data: catData,
              backgroundColor: catColors,
              borderColor: '#1e293b',
              borderWidth: 2,
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', font: { family: 'Inter, system-ui', size: 11 }, padding: 12 }
              }
            },
            cutout: '68%'
          }
        });
      }
    }

    // 3. Complaints by Status Chart
    const statusCanvas = document.getElementById('chart-status');
    if (statusCanvas) {
      const statusLabels = ['Pending', 'In Progress', 'Resolved'];
      const statusData = [stats.pending, stats.inProgress, stats.resolved];
      const statusColors = [THEME_COLORS.Pending, THEME_COLORS.InProgress, THEME_COLORS.Resolved];

      if (charts.status) {
        charts.status.data.datasets[0].data = statusData;
        charts.status.update();
      } else {
        charts.status = new Chart(statusCanvas, {
          type: 'doughnut',
          data: {
            labels: statusLabels,
            datasets: [{
              data: statusData,
              backgroundColor: statusColors,
              borderColor: '#1e293b',
              borderWidth: 2,
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', font: { family: 'Inter, system-ui', size: 11 }, padding: 12 }
              }
            },
            cutout: '68%'
          }
        });
      }
    }
  }

  // Fallback if Chart.js is not loaded
  function renderSvgFallbacks(stats, tierCounts) {
    const renderFallbackBar = (containerId, items) => {
      const el = document.getElementById(containerId);
      if (!el || !el.parentElement) return;
      const parent = el.parentElement;
      let wrapper = parent.querySelector ? parent.querySelector('.svg-chart-fallback') : null;
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'svg-chart-fallback';
        parent.appendChild(wrapper);
        el.style.display = 'none';
      }

      const totalVal = items.reduce((acc, curr) => acc + curr.value, 0) || 1;
      let html = '<div class="chart-bars-list">';
      for (const item of items) {
        const pct = Math.round((item.value / totalVal) * 100);
        html += `
          <div class="chart-bar-row">
            <div class="chart-bar-label"><span>${item.label}</span><span>${item.value} (${pct}%)</span></div>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width: ${pct}%; background-color: ${item.color};"></div>
            </div>
          </div>
        `;
      }
      html += '</div>';
      wrapper.innerHTML = html;
    };

    renderFallbackBar('chart-priority', [
      { label: 'P0 - Emergency (100)', value: tierCounts.P0, color: THEME_COLORS.P0 },
      { label: 'P1 - High Impact (80-99)', value: tierCounts.P1, color: THEME_COLORS.P1 },
      { label: 'P2 - Medium Impact (50-79)', value: tierCounts.P2, color: THEME_COLORS.P2 },
      { label: 'P3 - Low Impact (<50)', value: tierCounts.P3, color: THEME_COLORS.P3 }
    ]);

    renderFallbackBar('chart-category', [
      { label: 'Safety', value: stats.byCategory.Safety, color: THEME_COLORS.Safety },
      { label: 'Electrical', value: stats.byCategory.Electrical, color: THEME_COLORS.Electrical },
      { label: 'Plumbing', value: stats.byCategory.Plumbing, color: THEME_COLORS.Plumbing },
      { label: 'Cleanliness', value: stats.byCategory.Cleanliness, color: THEME_COLORS.Cleanliness },
      { label: 'Infrastructure', value: stats.byCategory.Infrastructure, color: THEME_COLORS.Infrastructure },
      { label: 'Other', value: stats.byCategory.Other, color: THEME_COLORS.Other }
    ]);

    renderFallbackBar('chart-status', [
      { label: 'Pending', value: stats.pending, color: THEME_COLORS.Pending },
      { label: 'In Progress', value: stats.inProgress, color: THEME_COLORS.InProgress },
      { label: 'Resolved', value: stats.resolved, color: THEME_COLORS.Resolved }
    ]);
  }

  // PRIORITY 2: Campus Infrastructure Heatmap Component
  function renderHeatmap() {
    const grid = document.getElementById('campusHeatmapGrid');
    if (!grid || !_Store) return;

    const heatmapData = _Store.getHeatmapData();
    const buildings = Object.keys(heatmapData);

    if (buildings.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-state-title">No campus location data available</div></div>';
      return;
    }

    let html = '';
    for (const bldg of buildings) {
      const data = heatmapData[bldg];
      let riskBadgeClass = 'badge-risk-healthy';
      if (data.riskTier.includes('CRITICAL')) riskBadgeClass = 'badge-risk-critical';
      else if (data.riskTier === 'HIGH RISK') riskBadgeClass = 'badge-risk-high';
      else if (data.riskTier === 'MODERATE') riskBadgeClass = 'badge-risk-moderate';

      const catKeys = Object.keys(data.categories);
      const catPills = catKeys.length > 0
        ? catKeys.map(k => `<span class="heatmap-cat-pill">${k}: ${data.categories[k]}</span>`).join('')
        : '<span style="font-size: 0.7rem; color: var(--text-dim);">No active issues</span>';

      const safeBldg = bldg.replace(/'/g, "\\'");

      html += `
        <div class="heatmap-card ${data.colorClass}" onclick="App.filterByBuilding('${safeBldg}')" title="Click to filter operations desk for ${bldg}">
          <div class="heatmap-header">
            <span class="heatmap-building-name">${bldg}</span>
            <span class="heatmap-risk-badge ${riskBadgeClass}">${data.riskTier}</span>
          </div>
          <div class="heatmap-stats-row">
            <span>Unresolved Issues:</span>
            <span class="heatmap-stat-val">${data.activeCount} active</span>
          </div>
          <div class="heatmap-stats-row">
            <span>Max Disruption Score:</span>
            <span class="heatmap-stat-val" style="color: ${data.maxImpactScore >= 95 ? '#ef4444' : (data.maxImpactScore >= 80 ? '#fb923c' : 'var(--text-main)')};">
              ${data.maxImpactScore > 0 ? data.maxImpactScore + '/100' : 'None'}
            </span>
          </div>
          <div class="heatmap-stats-row">
            <span>Cumulative Resolved:</span>
            <span class="heatmap-stat-val">${data.totalResolved} fixed</span>
          </div>
          <div class="heatmap-cat-pills">
            ${catPills}
          </div>
          <div style="font-size: 0.68rem; color: var(--accent-cyan); text-align: right; margin-top: 10px;">
            Filter Backlog ➔
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  // PRIORITY 2 & 3: Recurring Issue Pattern Detector
  function renderRecurringPatterns() {
    const grid = document.getElementById('recurringIssuesGrid');
    if (!grid || !_Store) return;

    const recurring = _Store.getRecurringIssues();

    if (recurring.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
          <div class="empty-state-icon" style="font-size: 1.8rem; margin-bottom: 6px;">🛡️</div>
          <div class="empty-state-title" style="font-size: 0.95rem;">No Recurring Infrastructure Incidents</div>
          <div class="empty-state-desc" style="font-size: 0.78rem;">All current complaints represent isolated issues. Recurring cluster threshold is 2 or more reports in the same building and category.</div>
        </div>
      `;
      return;
    }

    let html = '';
    for (const item of recurring) {
      html += `
        <div class="recurring-card">
          <div class="recurring-card-header">
            <div>
              <span class="recurring-location">${item.building}</span>
              <div style="font-size: 0.76rem; color: var(--accent-cyan); margin-top: 2px;">
                Category: <strong>${item.category}</strong>
              </div>
            </div>
            <span class="recurring-count-chip">${item.totalReports} Incidents Logged</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">
            Active Unresolved: <strong>${item.activeReports}</strong>
          </div>
          <div class="recurring-tickets-list">
            Clustered Tickets: ${item.ticketIds.join(', ')}
          </div>
          <div class="recurring-recommendation">
            <strong>Predictive Maintenance Action:</strong> ${item.recommendation}
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  return {
    renderAll,
    renderHeatmap,
    renderRecurringPatterns
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsEngine;
} else {
  window.AnalyticsEngine = AnalyticsEngine;
}

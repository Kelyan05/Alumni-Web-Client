/**
 * js/dashboard.js
 * 
 * Main dashboard controller:
 *  - Login / Register / Logout
 *  - Section navigation
 *  - Loading KPI data
 *  - Alumni directory with filters and pagination
 *  - API key management table
 *  - CSV and chart image export
 */

// ============================================================
// STATE
// ============================================================
let currentSection = 'overview';
let currentUser = null;
let alumniCurrentPage = 1;
let alumniFilters = {};

// ============================================================
// DOM HELPERS
// ============================================================
function $(id) { return document.getElementById(id); }
function showEl(id) { $(id).style.display = ''; }
function hideEl(id) { $(id).style.display = 'none'; }
function setText(id, val) { $(id).textContent = val; }

function showAlert(id, msg, type = 'error') {
  const el = $(id);
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = '';
}

function hideAlert(id) { $(id).style.display = 'none'; }

// ============================================================
// AUTH
// ============================================================
$('loginBtn').addEventListener('click', async () => {
  hideAlert('loginError');
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  if (!email || !password) {
    return showAlert('loginError', 'Please enter your email and password.');
  }

  try {
    const data = await Api.login(email, password);
    currentUser = data.user;
    onLoginSuccess();
  } catch (err) {
    showAlert('loginError', err.message);
  }
});

$('registerBtn').addEventListener('click', async () => {
  hideAlert('registerError');
  const name = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const password = $('regPassword').value;

  if (!name || !email || !password) {
    return showAlert('registerError', 'All fields are required.');
  }

  try {
    const data = await Api.register(name, email, password);
    showAlert('registerSuccess', data.message || 'Account created! Please verify your email.', 'success');
    hideAlert('registerError');
  } catch (err) {
    showAlert('registerError', err.message);
  }
});

$('logoutBtn').addEventListener('click', () => {
  Api.logout();
  currentUser = null;
  showEl('loginModal');
  hideEl('dashboard');
  hideEl('logoutBtn');
  setText('userInfo', 'Not logged in');
});

// Modal navigation links
$('showRegister').addEventListener('click', e => {
  e.preventDefault();
  hideEl('loginModal');
  showEl('registerModal');
});

$('showLogin').addEventListener('click', e => {
  e.preventDefault();
  hideEl('registerModal');
  showEl('loginModal');
});

$('showForgot').addEventListener('click', e => {
  e.preventDefault();
  alert('Password reset: enter your email at /api/auth/forgot-password via API or contact your admin.');
});

// ============================================================
// ON LOGIN SUCCESS
// ============================================================
function onLoginSuccess() {
  hideEl('loginModal');
  hideEl('registerModal');
  showEl('dashboard');
  showEl('logoutBtn');
  setText('userInfo', currentUser.email);
  loadSection('overview');
}

// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const section = link.dataset.section;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    loadSection(section);
  });
});

function loadSection(section) {
  currentSection = section;

  // Hide all sections
  document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
  showEl(`section-${section}`);

  // Update page title
  const titles = {
    'overview': 'Overview',
    'skills-gap': 'Skills Gap Analysis',
    'career-pathways': 'Career Pathways',
    'certifications': 'Certifications',
    'alumni': 'Alumni Directory',
    'api-keys': 'API Key Management',
  };
  setText('pageTitle', titles[section] || section);

  // Load section data
  switch (section) {
    case 'overview':       loadOverview(); break;
    case 'skills-gap':     loadSkillsGap(); break;
    case 'career-pathways': loadCareerPathways(); break;
    case 'certifications': loadCertifications(); break;
    case 'alumni':         loadAlumniDirectory(); break;
    case 'api-keys':       loadApiKeys(); break;
  }
}

// ============================================================
// OVERVIEW
// ============================================================
async function loadOverview() {
  try {
    const { data } = await Api.getSummary();
    setText('kpiAlumni', data.totalAlumni.toLocaleString());
    setText('kpiCerts', data.totalCerts.toLocaleString());
    setText('kpiSkills', data.postGradSkills.toLocaleString());
    setText('kpiProgrammes', data.programmes.toLocaleString());
  } catch (err) {
    console.error('Failed to load summary:', err);
  }

  try { await Charts.renderIndustryChart(); } catch(e) { console.error(e); }
  try { await Charts.renderTopSkillsChart(); } catch(e) { console.error(e); }
  try { await Charts.renderCertTrendsChart(); } catch(e) { console.error(e); }
}

// ============================================================
// SKILLS GAP
// ============================================================
async function loadSkillsGap() {
  try { await Charts.renderSkillsGapBar(); } catch(e) { console.error(e); }
  try { await Charts.renderSkillsGapRadar(); } catch(e) { console.error(e); }
  try { await Charts.renderGapTable(); } catch(e) { console.error(e); }
}

// Programme filter
$('programmeFilter').addEventListener('change', async (e) => {
  try { await Charts.renderSkillsGapBar(e.target.value); } catch(err) { console.error(err); }
});

// ============================================================
// CAREER PATHWAYS
// ============================================================
async function loadCareerPathways() {
  try { await Charts.renderCareerChart(); } catch(e) { console.error(e); }
  try { await Charts.renderEmploymentYearChart(); } catch(e) { console.error(e); }
  try { await Charts.renderCareerDoughnut(); } catch(e) { console.error(e); }
}

// ============================================================
// CERTIFICATIONS
// ============================================================
async function loadCertifications() {
  try { await Charts.renderCertificationCharts(); } catch(e) { console.error(e); }
}

// ============================================================
// ALUMNI DIRECTORY
// ============================================================
async function loadAlumniDirectory(page = 1) {
  alumniCurrentPage = page;
  const tableEl = $('alumniTable');
  tableEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading alumni...</div>';

  try {
    const { data, pagination } = await Api.getAlumni(alumniFilters, page);

    if (data.length === 0) {
      tableEl.innerHTML = '<p class="loading">No alumni found matching your filters.</p>';
      return;
    }

    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Programme</th><th>Grad Year</th>
            <th>Industry</th><th>Job Title</th><th>Employer</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(a => `
            <tr>
              <td>${escapeHtml(a.name)}</td>
              <td>${escapeHtml(a.programme)}</td>
              <td>${a.graduation_year}</td>
              <td>${escapeHtml(a.industry || '—')}</td>
              <td>${escapeHtml(a.job_title || '—')}</td>
              <td>${escapeHtml(a.employer || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    renderPagination(pagination);
    populateAlumniFilters(data);

  } catch (err) {
    tableEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderPagination({ page, pages }) {
  const el = $('alumniPagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  const buttons = [];
  if (page > 1) buttons.push(`<button class="page-btn" data-page="${page-1}">← Prev</button>`);
  for (let p = Math.max(1, page-2); p <= Math.min(pages, page+2); p++) {
    buttons.push(`<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`);
  }
  if (page < pages) buttons.push(`<button class="page-btn" data-page="${page+1}">Next →</button>`);
  el.innerHTML = buttons.join('');

  el.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => loadAlumniDirectory(parseInt(btn.dataset.page)));
  });
}

function populateAlumniFilters(data) {
  // Populate year filter on first load
  const yearSel = $('alumniYearFilter');
  if (yearSel.options.length <= 1) {
    const years = [2019, 2020, 2021, 2022, 2023];
    years.forEach(y => { const o = new Option(y, y); yearSel.add(o); });
  }
  const progSel = $('alumniProgrammeFilter');
  if (progSel.options.length <= 1) {
    const progs = [...new Set(data.map(d => d.programme))];
    progs.forEach(p => { const o = new Option(p, p); progSel.add(o); });
  }
  const indSel = $('alumniIndustryFilter');
  if (indSel.options.length <= 1) {
    const inds = [...new Set(data.map(d => d.industry).filter(Boolean))];
    inds.forEach(i => { const o = new Option(i, i); indSel.add(o); });
  }
}

$('applyAlumniFilter').addEventListener('click', () => {
  alumniFilters = {};
  const prog = $('alumniProgrammeFilter').value;
  const year = $('alumniYearFilter').value;
  const ind = $('alumniIndustryFilter').value;
  if (prog) alumniFilters.programme = prog;
  if (year) alumniFilters.graduation_year = year;
  if (ind) alumniFilters.industry = ind;
  loadAlumniDirectory(1);
});

// ============================================================
// API KEYS
// ============================================================
async function loadApiKeys() {
  const el = $('apiKeysList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading API keys...</div>';

  try {
    const { data } = await Api.getApiKeys();

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Client</th><th>Key Preview</th><th>Permissions</th>
            <th>Status</th><th>Last Used</th><th>Requests</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(k => `
            <tr>
              <td><strong>${escapeHtml(k.client_name)}</strong></td>
              <td><code>${escapeHtml(k.key_preview)}</code></td>
              <td>${k.permissions.map(p => `<span class="badge">${escapeHtml(p)}</span>`).join('')}</td>
              <td>
                <span class="badge ${k.active ? 'badge-success' : 'badge-danger'}">
                  ${k.active ? 'Active' : 'Revoked'}
                </span>
              </td>
              <td>${k.last_used ? new Date(k.last_used).toLocaleString() : 'Never'}</td>
              <td>${k.total_requests}</td>
              <td>
                ${k.active ? `<button class="btn btn-danger" onclick="revokeKey(${k.id})">Revoke</button>` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

window.revokeKey = async (id) => {
  if (!confirm('Revoke this API key? All applications using it will lose access.')) return;
  try {
    await Api.revokeApiKey(id);
    loadApiKeys();
  } catch (err) {
    alert('Failed to revoke key: ' + err.message);
  }
};

// ============================================================
// EXPORT: CSV
// ============================================================
$('exportCsvBtn').addEventListener('click', async () => {
  try {
    let csvData, filename;

    if (currentSection === 'alumni') {
      const { data } = await Api.getAlumni(alumniFilters, 1, 1000);
      const headers = ['Name', 'Programme', 'Graduation Year', 'Industry', 'Job Title', 'Employer'];
      const rows = data.map(a => [a.name, a.programme, a.graduation_year, a.industry, a.job_title, a.employer]);
      csvData = [headers, ...rows].map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
      filename = 'alumni_export.csv';

    } else if (currentSection === 'skills-gap') {
      const { data } = await Api.getSkillsGap();
      const headers = ['Programme', 'Skill', 'Alumni Count', 'Percentage'];
      const rows = data.map(d => [d.programme, d.skill, d.alumni_count, d.percentage]);
      csvData = [headers, ...rows].map(r => r.join(',')).join('\n');
      filename = 'skills_gap_export.csv';

    } else {
      const { data } = await Api.getTopSkills();
      const headers = ['Skill', 'Total Alumni', 'Percentage'];
      const rows = data.map(d => [d.skill, d.total_alumni, d.percentage]);
      csvData = [headers, ...rows].map(r => r.join(',')).join('\n');
      filename = 'analytics_export.csv';
    }

    downloadBlob(csvData, filename, 'text/csv');
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
});

// ============================================================
// EXPORT: Chart Images
// ============================================================
$('exportChartBtn').addEventListener('click', async () => {
  const section = $(`section-${currentSection}`);
  const canvas = section.querySelector('canvas');

  if (!canvas) {
    return alert('No chart available to export in this section.');
  }

  // Use html2canvas to capture the chart card
  const card = canvas.closest('.chart-card') || canvas.parentElement;
  const canvasImg = await html2canvas(card);
  const link = document.createElement('a');
  link.download = `${currentSection}_chart.png`;
  link.href = canvasImg.toDataURL('image/png');
  link.click();
});

// ============================================================
// UTILITIES
// ============================================================
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// INIT - Show login on page load
// ============================================================
(function init() {
  showEl('loginModal');
  hideEl('dashboard');
})();
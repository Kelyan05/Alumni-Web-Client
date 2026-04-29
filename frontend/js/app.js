const State = {
  jwt:        null,
  apiKey:     null,
  adminName:  null,
  charts:     {},
  alumni:     { page: 1, limit: 20, total: 0 },
  filters:    { programme: '', industry: '', graduation_year: '' },
};

// ── HTTP HELPERS 
async function apiAuth(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (State.jwt) opts.headers['Authorization'] = 'Bearer ' + State.jwt;
  if (body)      opts.body = JSON.stringify(body);
  const res  = await fetch('/api/' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

async function apiData(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (State.apiKey) opts.headers['X-Api-Key'] = State.apiKey;
  if (body)         opts.body = JSON.stringify(body);
  const res  = await fetch('/api/' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

// ── LOGIN / REGISTER 
async function login() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const spinner  = document.getElementById('loginSpinner');
  errEl.classList.add('d-none');
  spinner.classList.remove('d-none');

  try {
    const result = await apiAuth('auth/login', 'POST', { email, password });
    State.jwt       = result.token;
    State.adminName = result.name;

    // Get an API key the dashboard can use to call data endpoints.
    // We pick the one labelled "Analytics Dashboard" if it exists, otherwise create one.
    await ensureDashboardApiKey();

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display    = 'block';
    document.getElementById('adminName').textContent     = State.adminName;

    loadDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  } finally {
    spinner.classList.add('d-none');
  }
}

async function register() {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('regError');
  errEl.classList.add('d-none');
  try {
    await apiAuth('auth/register', 'POST', { name, email, password });
    const modalEl = document.getElementById('registerModal');

    // Move focus somewhere safe (e.g. login email input)
    document.getElementById('loginEmail').focus();
    
    // Then hide modal
    bootstrap.Modal.getInstance(modalEl).hide();    document.getElementById('loginEmail').value    = email;
    document.getElementById('loginPassword').value = password;
    alert('Account created — you are now signed in.');
    login();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  }
}


async function ensureDashboardApiKey() {
  const result = await apiAuth('keys', 'POST', {
    client_name: 'Dashboard Session ' + new Date().toISOString().slice(0, 16),
    permissions: ['read:alumni', 'read:analytics'],
  });
  State.apiKey = result.rawKey;
}

function logout() {
  State.jwt = State.apiKey = State.adminName = null;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display    = 'none';
  document.getElementById('loginPassword').value = '';
}

// ── NAVIGATION ──
function navigate(page) {
  document.querySelectorAll('.nav-link[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));

  if (page === 'dashboard') loadDashboard();
  else if (page === 'charts')  loadCharts();
  else if (page === 'alumni')  loadAlumniPage();
  else if (page === 'apikeys') loadKeys();
  else if (page === 'usage')   loadUsageStats();
}

// ── DASHBOARD PAGE 
async function loadDashboard() {
  try {
    const [summary, industry, gradYears, gap] = await Promise.all([
      apiData('analytics/summary'),
      apiData('analytics/industry-breakdown'),
      apiData('analytics/graduation-years'),
      apiData('analytics/skills-gap'),
    ]);

    document.getElementById('kpi-total').textContent = summary.data.totalAlumni;
    document.getElementById('kpi-certs').textContent = summary.data.totalCerts;
    document.getElementById('kpi-skills').textContent= summary.data.postGradSkills;
    document.getElementById('kpi-prog').textContent  = summary.data.programmes;

    drawDoughnut('dashIndustryChart', industry.data.map(r => r.industry), industry.data.map(r => r.count));
    drawBar('dashYearChart',
      gradYears.data.map(r => r.graduation_year),
      gradYears.data.map(r => r.count),
      'Alumni Count'
    );

    // Show top 5 curriculum gaps (skills with high % post-grad acquisition)
    const topGaps = gap.data.raw
      .filter(r => r.percentage >= 30)
      .slice(0, 5)
      .map(r => `<div class="mb-2"><strong>${r.programme}</strong>: <code>${r.skill}</code> — ${r.percentage}% of graduates acquired post-graduation</div>`)
      .join('') || '<div class="text-muted">No significant curriculum gaps detected.</div>';
    document.getElementById('gapAlerts').innerHTML = topGaps;
  } catch (err) {
    console.error(err);
  }
}

// ── CHARTS PAGE ─
async function loadCharts() {
  try {
    const [topSkills, certCat, certTrends, career, gap] = await Promise.all([
      apiData('analytics/top-skills'),
      apiData('analytics/certs-by-category'),
      apiData('analytics/cert-trends'),
      apiData('analytics/career-pathways'),
      apiData('analytics/skills-gap'),
    ]);

    // Top skills — horizontal bar
    drawHorizontalBar('topSkillsChart',
      topSkills.data.map(r => r.skill),
      topSkills.data.map(r => r.total_alumni),
      'Alumni with skill'
    );

    // Cert by category — pie
    drawPie('certCatChart',
      certCat.data.map(r => r.category),
      certCat.data.map(r => r.count));

    // Cert trends — multi-line
    drawLine('certTrendsChart', certTrends.data.labels, certTrends.data.datasets);

    // Career pathways — grouped bar
    const programmes = [...new Set(career.data.map(r => r.programme))];
    const industries = [...new Set(career.data.map(r => r.industry))];
    const map = {};
    career.data.forEach(r => map[`${r.programme}|${r.industry}`] = r.alumni_count);
    const datasets = industries.map((ind, i) => ({
      label: ind,
      data:  programmes.map(p => map[`${p}|${ind}`] || 0),
      backgroundColor: chartColor(i),
    }));
    drawGroupedBar('careerChart', programmes, datasets);

    // Skills gap radar — programme selector
    const sel = document.getElementById('programmeFilter');
    if (sel.options.length === 1) {
      gap.data.datasets.forEach(d => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = d.label;
        sel.appendChild(opt);
      });
      sel.onchange = () => drawSkillsGap(gap.data, sel.value);
    }
    drawSkillsGap(gap.data, '');
  } catch (err) {
    console.error(err);
  }
}

function drawSkillsGap(data, programmeFilter) {
  const datasets = programmeFilter
    ? data.datasets.filter(d => d.label === programmeFilter)
    : data.datasets;
  drawRadar('skillsGapChart', data.labels, datasets.map((d, i) => ({
    ...d,
    backgroundColor: chartColor(i, 0.2),
    borderColor:     chartColor(i),
  })));
}

// ── ALUMNI PAGE ─
async function loadAlumniPage() {
  // Load filter dropdowns once
  if (document.getElementById('filterProg').options.length === 1) {
    const f = await apiData('alumni/filters');
    f.data.programmes.forEach(p => addOption('filterProg', p));
    f.data.industries.forEach(p => addOption('filterIndustry', p));
    f.data.graduation_years.forEach(p => addOption('filterYear', p));
  }
  await refreshAlumni();
}

async function refreshAlumni() {
  const params = new URLSearchParams();
  if (State.filters.programme)       params.set('programme',       State.filters.programme);
  if (State.filters.industry)        params.set('industry',        State.filters.industry);
  if (State.filters.graduation_year) params.set('graduation_year', State.filters.graduation_year);
  params.set('page',  State.alumni.page);
  params.set('limit', State.alumni.limit);

  try {
    const result = await apiData('alumni?' + params.toString());
    const tbody  = document.getElementById('alumniTableBody');
    if (result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No alumni match these filters.</td></tr>';
    } else {
      tbody.innerHTML = result.data.map(a => `
        <tr>
          <td><strong>${escapeHtml(a.name)}</strong></td>
          <td>${escapeHtml(a.programme)}</td>
          <td>${a.graduation_year}</td>
          <td><span class="badge bg-secondary">${escapeHtml(a.industry)}</span></td>
          <td>${escapeHtml(a.job_title || '—')}</td>
          <td>${escapeHtml(a.employer || '—')}</td>
        </tr>
      `).join('');
    }
    State.alumni.total = result.pagination.total;
    document.getElementById('alumniCount').textContent =
      `Showing page ${result.pagination.page} of ${result.pagination.pages} (${result.pagination.total} alumni)`;
    document.getElementById('prevPage').disabled = result.pagination.page <= 1;
    document.getElementById('nextPage').disabled = result.pagination.page >= result.pagination.pages;
  } catch (err) {
    console.error(err);
  }
}

// ── API KEYS PAGE 
async function loadKeys() {
  try {
    const result = await apiAuth('keys');
    const tbody  = document.getElementById('keysTableBody');
    if (result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No API keys yet.</td></tr>';
      return;
    }
    tbody.innerHTML = result.data.map(k => `
      <tr>
        <td><strong>${escapeHtml(k.client_name)}</strong></td>
        <td><code class="small">${escapeHtml(k.key_preview)}</code></td>
        <td>${k.permissions.map(p => `<span class="badge bg-info bg-opacity-25 text-dark badge-perm">${escapeHtml(p)}</span>`).join('')}</td>
        <td>${k.total_requests}</td>
        <td><small class="text-muted">${k.last_used || 'Never'}</small></td>
        <td>${k.is_active
          ? '<span class="badge bg-success">Active</span>'
          : '<span class="badge bg-secondary">Revoked</span>'}</td>
        <td>${k.is_active
          ? `<button class="btn btn-sm btn-outline-danger" onclick="revokeKey(${k.id})">Revoke</button>`
          : ''}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function revokeKey(id) {
  if (!confirm('Revoke this API key? This cannot be undone.')) return;
  try {
    await apiAuth('keys/' + id, 'DELETE');
    loadKeys();
  } catch (err) { alert(err.message); }
}

async function createKey() {
  const clientName  = document.getElementById('keyClientName').value.trim();
  const permissions = [...document.querySelectorAll('.key-perm:checked')].map(c => c.value);
  if (!clientName || permissions.length === 0) {
    return alert('Please provide a client name and at least one permission.');
  }
  try {
    const result = await apiAuth('keys', 'POST', { client_name: clientName, permissions });
    document.getElementById('newKeyValue').textContent = result.rawKey;
    document.getElementById('newKeyAlert').classList.remove('d-none');
    document.getElementById('keyClientName').value = '';
    document.querySelectorAll('.key-perm').forEach(c => c.checked = false);
    setTimeout(loadKeys, 100);
  } catch (err) {
    alert(err.message);
  }
}

// ── USAGE STATS PAGE 
async function loadUsageStats() {
  try {
    const result = await apiAuth('keys/stats');
    const labels = result.data.map(r => r.endpoint);
    const counts = result.data.map(r => r.hits);

    drawBar('usageChart', labels, counts, 'Requests');

    document.getElementById('usageTableBody').innerHTML = result.data.map(r => `
      <tr>
        <td>${escapeHtml(r.client_name)}</td>
        <td><code class="small">${escapeHtml(r.endpoint)}</code></td>
        <td><strong>${r.hits}</strong></td>
        <td><small class="text-muted">${r.last_hit || '—'}</small></td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="text-muted">No usage data yet.</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

// ── EXPORT FUNCTIONS 
async function exportCsv() {
  try {
    const params = new URLSearchParams();
    if (State.filters.programme)       params.set('programme',       State.filters.programme);
    if (State.filters.industry)        params.set('industry',        State.filters.industry);
    if (State.filters.graduation_year) params.set('graduation_year', State.filters.graduation_year);
    params.set('limit', 1000);

    const result = await apiData('alumni?' + params.toString());
    const headers = ['ID','Name','Programme','Graduation Year','Industry','Job Title','Employer'];
    const rows = result.data.map(a => [a.id, a.name, a.programme, a.graduation_year, a.industry, a.job_title || '', a.employer || '']);

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `alumni_export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
}

async function exportPdf() {
  try {
    const summary  = await apiData('analytics/summary');
    const top      = await apiData('analytics/top-skills');
    const industry = await apiData('analytics/industry-breakdown');

    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Alumni Analytics Report</title>
      <style>
        body{font-family:Arial;padding:30px;color:#333}
        h1{color:#003087;border-bottom:2px solid #003087;padding-bottom:8px}
        h2{color:#003087;margin-top:24px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th{background:#003087;color:#fff;padding:8px;text-align:left}
        td{padding:8px;border-bottom:1px solid #eee}
        .stat{display:inline-block;margin:8px 16px 8px 0;padding:12px 16px;background:#f0f4fa;border-radius:8px}
        .stat strong{display:block;font-size:1.6rem;color:#003087}
        .footer{margin-top:30px;color:#999;font-size:0.85rem;text-align:center}
      </style></head><body>
      <h1>University Alumni Analytics Report</h1>
      <p><small>Generated ${new Date().toLocaleString()}</small></p>
      <h2>Key Indicators</h2>
      <div class="stat"><strong>${summary.data.totalAlumni}</strong>Total Alumni</div>
      <div class="stat"><strong>${summary.data.totalCerts}</strong>Certifications</div>
      <div class="stat"><strong>${summary.data.postGradSkills}</strong>Post-Grad Skills</div>
      <div class="stat"><strong>${summary.data.programmes}</strong>Programmes</div>

      <h2>Top Post-Graduation Skills</h2>
      <table><thead><tr><th>Skill</th><th>Alumni</th><th>%</th></tr></thead><tbody>
      ${top.data.map(r => `<tr><td>${r.skill}</td><td>${r.total_alumni}</td><td>${r.percentage}%</td></tr>`).join('')}
      </tbody></table>

      <h2>Industry Distribution</h2>
      <table><thead><tr><th>Industry</th><th>Alumni</th></tr></thead><tbody>
      ${industry.data.map(r => `<tr><td>${r.industry}</td><td>${r.count}</td></tr>`).join('')}
      </tbody></table>

      <div class="footer">University of Westminster · Alumni Analytics Dashboard</div>
      <script>window.onload=()=>window.print()<\/script>
      </body></html>
    `);
    win.document.close();
  } catch (err) {
    alert(err.message);
  }
}

// ── CHART HELPERS 
function chartColor(i, alpha = 1) {
  const palette = [
    `rgba(0, 48, 135, ${alpha})`,
    `rgba(232, 35, 42, ${alpha})`,
    `rgba(56, 142, 60, ${alpha})`,
    `rgba(245, 124, 0, ${alpha})`,
    `rgba(123, 31, 162, ${alpha})`,
    `rgba(0, 151, 167, ${alpha})`,
    `rgba(216, 67, 21, ${alpha})`,
    `rgba(48, 63, 159, ${alpha})`,
  ];
  return palette[i % palette.length];
}

function destroyChart(id) {
  if (State.charts[id]) State.charts[id].destroy();
}

function drawBar(id, labels, data, label) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: chartColor(0, 0.8), borderRadius: 4 }] },
    options: { responsive: true, animation: { duration: 800 },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } } },
  });
}

function drawHorizontalBar(id, labels, data, label) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: chartColor(1, 0.8) }] },
    options: { indexAxis: 'y', responsive: true, animation: { duration: 800 },
      plugins: { legend: { display: false } } },
  });
}

function drawDoughnut(id, labels, data) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: labels.map((_, i) => chartColor(i, 0.85)) }] },
    options: { responsive: true, animation: { duration: 800 },
      plugins: { legend: { position: 'right' } } },
  });
}

function drawPie(id, labels, data) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: labels.map((_, i) => chartColor(i, 0.85)) }] },
    options: { responsive: true, animation: { duration: 800 },
      plugins: { legend: { position: 'right' } } },
  });
}

function drawLine(id, labels, datasets) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        ...d,
        borderColor: chartColor(i),
        backgroundColor: chartColor(i, 0.1),
        tension: 0.3,
        fill: false,
      })),
    },
    options: { responsive: true, animation: { duration: 800 },
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } } },
  });
}

function drawGroupedBar(id, labels, datasets) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets },
    options: { responsive: true, animation: { duration: 800 },
      plugins: { legend: { position: 'top' } },
      scales: { x: { stacked: false }, y: { beginAtZero: true } } },
  });
}

function drawRadar(id, labels, datasets) {
  destroyChart(id);
  State.charts[id] = new Chart(document.getElementById(id), {
    type: 'radar',
    data: { labels, datasets },
    options: { responsive: true, animation: { duration: 800 },
      plugins: { legend: { position: 'top' } },
      scales: { r: { beginAtZero: true } } },
  });
}

// ── UTILITIES ───
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

function addOption(selectId, value) {
  const opt = document.createElement('option');
  opt.value = opt.textContent = value;
  document.getElementById(selectId).appendChild(opt);
}

// ── EVENT WIRING 
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick      = login;
  document.getElementById('regBtn').onclick        = register;
  document.getElementById('logoutBtn').onclick     = logout;

  document.getElementById('loginEmail').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
  document.getElementById('loginPassword').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });

  document.querySelectorAll('.nav-link[data-page]').forEach(a => {
    a.onclick = e => { e.preventDefault(); navigate(a.dataset.page); };
  });

  document.getElementById('exportCsvBtn').onclick = exportCsv;
  document.getElementById('exportPdfBtn').onclick = exportPdf;

  document.getElementById('applyFilters').onclick = () => {
    State.filters.programme       = document.getElementById('filterProg').value;
    State.filters.industry        = document.getElementById('filterIndustry').value;
    State.filters.graduation_year = document.getElementById('filterYear').value;
    State.alumni.page = 1;
    refreshAlumni();
  };

  document.getElementById('prevPage').onclick = () => { State.alumni.page--; refreshAlumni(); };
  document.getElementById('nextPage').onclick = () => { State.alumni.page++; refreshAlumni(); };
  document.getElementById('createKeyBtn').onclick = createKey;
});

// expose for inline onclick
window.revokeKey = revokeKey;

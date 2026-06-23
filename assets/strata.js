// Strata — front-end app logic.
// Vanilla JS, no framework. Loaded with `defer` from index.html.
// Pre-paint theme application lives inline in index.html (must run before first paint).

const API = 'api.php';
const state = { db: null, table: null, schema: 'PUBLIC', page: 1, perPage: 50, sort: '', dir: 'ASC', search: '', tables: [] };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- connection profiles (Phase 2) ---------------------------------------
// Profiles live in localStorage. Passwords only persist when `remember` is on;
// otherwise they are kept in-memory for the session and re-prompted on reload.
const PROFILES_KEY = 'strata-profiles';
const ACTIVE_KEY = 'strata-active';
const runtimePass = {}; // id -> password, for non-remembered profiles this session
const uid = () => 'p' + Math.random().toString(36).slice(2, 9);

function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch { return []; }
}
function saveProfiles(list) { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); }
function activeId() { return localStorage.getItem(ACTIVE_KEY); }
function setActiveId(id) { localStorage.setItem(ACTIVE_KEY, id); }
function activeProfile() {
  const list = loadProfiles();
  return list.find(p => p.id === activeId()) || list[0] || null;
}

/** Credentials for the active profile, or null if a password is still needed. */
function activeConn() {
  const p = activeProfile();
  if (!p) return null;
  const pass = p.remember ? (p.pass ?? '') : runtimePass[p.id];
  if (pass === undefined) return null; // needs re-prompt
  const c = { host: p.host, port: +p.port || 3306, user: p.user, pass };
  if (state.db || p.db) c.db = state.db || p.db;
  return c;
}

async function api(action, params = {}) {
  const conn = activeConn();
  if (!conn) throw new Error('No active connection');
  const res = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conn, ...params }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadDatabases() {
  const { databases } = await api('databases');
  const sel = $('dbSelect');
  const skip = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);
  const ordered = [...databases.filter(d => !skip.has(d)), ...databases.filter(d => skip.has(d))];
  sel.innerHTML = ordered.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
  const prof = activeProfile();
  state.db = (prof && prof.db && ordered.includes(prof.db)) ? prof.db : ordered[0];
  sel.value = state.db;
  await loadTables();
}

async function loadTables() {
  const { tables } = await api('tables', { db: state.db });
  state.tables = tables;
  renderTableList();
  $('connInfo').textContent = `Connected · ${state.db}`;
  if (tables.length) selectTable(tables[0].name);
  else { state.table = null; renderEmpty('No tables in this database'); }
}

function renderTableList() {
  const filter = $('tableFilter').value.toLowerCase();
  const list = state.tables.filter(t => t.name.toLowerCase().includes(filter));
  $('tableCount').textContent = `${list.length}`;
  $('tableList').innerHTML = list.map(t => {
    const active = t.name === state.table;
    const icon = t.type === 'VIEW' ? 'visibility' : 'table_rows';
    return `<a href="#" data-table="${esc(t.name)}"
      class="flex items-center justify-between gap-sm px-sm py-xs rounded-lg transition-colors ${active ? 'bg-secondary-container text-on-secondary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}">
      <span class="flex items-center gap-sm truncate"><span class="material-symbols-outlined text-[18px] opacity-70">${icon}</span><span class="truncate">${esc(t.name)}</span></span>
      <span class="text-[10px] opacity-50 font-mono shrink-0">${t.rows ?? 0}</span></a>`;
  }).join('') || `<p class="text-xs text-on-surface-variant opacity-40 px-sm py-md">No match</p>`;
  $('tableList').querySelectorAll('a').forEach(a =>
    a.onclick = (e) => { e.preventDefault(); selectTable(a.dataset.table); });
}

function selectTable(name) {
  state.table = name; state.page = 1; state.sort = ''; state.dir = 'ASC'; state.search = '';
  $('rowSearch').value = '';
  renderTableList();
  loadRows();
}

function renderEmpty(msg) {
  $('gridHead').innerHTML = ''; $('gridBody').innerHTML = '';
  const m = $('gridMsg'); m.textContent = msg; m.classList.remove('hidden');
  $('ctxTable').textContent = state.table || '—';
  $('ctxRows').textContent = ''; $('pageInfo').textContent = '—';
}

function badge(val) {
  const v = String(val).toUpperCase();
  const map = {
    ACTIVE: 'bg-green-950/30 text-green-400 border-green-900/50',
    PUBLISH: 'bg-green-950/30 text-green-400 border-green-900/50',
    PENDING: 'bg-amber-950/30 text-amber-400 border-amber-900/50',
    DRAFT: 'bg-amber-950/30 text-amber-400 border-amber-900/50',
    SUSPENDED: 'bg-red-950/30 text-red-400 border-red-900/50',
    TRASH: 'bg-red-950/30 text-red-400 border-red-900/50',
    INACTIVE: 'bg-surface-variant text-on-surface-variant border-outline-variant',
  };
  const cls = map[v] || 'bg-surface-variant text-on-surface-variant border-outline-variant';
  return `<span class="inline-flex items-center px-sm py-[2px] rounded-full border text-[10px] font-semibold ${cls}">${esc(val)}</span>`;
}

const STATUS_COLS = new Set(['status', 'state', 'post_status', 'comment_approved']);

function cell(col, val) {
  if (val === null) return `<span class="opacity-30 italic">NULL</span>`;
  if (STATUS_COLS.has(col.name.toLowerCase()) && String(val).length < 24) return badge(val);
  if (col.key === 'PRI') return `<span class="text-on-surface">${esc(val)}</span>`;
  const s = String(val);
  if (/email/i.test(col.name) || (/url|link/i.test(col.name) && /^https?:/.test(s)))
    return `<span class="text-primary font-medium truncate inline-block max-w-[320px]">${esc(s)}</span>`;
  const trunc = s.length > 120 ? esc(s.slice(0, 120)) + '…' : esc(s);
  return `<span class="text-on-surface-variant truncate inline-block max-w-[420px]" title="${esc(s)}">${trunc}</span>`;
}

async function loadRows() {
  if (!state.table) return;
  $('gridMsg').classList.add('hidden');
  const t0 = performance.now();
  let data;
  try {
    data = await api('rows', {
      db: state.db, table: state.table, page: state.page, per_page: state.perPage,
      sort: state.sort, dir: state.dir, search: state.search,
    });
  } catch (e) { renderEmpty('Error: ' + e.message); return; }
  const ms = Math.round(performance.now() - t0);

  // context header
  $('ctxTable').textContent = data.table;
  $('ctxSchema').textContent = `SCHEMA: ${state.db.toUpperCase()}`;
  $('ctxRows').textContent = `${data.total.toLocaleString()} rows`;
  $('queryTime').textContent = `Query took ${ms}ms`;
  const from = data.total ? (data.page - 1) * data.per_page + 1 : 0;
  const to = Math.min(data.page * data.per_page, data.total);
  $('pageInfo').textContent = `${from}-${to} of ${data.total.toLocaleString()}`;

  // head
  $('gridHead').innerHTML = `<tr class="bg-surface-container-highest border-b border-outline-variant">${
    data.columns.map(c => {
      const sorted = state.sort === c.name;
      const arrow = sorted ? (state.dir === 'ASC' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
      const keyIcon = c.key === 'PRI' ? '<span class="material-symbols-outlined text-[13px] text-tertiary">key</span>' : '';
      return `<th data-col="${esc(c.name)}" class="px-md py-sm text-[13px] text-on-surface-variant uppercase tracking-wider cursor-pointer hover:bg-surface-variant transition-colors select-none">
        <div class="flex items-center gap-xs">${keyIcon}${esc(c.name)}
          <span class="material-symbols-outlined text-[14px] ${sorted ? 'opacity-100 text-primary' : 'opacity-40'}">${arrow}</span></div></th>`;
    }).join('')
  }</tr>`;
  $('gridHead').querySelectorAll('th').forEach(th =>
    th.onclick = () => {
      const c = th.dataset.col;
      if (state.sort === c) state.dir = state.dir === 'ASC' ? 'DESC' : 'ASC';
      else { state.sort = c; state.dir = 'ASC'; }
      state.page = 1; loadRows();
    });

  // body
  if (!data.rows.length) { renderEmpty(state.search ? 'No rows match search' : 'Table is empty'); return; }
  $('gridBody').innerHTML = data.rows.map((r, i) =>
    `<tr class="border-b border-outline-variant hover:bg-surface-container-highest/50 transition-colors ${i % 2 ? 'bg-surface-container-low/30' : ''}">${
      data.columns.map(c => `<td class="px-md py-xs">${cell(c, r[c.name])}</td>`).join('')
    }</tr>`).join('');
  state._lastData = data;
}

function exportCsv() {
  const d = state._lastData;
  if (!d || !d.rows.length) return;
  const cols = d.columns.map(c => c.name);
  const q = (v) => v === null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...d.rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${state.db}.${state.table}_p${state.page}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// events
$('dbSelect').onchange = (e) => { state.db = e.target.value; loadTables(); };
$('tableFilter').oninput = renderTableList;
$('perPage').onchange = (e) => { state.perPage = +e.target.value; state.page = 1; loadRows(); };
$('prevPage').onclick = () => { if (state.page > 1) { state.page--; loadRows(); } };
$('nextPage').onclick = () => { const d = state._lastData; if (d && state.page < d.pages) { state.page++; loadRows(); } };
$('btnRefresh').onclick = loadRows;
$('btnExport').onclick = exportCsv;
let searchTimer;
$('rowSearch').oninput = (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; loadRows(); }, 300); };

// ---- connection UI (Phase 2) ---------------------------------------------

function renderProfileSelect() {
  const list = loadProfiles();
  const sel = $('profileSelect');
  const act = activeProfile();
  sel.innerHTML = list.map(p =>
    `<option value="${esc(p.id)}" ${act && p.id === act.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')
    || `<option value="">No connection</option>`;
}

function openConnModal() { $('connModal').classList.remove('hidden'); showList(); }
function closeConnModal() {
  // Block dismissal while there is no usable connection (first run / locked out).
  if (!activeConn()) return;
  $('connModal').classList.add('hidden');
}

function showList() {
  $('connForm').classList.add('hidden');
  $('connList').classList.remove('hidden');
  $('connModalTitle').textContent = loadProfiles().length ? 'Connections' : 'Welcome to Strata';
  renderProfileList();
}

function renderProfileList() {
  const list = loadProfiles();
  const wrap = $('profileList');
  if (!list.length) {
    wrap.innerHTML = `<p class="text-on-surface-variant opacity-70 text-center py-md">No connections yet. Add one to get started.</p>`;
    return;
  }
  const act = activeId();
  wrap.innerHTML = list.map(p => {
    const on = p.id === act;
    return `<div class="flex items-center justify-between gap-sm px-md py-sm rounded-lg border ${on ? 'border-primary bg-primary-container/20' : 'border-outline-variant'}">
      <button data-use="${esc(p.id)}" class="flex-1 min-w-0 text-left">
        <div class="font-semibold text-on-surface truncate">${esc(p.name)} ${on ? '<span class="text-primary text-xs">● active</span>' : ''}</div>
        <div class="text-xs text-on-surface-variant opacity-70 font-mono truncate">${esc(p.user)}@${esc(p.host)}:${esc(p.port)}${p.db ? '/' + esc(p.db) : ''}</div>
      </button>
      <div class="flex items-center gap-xs shrink-0">
        <button data-edit="${esc(p.id)}" title="Edit" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant"><span class="material-symbols-outlined text-[18px]">edit</span></button>
        <button data-del="${esc(p.id)}" title="Delete" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-error"><span class="material-symbols-outlined text-[18px]">delete</span></button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-use]').forEach(b => b.onclick = () => switchProfile(b.dataset.use));
  wrap.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => showForm(list.find(p => p.id === b.dataset.edit)));
  wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteProfile(b.dataset.del));
}

function showForm(profile) {
  const f = $('connForm');
  $('connList').classList.add('hidden');
  f.classList.remove('hidden');
  $('connTestMsg').classList.add('hidden');
  f.dataset.id = profile ? profile.id : '';
  $('connModalTitle').textContent = profile ? 'Edit connection' : 'New connection';
  f.name.value = profile?.name ?? '';
  f.host.value = profile?.host ?? '127.0.0.1';
  f.port.value = profile?.port ?? 3306;
  f.user.value = profile?.user ?? 'root';
  f.pass.value = profile?.remember ? (profile.pass ?? '') : '';
  f.db.value = profile?.db ?? '';
  f.remember.checked = profile ? !!profile.remember : true;
  f.name.focus();
}

function formConn() {
  const f = $('connForm');
  return { host: f.host.value.trim(), port: +f.port.value || 3306, user: f.user.value.trim(), pass: f.pass.value };
}

async function testConnection() {
  const msg = $('connTestMsg');
  msg.className = 'text-sm rounded-lg px-sm py-sm bg-surface-container-high text-on-surface-variant';
  msg.textContent = 'Testing…';
  msg.classList.remove('hidden');
  try {
    const res = await fetch(`${API}?action=test_connection`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conn: formConn() }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    msg.className = 'text-sm rounded-lg px-sm py-sm bg-green-950/30 text-green-400 border border-green-900/50';
    msg.textContent = `Connected · MySQL ${data.version}`;
  } catch (e) {
    msg.className = 'text-sm rounded-lg px-sm py-sm bg-red-950/30 text-red-400 border border-red-900/50';
    msg.textContent = e.message;
  }
}

function saveProfileFromForm(e) {
  e.preventDefault();
  const f = $('connForm');
  const list = loadProfiles();
  const id = f.dataset.id || uid();
  const remember = f.remember.checked;
  const prof = {
    id, name: f.name.value.trim() || 'Untitled', host: f.host.value.trim(),
    port: +f.port.value || 3306, user: f.user.value.trim(),
    db: f.db.value.trim(), remember,
  };
  if (remember) prof.pass = f.pass.value;
  if (f.pass.value !== '') runtimePass[id] = f.pass.value; // also use this session
  const idx = list.findIndex(p => p.id === id);
  if (idx >= 0) list[idx] = prof; else list.push(prof);
  saveProfiles(list);
  if (!activeId() || idx < 0) setActiveId(id);
  renderProfileSelect();
  switchProfile(id);
}

function deleteProfile(id) {
  if (!confirm('Delete this connection?')) return;
  const list = loadProfiles().filter(p => p.id !== id);
  saveProfiles(list);
  delete runtimePass[id];
  if (activeId() === id) { if (list[0]) setActiveId(list[0].id); else localStorage.removeItem(ACTIVE_KEY); }
  renderProfileSelect();
  renderProfileList();
  if (!activeProfile()) showList(); // back to empty welcome
}

async function switchProfile(id) {
  setActiveId(id);
  renderProfileSelect();
  state.db = null; state.table = null;
  const p = activeProfile();
  if (!p) return;
  if (activeConn() === null) { // needs password
    showForm(p);
    $('connModal').classList.remove('hidden');
    return;
  }
  closeConnModal();
  $('connInfo').textContent = `Connecting to ${p.name}…`;
  try { await loadDatabases(); }
  catch (e) { renderEmpty('Connection error: ' + e.message); $('connInfo').textContent = 'Disconnected'; }
}

// wiring
$('btnConnections').onclick = openConnModal;
$('connClose').onclick = closeConnModal;
$('btnNewProfile').onclick = () => showForm(null);
$('btnCancelForm').onclick = () => { activeProfile() ? showList() : showList(); };
$('btnTest').onclick = testConnection;
$('connForm').onsubmit = saveProfileFromForm;
$('profileSelect').onchange = (e) => switchProfile(e.target.value);
$('connModal').addEventListener('click', (e) => { if (e.target.id === 'connModal') closeConnModal(); });

// theme switcher
const mql = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(mode) {
  const dark = mode === 'dark' || (mode === 'system' && mql.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('.theme-seg button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
}
function setTheme(mode) { localStorage.setItem('strata-theme', mode); applyTheme(mode); }
document.querySelectorAll('.theme-seg button').forEach(b =>
  b.onclick = () => setTheme(b.dataset.mode));
mql.onchange = () => { if ((localStorage.getItem('strata-theme') || 'system') === 'system') applyTheme('system'); };
applyTheme(localStorage.getItem('strata-theme') || 'system');

// ---- boot ----------------------------------------------------------------
async function boot() {
  renderProfileSelect();
  const p = activeProfile();
  if (!p) { openConnModal(); return; }          // first run: no profiles
  if (activeConn() === null) {                   // profile exists, password needed
    $('connInfo').textContent = 'Password required';
    showForm(p); $('connModal').classList.remove('hidden');
    return;
  }
  try { await loadDatabases(); }
  catch (e) { renderEmpty('Init error: ' + e.message); $('connInfo').textContent = 'Disconnected'; }
}
boot();

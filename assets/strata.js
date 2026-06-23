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
  const m = $('gridMsg');
  m.textContent = 'Loading…'; m.classList.remove('hidden');
  const t0 = performance.now();
  let data;
  try {
    data = await api('rows', {
      db: state.db, table: state.table, page: state.page, per_page: state.perPage,
      sort: state.sort, dir: state.dir, search: state.search,
    });
  } catch (e) { renderEmpty('Error: ' + e.message); return; }
  const ms = Math.round(performance.now() - t0);
  m.classList.add('hidden'); // clear "Loading…"

  // primary-key columns drive selection / edit / delete
  state.columns = data.columns;
  state.fks = data.fks || {};
  state.pkCols = data.columns.filter(c => c.key === 'PRI').map(c => c.name);
  state.hiddenCols = loadHidden();
  state.selected = new Map(); // rowKey -> pk object
  updateBulkBar();
  const visible = data.columns.filter(c => !state.hiddenCols.has(c.name));

  // context header
  $('ctxTable').textContent = data.table;
  $('ctxSchema').textContent = `SCHEMA: ${state.db.toUpperCase()}`;
  $('ctxRows').textContent = `${data.total.toLocaleString()} rows`;
  $('queryTime').textContent = `Query took ${ms}ms`;
  const from = data.total ? (data.page - 1) * data.per_page + 1 : 0;
  const to = Math.min(data.page * data.per_page, data.total);
  $('pageInfo').textContent = `${from}-${to} of ${data.total.toLocaleString()}`;

  // head
  const hasPk = state.pkCols.length > 0;
  const selTh = hasPk
    ? `<th class="px-md py-sm w-10"><input id="selAll" type="checkbox" class="rounded border-outline-variant text-primary focus:ring-primary"/></th>`
    : '';
  $('gridHead').innerHTML = `<tr class="bg-surface-container-highest border-b border-outline-variant">${selTh}${
    visible.map(c => {
      const sorted = state.sort === c.name;
      const arrow = sorted ? (state.dir === 'ASC' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
      const keyIcon = c.key === 'PRI' ? '<span class="material-symbols-outlined text-[13px] text-tertiary">key</span>' : '';
      return `<th data-col="${esc(c.name)}" class="px-md py-sm text-[13px] text-on-surface-variant uppercase tracking-wider cursor-pointer hover:bg-surface-variant transition-colors select-none">
        <div class="flex items-center gap-xs">${keyIcon}${esc(c.name)}
          <span class="material-symbols-outlined text-[14px] ${sorted ? 'opacity-100 text-primary' : 'opacity-40'}">${arrow}</span></div></th>`;
    }).join('')
  }</tr>`;
  if (hasPk) $('selAll').onchange = (e) => toggleSelectAll(e.target.checked);
  $('gridHead').querySelectorAll('th').forEach(th =>
    th.onclick = () => {
      const c = th.dataset.col;
      if (state.sort === c) state.dir = state.dir === 'ASC' ? 'DESC' : 'ASC';
      else { state.sort = c; state.dir = 'ASC'; }
      state.page = 1; loadRows();
    });

  // body
  if (!data.rows.length) { renderEmpty(state.search ? 'No rows match search' : 'Table is empty'); return; }
  $('gridBody').innerHTML = data.rows.map((r, i) => {
    const selCell = hasPk
      ? `<td class="px-md py-xs"><input type="checkbox" data-sel="${i}" class="rowSel rounded border-outline-variant text-primary focus:ring-primary"/></td>`
      : '';
    return `<tr data-row="${i}" class="group border-b border-outline-variant hover:bg-surface-container-highest/50 transition-colors cursor-pointer ${i % 2 ? 'bg-surface-container-low/30' : ''}">${selCell}${
      visible.map(c => {
        const fk = state.fks[c.name];
        const v = r[c.name];
        const inner = (fk && v !== null)
          ? `<a href="#" class="fk-link text-primary underline decoration-dotted decoration-primary/40 hover:decoration-primary" data-fktable="${esc(fk.table)}" data-fkval="${esc(v)}">${esc(v)}<span class="material-symbols-outlined text-[12px] align-middle ml-[2px]">north_east</span></a>`
          : cell(c, v);
        return `<td class="px-md py-xs">${inner}</td>`;
      }).join('')
    }</tr>`;
  }).join('');
  state._lastData = data;
  // foreign-key links jump to the referenced table filtered by value
  $('gridBody').querySelectorAll('.fk-link').forEach(a => a.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    jumpToFk(a.dataset.fktable, a.dataset.fkval);
  });
  // row click → open detail drawer (ignore clicks on the checkbox cell)
  $('gridBody').querySelectorAll('tr').forEach(tr => {
    tr.onclick = (e) => {
      if (e.target.closest('input[type=checkbox]')) return;
      openRowDrawer('view', data.rows[+tr.dataset.row]);
    };
  });
  if (hasPk) $('gridBody').querySelectorAll('.rowSel').forEach(cb => {
    cb.onchange = () => {
      const row = data.rows[+cb.dataset.sel];
      const k = rowKey(row);
      if (cb.checked) state.selected.set(k, rowPk(row));
      else state.selected.delete(k);
      updateBulkBar();
    };
  });
}

// ---- selection helpers (Phase 3) -----------------------------------------
function rowPk(row) { const o = {}; for (const c of state.pkCols) o[c] = row[c]; return o; }
function rowKey(row) { return state.pkCols.map(c => row[c]).join('\x1f'); }

function toggleSelectAll(on) {
  const d = state._lastData; if (!d) return;
  state.selected = new Map();
  if (on) d.rows.forEach(r => state.selected.set(rowKey(r), rowPk(r)));
  $('gridBody').querySelectorAll('.rowSel').forEach(cb => cb.checked = on);
  updateBulkBar();
}

function updateBulkBar() {
  const n = state.selected ? state.selected.size : 0;
  const bar = $('bulkBar');
  bar.classList.toggle('hidden', n === 0);
  bar.classList.toggle('flex', n > 0);
  if (n) $('bulkCount').textContent = `${n} selected`;
}

async function bulkDelete() {
  const pks = [...state.selected.values()];
  if (!pks.length) return;
  if (!confirm(`Delete ${pks.length} row(s)? This cannot be undone.`)) return;
  try {
    const res = await api('row_delete', { db: state.db, table: state.table, pks });
    state.selected = new Map();
    await loadRows();
    flash(`Deleted ${res.deleted} row(s)`);
  } catch (e) { alert('Delete failed: ' + e.message); }
}

// events
$('dbSelect').onchange = (e) => { state.db = e.target.value; loadTables(); };
$('tableFilter').oninput = renderTableList;
$('perPage').onchange = (e) => { state.perPage = +e.target.value; state.page = 1; loadRows(); };
$('prevPage').onclick = () => { if (state.page > 1) { state.page--; loadRows(); } };
$('nextPage').onclick = () => { const d = state._lastData; if (d && state.page < d.pages) { state.page++; loadRows(); } };
$('btnRefresh').onclick = loadRows;
$('btnExport').onclick = exportFullCsv;
let searchTimer;
$('rowSearch').oninput = (e) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; loadRows(); }, 300); };

// ---- row drawer / CRUD (Phase 3) -----------------------------------------

function flash(msg) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'fixed bottom-md right-md z-[200] px-md py-sm rounded-lg bg-surface-container-highest border border-outline-variant text-on-surface shadow-2xl text-sm transition-opacity';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

const NUMERIC = /^(tinyint|smallint|mediumint|int|bigint|decimal|float|double|year)$/;
const LONGTEXT = /^(text|mediumtext|longtext|tinytext|blob|mediumblob|longblob|json)$/;

function drawerMsg(text, kind) {
  const m = $('drawerMsg');
  if (!text) { m.classList.add('hidden'); return; }
  const tone = kind === 'error'
    ? 'bg-red-950/30 text-red-400 border border-red-900/50'
    : 'bg-green-950/30 text-green-400 border border-green-900/50';
  m.className = `mx-lg mb-sm text-sm rounded-lg px-sm py-sm ${tone}`;
  m.textContent = text;
}

function openRowDrawer(mode, row) {
  if (!state.columns) return;
  state.drawer = { mode, row: row || {}, table: state.table };
  $('rowDrawer').classList.remove('hidden');
  renderDrawer();
}
function closeRowDrawer() { $('rowDrawer').classList.add('hidden'); }

function renderDrawer() {
  const { mode, row } = state.drawer;
  const editable = mode !== 'view';
  $('drawerTitle').textContent = mode === 'new' ? `New row · ${state.table}` : state.table;
  $('drawerMode').textContent = mode.toUpperCase();
  drawerMsg('');

  $('drawerBody').innerHTML = state.columns.map(c => {
    const val = mode === 'new' ? (c.default ?? '') : row[c.name];
    // Only reflect a real NULL (view/edit). New rows start non-null; use the toggle for NULL.
    const isNull = mode !== 'new' && row[c.name] === null;
    const auto = String(c.extra).includes('auto_increment');
    const pk = c.key === 'PRI';
    // lock auto-increment always; lock PK while editing an existing row
    const locked = !editable || auto || (pk && mode === 'edit');
    const long = LONGTEXT.test(c.type);
    const inputType = NUMERIC.test(c.type) ? 'number' : 'text';
    const common = `data-col="${esc(c.name)}" class="drawerInput w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-sm text-on-surface font-mono text-[13px] focus:ring-primary focus:border-primary disabled:opacity-50" ${locked ? 'disabled' : ''}`;
    const ctrl = long
      ? `<textarea ${common} rows="3" placeholder="${auto ? '(auto)' : ''}">${isNull ? '' : esc(val)}</textarea>`
      : `<input ${common} type="${inputType}" value="${isNull ? '' : esc(val)}" placeholder="${auto ? '(auto)' : ''}"/>`;
    const keyIcon = pk ? '<span class="material-symbols-outlined text-[13px] text-tertiary">key</span>' : '';
    const nullBtn = (c.nullable === 'YES' && editable && !auto)
      ? `<button type="button" data-null="${esc(c.name)}" class="nullToggle text-[10px] px-sm py-[2px] rounded border ${isNull ? 'border-primary text-primary' : 'border-outline-variant text-on-surface-variant'}">NULL</button>`
      : '';
    return `<div class="field" data-field="${esc(c.name)}" data-isnull="${isNull ? '1' : '0'}">
      <div class="flex items-center justify-between mb-xs">
        <label class="flex items-center gap-xs text-xs uppercase tracking-wider text-on-surface-variant opacity-80">${keyIcon}${esc(c.name)}
          <span class="opacity-50 lowercase font-mono">${esc(c.type)}</span></label>
        ${nullBtn}
      </div>${ctrl}</div>`;
  }).join('');

  // NULL toggles
  $('drawerBody').querySelectorAll('.nullToggle').forEach(btn => {
    btn.onclick = () => {
      const field = btn.closest('.field');
      const on = field.dataset.isnull !== '1';
      field.dataset.isnull = on ? '1' : '0';
      const input = field.querySelector('.drawerInput');
      input.disabled = on;
      if (on) input.value = '';
      btn.classList.toggle('border-primary', on);
      btn.classList.toggle('text-primary', on);
      btn.classList.toggle('border-outline-variant', !on);
      btn.classList.toggle('text-on-surface-variant', !on);
    };
  });

  // typing clears a NULL flag
  $('drawerBody').querySelectorAll('.drawerInput').forEach(input => {
    input.oninput = () => {
      const field = input.closest('.field');
      if (field.dataset.isnull === '1') {
        field.dataset.isnull = '0';
        const btn = field.querySelector('.nullToggle');
        if (btn) { btn.classList.remove('border-primary', 'text-primary'); btn.classList.add('border-outline-variant', 'text-on-surface-variant'); }
      }
    };
  });

  // footer buttons by mode + PK availability
  const hasPk = state.pkCols && state.pkCols.length > 0;
  $('drawerEdit').classList.toggle('hidden', mode !== 'view' || !hasPk);
  $('drawerSave').classList.toggle('hidden', mode === 'view');
  $('drawerDelete').classList.toggle('hidden', mode === 'new' || !hasPk);
  $('drawerCancel').textContent = mode === 'view' ? 'Close' : 'Cancel';
}

function collectDrawerValues() {
  const out = {};
  $('drawerBody').querySelectorAll('.field').forEach(field => {
    const col = field.dataset.field;
    const input = field.querySelector('.drawerInput');
    if (input.disabled && field.dataset.isnull !== '1') return; // locked (auto/pk) → skip
    out[col] = field.dataset.isnull === '1' ? null : input.value;
  });
  return out;
}

async function saveDrawer() {
  const { mode, row } = state.drawer;
  const values = collectDrawerValues();
  const params = { db: state.db, table: state.table, values };
  if (mode === 'edit') params.pk = rowPk(row);
  try {
    const res = await api('row_save', params);
    closeRowDrawer();
    await loadRows();
    flash(mode === 'edit' ? `Saved (${res.affected} changed)` : `Inserted row #${res.insertId}`);
  } catch (e) { drawerMsg(e.message, 'error'); }
}

async function deleteDrawerRow() {
  const { row } = state.drawer;
  if (!confirm('Delete this row? This cannot be undone.')) return;
  try {
    await api('row_delete', { db: state.db, table: state.table, pks: [rowPk(row)] });
    closeRowDrawer();
    await loadRows();
    flash('Row deleted');
  } catch (e) { drawerMsg(e.message, 'error'); }
}

// drawer wiring
$('btnNewRow').onclick = () => { if (state.table) openRowDrawer('new', null); };
$('drawerClose').onclick = closeRowDrawer;
$('rowDrawerScrim').onclick = closeRowDrawer;
$('drawerCancel').onclick = closeRowDrawer;
$('drawerEdit').onclick = () => { state.drawer.mode = 'edit'; renderDrawer(); };
$('drawerSave').onclick = saveDrawer;
$('drawerDelete').onclick = deleteDrawerRow;
$('btnBulkDelete').onclick = bulkDelete;

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

// ---- view switching ------------------------------------------------------
function switchView(name) {
  $('viewBrowser').classList.toggle('hidden', name !== 'browser');
  $('viewQuery').classList.toggle('hidden', name !== 'query');
  $('viewDashboard').classList.toggle('hidden', name !== 'dashboard');
  document.querySelectorAll('.navtab').forEach(t => {
    const on = t.dataset.view === name;
    t.classList.toggle('text-primary', on);
    t.classList.toggle('font-bold', on);
    t.classList.toggle('border-b-2', on);
    t.classList.toggle('border-primary', on);
    t.classList.toggle('py-sm', on);
    t.classList.toggle('text-on-surface-variant', !on);
    t.classList.toggle('font-medium', !on);
  });
  if (name === 'query') { $('qDbName').textContent = state.db || '—'; $('sqlEditor').focus(); }
  if (name === 'dashboard') loadStats();
}

// ---- dashboard (Phase 5) -------------------------------------------------
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(1) + ' ' + u[i];
}
function fmtDuration(s) {
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}
function statCard(icon, label, value, sub) {
  return `<div class="glass-panel rounded-xl p-md flex flex-col gap-xs">
    <div class="flex items-center gap-sm text-on-surface-variant"><span class="material-symbols-outlined text-[20px] text-primary">${icon}</span><span class="text-xs uppercase tracking-wider opacity-70">${esc(label)}</span></div>
    <div class="font-display text-xl font-bold text-on-surface truncate" title="${esc(value)}">${esc(value)}</div>
    ${sub ? `<div class="text-xs text-on-surface-variant opacity-60 font-mono">${esc(sub)}</div>` : ''}
  </div>`;
}

async function loadStats() {
  $('statCards').innerHTML = `<div class="col-span-4 text-center opacity-60 py-lg">Loading metrics…</div>`;
  let s;
  try { s = await api('stats', { db: state.db || '' }); }
  catch (e) { $('statCards').innerHTML = `<div class="col-span-4 text-center text-error py-lg">${esc(e.message)}</div>`; return; }

  $('dashServer').textContent = `MySQL ${s.version}`;
  $('statCards').innerHTML = [
    statCard('dns', 'Databases', s.dbCount.toLocaleString(), 'on this server'),
    statCard('table_rows', `Tables in ${state.db || '—'}`, s.tableCount.toLocaleString(), fmtBytes(s.dbSize) + ' on disk'),
    statCard('lan', 'Connections', s.threadsConnected.toLocaleString(), `${s.threadsRunning} running`),
    statCard('schedule', 'Uptime', fmtDuration(s.uptime), `since start`),
    statCard('database', 'Total queries', s.questions.toLocaleString(), null),
    statCard('warning', 'Slow queries', s.slowQueries.toLocaleString(), null),
    statCard('download', 'Bytes sent', fmtBytes(s.bytesSent), null),
    statCard('upload', 'Bytes received', fmtBytes(s.bytesReceived), null),
  ].join('');

  const b = s.breakdown;
  const max = Math.max(1, b.select, b.insert, b.update, b.delete);
  const bar = (label, val, color) => `<div class="flex items-center gap-md">
    <span class="w-16 text-xs uppercase tracking-wider text-on-surface-variant opacity-70">${label}</span>
    <div class="flex-1 h-5 rounded bg-surface-container-lowest overflow-hidden"><div class="h-full ${color}" style="width:${(val / max * 100).toFixed(1)}%"></div></div>
    <span class="w-24 text-right font-mono text-xs text-on-surface-variant">${val.toLocaleString()}</span>
  </div>`;
  $('breakdownChart').innerHTML =
    bar('SELECT', b.select, 'bg-primary') +
    bar('INSERT', b.insert, 'bg-green-500') +
    bar('UPDATE', b.update, 'bg-amber-500') +
    bar('DELETE', b.delete, 'bg-red-500');
}
$('btnRefreshStats').onclick = loadStats;
document.querySelectorAll('.navtab').forEach(t => t.onclick = () => switchView(t.dataset.view));

// ---- query runner (Phase 4) ----------------------------------------------
const QTABS_KEY = 'strata-qtabs';
const QHIST_KEY = 'strata-qhistory';

function loadQTabs() {
  try { const t = JSON.parse(localStorage.getItem(QTABS_KEY)); if (t && t.tabs?.length) return t; } catch {}
  return { tabs: [{ id: uid(), name: 'Query 1', sql: '' }], active: 0 };
}
let qtabs = loadQTabs();
function saveQTabs() { localStorage.setItem(QTABS_KEY, JSON.stringify(qtabs)); }

function renderQTabs() {
  $('queryTabs').innerHTML = qtabs.tabs.map((t, i) => {
    const on = i === qtabs.active;
    return `<div data-tab="${i}" class="qtab flex items-center gap-xs px-md py-xs rounded-lg cursor-pointer whitespace-nowrap ${on ? 'bg-secondary-container text-on-secondary-container font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}">
      <span>${esc(t.name)}</span>
      ${qtabs.tabs.length > 1 ? `<span data-close="${i}" class="material-symbols-outlined text-[15px] opacity-60 hover:opacity-100">close</span>` : ''}
    </div>`;
  }).join('');
  $('queryTabs').querySelectorAll('.qtab').forEach(el => {
    el.onclick = (e) => {
      if (e.target.dataset.close !== undefined) { closeQTab(+e.target.dataset.close); return; }
      selectQTab(+el.dataset.tab);
    };
  });
}
function syncEditorToTab() { if (qtabs.tabs[qtabs.active]) { qtabs.tabs[qtabs.active].sql = $('sqlEditor').value; saveQTabs(); } }
function selectQTab(i) { syncEditorToTab(); qtabs.active = i; $('sqlEditor').value = qtabs.tabs[i].sql; saveQTabs(); renderQTabs(); }
function newQTab() {
  syncEditorToTab();
  qtabs.tabs.push({ id: uid(), name: `Query ${qtabs.tabs.length + 1}`, sql: '' });
  qtabs.active = qtabs.tabs.length - 1;
  $('sqlEditor').value = '';
  saveQTabs(); renderQTabs(); $('sqlEditor').focus();
}
function closeQTab(i) {
  qtabs.tabs.splice(i, 1);
  if (qtabs.active >= qtabs.tabs.length) qtabs.active = qtabs.tabs.length - 1;
  $('sqlEditor').value = qtabs.tabs[qtabs.active].sql;
  saveQTabs(); renderQTabs();
}

function loadHistory() { try { return JSON.parse(localStorage.getItem(QHIST_KEY)) || []; } catch { return []; } }
function pushHistory(sql) {
  let h = loadHistory().filter(x => x.sql !== sql);
  h.unshift({ sql, ts: Date.now(), db: state.db });
  h = h.slice(0, 40);
  localStorage.setItem(QHIST_KEY, JSON.stringify(h));
}
function toggleHistory() {
  const panel = $('historyPanel');
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
  const h = loadHistory();
  panel.innerHTML = h.length
    ? h.map(x => `<button data-sql="${esc(x.sql)}" class="histItem block w-full text-left px-sm py-xs rounded hover:bg-surface-container-high font-mono text-[12px] text-on-surface-variant truncate">${esc(x.sql)}</button>`).join('')
    : `<p class="text-center opacity-60 py-md">No history yet.</p>`;
  panel.querySelectorAll('.histItem').forEach(b => b.onclick = () => {
    $('sqlEditor').value = b.dataset.sql; syncEditorToTab(); panel.classList.add('hidden'); $('sqlEditor').focus();
  });
  panel.classList.remove('hidden');
}

async function runQuery(explain) {
  let sql = $('sqlEditor').value.trim();
  if (!sql) return;
  syncEditorToTab();
  const runSql = explain ? 'EXPLAIN ' + sql : sql;
  $('qMeta').textContent = 'Running…';
  try {
    const data = await api('query', { db: state.db || '', sql: runSql });
    pushHistory(sql);
    renderQueryResult(data);
  } catch (e) {
    renderQueryError(e.message);
  }
}

function renderQueryError(msg) {
  $('qHead').innerHTML = ''; $('qBody').innerHTML = '';
  const m = $('qMsg');
  m.className = 'p-lg m-md rounded-lg bg-red-950/30 text-red-400 border border-red-900/50 font-mono text-sm whitespace-pre-wrap text-left';
  m.textContent = msg;
  m.classList.remove('hidden');
  $('qMeta').textContent = 'Error';
}

function renderQueryResult(data) {
  const m = $('qMsg');
  if (data.type === 'exec') {
    $('qHead').innerHTML = ''; $('qBody').innerHTML = '';
    m.className = 'p-xl text-center text-on-surface';
    m.innerHTML = `<span class="material-symbols-outlined text-[40px] text-green-400">check_circle</span><div class="mt-sm">${data.affected} row(s) affected</div>`;
    m.classList.remove('hidden');
    $('qMeta').textContent = `${data.affected} affected · ${data.ms}ms`;
    return;
  }
  // result set
  m.className = 'p-xl text-center text-on-surface-variant opacity-60 hidden';
  $('qHead').innerHTML = `<tr class="bg-surface-container-highest border-b border-outline-variant">${
    data.columns.map(c => `<th class="px-md py-sm text-[13px] text-on-surface-variant uppercase tracking-wider">${esc(c.name)}</th>`).join('')
  }</tr>`;
  if (!data.rows.length) {
    $('qBody').innerHTML = '';
    m.textContent = 'Query returned no rows.'; m.classList.remove('hidden');
  } else {
    $('qBody').innerHTML = data.rows.map((r, i) =>
      `<tr class="border-b border-outline-variant hover:bg-surface-container-highest/50 ${i % 2 ? 'bg-surface-container-low/30' : ''}">${
        data.columns.map(c => {
          const v = r[c.name];
          return `<td class="px-md py-xs">${v === null ? '<span class="opacity-30 italic">NULL</span>' : `<span class="text-on-surface-variant" title="${esc(v)}">${esc(String(v).slice(0, 200))}</span>`}</td>`;
        }).join('')
      }</tr>`).join('');
  }
  $('qMeta').textContent = `${data.rowCount} row(s) · ${data.ms}ms`;
  state._lastQuery = data;
}

// query wiring
$('btnNewTab').onclick = newQTab;
$('btnRun').onclick = () => runQuery(false);
$('btnExplain').onclick = () => runQuery(true);
$('btnHistory').onclick = toggleHistory;
$('sqlEditor').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runQuery(false); }
});
$('sqlEditor').value = qtabs.tabs[qtabs.active].sql;
renderQTabs();

// ---- polish: columns, FK jump, full export, shortcuts (Phase 6) ----------
function hiddenKey() { return `strata-hidden:${state.db}.${state.table}`; }
function loadHidden() { try { return new Set(JSON.parse(localStorage.getItem(hiddenKey())) || []); } catch { return new Set(); } }
function saveHidden(s) { localStorage.setItem(hiddenKey(), JSON.stringify([...s])); }

function jumpToFk(table, val) {
  if (!state.tables.find(t => t.name === table)) { flash(`Referenced table "${table}" not in this database`); return; }
  state.table = table; state.page = 1; state.sort = ''; state.dir = 'ASC';
  state.search = String(val); $('rowSearch').value = String(val);
  renderTableList(); loadRows();
}

function toggleColMenu() {
  const m = $('colMenu');
  if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
  const cols = state.columns || [];
  m.innerHTML = cols.map(c => {
    const hidden = state.hiddenCols.has(c.name);
    return `<label class="flex items-center gap-sm px-sm py-xs rounded hover:bg-surface-container-high cursor-pointer text-[13px]">
      <input type="checkbox" data-col="${esc(c.name)}" ${hidden ? '' : 'checked'} class="rounded border-outline-variant text-primary focus:ring-primary"/>
      <span class="truncate">${esc(c.name)}</span></label>`;
  }).join('') || '<p class="text-xs opacity-60 p-sm">No columns</p>';
  m.querySelectorAll('input').forEach(cb => cb.onchange = () => {
    if (cb.checked) state.hiddenCols.delete(cb.dataset.col); else state.hiddenCols.add(cb.dataset.col);
    saveHidden(state.hiddenCols); loadRows();
  });
  m.classList.remove('hidden');
}

async function exportFullCsv() {
  if (!state.table) return;
  const conn = activeConn(); if (!conn) return;
  flash('Preparing CSV…');
  let res;
  try {
    res = await fetch(`${API}?action=export_csv`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conn, db: state.db, table: state.table, search: state.search, sort: state.sort, dir: state.dir }),
    });
  } catch (e) { alert('Export failed: ' + e.message); return; }
  if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Export failed' })); alert(e.error || 'Export failed'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${state.db}.${state.table}.csv`; a.click();
  URL.revokeObjectURL(url);
  flash('CSV downloaded');
}

$('btnColumns').onclick = (e) => { e.stopPropagation(); toggleColMenu(); };
document.addEventListener('click', (e) => { if (!e.target.closest('#colMenu') && !e.target.closest('#btnColumns')) $('colMenu').classList.add('hidden'); });

// global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeRowDrawer();
    if (activeConn()) $('connModal').classList.add('hidden');
    $('colMenu').classList.add('hidden');
    $('historyPanel').classList.add('hidden');
    return;
  }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key === '/') { e.preventDefault(); $('rowSearch').focus(); }
  else if (e.key === 'n' && state.table && !$('viewBrowser').classList.contains('hidden')) { e.preventDefault(); openRowDrawer('new', null); }
});

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

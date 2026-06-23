// Strata — front-end app logic.
// Vanilla JS, no framework. Loaded with `defer` from index.html.
// Pre-paint theme application lives inline in index.html (must run before first paint).

const API = 'api.php';
const state = { db: null, table: null, schema: 'PUBLIC', page: 1, perPage: 50, sort: '', dir: 'ASC', search: '', tables: [] };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params });
  const res = await fetch(`${API}?${qs}`);
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
  state.db = ordered[0];
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

loadDatabases().catch(e => renderEmpty('Init error: ' + e.message));

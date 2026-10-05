// R3 Zip — interfaz
'use strict';
const $ = (id) => document.getElementById(id);
const api = window.r3;

const state = {
  archive: null,      // ruta del comprimido abierto
  info: null,         // { type, items, ... }
  password: '',
  cwd: '',            // carpeta interna actual ('' = raíz)
  selected: new Set(),
  sort: { k: 'name', desc: false },
  inputs: [],         // elementos a comprimir [{ path, name, dir, size }]
};

// ---------- utilidades
const fmtSize = (n) => {
  if (n == null || isNaN(n)) return '';
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toLocaleString('es-CO', { maximumFractionDigits: n < 10 ? 1 : 0 }) + ' ' + u[i];
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON_FILE = '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>';
const ICON_DIR = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

function show(view) {
  $('home').hidden = view !== 'home';
  $('archive').hidden = view !== 'archive';
}

function message(title, text, buttons = [{ label: 'Aceptar', value: 'ok', gold: true }]) {
  return new Promise((resolve) => {
    const d = $('dlgMsg');
    $('msgTitle').textContent = title;
    $('msgText').textContent = text;
    $('msgButtons').innerHTML = buttons.map((b) => `<button value="${b.value}" class="btn ${b.gold ? 'gold' : 'ghost'}">${esc(b.label)}</button>`).join('');
    d.onclose = () => resolve(d.returnValue);
    d.returnValue = '';
    d.showModal();
  });
}

function askPassword(msg) {
  return new Promise((resolve) => {
    const d = $('dlgPassword');
    $('pwMsg').textContent = msg || 'Este archivo está protegido. Escriba la contraseña.';
    $('pwInput').value = ''; $('pwInput').type = 'password'; $('pwShow').checked = false;
    d.returnValue = '';
    d.onclose = () => resolve(d.returnValue === 'ok' ? $('pwInput').value : null);
    d.showModal();
    $('pwInput').focus();
  });
}
$('pwShow').onchange = () => { $('pwInput').type = $('pwShow').checked ? 'text' : 'password'; };

// ---------- progreso
let jobSeq = 0;
let currentJob = null;
api.on('job:progress', ({ id, p, t }) => {
  if (id !== currentJob) return;
  $('prBar').style.width = p + '%';
  $('prPct').textContent = p + ' %';
  if (t) $('prFile').textContent = t;
});
$('prCancel').onclick = () => { if (currentJob) api.cancel(currentJob); $('prTitle').textContent = 'Cancelando…'; };

async function withProgress(title, fn) {
  const id = 'j' + (++jobSeq);
  currentJob = id;
  $('prTitle').textContent = title;
  $('prBar').style.width = '0';
  $('prPct').textContent = '0 %';
  $('prFile').textContent = '';
  const d = $('dlgProgress');
  d.onkeydown = (e) => { if (e.key === 'Escape') e.preventDefault(); };
  d.showModal();
  try { return await fn(id); }
  finally { currentJob = null; d.close(); }
}

// ---------- abrir comprimido
async function openArchive(file, password = '') {
  let pw = password;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await api.list(file, pw);
    if (r.ok) {
      state.archive = file; state.info = r.data; state.password = pw;
      state.cwd = ''; state.selected.clear();
      // Si el contenido está cifrado y aún no hay contraseña, se pedirá al extraer
      renderArchive();
      show('archive');
      return true;
    }
    if (r.code === 'PASSWORD') {
      pw = await askPassword(attempt ? 'Contraseña incorrecta. Intente de nuevo.' : 'Este archivo tiene los nombres protegidos. Escriba la contraseña para ver su contenido.');
      if (pw == null) return false;
      continue;
    }
    await message('No se pudo abrir', `${(await api.pathInfo(file)).base}\n\n${r.error}`);
    return false;
  }
  return false;
}

// Construye la vista de una carpeta interna a partir de la lista plana de rutas
function entriesAt(cwd) {
  const pre = cwd ? cwd + '/' : '';
  const map = new Map();
  for (const it of state.info.items) {
    if (!it.path.startsWith(pre) || it.path === cwd) continue;
    const rest = it.path.slice(pre.length);
    const slash = rest.indexOf('/');
    const name = slash < 0 ? rest : rest.slice(0, slash);
    if (!name) continue;
    const full = pre + name;
    let e = map.get(name);
    if (!e) { e = { name, path: full, dir: slash >= 0 || it.dir, size: 0, packed: 0, modified: '', encrypted: false, count: 0 }; map.set(name, e); }
    if (slash < 0) { e.dir = it.dir; e.modified = it.modified; }
    if (!it.dir) { e.size += it.size; e.packed += it.packed || 0; e.count++; }
    if (it.encrypted) e.encrypted = true;
    if (!e.modified && it.modified) e.modified = it.modified;
  }
  const arr = [...map.values()];
  const { k, desc } = state.sort;
  arr.sort((a, b) => (b.dir - a.dir) || cmp(a[k], b[k]) * (desc ? -1 : 1));
  return arr;
}
const cmp = (a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' }));

async function renderArchive() {
  const { info } = state;
  const base = (await api.pathInfo(state.archive)).base;
  $('archTitle').textContent = base;
  const files = info.items.filter((i) => !i.dir);
  const total = files.reduce((s, i) => s + i.size, 0);
  const enc = info.items.some((i) => i.encrypted);
  $('archMeta').textContent = `${info.type.toUpperCase()} · ${files.length.toLocaleString('es-CO')} archivo(s) · ${fmtSize(total)}` +
    (info.physicalSize ? ` → ${fmtSize(info.physicalSize)}` : '') + (enc ? ' · 🔒 protegido con contraseña' : '');
  document.title = base + ' — R3 Zip';
  renderFolder();
}

function renderFolder() {
  const list = entriesAt(state.cwd);
  const tb = $('rows');
  tb.innerHTML = list.length ? list.map((e) => `
    <tr data-p="${esc(e.path)}" class="${e.dir ? 'dir' : ''} ${state.selected.has(e.path) ? 'sel' : ''}">
      <td><span class="nm">${e.dir ? ICON_DIR : ICON_FILE}${esc(e.name)}${e.encrypted ? '<span class="lock" title="Protegido">🔒</span>' : ''}</span></td>
      <td class="num">${e.dir ? (e.count + ' elem.') : fmtSize(e.size)}</td>
      <td class="num">${e.dir ? '' : (state.info.solid ? '<span class="muted" title="Archivo sólido: se comprime en bloque">en bloque</span>' : fmtSize(e.packed))}</td>
      <td>${esc((e.modified || '').slice(0, 16))}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="empty">Carpeta vacía</td></tr>';
  // migas
  const parts = state.cwd ? state.cwd.split('/') : [];
  const c = $('crumbs');
  c.innerHTML = '<a data-c="">Raíz</a>' + parts.map((p, i) => ` › <a data-c="${esc(parts.slice(0, i + 1).join('/'))}">${esc(p)}</a>`).join('');
  document.querySelectorAll('.files th').forEach((th) => { th.classList.toggle('sorted', th.dataset.k === state.sort.k); th.classList.toggle('desc', th.dataset.k === state.sort.k && state.sort.desc); });
  updateSelection();
}

function updateSelection() {
  const n = state.selected.size;
  $('btnExtractSel').disabled = !n;
  $('btnExtractSel').textContent = n ? `Extraer selección (${n})` : 'Extraer selección';
  const files = state.info.items.filter((i) => !i.dir);
  $('status').textContent = (n ? `${n} seleccionado(s) · ` : '') + `${entriesAt(state.cwd).length} elemento(s) en esta carpeta · doble clic para abrir · Ctrl+A selecciona todo · ${files.length} archivo(s) en total`;
}

let lastClicked = null;
$('rows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-p]'); if (!tr) return;
  const p = tr.dataset.p;
  const rows = [...$('rows').querySelectorAll('tr[data-p]')].map((r) => r.dataset.p);
  if (e.shiftKey && lastClicked) {
    const a = rows.indexOf(lastClicked), b = rows.indexOf(p);
    if (!(e.ctrlKey || e.metaKey)) state.selected.clear();
    rows.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => state.selected.add(x));
  } else if (e.ctrlKey || e.metaKey) {
    state.selected.has(p) ? state.selected.delete(p) : state.selected.add(p);
    lastClicked = p;
  } else { state.selected.clear(); state.selected.add(p); lastClicked = p; }
  $('rows').querySelectorAll('tr[data-p]').forEach((r) => r.classList.toggle('sel', state.selected.has(r.dataset.p)));
  updateSelection();
});
$('rows').addEventListener('dblclick', async (e) => {
  const tr = e.target.closest('tr[data-p]'); if (!tr) return;
  const p = tr.dataset.p;
  if (tr.classList.contains('dir')) { state.cwd = p; state.selected.clear(); renderFolder(); return; }
  const pw = await ensurePassword([p]); if (pw == null) return;
  const r = await api.openItem(state.archive, p, pw);
  if (!r.ok) {
    if (r.code === 'PASSWORD') { state.password = ''; return message('Contraseña incorrecta', 'No se pudo abrir el archivo con esa contraseña.'); }
    message('No se pudo abrir', r.error);
  }
});
$('crumbs').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-c]'); if (!a) return;
  state.cwd = a.dataset.c; state.selected.clear(); renderFolder();
});
document.querySelectorAll('.files th').forEach((th) => th.addEventListener('click', () => {
  const k = th.dataset.k;
  state.sort = { k, desc: state.sort.k === k ? !state.sort.desc : false };
  renderFolder();
}));

// ¿Hace falta contraseña para estos elementos? La pide una vez y la recuerda mientras el archivo esté abierto.
async function ensurePassword(paths) {
  if (state.password) return state.password;
  const sel = paths && paths.length ? state.info.items.filter((i) => paths.some((p) => i.path === p || i.path.startsWith(p + '/'))) : state.info.items;
  if (!sel.some((i) => i.encrypted)) return '';
  const pw = await askPassword('El contenido está protegido. Escriba la contraseña.');
  if (pw == null) return null;
  state.password = pw;
  return pw;
}

// ---------- extraer
async function defaultDest(file) {
  const i = await api.pathInfo(file);
  const name = i.base.replace(/\.(tar\.(gz|xz|bz2|zst)|part0*1\.rar|7z\.001|zip\.001|[^.]+)$/i, '') || 'extraido';
  return api.join(i.dir, name);
}

function extractDialog(dest) {
  return new Promise((resolve) => {
    const d = $('dlgExtract');
    $('exDest').value = dest;
    d.returnValue = '';
    d.onclose = () => resolve(d.returnValue === 'ok' && $('exDest').value.trim() ? { dest: $('exDest').value.trim(), mode: $('exMode').value, open: $('exOpen').checked } : null);
    d.showModal();
  });
}
$('exPick').onclick = async () => { const p = await api.pickDir($('exDest').value); if (p) $('exDest').value = p; };

async function doExtract(file, files, opts) {
  let pw = opts.password;
  for (;;) {
    const r = await withProgress('Extrayendo…', (id) => api.extract(id, file, opts.dest, { password: pw, files, mode: opts.mode }));
    if (r.ok) {
      if (opts.open) api.openPath(opts.dest);
      return true;
    }
    if (r.code === 'CANCELLED') { await message('Cancelado', 'La extracción se canceló. Puede que algunos archivos ya se hayan extraído.'); return false; }
    if (r.code === 'PASSWORD') {
      pw = await askPassword(pw ? 'Contraseña incorrecta. Intente de nuevo.' : 'El contenido está protegido. Escriba la contraseña.');
      if (pw == null) return false;
      if (state.archive === file) state.password = pw;
      continue;
    }
    await message('Error al extraer', r.error);
    return false;
  }
}

async function extractFromView(selection) {
  const files = selection ? [...state.selected] : [];
  const pw = await ensurePassword(files); if (pw == null) return;
  const o = await extractDialog(await defaultDest(state.archive)); if (!o) return;
  await doExtract(state.archive, files, { ...o, password: pw });
}
$('btnExtractAll').onclick = () => extractFromView(false);
$('btnExtractSel').onclick = () => extractFromView(true);

$('btnTest').onclick = async () => {
  const pw = await ensurePassword([]); if (pw == null) return;
  const r = await withProgress('Probando integridad…', (id) => api.test(id, state.archive, pw));
  if (r.ok) return message('Archivo en buen estado', 'Se verificó todo el contenido y no se encontraron errores.');
  if (r.code === 'PASSWORD') { state.password = ''; return message('Contraseña incorrecta', 'No se pudo verificar con esa contraseña.'); }
  if (r.code !== 'CANCELLED') message('Se encontraron problemas', r.error);
};
$('btnClose').onclick = closeArchive;
function closeArchive() { state.archive = null; state.info = null; state.password = ''; document.title = 'R3 Zip'; show('home'); }

// ---------- comprimir
async function openCompress(paths = []) {
  state.inputs = [];
  await addInputs(paths);
  const d = $('dlgCompress');
  $('cmpPw').value = ''; $('cmpPw2').value = ''; $('cmpNames').checked = false; $('cmpErr').textContent = ''; $('cmpVol').value = '';
  syncFormat();
  d.returnValue = '';
  d.showModal();
}
async function addInputs(paths) {
  if (!paths.length) return;
  const r = await api.stat(paths);
  if (!r.ok) return;
  for (const it of r.data) if (!state.inputs.some((x) => x.path === it.path)) state.inputs.push(it);
  await renderInputs(true);
}
async function renderInputs(suggestName) {
  $('cmpList').innerHTML = state.inputs.map((it, i) => `<li>${it.dir ? ICON_DIR : ICON_FILE}<span title="${esc(it.path)}">${esc(it.name)}</span><small class="muted">${fmtSize(it.size)}</small><button type="button" data-i="${i}" title="Quitar">✕</button></li>`).join('');
  const total = state.inputs.reduce((s, x) => s + x.size, 0);
  $('cmpTotal').textContent = state.inputs.length ? `${state.inputs.length} elemento(s) · ${fmtSize(total)}` : '';
  if (suggestName && state.inputs.length && (!$('cmpOut').value || $('cmpOut').dataset.auto === '1')) {
    const first = await api.pathInfo(state.inputs[0].path);
    const parent = await api.pathInfo(first.dir);
    const base = state.inputs.length === 1 ? (state.inputs[0].dir ? first.base : first.base.replace(/\.[^.]+$/, '') || first.base) : (parent.base || 'Comprimido');
    $('cmpOut').value = await api.join(first.dir, base + '.' + $('cmpFormat').value);
    $('cmpOut').dataset.auto = '1';
  }
}
$('cmpList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  state.inputs.splice(+b.dataset.i, 1); renderInputs(false);
});
$('cmpAddFiles').onclick = async () => addInputs(await api.pickInputs('file'));
$('cmpAddDirs').onclick = async () => addInputs(await api.pickInputs('dir'));
$('cmpOut').oninput = () => { $('cmpOut').dataset.auto = '0'; };
$('cmpPick').onclick = async () => { const p = await api.saveArchiveDialog($('cmpOut').value); if (p) { $('cmpOut').value = fixExt(p); $('cmpOut').dataset.auto = '0'; } };
const EXT_RX = /\.(7z|zip|tar|tar\.gz|tgz|tar\.xz|txz|tar\.bz2|tbz2?)$/i;
function fixExt(p) { const f = $('cmpFormat').value; return EXT_RX.test(p) ? p.replace(EXT_RX, '.' + f) : p + '.' + f; }
function syncFormat() {
  const f = $('cmpFormat').value;
  const canPw = f === '7z' || f === 'zip';
  $('cmpSecure').disabled = !canPw;
  $('cmpSecure').style.opacity = canPw ? 1 : .45;
  $('cmpNamesWrap').hidden = f !== '7z';
  $('cmpPwNote').textContent = canPw ? 'Cifrado AES-256. Si olvida la contraseña no hay forma de recuperar el contenido.' : 'El formato ' + f.toUpperCase() + ' no admite contraseña. Use ZIP o 7Z para protegerlo.';
  $('cmpLevel').disabled = f === 'tar';
  $('cmpVol').disabled = f.startsWith('tar.');
  if ($('cmpVol').disabled) $('cmpVol').value = '';
  if ($('cmpOut').value) $('cmpOut').value = fixExt($('cmpOut').value);
}
$('cmpFormat').onchange = () => { $('cmpErr').textContent = ''; syncFormat(); };

$('dlgCompress').addEventListener('close', async () => {
  const d = $('dlgCompress');
  if (d.returnValue !== 'ok') return;
  const fail = (msg) => { $('cmpErr').textContent = msg; d.returnValue = ''; d.showModal(); };
  if (!state.inputs.length) return fail('Agregue al menos un archivo o carpeta.');
  const out = $('cmpOut').value.trim();
  if (!out) return fail('Indique dónde guardar el archivo.');
  const f = $('cmpFormat').value;
  const pw = (f === '7z' || f === 'zip') ? $('cmpPw').value : '';
  if (pw !== ((f === '7z' || f === 'zip') ? $('cmpPw2').value : '')) return fail('Las contraseñas no coinciden.');
  if (f === 'zip' && /[^ -~]/.test(pw)) return fail('En ZIP la contraseña no puede tener tildes, ñ ni caracteres especiales de otros idiomas. Cámbiela o elija el formato 7Z.');
  if (state.inputs.some((x) => x.path === out)) return fail('El archivo de salida no puede ser uno de los elementos a comprimir.');
  if (await api.exists(out)) {
    const v = await message('El archivo ya existe', `${(await api.pathInfo(out)).base} ya existe. ¿Desea reemplazarlo?`, [{ label: 'Cancelar', value: 'no' }, { label: 'Reemplazar', value: 'yes', gold: true }]);
    if (v !== 'yes') { d.returnValue = ''; d.showModal(); return; }
  }
  const opts = { format: f, level: $('cmpLevel').value, password: pw, encryptNames: $('cmpNames').checked, volume: $('cmpVol').value };
  const r = await withProgress('Comprimiendo…', (id) => api.create(id, out, state.inputs.map((x) => x.path), opts));
  if (r.ok) {
    const v = await message('Listo', `Se creó ${(await api.pathInfo(out)).base}${opts.volume ? ' (en varias partes)' : ''}.`, [{ label: 'Cerrar', value: 'ok' }, { label: 'Mostrar en la carpeta', value: 'show', gold: true }]);
    if (v === 'show') api.showInFolder(opts.volume ? out + '.001' : out);
  } else if (r.code === 'CANCELLED') message('Cancelado', 'No se creó el archivo.');
  else message('Error al comprimir', r.error);
});

// ---------- acciones externas (doble clic en un archivo, menú contextual, arrastrar)
async function handleAction(a) {
  if (!a || !a.files || !a.files.length) return;
  closeOpenDialogs();
  if (a.action === 'compress') return openCompress(a.files);
  if (a.action === 'extract-here' || a.action === 'extract-to') {
    let allOk = true;
    for (const f of a.files) {
      const dest = a.action === 'extract-here' ? (await api.pathInfo(f)).dir : await defaultDest(f);
      if (!await doExtract(f, [], { dest, mode: 'rename', open: a.action === 'extract-to', password: '' })) allOk = false;
    }
    // Lanzado solo para extraer desde el Explorador: se cierra al terminar bien
    if (a.startup && allOk && !state.archive) return window.close();
    if (!state.archive) show('home');
    return;
  }
  return openArchive(a.files[0]);
}
function closeOpenDialogs() { document.querySelectorAll('dialog[open]').forEach((d) => { if (d.id !== 'dlgProgress') d.close(); }); }
api.on('app:action', handleAction);
api.on('app:command', (c) => ({ open: openDialog, compress: () => openCompress(), close: closeArchive, about: about })[c]?.());

async function handleDrop(paths) {
  if (!paths.length) return;
  if ($('dlgCompress').open) return addInputs(paths);
  if (paths.length === 1 && await api.isArchive(paths[0])) {
    const v = await message('¿Qué desea hacer?', `${(await api.pathInfo(paths[0])).base} es un archivo comprimido.`, [{ label: 'Comprimir de nuevo', value: 'cmp' }, { label: 'Abrir y ver contenido', value: 'open', gold: true }]);
    if (v === 'open') return openArchive(paths[0]);
    if (v !== 'cmp') return;
  }
  openCompress(paths);
}
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); if (++dragDepth === 1 && !$('dlgCompress').open) $('drop').hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; $('drop').hidden = true;
  const paths = [...e.dataTransfer.files].map((f) => api.filePath(f)).filter(Boolean);
  handleDrop(paths);
});

// ---------- botones superiores y teclado
async function openDialog() { const f = await api.openArchiveDialog(); if (f) openArchive(f); }
$('btnOpen').onclick = openDialog;
$('cardExtract').onclick = openDialog;
$('btnCompress').onclick = () => openCompress();
$('cardCompress').onclick = () => openCompress();

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (document.querySelector('dialog[open]')) return;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openDialog(); }
  else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); openCompress(); }
  else if (mod && e.key.toLowerCase() === 'w' && state.archive) { e.preventDefault(); closeArchive(); }
  else if (mod && e.key.toLowerCase() === 'a' && state.archive) { e.preventDefault(); entriesAt(state.cwd).forEach((x) => state.selected.add(x.path)); renderFolder(); }
  else if (e.key === 'Backspace' && state.archive && state.cwd) { state.cwd = state.cwd.split('/').slice(0, -1).join('/'); state.selected.clear(); renderFolder(); }
  else if (e.key === 'Enter' && state.archive && state.selected.size === 1) { const tr = $('rows').querySelector('tr.sel'); if (tr) tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }
});

// ---------- acerca de y licencias
async function about() {
  const a = await api.about();
  $('abVer').textContent = 'v' + a.version;
  $('abEngine').textContent = a.engine ? a.engine : '';
  $('abSys').textContent = `Sistema: ${a.platform} · Electron ${a.electron}`;
  $('dlgAbout').showModal();
}
$('btnAbout').onclick = about;
document.querySelectorAll('[data-lic]').forEach((b) => b.addEventListener('click', async () => {
  const which = b.dataset.lic;
  $('licTitle').textContent = { app: 'Licencia de R3 Zip (MIT)', third: 'Avisos de software de terceros', engine: 'Licencia de 7-Zip' }[which];
  $('licText').textContent = await api.license(which);
  $('dlgLicense').showModal();
}));
$('licFolder').onclick = () => api.openLicensesFolder();

show('home');

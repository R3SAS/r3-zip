// R3 Zip — proceso principal de Electron (Windows y macOS)
// Software libre y de código abierto desarrollado por R3 (licencia MIT). Gratuito: no se vende.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const engine = require('./src/engine');

const isMac = process.platform === 'darwin';
const ARCHIVE_RX = /\.(7z|zip|zipx|rar|r00|001|tar|tgz|tbz2?|txz|tzst|gz|gzip|bz2|bzip2|xz|lzma|zst|cab|iso|wim|arj|lzh|lha|z|cpio|rpm|deb|dmg|vhd|vhdx|jar|apk|xpi|epub)$/i;
let win = null;
let pending = []; // acciones recibidas antes de que la ventana esté lista
let ready = false;
const jobs = new Map();

engine.setEngineDir(app.isPackaged
  ? path.join(process.resourcesPath, 'engine')
  : path.join(__dirname, 'vendor', isMac ? 'mac' : 'win-x64'));

// ---- Línea de comandos: archivo a abrir, --extract-here, --extract-to, --compress
function parseArgs(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('--exec=') && a !== '--quit' && a !== '.');
  const flag = args.find((a) => /^--(extract-here|extract-to|compress)$/.test(a));
  const files = args.filter((a) => !a.startsWith('-') && fs.existsSync(a)).map((a) => path.resolve(a));
  if (!files.length) return null;
  if (flag === '--compress') return { action: 'compress', files };
  if (flag === '--extract-here') return { action: 'extract-here', files };
  if (flag === '--extract-to') return { action: 'extract-to', files };
  return { action: 'open', files };
}

// El menú contextual de Windows lanza una instancia por archivo seleccionado: se agrupan en 400 ms.
let batch = null;
function dispatch(act) {
  if (!act) return;
  if (act.action === 'compress') {
    if (!batch) { batch = { action: 'compress', files: [] }; setTimeout(() => { const b = batch; batch = null; deliver(b); }, 400); }
    batch.files.push(...act.files.filter((f) => !batch.files.includes(f)));
    return;
  }
  deliver(act);
}
function deliver(act) {
  if (ready && win) { win.webContents.send('app:action', act); if (win.isMinimized()) win.restore(); win.focus(); }
  else pending.push(act);
}

// Evita que Chromium congele la ventana si queda tapada durante una operación larga
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', (_e, argv) => dispatch(parseArgs(argv)));

app.on('open-file', (e, file) => { e.preventDefault(); dispatch({ action: 'open', files: [file] }); });

function buildMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  const send = (cmd) => () => win && win.webContents.send('app:command', cmd);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [{ label: 'Acerca de R3 Zip', click: send('about') }, { type: 'separator' }, { role: 'hide', label: 'Ocultar' }, { role: 'hideOthers', label: 'Ocultar otros' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] },
    { label: 'Archivo', submenu: [
      { label: 'Abrir comprimido…', accelerator: 'Cmd+O', click: send('open') },
      { label: 'Comprimir…', accelerator: 'Cmd+N', click: send('compress') },
      { label: 'Cerrar', accelerator: 'Cmd+W', click: send('close') },
    ] },
    { label: 'Edición', submenu: [{ role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ventana', submenu: [{ role: 'minimize', label: 'Minimizar' }, { role: 'zoom', label: 'Zoom' }] },
  ]));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 700, minWidth: 760, minHeight: 520,
    backgroundColor: '#0D0D0D',
    title: 'R3 Zip',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('did-finish-load', () => {
    ready = true;
    for (const a of pending.splice(0)) win.webContents.send('app:action', a);
  });
  win.on('closed', () => { win = null; ready = false; });
}

app.whenReady().then(() => {
  buildMenu();
  const first = parseArgs(process.argv);
  if (first) first.startup = true;
  dispatch(first);
  createWindow();
  const exec = process.argv.find((a) => a.startsWith('--exec='));
  if (exec) win.webContents.on('console-message', (_e, level, msg, line, src) => { if (level >= 2) console.log('[renderer]', msg, src + ':' + line); });
  if (exec) require(path.resolve(__dirname, exec.slice(7)))({ win: () => win, engine, quit: () => app.quit() });
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { for (const j of jobs.values()) j.abort(); });

// ---- IPC
const wrap = (fn) => async (...a) => {
  try { return { ok: true, data: await fn(...a) }; }
  catch (e) { return { ok: false, error: e.message, code: e.code || 'ERROR' }; }
};

function job(id, fn) {
  const ac = new AbortController();
  jobs.set(id, ac);
  const onProgress = (p, t) => win && win.webContents.send('job:progress', { id, p, t });
  return fn({ signal: ac.signal, onProgress }).finally(() => jobs.delete(id));
}

ipcMain.handle('job:cancel', (_e, id) => { const j = jobs.get(id); if (j) j.abort(); return true; });

ipcMain.handle('archive:list', wrap((_e, file, password) => engine.list(file, password)));
ipcMain.handle('archive:test', wrap((_e, id, file, password) => job(id, (o) => engine.test(file, password, o))));
ipcMain.handle('archive:extract', wrap(async (_e, id, file, dest, opt) => {
  await job(id, (o) => engine.extract(file, dest, opt, o));
  return { dest };
}));
ipcMain.handle('archive:create', wrap(async (_e, id, output, inputs, opt) => {
  try { return await job(id, (o) => engine.create(output, inputs, opt, o)); }
  catch (e) {
    // No dejar archivos a medias
    try { fs.unlinkSync(output); } catch {}
    try { fs.readdirSync(path.dirname(output)).filter((n) => n.startsWith(path.basename(output) + '.0')).forEach((n) => fs.unlinkSync(path.join(path.dirname(output), n))); } catch {}
    throw e;
  }
}));

// Abre un archivo interno: lo extrae a una carpeta temporal y lo abre con su programa
ipcMain.handle('archive:open-item', wrap(async (_e, file, item, password) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r3zip-'));
  await engine.extract(file, dir, { password, files: [item], mode: 'overwrite' });
  const target = path.join(dir, ...item.split('/'));
  const err = await shell.openPath(target);
  if (err) throw new Error(err);
  return target;
}));

ipcMain.handle('fs:stat', wrap(async (_e, files) => files.map((f) => {
  try { const st = fs.statSync(f); return { path: f, name: path.basename(f), dir: st.isDirectory(), size: st.isDirectory() ? engine.sizeOf(f) : st.size }; }
  catch { return null; }
}).filter(Boolean)));
ipcMain.handle('fs:exists', (_e, f) => fs.existsSync(f));
ipcMain.handle('fs:is-archive', (_e, f) => ARCHIVE_RX.test(f) || /\.(7z|zip|rar|part\d+\.rar)\.\d{3}$/i.test(f));
ipcMain.handle('path:info', (_e, f) => ({ dir: path.dirname(f), base: path.basename(f), ext: path.extname(f), sep: path.sep }));
ipcMain.handle('path:join', (_e, ...p) => path.join(...p));

ipcMain.handle('dialog:open-archive', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Abrir archivo comprimido', properties: ['openFile'], filters: [{ name: 'Comprimidos', extensions: ['7z', 'zip', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'cab', 'iso', '001'] }, { name: 'Todos', extensions: ['*'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:pick-inputs', async (_e, kind) => {
  const r = await dialog.showOpenDialog(win, { title: kind === 'dir' ? 'Agregar carpetas' : 'Agregar archivos', properties: [kind === 'dir' ? 'openDirectory' : 'openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('dialog:pick-dir', async (_e, def) => {
  const r = await dialog.showOpenDialog(win, { title: 'Elegir carpeta de destino', defaultPath: def, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:save-archive', async (_e, def) => {
  const r = await dialog.showSaveDialog(win, { title: 'Guardar archivo comprimido', defaultPath: def });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('shell:show', (_e, f) => { shell.showItemInFolder(f); return true; });
ipcMain.handle('shell:open', (_e, f) => shell.openPath(f));

ipcMain.handle('app:about', async () => ({
  version: app.getVersion(),
  engine: await engine.version(),
  platform: `${process.platform} ${process.arch}`,
  electron: process.versions.electron,
}));
ipcMain.handle('app:license', (_e, which) => {
  const base = app.isPackaged ? process.resourcesPath : __dirname;
  const map = {
    app: path.join(base, app.isPackaged ? 'LICENSE.txt' : 'LICENSE'),
    third: path.join(base, 'THIRD-PARTY-NOTICES.md'),
    engine: path.join(app.isPackaged ? path.join(base, 'engine') : path.join(__dirname, 'vendor', isMac ? 'mac' : 'win-x64'), 'License.txt'),
  };
  try { return fs.readFileSync(map[which], 'utf8'); } catch (e) { return 'No se encontró el archivo de licencia: ' + e.message; }
});
ipcMain.handle('app:open-licenses-folder', () => {
  const base = app.isPackaged ? process.resourcesPath : __dirname;
  return shell.openPath(base);
});

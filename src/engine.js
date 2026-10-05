// R3 Zip — puente con el motor de compresión (7-Zip, GNU LGPL, ejecutable sin modificar).
// Se invoca como proceso aparte: el código de R3 Zip no enlaza ni modifica el código de 7-Zip.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isMac = process.platform === 'darwin';

let engineDir = null;
function setEngineDir(dir) { engineDir = dir; }

function bin() {
  const exe = path.join(engineDir, isMac ? '7zz' : '7z.exe');
  if (isMac) { try { fs.chmodSync(exe, 0o755); } catch {} }
  return exe;
}

// Opciones comunes: salida UTF-8, sin preguntas (stdin cerrado), progreso por stdout.
const COMMON = ['-sccUTF-8', '-scsUTF-8', '-y'];
const pw = (p) => '-p' + (p || '');

class EngineError extends Error {
  constructor(message, code, detail) { super(message); this.code = code; this.detail = detail; }
}

function classify(stderr, stdout, code) {
  const all = stderr + '\n' + stdout;
  if (/Wrong password|Cannot open encrypted archive/i.test(all)) return new EngineError('Contraseña incorrecta o requerida.', 'PASSWORD', all);
  if (/Can not open the file as archive|Cannot open the file as archive|is not archive/i.test(all)) return new EngineError('El archivo no es un comprimido válido o el formato no es compatible.', 'NOT_ARCHIVE', all);
  if (/Data Error|CRC Failed|Headers Error|Unexpected end of (data|archive)/i.test(all)) return new EngineError('El archivo comprimido está dañado o incompleto.', 'CORRUPT', all);
  if (/Missing volume|Cannot find volume/i.test(all)) return new EngineError('Falta una de las partes (volúmenes) del archivo.', 'VOLUME', all);
  if (/There is not enough space|No space left/i.test(all)) return new EngineError('No hay espacio suficiente en el disco.', 'SPACE', all);
  if (/Access is denied|Permission denied|being used by another process/i.test(all)) return new EngineError('Sin permiso para leer o escribir uno de los archivos (o está abierto en otro programa).', 'ACCESS', all);
  const line = (stderr.split(/\r?\n/).find((l) => /ERROR/i.test(l)) || stderr.trim().split(/\r?\n/).pop() || '').trim();
  return new EngineError(line || `El motor terminó con código ${code}.`, 'ENGINE', all);
}

// Ejecuta el motor. onProgress(porcentaje, texto) se llama con el avance leído de -bsp1.
function run(args, { onProgress, cwd, signal, stdinFrom, pipeStdout } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin(), args, { cwd, windowsHide: true, stdio: [stdinFrom ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    if (stdinFrom) stdinFrom.pipe(child.stdin);
    let out = ''; let err = ''; let last = -1;
    if (pipeStdout) pipeStdout(child.stdout);
    else child.stdout.on('data', (d) => {
      const s = d.toString('utf8');
      out += s;
      if (out.length > 4e6) out = out.slice(-2e6);
      if (onProgress) {
        // -bsp1 escribe líneas como " 45% 12 - carpeta\archivo.txt" separadas por retrocesos
        const parts = s.split(/[\r\n\b]+/).filter((x) => /\d%/.test(x));
        const tail = parts[parts.length - 1];
        const m = tail && tail.match(/(\d{1,3})%(?:\s+\d+)?(?:\s+[+\-=TUR]\s+(.*))?/);
        if (m) {
          const p = Math.min(100, +m[1]);
          if (p !== last || m[2]) { last = p; onProgress(p, (m[2] || '').trim()); }
        }
      }
    });
    child.stderr.on('data', (d) => { err += d.toString('utf8'); });
    const abort = () => { try { child.kill(); } catch {} };
    if (signal) {
      if (signal.aborted) abort();
      signal.addEventListener('abort', abort, { once: true });
    }
    child.on('error', (e) => reject(new EngineError('No se pudo iniciar el motor de compresión: ' + e.message, 'SPAWN')));
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', abort);
      if (signal && signal.aborted) return reject(new EngineError('Operación cancelada.', 'CANCELLED'));
      // 0 = correcto, 1 = advertencias (p. ej. archivo bloqueado omitido)
      if (code === 0 || code === 1) return resolve({ code, out, err });
      reject(classify(err, out, code));
    });
  });
}

function parseList(text, archive = '') {
  const info = {};
  const items = [];
  const [head, body = ''] = text.split(/\r?\n----------\r?\n/);
  // Bloque del archivo (después de la línea "--")
  const archBlock = head.split(/\r?\n--\r?\n/)[1] || '';
  for (const line of archBlock.split(/\r?\n/)) {
    const i = line.indexOf(' = ');
    if (i > 0) info[line.slice(0, i)] = line.slice(i + 3);
  }
  for (const block of body.split(/\r?\n\r?\n/)) {
    const o = {};
    for (const line of block.split(/\r?\n/)) {
      const i = line.indexOf(' = ');
      if (i > 0) o[line.slice(0, i)] = line.slice(i + 3);
      else if (line.endsWith(' =')) o[line.slice(0, -2)] = '';
    }
    // .xz / .gz / .bz2 no guardan el nombre: se deduce del nombre del archivo
    if (o.Path === undefined && o.Size !== undefined) o.Path = path.basename(archive).replace(/\.(xz|gz|gzip|bz2|bzip2|zst|lzma|z)$/i, '').replace(/\.t(gz|xz|bz2?|zst)$/i, '.tar') || 'contenido';
    if (o.Path === undefined) continue;
    const attrs = o.Attributes || '';
    items.push({
      path: o.Path.replace(/\\/g, '/'),
      size: o.Size ? +o.Size : 0,
      packed: o['Packed Size'] ? +o['Packed Size'] : null,
      modified: o.Modified || '',
      dir: o.Folder === '+' || /^D|\bD\b/.test(attrs) || /^D/.test(attrs),
      encrypted: o.Encrypted === '+',
      method: o.Method || '',
    });
  }
  return {
    type: info.Type || '',
    physicalSize: info['Physical Size'] ? +info['Physical Size'] : null,
    method: info.Method || '',
    solid: info.Solid === '+',
    encryptedHeaders: false,
    items,
  };
}

async function list(archive, password, opts = {}) {
  const r = await run(['l', '-slt', ...COMMON, pw(password), '--', archive], opts);
  return parseList(r.out, archive);
}

// mode: 'overwrite' | 'skip' | 'rename'
async function extract(archive, dest, { password, files = [], mode = 'rename', flat = false } = {}, opts = {}) {
  const ao = { overwrite: '-aoa', skip: '-aos', rename: '-aou' }[mode] || '-aou';
  fs.mkdirSync(dest, { recursive: true });
  const args = [flat ? 'e' : 'x', ...COMMON, '-bsp1', '-bso0', ao, pw(password), '-o' + dest, '--', archive];
  // Al extraer un elemento de carpeta se incluye su contenido (-r no aplica a rutas internas; se usa ruta\*)
  for (const f of files) args.push(f.replace(/\//g, isMac ? '/' : '\\'));
  return run(args, opts);
}

async function test(archive, password, opts = {}) {
  return run(['t', ...COMMON, '-bsp1', '-bso0', pw(password), '--', archive], opts);
}

const LEVELS = { store: 0, fast: 1, normal: 5, max: 7, ultra: 9 };

// fmt: '7z' | 'zip' | 'tar' | 'tar.gz' | 'tar.xz' | 'tar.bz2'
async function create(output, inputs, { format = '7z', level = 'normal', password = '', encryptNames = false, volume = '' } = {}, opts = {}) {
  const mx = '-mx' + (LEVELS[level] ?? 5);
  if (format === 'zip' && password && /[^ -~]/.test(password)) throw new EngineError('En ZIP la contraseña solo puede tener letras sin tildes ni ñ, números y símbolos. Cámbiela o use el formato 7Z.', 'ZIP_PASSWORD');
  try { fs.unlinkSync(output); } catch {}
  const base = ['a', ...COMMON, '-bsp1', '-bso0', '-ssw'];
  const vol = volume ? ['-v' + volume] : [];
  // Las rutas se agregan con su nombre (sin la ruta completa del disco)
  const cwdGroups = groupByParent(inputs);
  if (format === '7z' || format === 'zip' || format === 'tar') {
    const extra = [];
    if (format === '7z') { extra.push('-t7z', mx); if (password) extra.push(pw(password)); if (password && encryptNames) extra.push('-mhe=on'); }
    if (format === 'zip') { extra.push('-tzip', mx); if (password) extra.push(pw(password), '-mem=AES256'); }
    if (format === 'tar') extra.push('-ttar');
    // Un solo directorio padre (lo normal): una ejecución. Varios: se agregan por grupos al mismo archivo.
    let i = 0;
    for (const [cwd, names] of cwdGroups) {
      const groupOpts = { ...opts, cwd, onProgress: opts.onProgress && ((p, t) => opts.onProgress(Math.round((i * 100 + p) / cwdGroups.size), t)) };
      await run([...base, ...extra, ...(i === 0 ? vol : []), '--', output, ...names], groupOpts);
      i++;
    }
    return { output };
  }
  // tar.gz / tar.xz / tar.bz2: tar por la salida estándar → compresor por la entrada estándar
  const t = { 'tar.gz': 'gzip', 'tar.xz': 'xz', 'tar.bz2': 'bzip2' }[format];
  if (!t) throw new EngineError('Formato no compatible: ' + format, 'FORMAT');
  if (cwdGroups.size > 1) throw new EngineError('Para .' + format + ' todos los elementos deben estar en la misma carpeta.', 'FORMAT');
  const [[cwd, names]] = [...cwdGroups];
  const { PassThrough } = require('stream');
  const pipe = new PassThrough();
  const tarP = run(['a', ...COMMON, '-ttar', '-so', '-bsp2', '-ssw', '--', 'x.tar', ...names], { cwd, signal: opts.signal, pipeStdout: (s) => s.pipe(pipe) });
  const compP = run(['a', ...COMMON, '-t' + t, mx, '-si' + path.basename(output, path.extname(output)).replace(/\.tar$/i, '') + '.tar', '-bsp1', '-bso0', '--', output], { signal: opts.signal, stdinFrom: pipe });
  // El avance real lo da el lector de stdin (no conoce el total): se informa por bytes
  const total = inputs.reduce((s, f) => s + sizeOf(f), 0) || 1;
  let seen = 0;
  pipe.on('data', (d) => { seen += d.length; opts.onProgress && opts.onProgress(Math.min(99, Math.round(seen * 100 / total)), ''); });
  await Promise.all([tarP, compP]);
  return { output };
}

function sizeOf(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((s, n) => s + sizeOf(path.join(p, n)), 0);
  } catch { return 0; }
}

function groupByParent(inputs) {
  const m = new Map();
  for (const f of inputs) {
    const dir = path.dirname(f);
    if (!m.has(dir)) m.set(dir, []);
    m.get(dir).push(path.basename(f));
  }
  return m;
}

async function version() {
  const r = await run([], {}).catch((e) => ({ out: e.detail || '' }));
  const m = (r.out || '').match(/7-Zip\s+(?:\(z\)\s+)?([\d.]+)/);
  return m ? m[1] : '';
}

module.exports = { setEngineDir, list, extract, test, create, version, parseList, sizeOf, EngineError, bin };

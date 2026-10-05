// Pruebas del motor: node test/engine-test.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const engine = require('../src/engine');

engine.setEngineDir(path.join(__dirname, '..', 'vendor', process.platform === 'darwin' ? 'mac' : 'win-x64'));

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'r3zip-test-'));
const SRC = path.join(T, 'Carpeta ñandú');
fs.mkdirSync(path.join(SRC, 'sub', 'más'), { recursive: true });
fs.writeFileSync(path.join(SRC, 'año ñ.txt'), 'hola mundo '.repeat(500));
fs.writeFileSync(path.join(SRC, 'sub', 'b.txt'), 'b');
fs.writeFileSync(path.join(SRC, 'sub', 'más', 'c.bin'), require('crypto').randomBytes(300000));
const SOLO = path.join(T, 'solo.txt');
fs.writeFileSync(SOLO, 'archivo suelto');

let pass = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const read = (...p) => fs.readFileSync(path.join(...p));

(async () => {
  for (const fmt of ['7z', 'zip', 'tar', 'tar.gz', 'tar.xz', 'tar.bz2']) {
    const out = path.join(T, 'prueba.' + fmt);
    const prog = [];
    await engine.create(out, [SRC, SOLO], { format: fmt, level: 'normal' }, { onProgress: (p) => prog.push(p) });
    assert(fs.existsSync(out), 'no se creó ' + fmt);
    let target = out;
    if (fmt.startsWith('tar.')) {
      // el comprimido contiene un .tar: listar el contenido del .tar interno
      const l1 = await engine.list(out);
      assert.equal(l1.items.length, 1);
      assert(/\.tar$/.test(l1.items[0].path), 'interno: ' + l1.items[0].path);
      const d = path.join(T, 'x-' + fmt);
      await engine.extract(out, d);
      target = path.join(d, l1.items[0].path);
    }
    const l = await engine.list(target);
    const paths = l.items.map((i) => i.path).sort();
    assert(paths.includes('Carpeta ñandú/año ñ.txt'), fmt + ': ' + paths.join(','));
    assert(paths.includes('Carpeta ñandú/sub/más/c.bin'));
    assert(paths.includes('solo.txt'));
    const d2 = path.join(T, 'y-' + fmt);
    await engine.extract(target, d2);
    assert.deepEqual(read(d2, 'Carpeta ñandú', 'sub', 'más', 'c.bin'), read(SRC, 'sub', 'más', 'c.bin'));
    assert.equal(read(d2, 'solo.txt').toString(), 'archivo suelto');
    await engine.test(target);
    ok(`${fmt}: crear, listar, extraer y probar (progreso: ${prog.length} avisos, último ${prog[prog.length - 1]}%)`);
  }

  // Contraseña en ZIP (AES) y 7z con nombres cifrados
  const z = path.join(T, 'clave.zip');
  await assert.rejects(engine.create(z, [SRC], { format: 'zip', password: 'Señal#1' }), (e) => e.code === 'ZIP_PASSWORD');
  await engine.create(z, [SRC], { format: 'zip', password: 'Senal#1' });
  const lz = await engine.list(z);
  assert(lz.items.some((i) => i.encrypted), 'zip sin cifrado');
  await assert.rejects(engine.extract(z, path.join(T, 'zbad'), { password: 'mala' }), (e) => e.code === 'PASSWORD');
  await assert.rejects(engine.extract(z, path.join(T, 'znone'), {}), (e) => e.code === 'PASSWORD');
  await engine.extract(z, path.join(T, 'zok'), { password: 'Senal#1' });
  assert.deepEqual(read(T, 'zok', 'Carpeta ñandú', 'sub', 'más', 'c.bin'), read(SRC, 'sub', 'más', 'c.bin'));
  ok('zip AES-256: contraseña incorrecta/ausente detectada, correcta extrae');

  const s = path.join(T, 'clave.7z');
  await engine.create(s, [SRC], { format: '7z', password: 'añoÑ€', encryptNames: true });
  await assert.rejects(engine.list(s, ''), (e) => e.code === 'PASSWORD');
  await assert.rejects(engine.list(s, 'xyz'), (e) => e.code === 'PASSWORD');
  const ls = await engine.list(s, 'añoÑ€');
  assert(ls.items.length >= 5);
  ok('7z con nombres cifrados: listar pide contraseña');

  // Extraer selección (carpeta interna con su contenido)
  const sel = path.join(T, 'sel');
  await engine.extract(path.join(T, 'prueba.7z'), sel, { files: ['Carpeta ñandú/sub'] });
  assert(fs.existsSync(path.join(sel, 'Carpeta ñandú', 'sub', 'más', 'c.bin')));
  assert(!fs.existsSync(path.join(sel, 'Carpeta ñandú', 'año ñ.txt')));
  ok('extraer selección: carpeta interna con subcarpetas');

  // Modos de conflicto
  const conf = path.join(T, 'conf');
  await engine.extract(path.join(T, 'prueba.zip'), conf, { files: ['solo.txt'] });
  fs.writeFileSync(path.join(conf, 'solo.txt'), 'local');
  await engine.extract(path.join(T, 'prueba.zip'), conf, { files: ['solo.txt'], mode: 'skip' });
  assert.equal(read(conf, 'solo.txt').toString(), 'local');
  await engine.extract(path.join(T, 'prueba.zip'), conf, { files: ['solo.txt'], mode: 'rename' });
  assert(fs.readdirSync(conf).length === 2, fs.readdirSync(conf).join(','));
  await engine.extract(path.join(T, 'prueba.zip'), conf, { files: ['solo.txt'], mode: 'overwrite' });
  assert.equal(read(conf, 'solo.txt').toString(), 'archivo suelto');
  ok('conflictos: omitir, renombrar y reemplazar');

  // Volúmenes
  const v = path.join(T, 'partes.7z');
  await engine.create(v, [SRC], { format: '7z', level: 'store', volume: '100k' });
  const parts = fs.readdirSync(T).filter((n) => n.startsWith('partes.7z.'));
  assert(parts.length >= 3, 'partes: ' + parts);
  await engine.extract(path.join(T, 'partes.7z.001'), path.join(T, 'vol'));
  assert.deepEqual(read(T, 'vol', 'Carpeta ñandú', 'sub', 'más', 'c.bin'), read(SRC, 'sub', 'más', 'c.bin'));
  ok(`volúmenes: ${parts.length} partes de 100 KB, se reconstruye`);

  // Archivo dañado y no comprimido
  const bad = path.join(T, 'dañado.zip');
  const buf = read(T, 'prueba.zip'); for (let i = 200; i < 600; i++) buf[i] ^= 0xff; fs.writeFileSync(bad, buf);
  await assert.rejects(engine.test(bad), (e) => ['CORRUPT', 'ENGINE', 'NOT_ARCHIVE'].includes(e.code));
  await assert.rejects(engine.list(SOLO), (e) => e.code === 'NOT_ARCHIVE');
  ok('dañado y no-comprimido: errores claros');

  // Cancelación
  const big = path.join(T, 'grande.bin'); fs.writeFileSync(big, require('crypto').randomBytes(60 * 1024 * 1024));
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 300);
  await assert.rejects(engine.create(path.join(T, 'cancel.7z'), [big], { format: '7z', level: 'ultra' }, { signal: ac.signal }), (e) => e.code === 'CANCELLED');
  ok('cancelar a mitad de compresión');

  console.log('\nversión del motor:', await engine.version());
  console.log(`\n${pass} pruebas correctas`);
  fs.rmSync(T, { recursive: true, force: true });
})().catch((e) => { console.error('FALLÓ:', e, e.detail || ''); process.exit(1); });

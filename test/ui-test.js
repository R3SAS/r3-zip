// Prueba de interfaz: npx electron . --exec=test/ui-test.js
// Recorre inicio → abrir comprimido → navegar → extraer → comprimir con contraseña → acerca de; guarda capturas en test/shots.
const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = async ({ win, engine, quit }) => {
  const shots = path.join(__dirname, 'shots');
  fs.mkdirSync(shots, { recursive: true });
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'r3zip-ui-'));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => win().webContents.executeJavaScript(code);
  const until = async (code, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(code)) return true; await wait(150); } throw new Error('tiempo agotado: ' + code); };
  const shot = async (name) => { win().webContents.invalidate(); await wait(250); fs.writeFileSync(path.join(shots, name + '.png'), (await win().capturePage()).toPNG()); };
  let n = 0; const ok = (m) => { n++; console.log('  ✓ ' + m); };
  try {
    await new Promise((r) => (win().webContents.isLoading() ? win().webContents.once('did-finish-load', r) : r()));
    await wait(500);
    await shot('1-inicio');
    ok('inicio');

    // Datos de prueba
    const src = path.join(T, 'Informes 2026');
    fs.mkdirSync(path.join(src, 'Anexos'), { recursive: true });
    for (let i = 1; i <= 6; i++) fs.writeFileSync(path.join(src, `Informe mensual ${i}.txt`), ('Línea de informe ' + i + '\n').repeat(2000));
    fs.writeFileSync(path.join(src, 'Anexos', 'foto.bin'), require('crypto').randomBytes(200000));
    const arch = path.join(T, 'Informes 2026.7z');
    await engine.create(arch, [src], { format: '7z' });

    // Abrir como si viniera del Explorador
    win().webContents.send('app:action', { action: 'open', files: [arch] });
    await until(`!document.getElementById('archive').hidden && document.querySelectorAll('#rows tr[data-p]').length === 1`);
    await js(`document.querySelector('#rows tr[data-p]').dispatchEvent(new MouseEvent('dblclick', {bubbles:true}))`);
    await until(`document.querySelectorAll('#rows tr[data-p]').length === 7`);
    await js(`document.querySelectorAll('#rows tr[data-p]')[1].click()`);
    await shot('2-contenido');
    ok('abrir comprimido y entrar a carpeta (7 elementos)');

    // Tema híbrido R3 + control de tono (claro y oscuro), luego vuelve al tono R3
    const fondo = () => js(`getComputedStyle(document.body).backgroundColor`);
    const tono = (v) => js(`(() => { const r = document.querySelector('.r3-tono input'); r.value = '${v}'; r.dispatchEvent(new Event('input')); })()`);
    if (!(await js(`!!document.querySelector('.top .r3-tono')`))) throw new Error('falta el control de tono');
    if ((await fondo()) !== 'rgb(179, 174, 164)') throw new Error('tono R3 inesperado: ' + (await fondo()));
    await tono(10); await shot('2b-tono-claro');
    await tono(92); await shot('2c-tono-oscuro');
    if ((await js(`getComputedStyle(document.body).color`)) !== 'rgb(236, 237, 238)') throw new Error('tono oscuro sin texto claro');
    await tono(50);
    await js(`localStorage.removeItem('r3-tono')`);
    ok('tema híbrido y control de tono');

    // Extraer todo con el diálogo
    await js(`document.getElementById('btnExtractAll').click()`);
    await until(`document.getElementById('dlgExtract').open`);
    const dest = path.join(T, 'salida');
    await js(`document.getElementById('exDest').value = ${JSON.stringify(dest)}; document.getElementById('exOpen').checked = false;`);
    await shot('3-extraer');
    await js(`document.querySelector('#dlgExtract button[value=ok]').click()`);
    const t0 = Date.now();
    while (!fs.existsSync(path.join(dest, 'Informes 2026', 'Anexos', 'foto.bin'))) { if (Date.now() - t0 > 15000) throw new Error('no se extrajo: ' + await js(`[...document.querySelectorAll('dialog[open]')].map(d => d.id + ':' + d.innerText.slice(0,200)).join(' / ') + ' archive.hidden=' + document.getElementById('archive').hidden`) + ' ' + (fs.existsSync(dest) ? fs.readdirSync(dest, { recursive: true }).join(',') : 'sin carpeta')); await wait(150); }
    await until(`!document.getElementById('dlgProgress').open`);
    ok('extraer todo');

    // Comprimir con contraseña (ZIP + contraseña con ñ → aviso; luego 7z)
    await js(`document.getElementById('btnClose').click()`);
    win().webContents.send('app:action', { action: 'compress', files: [src] });
    await until(`document.getElementById('dlgCompress').open && document.querySelectorAll('#cmpList li').length === 1`);
    await js(`document.getElementById('cmpPw').value = 'año'; document.getElementById('cmpPw2').value = 'año'; document.getElementById('cmpGo').click();`);
    await until(`document.getElementById('cmpErr').textContent.includes('ZIP')`);
    ok('aviso de contraseña ZIP con ñ');
    await js(`const f = document.getElementById('cmpFormat'); f.value = '7z'; f.dispatchEvent(new Event('change')); document.getElementById('cmpNames').checked = true;`);
    await shot('4-comprimir');
    const out = await js(`document.getElementById('cmpOut').value`);
    if (!/Informes 2026\.7z$/.test(out)) throw new Error('nombre sugerido: ' + out);
    await js(`document.getElementById('cmpOut').value = ${JSON.stringify(path.join(T, 'nuevo.7z'))}; document.getElementById('cmpGo').click();`);
    await until(`document.getElementById('dlgMsg').open`, 30000);
    const msg = await js(`document.getElementById('msgTitle').textContent`);
    if (msg !== 'Listo') throw new Error('mensaje: ' + msg + ' ' + await js(`document.getElementById('msgText').textContent`));
    await js(`document.querySelector('#msgButtons button[value=ok]').click()`);
    const l = await engine.list(path.join(T, 'nuevo.7z'), 'año').catch((e) => e);
    if (!l.items || l.items.length < 8) throw new Error('7z cifrado no válido');
    ok('comprimir 7z con contraseña y nombres ocultos');

    // Abrir el cifrado: pide contraseña
    win().webContents.send('app:action', { action: 'open', files: [path.join(T, 'nuevo.7z')] });
    await until(`document.getElementById('dlgPassword').open`);
    await shot('5-contrasena');
    await js(`document.getElementById('pwInput').value = 'año'; document.getElementById('pwOk').click();`);
    await until(`!document.getElementById('archive').hidden && document.getElementById('archMeta').textContent.includes('protegido')`);
    ok('abrir 7z cifrado con contraseña');

    // Acerca de
    await js(`document.getElementById('btnAbout').click()`);
    await until(`document.getElementById('abEngine').textContent.length > 0`);
    await shot('6-acerca');
    const txt = await js(`document.getElementById('dlgAbout').innerText`);
    if (!/código abierto desarrollada por R3/.test(txt) || !/26\.03/.test(txt)) throw new Error('acerca de: ' + txt);
    await js(`document.querySelector('[data-lic=engine]').click()`);
    await until(`document.getElementById('licText').textContent.includes('unRAR')`);
    ok('acerca de y licencias');

    console.log(`\n${n} pruebas de interfaz correctas · capturas en test/shots`);
  } catch (e) {
    console.error('FALLÓ:', e.message);
    try { await shot('error'); } catch {}
    process.exitCode = 1;
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
    quit();
  }
};

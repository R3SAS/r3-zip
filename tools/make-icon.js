// Genera build/icon.png (1024×1024), build/icon.ico y assets/icon.png a partir de un SVG propio de R3.
// Uso: npx electron tools/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// Caja de archivo negra con cremallera dorada y "R3" plateado (diseño propio, sin recursos de terceros)
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262626"/><stop offset="1" stop-color="#0D0D0D"/></linearGradient>
    <linearGradient id="au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2D57E"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#B8860B"/></linearGradient>
    <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E6E8EA"/><stop offset=".5" stop-color="#B4B8BC"/><stop offset="1" stop-color="#8A8D91"/></linearGradient>
  </defs>
  <rect x="48" y="48" width="928" height="928" rx="200" fill="url(#bg)" stroke="url(#au)" stroke-width="20"/>
  <g fill="url(#au)">
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${i % 2 ? 452 : 512}" y="${70 + i * 52}" width="60" height="30" rx="8"/>`).join('')}
    <rect x="432" y="530" width="160" height="124" rx="26"/>
    <rect x="474" y="648" width="76" height="96" rx="36"/>
  </g>
  <rect x="490" y="580" width="44" height="28" rx="10" fill="#0D0D0D"/>
  <text x="512" y="905" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="150" fill="url(#ag)" letter-spacing="6"><tspan fill="url(#au)">R</tspan>3</text>
</svg>`;

function ico(pngs) {
  const n = pngs.length;
  const header = Buffer.alloc(6 + 16 * n);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(n, 4);
  let off = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8); header.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.buf)]);
}

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html,<html><body></body></html>');
  const render = (size) => w.webContents.executeJavaScript(`new Promise((res) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = ${size}; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, ${size}, ${size}); res(c.toDataURL('image/png')); };
    img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(SVG).toString('base64'))};
  })`);
  const toBuf = (d) => Buffer.from(d.split(',')[1], 'base64');
  const out = path.join(__dirname, '..', 'build');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'icon.png'), toBuf(await render(1024)));
  fs.writeFileSync(path.join(out, 'icon.svg'), SVG);
  const sizes = [];
  for (const sz of [16, 24, 32, 48, 64, 128, 256]) sizes.push({ size: sz, buf: toBuf(await render(sz)) });
  fs.writeFileSync(path.join(out, 'icon.ico'), ico(sizes));
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), toBuf(await render(512)));
  console.log('iconos listos');
  app.quit();
});

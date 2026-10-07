// Tono ajustable R3: cada persona aclara u oscurece el área de trabajo; se guarda en su equipo.
// El marco (encabezado y menú) sigue negro con dorado en cualquier tono.
// Uso: <script src="tono.js" data-app="pwa|sinc" data-donde=".barra" data-antes="#btnInstalar" data-compacto="999"></script>
(function () {
  'use strict';
  var script = document.currentScript;
  var cfg = script ? script.dataset : {};
  var CLAVE = 'r3-tono';
  var DEFECTO = 50; // tono R3 gris topo
  var CORTE = 70;   // por encima, textos claros

  // Superficies: blanco (0) · R3 crema / gris topo (50) · negro R3 original (100)
  var S = {
    fondo: ['#F3F4F6', '#B3AEA4', '#0D0D0D'],
    sup: ['#FFFFFF', '#C9C4BB', '#1A1A1A'],
    sup2: ['#F7F7F8', '#BFBAB0', '#141414'],
    btn: ['#FFFFFF', '#D3CEC5', '#222224'],
    entrada: ['#FFFFFF', '#DCD8D0', '#0F0F0F'],
    borde: ['#D5D8DC', '#A39E93', '#2C2C2F'],
    bordeSuave: ['#E6E8EB', '#B5B0A6', '#1D1D1F'],
    hover: ['#ECEEF1', '#BEB9AF', '#26262A'],
    track: ['#C9CDD2', '#A9A499', '#3A3A3E'],
  };
  var CLARO = {
    texto: '#151515', texto2b: '#474B50', num: '#5F6368',
    gradTexto: 'linear-gradient(145deg, #8A6D12, #6A520C)',
    ok: '#164F32', okBg: '#BCD5C5', okLine: '#93BEA4',
    warn: '#6E4C00', warnBg: '#DCCDA0', warnLine: '#C2A962',
    err: '#9E2018', errBg: '#E3C1BC', errLine: '#C99C96',
    info: '#1B4F82', infoBg: '#C3D3E3', infoLine: '#9DB6CF',
    oroBg: '#D9CDA6', oroLine: '#B8922A',
    hub: '#8A3410', hubBg: '#E5C6B4', hubLine: '#CDA088',
    serieTrabajo: '#7A600F', serieHogar: '#1F5A93',
  };
  var OSCURO = {
    texto: '#ECEDEE', texto2: '#B4B8BC', texto2b: '#B4B8BC', num: '#8A8D91', acento: '#F2D57E',
    gradTexto: 'linear-gradient(145deg, #F2D57E, #D4AF37, #B8860B)',
    ok: '#7FD6A2', okBg: '#12291D', okLine: '#25543A',
    warn: '#F1D27E', warnBg: '#2A2310', warnLine: '#5A4A18',
    err: '#F3A39B', errBg: '#2A1513', errLine: '#5A2723',
    info: '#A8CBEE', infoBg: '#13202E', infoLine: '#2A4561',
    oroBg: '#2A2310', oroLine: '#6E5A22',
    hub: '#FF9A73', hubBg: '#2E1A12', hubLine: '#6B3A24',
    serieTrabajo: '#D4AF37', serieHogar: '#6FA8DC',
  };
  // Variable CSS de cada app → clave de la paleta
  var MAPAS = {
    pwa: {
      '--fondo': 'fondo', '--superficie': 'sup', '--superficie-2': 'btn', '--borde': 'borde', '--entrada': 'entrada',
      '--texto': 'texto', '--texto-2': 'texto2', '--plata-texto': 'texto2b', '--acento': 'acento', '--r3-grad-dorado-texto': 'gradTexto', '--num': 'num',
      '--ok': 'ok', '--alerta': 'warn', '--error': 'err', '--ok-bg': 'okBg', '--ok-line': 'okLine', '--warn-bg': 'warnBg', '--warn-line': 'warnLine',
      '--err-bg': 'errBg', '--err-line': 'errLine', '--info': 'info', '--info-bg': 'infoBg', '--info-line': 'infoLine', '--oro-bg': 'oroBg', '--oro-line': 'oroLine',
      '--hub': 'hub', '--hub-bg': 'hubBg', '--hub-line': 'hubLine', '--serie-trabajo': 'serieTrabajo', '--serie-hogar': 'serieHogar',
    },
    sinc: {
      '--bg': 'fondo', '--panel': 'sup', '--panel2': 'sup2', '--line': 'borde', '--line-soft': 'bordeSuave', '--hover': 'hover', '--input': 'entrada',
      '--track': 'track', '--btn': 'btn', '--text': 'texto', '--muted': 'texto2', '--accent': 'acento', '--r3-grad-dorado-texto': 'gradTexto',
      '--ok': 'ok', '--warn': 'warn', '--fail': 'err', '--info': 'info', '--ok-bg': 'okBg', '--ok-line': 'okLine', '--warn-bg': 'warnBg',
      '--warn-line': 'warnLine', '--fail-bg': 'errBg', '--fail-line': 'errLine', '--info-bg': 'infoBg', '--info-line': 'infoLine', '--gold-bg': 'oroBg', '--gold-line': 'warnLine',
    },
  };
  var mapa = MAPAS[cfg.app] || MAPAS.pwa;

  function hx(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function mezclar(a, b, f) {
    var A = hx(a), B = hx(b);
    return '#' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0'); }).join('');
  }
  function paleta(v) {
    var p = {};
    Object.keys(S).forEach(function (k) { var s = S[k]; p[k] = v <= 50 ? mezclar(s[0], s[1], v / 50) : mezclar(s[1], s[2], (v - 50) / 50); });
    var o = v > CORTE;
    var sem = o ? OSCURO : CLARO;
    Object.keys(sem).forEach(function (k) { p[k] = sem[k]; });
    if (!o) {
      p.texto2 = v < 25 ? '#5F6368' : '#3F4347';
      p.acento = v < 25 ? '#8A6D12' : '#6A520C';
    }
    return p;
  }
  function leer() {
    try { var v = parseInt(localStorage.getItem(CLAVE), 10); return isNaN(v) ? DEFECTO : Math.min(100, Math.max(0, v)); } catch (e) { return DEFECTO; }
  }
  function guardar(v) { try { localStorage.setItem(CLAVE, String(v)); } catch (e) { /* sin almacenamiento: solo esta sesión */ } }
  var raiz = document.documentElement;
  function aplicar(v) {
    var p = paleta(v);
    Object.keys(mapa).forEach(function (css) { raiz.style.setProperty(css, p[mapa[css]]); });
    raiz.style.colorScheme = v > CORTE ? 'dark' : 'light';
    raiz.dataset.tono = v > CORTE ? 'oscuro' : 'claro';
  }

  var actual = leer();
  if (actual !== DEFECTO) aplicar(actual); // en el tono R3 manda el CSS de la app

  var ESTILO = [
    '.r3-tono{position:relative;display:flex;align-items:center;flex:none}',
    '.r3-tono-btn{display:none;width:38px;height:38px;border-radius:50%;border:1px solid #3a3a3a;background:#151515;color:#F2D57E;font-size:18px;line-height:1;cursor:pointer;place-items:center}',
    '.r3-tono-panel{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:99px;border:1px solid #3a3a3a;background:#151515;color:#E6E8EA;font-size:.78rem}',
    '.r3-tono-panel svg{flex:none}',
    '.r3-tono input[type=range]{-webkit-appearance:none;appearance:none;width:130px;height:6px;min-height:0;padding:0;margin:0;border-radius:99px;border:1px solid #3a3a3a;background:linear-gradient(90deg,#FFFFFF,#B3AEA4,#0D0D0D);outline:none;box-shadow:none}',
    '.r3-tono input[type=range]:focus-visible{box-shadow:0 0 0 2px rgba(212,175,55,.6)}',
    '.r3-tono input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:linear-gradient(145deg,#F2D57E,#D4AF37,#B8860B);border:2px solid #0D0D0D;box-shadow:0 0 0 1px #D4AF37;cursor:pointer}',
    '.r3-tono input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#D4AF37;border:2px solid #0D0D0D;cursor:pointer}',
    '.r3-tono-r3{border:1px solid #5a4a18;background:transparent;color:#F2D57E;border-radius:99px;font:inherit;font-size:.72rem;padding:2px 9px;cursor:pointer;min-height:0;width:auto}',
    '.r3-tono-r3:hover{background:rgba(212,175,55,.15)}',
    '.r3-tono.compacto .r3-tono-btn{display:grid}',
    '.r3-tono.compacto .r3-tono-panel{display:none;position:absolute;right:0;top:calc(100% + 8px);z-index:60;box-shadow:0 10px 30px rgba(0,0,0,.45);padding:10px 14px}',
    '.r3-tono.compacto.abierto .r3-tono-panel{display:flex}',
    '.r3-tono.compacto input[type=range]{width:170px}',
  ].join('\n');

  var SOL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var LUNA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function montar() {
    var donde = document.querySelector(cfg.donde || '.barra');
    if (!donde || donde.querySelector('.r3-tono')) return;
    var st = document.createElement('style');
    st.textContent = ESTILO;
    document.head.appendChild(st);

    var caja = document.createElement('div');
    caja.className = 'r3-tono';
    caja.innerHTML = '<button type="button" class="r3-tono-btn" aria-label="Ajustar el tono de la pantalla" aria-expanded="false">◐</button>' +
      '<div class="r3-tono-panel">' + SOL +
      '<input type="range" min="0" max="100" step="1" aria-label="Tono de la pantalla, de claro a oscuro">' + LUNA +
      '<button type="button" class="r3-tono-r3" title="Volver al tono R3">R3</button></div>';
    var antes = cfg.antes ? donde.querySelector(cfg.antes) : null;
    if (cfg.primero !== undefined) donde.insertBefore(caja, donde.firstChild);
    else donde.insertBefore(caja, antes);

    var rango = caja.querySelector('input');
    var boton = caja.querySelector('.r3-tono-btn');
    rango.value = String(actual);
    function poner(v, guardarlo) {
      actual = v;
      rango.value = String(v);
      if (v === DEFECTO) { Object.keys(mapa).forEach(function (css) { raiz.style.removeProperty(css); }); raiz.style.colorScheme = ''; raiz.dataset.tono = 'claro'; }
      else aplicar(v);
      if (guardarlo) guardar(v);
      document.dispatchEvent(new CustomEvent('r3-tono', { detail: v }));
    }
    rango.addEventListener('input', function () { poner(Number(rango.value), true); });
    caja.querySelector('.r3-tono-r3').addEventListener('click', function () { poner(DEFECTO, true); });
    boton.addEventListener('click', function (e) {
      e.stopPropagation();
      var ab = caja.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', String(ab));
      if (ab) rango.focus();
    });
    document.addEventListener('click', function (e) { if (!caja.contains(e.target)) { caja.classList.remove('abierto'); boton.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && caja.classList.contains('abierto')) { caja.classList.remove('abierto'); boton.focus(); } });

    var limite = Number(cfg.compacto || 999);
    var mq = window.matchMedia('(max-width: ' + limite + 'px)');
    function ajustar() { caja.classList.toggle('compacto', mq.matches); if (!mq.matches) caja.classList.remove('abierto'); }
    ajustar();
    if (mq.addEventListener) mq.addEventListener('change', ajustar); else mq.addListener(ajustar);
    // otra pestaña de la misma app cambió el tono
    window.addEventListener('storage', function (e) { if (e.key === CLAVE) poner(leer(), false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  window.R3Tono = { leer: leer, paleta: paleta };
})();

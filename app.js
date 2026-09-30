(() => {
  'use strict';

  /* ---------------------------------------------------------
     Utilities
     --------------------------------------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const esc   = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const fmt   = n => Math.round(n).toLocaleString('en-US');
  const pad2  = n => String(n).padStart(2, '0');
  const RM    = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE  = matchMedia('(pointer: fine)').matches;

  const C = {
    violet: '#6a35d0', ivory: '#f7efdf', night: '#1d1233', gold: '#e9bd62',
    goldHi: '#ffe2a3', goldLo: '#b8862f', ink: '#1a1030',
  };

  /* ---------------------------------------------------------
     Reveal on view
     --------------------------------------------------------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  const observeReveals = root => $$('.rv', root).forEach(el => io.observe(el));

  /* ---------------------------------------------------------
     Nav
     --------------------------------------------------------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('solid', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------
     Shared builders
     --------------------------------------------------------- */
  // Jhandi Burja faces as the game defines them. Order matches .f1–.f6: front, back, right, left, top, bottom.
  // The app's own face art (assets/images/jhandi_burja), one image per symbol.
  const FACES = ['heart', 'spade', 'diamond', 'club', 'burja', 'jhandi'].map(k => ({
    k, n: k[0].toUpperCase() + k.slice(1), img: `assets/jhandi/${k}.png`,
  }));
  const faceImg = (f, cls = '') => `<img class="${cls}" src="${f.img}" alt="" draggable="false">`;
  const FACE_ROT = [[0, 0], [0, 180], [0, -90], [0, 90], [-90, 0], [90, 0]];
  // A solid, square-cornered cube just inside the faces, so the gaps the rounded
  // face corners leave along the edges show ivory rather than the page behind.
  const DIE_CORE = [1, 2, 3, 4, 5, 6].map(i => `<span class="core c${i}"></span>`).join('');
  const dieHTML = () => DIE_CORE + FACES.map((f, i) => `<span class="f f${i + 1}">${faceImg(f)}</span>`).join('');
  $$('[data-die]').forEach(d => { d.innerHTML = dieHTML(); });

  /* ---------------------------------------------------------
     Prize wheel — Winzy's look: a lit gold rim, yellow / purple / orange
     wedges each with a prize icon, a crowned WINZY hub, a gold-trimmed
     pointer and a glowing purple podium.
     --------------------------------------------------------- */
  const TAU = Math.PI * 2;
  const WHEEL_H = 1.24; // canvas height ÷ width: pointer + wheel + podium
  const WZ = {
    purple: '#5a1fc7', purpleHi: '#7c3ff2', purpleLo: '#34108a', orange: '#ff7a12', yellow: '#ffc21f',
    gold: ['#fff3b0', '#ffd54f', '#f5ae1b', '#c9820a'], ink: '#3a137f',
  };
  const WEDGE_ORDER = [WZ.yellow, WZ.purple, WZ.orange, WZ.purple];
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  // `cashSeen` alternates notes and coins between cash wedges.
  const iconFor = (label, cashSeen) => {
    const l = label.toUpperCase();
    if (l.includes('CASH')) return cashSeen % 2 ? 'coins' : 'notes';
    if (l.includes('VOUCHER')) return 'ticket';
    if (l.includes('HAMPER')) return 'gift';
    if (l.includes('SURPRISE')) return 'surprise';
    if (l.includes('PRODUCT')) return 'phone';
    if (l.includes('TRY')) return 'retry';
    return 'star';
  };

  function createWheel(canvas, labels, opts = {}) {
    const ctx = canvas.getContext('2d');
    const n = labels.length, sweep = TAU / n, withIcons = opts.icons !== false;
    const lines = labels.map(l => { if (Array.isArray(l)) return l; const w = l.split(' '); return w.length > 2 ? [w.slice(0, -1).join(' '), w[w.length - 1]] : w; });
    labels = labels.map(l => (Array.isArray(l) ? l.join(' ') : l));
    let cash = 0;
    const icons = labels.map(l => { const ic = iconFor(l, cash); if (/CASH/i.test(l)) cash++; return ic; });
    const wh = { theta: 0, phase: 0, deflect: 0, D: 0, dpr: 1, visible: false, n };

    const lin = (x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const rad = (x, y, r, stops) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const rrect = (x, y, w, h, r) => {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    };
    const goldFill = (x, y, s) => lin(x, y - s, x, y + s, [[0, WZ.gold[0]], [.45, WZ.gold[1]], [1, WZ.gold[3]]]);

    /* ---- prize icons, centred on (x, y), about s across ---- */
    function giftIcon(x, y, s, body) {
      rrect(x - s * .3, y - s * .04, s * .6, s * .38, s * .05);
      ctx.fillStyle = lin(0, y - s * .04, 0, y + s * .34, [[0, body[0]], [1, body[1]]]); ctx.fill();
      rrect(x - s * .35, y - s * .17, s * .7, s * .15, s * .04);
      ctx.fillStyle = body[0]; ctx.fill();
      ctx.fillStyle = goldFill(x, y, s * .4);
      ctx.fillRect(x - s * .055, y - s * .17, s * .11, s * .51);
      ctx.lineWidth = s * .06; ctx.strokeStyle = WZ.gold[1];
      [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(x + d * s * .1, y - s * .25, s * .11, s * .065, d * -.5, 0, TAU); ctx.stroke(); });
      ctx.beginPath(); ctx.arc(x, y - s * .2, s * .05, 0, TAU); ctx.fillStyle = WZ.gold[2]; ctx.fill();
    }
    const ICONS = {
      notes(x, y, s) {
        [2, 1, 0].forEach(k => {
          ctx.save(); ctx.translate(x + (k - 1) * s * .03, y + s * .08 - k * s * .09); ctx.rotate(-.14);
          rrect(-s * .42, -s * .19, s * .84, s * .38, s * .05);
          ctx.fillStyle = k ? '#1f9d48' : '#34c85f'; ctx.fill();
          ctx.lineWidth = s * .025; ctx.strokeStyle = '#137a35'; ctx.stroke();
          if (!k) {
            ctx.beginPath(); ctx.arc(0, 0, s * .1, 0, TAU); ctx.fillStyle = '#9af0b4'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = s * .018;
            rrect(-s * .34, -s * .12, s * .68, s * .24, s * .03); ctx.stroke();
          }
          ctx.restore();
        });
      },
      coins(x, y, s) {
        const coin = (cx0, cy0) => {
          ctx.beginPath(); ctx.ellipse(cx0, cy0 + s * .06, s * .26, s * .1, 0, 0, TAU); ctx.fillStyle = WZ.gold[3]; ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx0, cy0, s * .26, s * .1, 0, 0, TAU); ctx.fillStyle = goldFill(cx0, cy0, s * .12); ctx.fill();
          ctx.lineWidth = s * .02; ctx.strokeStyle = '#b87708'; ctx.stroke();
        };
        for (let k = 0; k < 3; k++) coin(x + s * .14, y + s * .22 - k * s * .12);
        for (let k = 0; k < 4; k++) coin(x - s * .16, y + s * .28 - k * s * .12);
      },
      ticket(x, y, s) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-.22);
        rrect(-s * .4, -s * .21, s * .8, s * .42, s * .07);
        ctx.fillStyle = goldFill(0, 0, s * .22); ctx.fill();
        ctx.lineWidth = s * .03; ctx.strokeStyle = WZ.gold[3]; ctx.stroke();
        ctx.setLineDash([s * .04, s * .04]); ctx.beginPath(); ctx.moveTo(-s * .18, -s * .16); ctx.lineTo(-s * .18, s * .16); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#9a5c06'; ctx.font = `800 ${s * .3}px Geist, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('%', s * .1, s * .01);
        ctx.restore();
      },
      gift(x, y, s) { giftIcon(x, y, s, ['#c08bff', '#7c3ff2']); },
      surprise(x, y, s) { giftIcon(x, y, s, ['#ff7d9c', '#e0314f']); },
      phone(x, y, s) {
        rrect(x - s * .21, y - s * .35, s * .42, s * .7, s * .08);
        ctx.fillStyle = lin(x, y - s * .35, x, y + s * .35, [[0, '#9b6bff'], [1, '#5a1fc7']]); ctx.fill();
        ctx.lineWidth = s * .035; ctx.strokeStyle = '#e2d0ff'; ctx.stroke();
        rrect(x - s * .15, y - s * .27, s * .3, s * .52, s * .04); ctx.fillStyle = '#2a0a66'; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + s * .04, y - s * .19); ctx.lineTo(x - s * .08, y + s * .02); ctx.lineTo(x + s * .01, y + s * .02);
        ctx.lineTo(x - s * .04, y + s * .19); ctx.lineTo(x + s * .09, y - s * .04); ctx.lineTo(x, y - s * .04); ctx.closePath();
        ctx.fillStyle = WZ.gold[1]; ctx.fill();
      },
      star(x, y, s) {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? s * .17 : s * .4, a = -Math.PI / 2 + k * Math.PI / 5;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fillStyle = goldFill(x, y, s * .4); ctx.fill();
        ctx.lineWidth = s * .03; ctx.lineJoin = 'round'; ctx.strokeStyle = WZ.gold[3]; ctx.stroke();
      },
      retry(x, y, s) {
        ctx.lineWidth = s * .09; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, s * .26, -Math.PI * .1, Math.PI * 1.45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * .32, y - s * .2); ctx.lineTo(x + s * .26, y - s * .02); ctx.lineTo(x + s * .08, y - s * .1);
        ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
      },
    };

    function crown(x, y, s, fill) {
      ctx.beginPath();
      ctx.moveTo(x - s * .5, y + s * .3); ctx.lineTo(x - s * .5, y - s * .15); ctx.lineTo(x - s * .22, y + s * .08);
      ctx.lineTo(x, y - s * .32); ctx.lineTo(x + s * .22, y + s * .08); ctx.lineTo(x + s * .5, y - s * .15); ctx.lineTo(x + s * .5, y + s * .3);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      [[-.5, -.15], [0, -.32], [.5, -.15]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * .08, 0, TAU); ctx.fill(); });
    }

    function tier(cx, top, rx, ry, h, R) {
      ctx.beginPath();
      ctx.moveTo(cx - rx, top); ctx.lineTo(cx - rx, top + h);
      ctx.ellipse(cx, top + h, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, top);
      ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = lin(cx - rx, 0, cx + rx, 0, [[0, '#23085e'], [.5, '#5a1fc7'], [1, '#23085e']]); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, top, rx, ry, 0, 0, TAU);
      ctx.fillStyle = lin(0, top - ry, 0, top + ry, [[0, '#8f5cf7'], [1, '#4b17b0']]); ctx.fill();
      ctx.save();
      ctx.shadowColor = '#ff9a2e'; ctx.shadowBlur = R * .06;
      ctx.lineWidth = Math.max(1.2, R * .012); ctx.strokeStyle = '#ffc070';
      ctx.beginPath(); ctx.ellipse(cx, top, rx * .97, ry * .9, 0, 0, Math.PI); ctx.stroke();
      ctx.globalAlpha = .6;
      ctx.beginPath(); ctx.ellipse(cx, top + h * .55, rx, ry, 0, .15, Math.PI - .15); ctx.stroke();
      ctx.restore();
    }

    function podium(cx, cy, R) {
      ctx.beginPath(); ctx.ellipse(cx, cy + R * 1.33, R * .9, R * .1, 0, 0, TAU);
      ctx.fillStyle = 'rgba(52,16,138,.18)'; ctx.fill();
      tier(cx, cy + R * 1.12, R * .82, R * .12, R * .13, R);
      tier(cx, cy + R * 1.0, R * .6, R * .085, R * .1, R);
      ctx.beginPath();
      ctx.moveTo(cx - R * .16, cy + R * .7); ctx.lineTo(cx + R * .16, cy + R * .7);
      ctx.quadraticCurveTo(cx + R * .2, cy + R * .92, cx + R * .38, cy + R * 1.0);
      ctx.lineTo(cx - R * .38, cy + R * 1.0);
      ctx.quadraticCurveTo(cx - R * .2, cy + R * .92, cx - R * .16, cy + R * .7);
      ctx.closePath();
      ctx.fillStyle = lin(cx - R * .38, 0, cx + R * .38, 0, [[0, '#2a0a6b'], [.5, '#6a2bd6'], [1, '#2a0a6b']]); ctx.fill();
    }

    function pointer(cx, D) {
      const pw = D * .12, ph = D * .135, x0 = cx - pw / 2, y0 = D * .004, c = pw * .18;
      ctx.save();
      ctx.translate(cx, y0 + ph * .2); ctx.rotate(wh.deflect * .3); ctx.translate(-cx, -(y0 + ph * .2));
      ctx.beginPath();
      ctx.moveTo(x0 + c, y0); ctx.lineTo(x0 + pw - c, y0);
      ctx.quadraticCurveTo(x0 + pw, y0, x0 + pw - c * .45, y0 + c);
      ctx.lineTo(cx + pw * .07, y0 + ph - pw * .09);
      ctx.quadraticCurveTo(cx, y0 + ph, cx - pw * .07, y0 + ph - pw * .09);
      ctx.lineTo(x0 + c * .45, y0 + c);
      ctx.quadraticCurveTo(x0, y0, x0 + c, y0);
      ctx.closePath();
      ctx.shadowColor = 'rgba(40,10,110,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = lin(x0, y0, x0 + pw, y0 + ph, [[0, WZ.purpleHi], [.55, WZ.purple], [1, WZ.purpleLo]]); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = pw * .09; ctx.lineJoin = 'round'; ctx.strokeStyle = goldFill(cx, y0 + ph / 2, ph / 2); ctx.stroke();
      const bx = cx, by = y0 + ph * .32, br = pw * .15;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
      ctx.fillStyle = rad(bx - br * .35, by - br * .35, br * 1.4, [[0, '#fff6c8'], [.45, WZ.gold[1]], [1, WZ.gold[3]]]); ctx.fill();
      ctx.restore();
    }

    wh.draw = () => {
      const D = wh.D;
      if (!D) return;
      ctx.setTransform(wh.dpr, 0, 0, wh.dpr, 0, 0);
      ctx.clearRect(0, 0, D, D * WHEEL_H);
      const R = D / 2, cx = R, cy = D * .055 + R, faceR = R * .855;

      podium(cx, cy, R);

      // Gold rim, lifted off the page by a soft purple shadow.
      ctx.save();
      ctx.shadowColor = 'rgba(58,15,143,.45)'; ctx.shadowBlur = R * .14; ctx.shadowOffsetY = R * .05;
      ctx.beginPath(); ctx.arc(cx, cy, R * .985, 0, TAU);
      ctx.fillStyle = lin(cx - R, cy - R, cx + R, cy + R, [[0, WZ.gold[0]], [.35, WZ.gold[1]], [.72, WZ.gold[2]], [1, WZ.gold[3]]]);
      ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, R * .985 - 1, 0, TAU); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,250,220,.9)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, faceR + R * .012, 0, TAU); ctx.lineWidth = R * .024; ctx.strokeStyle = '#c9820a'; ctx.stroke();

      // Wedges.
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + wh.theta + (i - .5) * sweep, c = WEDGE_ORDER[i % 4];
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, faceR, a0, a0 + sweep + .004); ctx.closePath();
        ctx.fillStyle = rad(cx, cy, faceR, [[0, mix(c, '#ffffff', .12)], [.72, c], [1, mix(c, '#000000', .1)]]); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, faceR, 0, TAU);
      ctx.fillStyle = rad(cx, cy, faceR, [[.78, 'rgba(0,0,0,0)'], [1, 'rgba(40,10,90,.22)']]); ctx.fill();

      // Labels run along each wedge, reading from the hub out to the rim; a prize icon,
      // turned to face outward, sits between the hub and its label.
      if (opts.radial !== false) {
        const hubEdge = R * .3, outer = faceR * .93;
        const inner = withIcons ? faceR * .6 : hubEdge + faceR * .06, room = outer - inner;
        for (let i = 0; i < n; i++) {
          const m = -Math.PI / 2 + wh.theta + i * sweep, onYellow = WEDGE_ORDER[i % 4] === WZ.yellow;
          const rows = withIcons ? lines[i] : [labels[i]], base = faceR * (withIcons ? .085 : .1);
          ctx.save();
          ctx.translate(cx, cy); ctx.rotate(m);
          if (withIcons) {
            ctx.save(); ctx.translate(faceR * .49, 0); ctx.rotate(Math.PI / 2);
            ICONS[icons[i]](0, 0, faceR * .2);
            ctx.restore();
          }
          ctx.font = `800 ${base}px Geist, Inter, sans-serif`;
          const widest = Math.max(...rows.map(t => ctx.measureText(t).width));
          const fs = Math.min(base, base * room / widest);
          ctx.font = `800 ${fs}px Geist, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = onYellow ? WZ.ink : '#ffffff';
          if (!onYellow) { ctx.shadowColor = 'rgba(20,0,60,.35)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1; }
          // Two-word labels stack across the wedge. An upright wheel turns the left half's labels
          // round so they read the right way up, running rim to hub instead.
          const flip = opts.upright && Math.cos(m) < -1e-6;
          if (flip) ctx.rotate(Math.PI);
          const along = (flip ? -1 : 1) * (inner + outer) / 2;
          rows.forEach((t, k) => ctx.fillText(t, along, (k - (rows.length - 1) / 2) * fs * 1.1));
          ctx.restore();
        }
      }

      // Icon over label, both kept upright on screen.
      const s = faceR * .27;
      for (let i = 0; i < (opts.radial !== false ? 0 : n); i++) {
        const m = -Math.PI / 2 + wh.theta + i * sweep;
        const bx = cx + Math.cos(m) * faceR * .6, by = cy + Math.sin(m) * faceR * .6;
        if (withIcons) ICONS[icons[i]](bx, by - faceR * .11, s);
        const onYellow = WEDGE_ORDER[i % 4] === WZ.yellow;
        const base = withIcons ? faceR * .075 : faceR * .105, room = faceR * .46;
        ctx.font = `800 ${base}px Inter, sans-serif`;
        const widest = Math.max(...lines[i].map(t => ctx.measureText(t).width));
        const fs = widest > room ? base * room / widest : base;
        ctx.save();
        ctx.font = `800 ${fs}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = onYellow ? WZ.ink : '#ffffff';
        if (!onYellow) { ctx.shadowColor = 'rgba(20,0,60,.35)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1; }
        const ty = withIcons ? by + faceR * .1 : by - (lines[i].length - 1) * fs * .56;
        if (!withIcons) ctx.font = `800 ${fs}px Geist, Inter, sans-serif`;
        lines[i].forEach((t, k) => ctx.fillText(t, bx, ty + k * fs * 1.12));
        ctx.restore();
      }

      // Chasing bulbs round the rim.
      const ringR = (faceR + R * .985) / 2 + R * .004, bulbR = R * .034;
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i + .5) * TAU / 16, x = cx + ringR * Math.cos(a), y = cy + ringR * Math.sin(a);
        const glow = .5 + .5 * Math.cos(TAU * (i * 2 / 16 - wh.phase));
        ctx.beginPath(); ctx.arc(x, y, bulbR * 2.3, 0, TAU);
        ctx.fillStyle = rad(x, y, bulbR * 2.3, [[0, `rgba(255,244,200,${(.35 + .5 * glow).toFixed(3)})`], [1, 'rgba(255,244,200,0)']]); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, bulbR, 0, TAU); ctx.fillStyle = mix('#ffd97a', '#ffffff', glow); ctx.fill();
      }

      // Hub: gold ring, purple disc, gold crown and WINZY.
      const hr = R * .29;
      ctx.save();
      ctx.shadowColor = 'rgba(40,10,110,.45)'; ctx.shadowBlur = hr * .35; ctx.shadowOffsetY = hr * .08;
      ctx.beginPath(); ctx.arc(cx, cy, hr, 0, TAU);
      ctx.fillStyle = lin(cx - hr, cy - hr, cx + hr, cy + hr, [[0, WZ.gold[0]], [.5, WZ.gold[2]], [1, WZ.gold[3]]]); ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, hr * .8, 0, TAU);
      ctx.fillStyle = rad(cx - hr * .2, cy - hr * .25, hr, [[0, WZ.purpleHi], [.6, WZ.purple], [1, WZ.purpleLo]]); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,213,79,.55)'; ctx.stroke();
      crown(cx, cy - hr * .3, hr * .42, goldFill(cx, cy - hr * .3, hr * .2));
      ctx.font = `800 ${hr * .33}px Geist, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = goldFill(cx, cy + hr * .2, hr * .18);
      ctx.fillText('WINZY', cx, cy + hr * .22);

      pointer(cx, D);
    };
    wh.size = () => {
      const cw = canvas.clientWidth;
      if (!cw) return;
      wh.D = cw;
      wh.dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(cw * wh.dpr);
      canvas.height = Math.round(cw * WHEEL_H * wh.dpr);
      wh.draw();
    };
    // Which wedge sits under the pointer (wedge i is centred at i × sweep).
    wh.segmentAt = () => Math.round((((-wh.theta) % TAU) + TAU) % TAU / sweep) % n;
    return wh;
  }


  // Labels follow the backend's prize types: product, cash, voucher, gift hamper, surprise, grand, try again.
  const heroWheel = createWheel($('#heroWheel'), ['CASH', 'GIFT HAMPER', 'VOUCHER', 'PRODUCT', 'GRAND PRIZE', 'SURPRISE', 'CASH', 'VOUCHER'], { upright: true });
  const galleryWheel = createWheel($('#galleryWheel'), ['CASH', 'GIFT HAMPER', 'VOUCHER', 'PRODUCT', 'GRAND PRIZE', 'SURPRISE', 'CASH', 'VOUCHER']);

  // The slot machine's eight symbols (backend SlotMachineSymbol).
  const RED = '#e0513f';
  const sv = body => `<svg viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
  const SLOT_SYMS = [
    ['Seven',   sv(`<text x="20" y="33" text-anchor="middle" font-family="Geist, Inter, sans-serif" font-weight="800" font-size="32" fill="${C.violet}">7</text>`)],
    ['Cherry',  sv(`<path d="M14 26c2-9 6-15 14-20M26 27c-1-8 0-15 2-21" stroke="#3f7d3a" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="13" cy="28" r="7" fill="${RED}"/><circle cx="27" cy="29" r="7" fill="${RED}"/>`)],
    ['Lemon',   sv(`<path d="M4 21c3-9 11-13 18-11 7 1 11 5 14 10-3 9-11 13-18 11-7-1-11-5-14-10z" fill="${C.gold}"/><path d="M12 18c3-3 8-4 12-3" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>`)],
    ['Bell',    sv(`<path d="M20 5c-7 0-11 6-11 13v7l-4 5h30l-4-5v-7c0-7-4-13-11-13z" fill="${C.gold}"/><circle cx="20" cy="33.5" r="3.5" fill="${C.goldLo}"/>`)],
    ['Star',    sv(`<path d="M20 4l4.9 10 11 1.6-8 7.8 1.9 11L20 29.2 10.2 34.4l1.9-11-8-7.8 11-1.6z" fill="${C.gold}"/>`)],
    ['Diamond', sv(`<path d="M8 15l6-8h12l6 8-12 19z" fill="${C.violet}"/><path d="M8 15h24M14 7l6 27M26 7l-6 27" stroke="#fff" stroke-opacity=".45" fill="none"/>`)],
    ['Gift',    sv(`<rect x="7" y="17" width="26" height="17" rx="2" fill="${C.violet}"/><rect x="5" y="12" width="30" height="7" rx="2" fill="${C.violet}"/><path d="M20 12v22" stroke="${C.gold}" stroke-width="3"/><path d="M20 12c-3-6-10-6-9-2s6 3 9 2c3 1 8 2 9-2s-6-4-9 2z" fill="${RED}"/>`)],
    ['Coin',    sv(`<circle cx="20" cy="20" r="15" fill="${C.gold}"/><circle cx="20" cy="20" r="11" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/><text x="20" y="27" text-anchor="middle" font-family="Geist, Inter, sans-serif" font-weight="800" font-size="15" fill="#6b4a12">W</text>`)],
  ];

  /* ---------------------------------------------------------
     HERO — gentle parallax and a few live details
     --------------------------------------------------------- */
  const heroArt = $('#heroArt'), heroParts = $$('.ha', heroArt).map(el => ({ el, d: +el.dataset.d || 1 }));
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let heroVisible = true;
  new IntersectionObserver(es => es.forEach(e => { heroVisible = e.isIntersecting; })).observe($('.hero'));
  if (FINE && !RM) addEventListener('pointermove', e => {
    mouse.tx = e.clientX / innerWidth - .5;
    mouse.ty = e.clientY / innerHeight - .5;
  }, { passive: true });

  const heroSlot = $('#heroSlot');
  const setHeroSlot = syms => { heroSlot.innerHTML = syms.map(i => `<span>${SLOT_SYMS[i][1]}</span>`).join(''); };
  setHeroSlot([0, 0, 0]);
  const heroPlayers = $('#heroPlayers');
  let heroCount = 2431;
  setInterval(() => {
    if (!heroVisible || document.hidden) return;
    heroCount = Math.max(1900, heroCount + Math.round((Math.random() - .4) * 24));
    heroPlayers.textContent = fmt(heroCount);
    if (!RM && Math.random() < .5) {
      const a = Math.floor(Math.random() * 8);
      setHeroSlot(Math.random() < .5 ? [a, a, a] : [a, (a + 3) % 8, a]);
    }
  }, 1600);

  /* ---------------------------------------------------------
     GAME 01 — Jhandi Burja (pick a face; 2+ matches pays stake × matches)
     --------------------------------------------------------- */
  const jbDice = $('#jbDice'), jbTally = $('#jbTally'), jbOutcome = $('#jbOutcome'), jbRollBtn = $('#jbRoll');
  const jbRound = $('#jbRound'), jbPlayers = $('#jbPlayers');
  jbDice.innerHTML = Array.from({ length: 6 }, () => `<div class="die">${dieHTML()}</div>`).join('');
  jbTally.innerHTML = FACES.map((f, i) => `
    <button type="button" role="radio" aria-checked="false" data-i="${i}" aria-label="${f.n}">
      <span class="sym">${faceImg(f)}</span><small>${f.n}</small><span class="n">·</span>
    </button>`).join('');
  const dice = $$('.die', jbDice), tally = $$('button', jbTally);
  const dieState = dice.map(() => ({ rx: -18, ry: 22 }));
  dice.forEach(d => { d.style.transform = 'rotateX(-18deg) rotateY(22deg)'; });
  const STAKE = 100;
  let jbPick = 4, jbBusy = false, round = 128, jbPlayersN = 2431, jbSeen = false;
  const setPick = i => {
    jbPick = i;
    tally.forEach((b, k) => b.setAttribute('aria-checked', k === i));
    if (!jbBusy) jbOutcome.innerHTML = `Your pick: ${faceImg(FACES[i], 'ico')} <b>${FACES[i].n}</b> · stake ${STAKE} coins`;
  };
  tally.forEach((b, i) => b.addEventListener('click', () => setPick(i)));
  setPick(jbPick);
  const turnTo = (cur, target, extra) => {
    const t = ((target % 360) + 360) % 360;
    let v = Math.ceil(cur / 360) * 360 + t + 360 * extra;
    if (v <= cur + 180) v += 360;
    return v;
  };
  function rollJhandi() {
    if (jbBusy) return;
    jbBusy = true;
    jbRollBtn.disabled = true;
    jbOutcome.classList.remove('win');
    jbOutcome.innerHTML = 'Rolling…';
    tally.forEach(b => { b.classList.remove('hit'); $('.n', b).textContent = '·'; });
    const faces = dice.map((d, i) => {
      const f = Math.floor(Math.random() * 6), [tx, ty] = FACE_ROT[f], st = dieState[i];
      st.rx = turnTo(st.rx, tx, 1 + (i % 2));
      st.ry = turnTo(st.ry, ty, 1 + ((i + 1) % 2));
      d.style.transitionDuration = RM ? '0s' : (1.2 + Math.random() * .6).toFixed(2) + 's';
      d.style.transform = `rotateX(${st.rx}deg) rotateY(${st.ry}deg)`;
      return f;
    });
    setTimeout(() => {
      const counts = FACES.map((_, k) => faces.filter(f => f === k).length);
      tally.forEach((b, k) => { $('.n', b).textContent = counts[k]; b.classList.toggle('hit', counts[k] >= 2); });
      const n = counts[jbPick], face = FACES[jbPick];
      jbOutcome.classList.toggle('win', n >= 2);
      jbOutcome.innerHTML = n >= 2
        ? `${faceImg(face, 'ico')} × ${n}. <b>You win ${fmt(STAKE * n)} coins</b>`
        : `${faceImg(face, 'ico')} × ${n}. <b>No win this round</b>`;
      jbRound.textContent = '#' + (++round);
      jbPlayersN += Math.round((Math.random() - .3) * 40);
      jbPlayers.textContent = fmt(jbPlayersN);
      jbBusy = false;
      jbRollBtn.disabled = false;
    }, RM ? 100 : 1900);
  }
  jbRollBtn.addEventListener('click', rollJhandi);
  new IntersectionObserver((es, obs) => es.forEach(e => {
    if (!e.isIntersecting || jbSeen) return;
    jbSeen = true;
    setTimeout(rollJhandi, 500);
    obs.disconnect();
  }), { threshold: .5 }).observe(jbDice);

  /* ---------------------------------------------------------
     GAME 02 — Spin & Win tilts toward the cursor
     --------------------------------------------------------- */
  const gw = $('#gw'), gwCanvas = $('#galleryWheel');
  let gwFast = false;
  new IntersectionObserver(es => es.forEach(e => { galleryWheel.visible = e.isIntersecting; })).observe(gw);
  gw.addEventListener('pointerenter', () => { gwFast = true; });
  gw.addEventListener('pointerleave', () => { gwFast = false; gwCanvas.style.transform = ''; });
  if (FINE && !RM) {
    gw.addEventListener('pointermove', e => {
      const r = gw.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      gwCanvas.style.transform = `perspective(900px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
    });
  }

  /* ---------------------------------------------------------
     GAME 03 — Slot machine
     --------------------------------------------------------- */
  const slot = $('#slot'), slotMsg = $('#slotMsg'), slotBtn = $('#slotBtn');
  const strips = $$('.strip', slot), REPS = 12, NS = SLOT_SYMS.length;
  strips.forEach(s => { s.innerHTML = Array.from({ length: REPS }, () => SLOT_SYMS.map(([n, art]) => `<span title="${n}">${art}</span>`).join('')).join(''); });
  $('#slotLights').innerHTML = Array.from({ length: 12 }, () => '<i></i>').join('');
  const bulbs = $$('#slotLights i');
  const reelPos = [NS, NS + 2, NS + 4];
  let slotBusy = false;
  const symH = () => strips[0].firstElementChild.getBoundingClientRect().height;
  const setStrip = (s, idx, dur) => {
    s.style.transition = dur ? `transform ${dur}s cubic-bezier(.12,.9,.22,1.04)` : 'none';
    s.style.transform = `translateY(${-(idx - 1) * symH()}px)`;
  };
  const placeReels = () => strips.forEach((s, i) => setStrip(s, reelPos[i], 0));
  // Each symbol is one prize slot, so the three reels always agree on what was won.
  // Lemon is the Try again slot: it hands the player an extra pull.
  const SLOT_PRIZE = { Seven: 'the Grand Prize', Diamond: 'Rs 5,000 cash', Coin: 'Rs 500 cash', Gift: 'a gift hamper', Star: 'a surprise gift', Bell: 'a 20% voucher', Cherry: 'a free product', Lemon: null };
  const slotLeftEl = $('#slotLeft');
  let slotLeft = 1;
  const setSlotLeft = n => { slotLeft = n; slotLeftEl.textContent = n; };
  function spinSlot() {
    if (slotBusy) return;
    if (slotLeft < 1) setSlotLeft(1); // demo: a fresh play
    slotBusy = true;
    slotBtn.disabled = true;
    slot.classList.add('pull');
    setTimeout(() => slot.classList.remove('pull'), 450);
    slotMsg.classList.remove('win');
    slotMsg.textContent = 'Rolling…';
    setSlotLeft(slotLeft - 1);
    const landed = Math.floor(Math.random() * NS);
    const stops = strips.map(() => landed);
    strips.forEach((s, i) => {
      setStrip(s, NS + (reelPos[i] % NS), 0);
      void s.offsetHeight;
      reelPos[i] = NS * (6 + i * 2) + stops[i];
      setStrip(s, reelPos[i], RM ? .01 : 1.4 + i * .4);
    });
    setTimeout(() => {
      strips.forEach((s, i) => { reelPos[i] = NS + (reelPos[i] % NS); setStrip(s, reelPos[i], 0); });
      const name = SLOT_SYMS[landed][0], prize = SLOT_PRIZE[name];
      slotMsg.classList.toggle('win', !!prize);
      if (prize) {
        slotMsg.innerHTML = `Three ${name.toLowerCase()}s. <b>You win ${prize}!</b>`;
        slotBtn.textContent = 'Play again';
      } else {
        setSlotLeft(slotLeft + 1);
        slotMsg.innerHTML = 'Lemons: Try again. <b>You get an extra pull.</b>';
        slotBtn.textContent = 'Use extra pull';
      }
      slotBusy = false;
      slotBtn.disabled = false;
    }, RM ? 100 : 2400);
  }
  slot.addEventListener('click', spinSlot);
  slotBtn.addEventListener('click', spinSlot);
  slot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spinSlot(); } });
  let lightTick = 0;
  setInterval(() => {
    lightTick++;
    bulbs.forEach((b, i) => b.classList.toggle('on', slotBusy ? (i + lightTick) % 3 === 0 : (i + Math.floor(lightTick / 3)) % 2 === 0));
  }, 120);

  /* ---------------------------------------------------------
     GAME 04 — Scratch Card (two foils: silver, then copper)
     --------------------------------------------------------- */
  const scFoil = $('#scFoil'), scPanel = $('#scPanel'), scMsg = $('#scMsg'), scBtn = $('#scBtn');
  const scLeftEl = $('#scLeft');
  // What can be under the foil; null is a Try again card.
  const SC_PRIZES = [
    ['💵', 'Rs 100 cashback'], ['🎟️', 'A 20% voucher'], ['🎧', 'Wireless earbuds'],
    ['🧺', 'A gift hamper'], ['🏆', 'The Grand Prize'], null, null,
  ];
  const scCtx = scFoil.getContext('2d');
  const SC_COLS = 24, SC_ROWS = 18, SC_REVEAL = .6;
  let scWear, scPrize, scDone, scLast;
  function paintFoil() {
    const r = scPanel.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    scFoil.width = r.width * dpr; scFoil.height = r.height * dpr;
    const w = scFoil.width, h = scFoil.height;
    scCtx.setTransform(1, 0, 0, 1, 0, 0);
    scCtx.globalCompositeOperation = 'source-over';
    // Copper layer, then silver over it — scratching wears the silver first.
    const copper = scCtx.createLinearGradient(0, 0, w, h);
    ['#b9772e', '#e2a85a', '#8e5520', '#cf9146'].forEach((c, i, a) => copper.addColorStop(i / (a.length - 1), c));
    scCtx.fillStyle = copper; scCtx.fillRect(0, 0, w, h);
    const silver = scCtx.createLinearGradient(0, 0, w, h);
    ['#c3c8d0', '#eef1f4', '#a4abb5', '#dce0e5', '#b1b7c0'].forEach((c, i, a) => silver.addColorStop(i / (a.length - 1), c));
    scCtx.fillStyle = silver; scCtx.fillRect(0, 0, w, h);
    scCtx.strokeStyle = 'rgba(255,255,255,.2)'; scCtx.lineWidth = 3 * dpr;
    for (let x = -h; x < w; x += 14 * dpr) { scCtx.beginPath(); scCtx.moveTo(x, h); scCtx.lineTo(x + h, 0); scCtx.stroke(); }
    scCtx.fillStyle = '#4b525c'; scCtx.font = `900 ${15 * dpr}px Inter, system-ui, sans-serif`;
    scCtx.textAlign = 'center'; scCtx.textBaseline = 'middle';
    scCtx.fillText('🪙  SCRATCH HERE', w / 2, h / 2);
  }
  function newCard() {
    const p = SC_PRIZES[Math.floor(Math.random() * SC_PRIZES.length)];
    scPrize = p;
    $('#scIc').textContent = p ? p[0] : '🍀';
    $('#scLabel').textContent = p ? 'YOU WON' : 'SO CLOSE';
    $('#scName').textContent = p ? p[1] : 'Try again';
    scWear = new Uint8Array(SC_COLS * SC_ROWS);
    scDone = false; scLast = null;
    scFoil.classList.remove('gone');
    scLeftEl.textContent = '1';
    scMsg.classList.remove('win');
    scMsg.textContent = 'Rub the silver foil, then the copper under it.';
    paintFoil();
  }
  function scratchAt(e) {
    if (scDone) return;
    const r = scFoil.getBoundingClientRect(), dpr = scFoil.width / r.width;
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr, rad = 13 * dpr;
    // Each pass wears the foil only partly: the first rubs reveal copper,
    // more of them reach the prize.
    scCtx.globalCompositeOperation = 'destination-out';
    scCtx.strokeStyle = 'rgba(0,0,0,.35)'; scCtx.lineWidth = rad * 2; scCtx.lineCap = 'round';
    scCtx.beginPath(); scCtx.moveTo(scLast ? scLast[0] : x, scLast ? scLast[1] : y); scCtx.lineTo(x, y); scCtx.stroke();
    scLast = [x, y];
    const cw = scFoil.width / SC_COLS, ch = scFoil.height / SC_ROWS;
    for (let c = 0; c < SC_COLS; c++) for (let rr = 0; rr < SC_ROWS; rr++) {
      if (Math.hypot((c + .5) * cw - x, (rr + .5) * ch - y) <= rad && scWear[rr * SC_COLS + c] < 255) scWear[rr * SC_COLS + c]++;
    }
    const cleared = scWear.reduce((n, v) => n + (v >= 4), 0) / scWear.length;
    if (cleared >= SC_REVEAL) revealCard();
  }
  function revealCard() {
    scDone = true;
    scFoil.classList.add('gone');
    scLeftEl.textContent = scPrize ? '0' : '1';
    scMsg.classList.toggle('win', !!scPrize);
    scMsg.innerHTML = scPrize ? `<b>You won ${esc(scPrize[1].replace(/^A |^The /, m => m.toLowerCase()))}!</b>` : 'Try again. <b>You get an extra card.</b>';
    scBtn.textContent = scPrize ? 'New card' : 'Use extra card';
  }
  let scDown = false;
  scFoil.addEventListener('pointerdown', e => { scDown = true; scLast = null; scFoil.setPointerCapture(e.pointerId); scratchAt(e); });
  scFoil.addEventListener('pointermove', e => { if (scDown) scratchAt(e); });
  ['pointerup', 'pointercancel'].forEach(t => scFoil.addEventListener(t, () => { scDown = false; scLast = null; }));
  scBtn.addEventListener('click', newCard);
  addEventListener('resize', () => { if (!scDone) newCard(); });
  newCard();

  /* ---------------------------------------------------------
     GAME 05 — Gift Box (pick one of six shuffled boxes)
     --------------------------------------------------------- */
  const gbGrid = $('#gbGrid'), gbMsg = $('#gbMsg'), gbBtn = $('#gbBtn'), gbLeftEl = $('#gbLeft');
  // What the brand put in the six boxes; null is an empty box.
  const GB_FILL = [['🎧', 'Earbuds'], ['🧺', 'Gift hamper'], null, ['🎟️', 'Voucher'], null, null];
  gbGrid.innerHTML = Array.from({ length: GB_FILL.length }, (_, i) =>
    `<button type="button" class="gb-box" aria-label="Box ${i + 1}"><span class="gb-out"><i></i><span></span></span><span class="gb-body"><b class="gb-num">${i + 1}</b></span><span class="gb-lid"></span></button>`
  ).join('');
  const gbBoxes = $$('.gb-box', gbGrid);
  let gbBusy = false;
  function resetBoxes() {
    gbBoxes.forEach(b => { b.className = 'gb-box'; b.disabled = false; });
    gbLeftEl.textContent = '1';
    gbMsg.classList.remove('win');
    gbMsg.textContent = "Pick a box. What's inside?";
    gbBusy = false;
  }
  function pickBox(i) {
    if (gbBusy) return;
    gbBusy = true;
    // Shuffled on every pick, so which box you tap says nothing about what's in it.
    const boxes = GB_FILL.slice().sort(() => Math.random() - .5);
    const picked = gbBoxes[i], content = boxes[i];
    gbBoxes.forEach(b => { b.disabled = true; if (b !== picked) b.classList.add('dim'); });
    picked.classList.add('wobble');
    gbMsg.textContent = 'Opening your box…';
    setTimeout(() => {
      picked.classList.remove('wobble');
      const out = $('.gb-out', picked);
      out.classList.toggle('empty', !content);
      $('i', out).textContent = content ? content[0] : '💨';
      $('span', out).textContent = content ? content[1] : 'Try again';
      picked.classList.add('open');
      if (content) {
        gbMsg.classList.add('win');
        gbMsg.innerHTML = `<b>You found ${esc(content[1].toLowerCase())}!</b>`;
        gbLeftEl.textContent = '0';
        gbBtn.textContent = 'Play again';
      } else {
        boxes.forEach((c, j) => { if (c && j !== i) { gbBoxes[j].classList.remove('dim'); gbBoxes[j].classList.add('had'); } });
        gbMsg.innerHTML = 'Empty. <b>You get another pick.</b>';
        gbBtn.textContent = 'Pick again';
      }
    }, RM ? 50 : 900);
  }
  gbBoxes.forEach((b, i) => b.addEventListener('click', () => pickBox(i)));
  gbBtn.addEventListener('click', resetBoxes);
  resetBoxes();

  /* ---------------------------------------------------------
     CAMPAIGNS — ways to enter (backend ParticipationMethod)
     --------------------------------------------------------- */
  const ENTRY = [
    {
      name: 'Bill Scan', tag: 'Scan to earn points',
      desc: 'Users scan their bill to participate and earn points. The bill number, PAN and a photo of the bill are checked, and each bill counts once.',
      flow: ['Scan bill', 'Verified', 'Points & entry'],
      opts: ['Scan the product barcode, then the bill details', 'Bill number, PAN and bill photo checked', 'Each bill counts once', 'Points earned on every valid scan'],
      mock: `<span class="mk-cap">SCAN YOUR BILL</span><div class="mk-frame"><div class="mk-bars"></div><i class="mk-line"></i></div><span class="mk-ok">✓ Bill verified · points added</span><div class="mk-steps"><span class="on">Scan</span><span>Bill details</span><span>Bill photo</span></div>`,
    },
    {
      name: 'Guess & Win', tag: 'Closest answer wins',
      desc: 'Ask for a number or a word, like how many sixes in the final or who wins the show. The closest guess takes the prize.',
      flow: ['Guess', 'Answer revealed', 'Closest wins'],
      opts: ['Number or text answers', 'Set a unit and a min / max range', 'The answer can be set after entries close'],
      mock: `<span class="mk-cap">GUESS &amp; WIN</span><div class="mk-q">How many sixes in the final?</div><div class="mk-input"><b>14</b><span>sixes</span></div><div class="mk-range"><span>0</span><i></i><span>40</span></div><span class="mk-btn">Submit guess</span>`,
    },
    {
      name: 'Quiz', tag: 'Graded instantly',
      desc: 'Multiple-choice questions with one right answer each. Set a pass mark, then draw at random or rank by score.',
      flow: ['Answer', 'Graded', 'Qualified'],
      opts: ['Any number of questions, images optional', 'Pass mark: all correct, or as many as you set', 'Draw winners at random or by highest score'],
      mock: `<span class="mk-cap">QUESTION 2 / 5</span><div class="mk-q">Which festival is celebrated with Deusi-Bhailo?</div><span class="mk-opt"><i></i>Dashain</span><span class="mk-opt ok"><i></i>Tihar</span><span class="mk-opt"><i></i>Holi</span><span class="mk-opt"><i></i>Teej</span>`,
    },
    {
      name: 'Yes/No', tag: 'One-tap answers',
      desc: 'Quick two-option questions, graded the same way as a quiz. Built for a busy event floor.',
      flow: ['Yes or no', 'Graded', 'Qualified'],
      opts: ['Two options per question', 'Same pass-mark rules as Quiz', 'The fastest way in for a crowd'],
      mock: `<span class="mk-cap">QUESTION 1 / 3</span><div class="mk-q">Is this your first Dashain with us?</div><div class="mk-yn"><span class="ok">Yes</span><span>No</span></div>`,
    },
    {
      name: 'Poll', tag: 'The crowd decides',
      desc: 'People vote on a set of options and watch the results move live. Entries on the winning option go into the draw.',
      flow: ['Vote', 'Live results', 'Draw'],
      opts: ['Two or more options', 'No right answer. The vote share picks the winner', 'Results update live while voting is open'],
      mock: `<span class="mk-cap">LIVE POLL</span><div class="mk-q">Best Tihar sweet?</div><div class="mk-poll"><div class="lead" style="--v:54%"><i></i><span>Sel roti</span><b>54%</b></div><div style="--v:31%"><i></i><span>Anarasa</span><b>31%</b></div><div style="--v:15%"><i></i><span>Laddu</span><b>15%</b></div></div>`,
    },
    {
      name: 'Points', tag: 'Loyalty',
      desc: 'Users earn points through bill scans and other campaign activities, and can spend 100 points on an extra entry.',
      flow: ['Take part', 'Earn points', 'Redeem entry'],
      opts: ['Points for bill scans and campaign activities', 'Daily reward games add more', '100 points buys an extra entry, once per campaign'],
      mock: `<span class="mk-cap">YOUR POINTS</span><div class="mk-bal"><b>240</b><span>pts</span></div><div class="mk-meter"><i></i></div><span class="mk-opt ok"><i></i>Redeem 100 pts → 1 entry</span>`,
    },
  ];
  const entryTabs = $('#entryTabs'), entryPanel = $('#entryPanel');
  entryTabs.innerHTML = ENTRY.map((m, i) => `
    <button type="button" role="tab" id="en-${i}" aria-controls="entryPanel" aria-selected="false" tabindex="-1">
      <span class="en">${pad2(i + 1)}</span><span class="et">${esc(m.name)}</span><span class="ea">→</span>
    </button>`).join('');
  const entryBtns = $$('button', entryTabs);
  let entryIdx = -1;
  function setEntry(i, focus) {
    if (i === entryIdx) return;
    const first = entryIdx < 0;
    entryIdx = i;
    entryBtns.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
    if (focus) entryBtns[i].focus();
    entryPanel.setAttribute('aria-labelledby', 'en-' + i);
    const m = ENTRY[i];
    const render = () => {
      entryPanel.innerHTML = `
        <div class="ep-body">
          <div class="ep-copy">
            <span class="ep-tag">${pad2(i + 1)} / ${pad2(ENTRY.length)} · ${esc(m.tag)}</span>
            <h4>${esc(m.name)}</h4>
            <p>${esc(m.desc)}</p>
            <div class="flowchips">${m.flow.map((f, k) => `${k ? '<i>→</i>' : ''}<span>${esc(f)}</span>`).join('')}</div>
            <ul class="ep-opts">${m.opts.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
          </div>
          <div class="mock" aria-hidden="true">${m.mock}</div>
        </div>`;
      requestAnimationFrame(() => entryPanel.classList.remove('swap'));
    };
    if (first) { render(); return; }
    entryPanel.classList.add('swap');
    setTimeout(render, 200);
  }
  entryBtns.forEach((b, i) => b.addEventListener('click', () => setEntry(i)));
  entryTabs.addEventListener('keydown', e => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    setEntry((entryIdx + d + ENTRY.length) % ENTRY.length, true);
  });
  setEntry(0);

  /* ---------------------------------------------------------
     LIVE DRAW — played the way the app's draw rooms play it
     (features/live_draw): countdown → running with no result →
     revealing (the bowl lifts a slip, the wheel brakes, the reels stop)
     → revealed, one prize tier after another. The drawn Participant ID
     is then matched, checked and announced.
     --------------------------------------------------------- */
  const ID_AB = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let seed = 11;
  const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const NAMES = ['Sita K.', 'Bikash T.', 'Priya R.', 'Anish S.', 'Ramesh B.', 'Sunita G.', 'Kiran M.', 'Asha P.', 'Nabin D.', 'Pooja L.', 'Suman C.', 'Rita A.',
    'Dipesh N.', 'Manisha J.', 'Rohan S.', 'Kabita B.', 'Sagar P.', 'Anjali T.', 'Prakash R.', 'Srijana K.', 'Bishal G.', 'Nisha M.', 'Arjun D.', 'Laxmi S.',
    'Sanjay K.', 'Gita R.', 'Hari B.', 'Mina T.', 'Rajesh P.', 'Sabina L.', 'Umesh G.', 'Kamala D.', 'Nirmal S.', 'Puja B.', 'Deepak M.', 'Sarita A.'];
  const HOW = ['Bill Scan', 'Quiz', 'Guess & Win', 'Yes/No', 'Poll', 'Points'];
  // When each participant entered — a sample spread over the campaign's first twelve days.
  const entered = () => `${1 + Math.floor(srand() * 12)} Oct · ${1 + Math.floor(srand() * 12)}:${pad2(Math.floor(srand() * 60))} ${srand() < .5 ? 'AM' : 'PM'}`;
  const REF_LEN = 6; // kTicketReferenceLength
  const seenIds = new Set();
  const POOL = NAMES.map((name, i) => {
    let id;
    do { id = Array.from({ length: REF_LEN }, () => ID_AB[Math.floor(srand() * ID_AB.length)]).join(''); } while (seenIds.has(id));
    seenIds.add(id);
    return { id, name, how: HOW[i % HOW.length], when: entered(), style: i % 5 };
  });
  const TIERS = [
    { tier: 'Grand Prize', prize: 'Honda Dio scooter' },
    { tier: '2nd Prize', prize: 'Samsung Galaxy phone' },
    { tier: '3rd Prize', prize: 'Rs 10,000 shopping voucher' },
  ];
  let eligible = POOL.slice(), tierIdx = 0;

  const room = $('#room'), roomStatus = $('#roomStatus'), roomTier = $('#roomTier');
  const drawBtn = $('#drawBtn'), drawTabs = $$('#drawTabs button');
  const verifySteps = $$('#verify li'), winnerCard = $('#winnerCard');
  const countdown = $('#countdown'), cdNum = $('#cdNum'), cdRing = $('#cdRing');
  const poolCount = $('#poolCount'), roomAud = $('#roomAud');
  let method = 'bowl', phase = 'idle', drawTimers = [], roomVisible = false, audN = 1284;
  new IntersectionObserver(es => es.forEach(e => { roomVisible = e.isIntersecting; })).observe(room);
  const later = (fn, ms) => drawTimers.push(setTimeout(fn, ms));
  const STATUS = { idle: 'Waiting to start', running: 'Drawing live', revealing: 'Revealing winner', revealed: 'Winner drawn' };
  function setPhase(p, text) { phase = p; roomStatus.dataset.phase = p; roomStatus.textContent = text || STATUS[p]; }
  setInterval(() => {
    if (!roomVisible || document.hidden) return;
    audN = Math.max(900, audN + Math.round((Math.random() - (phase === 'idle' ? .5 : .3)) * 18));
    roomAud.textContent = fmt(audN);
  }, 1300);

  /* ---- Glass bowl (glass_bowl.dart, lottery_ticket.dart, winning_ticket_reveal.dart) ---- */
  const bowlCv = $('#bowlCv'), bctx = bowlCv.getContext('2d');
  const TICKET_STYLES = [['#F2B93B', '#D99A1F', '#4a2c00'], ['#3E6FA6', '#2C5480', '#ffffff'], ['#D1483F', '#AE372F', '#ffffff'], ['#4C9484', '#357467', '#ffffff'], ['#E0812F', '#BE651C', '#ffffff']];
  const bowl = { W: 0, H: 0, dpr: 1, mix: 0, target: 0, slips: [], reveal: null };
  const BOWL_SLIPS = Array.from({ length: 64 }, (_, i) => ({
    p: POOL[i % POOL.length], dx: srand() * 2 - 1, dy: Math.pow(srand(), 1.25), dz: srand(),
    rot: (srand() - .5) * 1.2, ph: srand() * TAU, hidden: false,
  })).sort((a, b) => a.dz - b.dz);
  // A round fishbowl: a near-circular body cut by a narrow neck (at .12h, half-width .26w)
  // and a small flat base (at .92h, half-width .24w), so the rim and base lens still line up.
  const BOWL_TOP = Math.acos(-.52), BOWL_BOT = Math.acos(-.48);
  // `sides` traces only the two walls, for stroking without a line across the mouth or base.
  function traceBowl(x, y, w, h, sides = false) {
    const rx = w * .5, ry = h * .462, cx = x + rx, cy = y + h * .515;
    bctx.beginPath();
    bctx.ellipse(cx, cy, rx, ry, 0, TAU - BOWL_TOP, BOWL_BOT, true);
    if (sides) bctx.moveTo(cx + rx * .48, cy + ry * Math.sin(BOWL_BOT));
    bctx.ellipse(cx, cy, rx, ry, 0, Math.PI - BOWL_BOT, BOWL_TOP - Math.PI, true);
    if (!sides) bctx.closePath();
  }
  function drawSlip(x, y, w, h, rot, st, text, sx = 1, widen = false) {
    const [base, dark, ink] = TICKET_STYLES[st];
    // The text sits right of the stub; either the ticket grows to hold it or the text shrinks to fit.
    let fs = h * .42;
    bctx.font = `800 ${fs}px Inter, sans-serif`;
    const tw = bctx.measureText(text).width, room = w * .68;
    if (tw > room) { if (widen) w = tw + h * 1.1; else fs *= room / tw; }
    bctx.save();
    bctx.translate(x, y); bctx.rotate(rot); bctx.scale(sx, 1);
    bctx.shadowColor = 'rgba(0,0,0,.35)'; bctx.shadowBlur = 3; bctx.shadowOffsetX = 1; bctx.shadowOffsetY = 2;
    const r = Math.min(4, h * .18);
    bctx.beginPath(); bctx.roundRect ? bctx.roundRect(-w / 2, -h / 2, w, h, r) : bctx.rect(-w / 2, -h / 2, w, h);
    bctx.fillStyle = base; bctx.fill();
    bctx.shadowColor = 'transparent';
    // The stub keeps its own width when the ticket stretches to hold a long name.
    const stub = Math.min(w * .24, h * .5);
    bctx.save(); bctx.clip();
    bctx.fillStyle = dark; bctx.fillRect(-w / 2, -h / 2, stub, h);
    bctx.restore();
    bctx.strokeStyle = 'rgba(255,255,255,.7)'; bctx.lineWidth = 1;
    for (let yy = -h / 2 + 1; yy < h / 2 - 1; yy += 3.2) { bctx.beginPath(); bctx.moveTo(-w / 2 + stub, yy); bctx.lineTo(-w / 2 + stub, yy + 1.6); bctx.stroke(); }
    if (widen && h > 30) { bctx.lineWidth = 2; bctx.strokeStyle = 'rgba(255,214,120,.9)'; bctx.beginPath(); bctx.roundRect ? bctx.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, r) : bctx.rect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2); bctx.stroke(); }
    bctx.fillStyle = ink; bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.font = `800 ${fs}px Inter, sans-serif`;
    bctx.fillText(text, stub / 2, 1);
    bctx.restore();
  }
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function sizeBowl() {
    const w = bowlCv.clientWidth;
    if (!w) return;
    bowl.W = w; bowl.H = w * 1.12; bowl.dpr = Math.min(2, devicePixelRatio || 1);
    bowlCv.width = Math.round(w * bowl.dpr); bowlCv.height = Math.round(bowl.H * bowl.dpr);
    drawBowl(performance.now());
  }
  function drawBowl(now) {
    const { W, H } = bowl;
    if (!W) return;
    // Shake strength eases in and out rather than jolting (LotteryBowl).
    bowl.mix = lerp(bowl.mix, bowl.target, .06);
    const s = bowl.mix, t = now / 1000, rad = hz => t * hz * TAU;
    const B = W * .8, cx = W / 2;
    // The glass is a touch taller than wide, so it reads as a round fishbowl rather than a squat dish.
    const Bw = W * .72, Bh = Bw * 1.08, x0 = (W - Bw) / 2, y0 = H - B * .19 - Bh * .94, floor = y0 + Bh * .94;
    const k = B / 300; // the app's pixel sizes are for a ~300px bowl
    bctx.setTransform(bowl.dpr, 0, 0, bowl.dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);

    // Pedestal the bowl stands on.
    const pedTop = floor - B * .01, pw = B * .62, ph = B * .1;
    bctx.beginPath(); bctx.ellipse(cx, pedTop + ph + B * .03, pw * .62, B * .03, 0, 0, TAU); bctx.fillStyle = 'rgba(0,0,0,.45)'; bctx.fill();
    const side = bctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
    side.addColorStop(0, '#23085e'); side.addColorStop(.5, '#5a1fc7'); side.addColorStop(1, '#23085e');
    bctx.beginPath(); bctx.moveTo(cx - pw / 2, pedTop); bctx.lineTo(cx - pw / 2, pedTop + ph);
    bctx.ellipse(cx, pedTop + ph, pw / 2, B * .045, 0, Math.PI, 0, true); bctx.lineTo(cx + pw / 2, pedTop);
    bctx.ellipse(cx, pedTop, pw / 2, B * .045, 0, 0, Math.PI, false); bctx.closePath(); bctx.fillStyle = side; bctx.fill();
    bctx.beginPath(); bctx.ellipse(cx, pedTop, pw / 2, B * .045, 0, 0, TAU);
    const top = bctx.createLinearGradient(0, pedTop - B * .045, 0, pedTop + B * .045);
    top.addColorStop(0, '#8f5cf7'); top.addColorStop(1, '#4b17b0'); bctx.fillStyle = top; bctx.fill();
    bctx.save(); bctx.shadowColor = '#ff9a2e'; bctx.shadowBlur = 10; bctx.lineWidth = 1.6; bctx.strokeStyle = '#ffc070';
    bctx.beginPath(); bctx.ellipse(cx, pedTop, pw / 2 * .97, B * .04, 0, 0, Math.PI); bctx.stroke();
    bctx.globalAlpha = .6; bctx.beginPath(); bctx.ellipse(cx, pedTop + ph * .6, pw / 2, B * .045, 0, .15, Math.PI - .15); bctx.stroke();
    bctx.restore();

    // The whole bowl tilts, sways and bobs while it is shaken.
    bctx.save();
    bctx.translate(cx + Math.sin(rad(4.5) + .6) * 10 * k * s, floor + Math.cos(rad(3.5)) * 6 * k * s);
    bctx.rotate(Math.sin(rad(3)) * .09 * s);
    bctx.translate(-cx, -floor);

    // Contact shadow, tinted glass.
    bctx.beginPath(); bctx.ellipse(x0 + Bw * .5, y0 + Bh * .94, Bw * .31, Bh * .04, 0, 0, TAU); bctx.fillStyle = 'rgba(0,0,0,.35)'; bctx.fill();
    traceBowl(x0, y0, Bw, Bh);
    const glass = bctx.createRadialGradient(x0 + Bw * .5, y0 + Bh * .4, 0, x0 + Bw * .5, y0 + Bh * .4, B * .6);
    glass.addColorStop(.3, 'rgba(255,255,255,.02)'); glass.addColorStop(.7, 'rgba(178,235,242,.07)'); glass.addColorStop(1, 'rgba(0,131,143,.2)');
    bctx.fillStyle = glass; bctx.fill();

    // The pile: small tickets across the bottom, fading with depth, bouncing up off the base.
    const tw = 32 * k, th = 17 * k, dim = phase === 'revealing' || phase === 'revealed';
    bctx.save();
    traceBowl(x0, y0, Bw, Bh); bctx.clip();
    BOWL_SLIPS.forEach(sl => {
      if (sl.hidden) return;
      const bx = Math.sin(rad(5) + sl.ph) * 14 * k * s;
      const by = Math.abs(Math.cos(rad(4) + sl.ph * 1.3)) * 12 * k * s;
      // Tossed tickets fly up through the whole bowl, then fall back onto the pile.
      const lift = s * Math.pow(Math.abs(Math.sin(rad(.9) + sl.ph)), 2) * Bh * .42;
      const h = sl.dy * Bh * .36 * (.7 + sl.dz * .3) + by + lift;
      // The bowl flares out above its base, so the pile spreads wider as it rises.
      const spread = Bw * (.2 + .18 * Math.min(1, h / (Bh * .4)));
      const x = cx + sl.dx * spread + bx;
      const y = y0 + Bh * .885 - th * .5 - h;
      const sc = .68 + sl.dz * .5;
      const spin = s ? Math.sin(rad(6) + sl.ph) * .5 * s : Math.sin(t * .6 + sl.dx * 10) * .04;
      bctx.globalAlpha = (dim ? .4 : .65) + sl.dz * .35;
      drawSlip(x, y, tw * sc, th * sc, sl.rot + spin, sl.p.style, '#' + sl.p.id);
    });
    bctx.globalAlpha = 1;
    bctx.restore();

    // Base lens, outline, rim and the two glares, over the tickets.
    bctx.beginPath();
    bctx.moveTo(x0 + Bw * .26, y0 + Bh * .92); bctx.bezierCurveTo(x0 + Bw * .38, y0 + Bh * .96, x0 + Bw * .62, y0 + Bh * .96, x0 + Bw * .74, y0 + Bh * .92);
    bctx.bezierCurveTo(x0 + Bw * .62, y0 + Bh * .88, x0 + Bw * .38, y0 + Bh * .88, x0 + Bw * .26, y0 + Bh * .92);
    bctx.fillStyle = 'rgba(255,255,255,.2)'; bctx.fill();
    traceBowl(x0, y0, Bw, Bh, true); bctx.lineWidth = 2; bctx.strokeStyle = 'rgba(224,247,250,.4)'; bctx.stroke();
    bctx.beginPath(); bctx.ellipse(x0 + Bw * .5, y0 + Bh * .12, Bw * .26, Bh * .05, 0, 0, TAU);
    bctx.fillStyle = 'rgba(224,247,250,.12)'; bctx.fill(); bctx.lineWidth = 2.2; bctx.strokeStyle = 'rgba(255,255,255,.65)'; bctx.stroke();
    bctx.lineCap = 'round';
    bctx.beginPath(); bctx.moveTo(x0 + Bw * .26, y0 + Bh * .16); bctx.bezierCurveTo(x0 + Bw * .08, y0 + Bh * .3, x0 + Bw * .08, y0 + Bh * .62, x0 + Bw * .22, y0 + Bh * .8);
    bctx.lineWidth = 4; bctx.strokeStyle = 'rgba(255,255,255,.38)'; bctx.stroke();
    bctx.beginPath(); bctx.moveTo(x0 + Bw * .74, y0 + Bh * .18); bctx.bezierCurveTo(x0 + Bw * .91, y0 + Bh * .32, x0 + Bw * .91, y0 + Bh * .58, x0 + Bw * .82, y0 + Bh * .7);
    bctx.lineWidth = 2.5; bctx.strokeStyle = 'rgba(255,255,255,.18)'; bctx.stroke();
    bctx.lineCap = 'butt';
    bctx.restore();

    // The drawn ticket rises out, grows and flips to show who won (WinningTicketReveal).
    const rv = bowl.reveal;
    if (rv) {
      const p = RM ? 1 : clamp((now - rv.start) / rv.dur);
      const rise = easeOutCubic(clamp(p / .65)), flip = easeInOut(clamp((p - .35) / .4)), grow = easeOutBack(clamp((p - .3) / .55));
      const settle = p > .8 ? Math.sin((p - .8) / .2 * Math.PI) * 3 : 0;
      const y = lerp(y0 + Bh * .7, H * .14, rise) - settle, sc = lerp(1, 4.2, grow), ang = flip * Math.PI;
      const faceUp = ang >= Math.PI / 2;
      bctx.save();
      bctx.shadowColor = 'rgba(255,194,31,.55)'; bctx.shadowBlur = 24 * grow;
      drawSlip(W / 2, y, tw * sc, th * sc * (faceUp ? 1.05 : 1), (1 - rise) * rv.slip.rot, rv.slip.p.style, faceUp ? rv.slip.p.name : '#' + rv.slip.p.id, Math.max(.04, Math.abs(Math.cos(ang))), true);
      bctx.restore();
    }
  }

  /* ---- Spinner room: ten wedges, entrants grouped into them (WheelSlotAllocator) ---- */
  const SLOTS = 10;
  const groupOf = i => i % SLOTS;
  const idWheel = createWheel($('#idWheel'), Array.from({ length: SLOTS }, (_, g) => `Group ${g + 1}`), { icons: false });
  const wheelRun = { speed: 0, brake: null };

  /* ---- Slot machine: the arcade cabinet, reels carrying the ticket reference ---- */
  const arcade = $('#arcade'), arReels = $('#arReels');
  arReels.innerHTML = Array.from({ length: REF_LEN }, () => '<div class="ar-reel"><div class="ar-strip"></div></div>').join('');
  const arStrips = $$('.ar-strip', arReels);
  const randChars = n => Array.from({ length: n }, () => `<span>${ID_AB[Math.floor(Math.random() * ID_AB.length)]}</span>`).join('');
  const showRef = ref => arStrips.forEach((s, k) => { s.classList.remove('rolling'); s.style.transition = 'none'; s.style.transform = 'translateY(0)'; s.innerHTML = `${randChars(1)}<span>${ref[k]}</span>${randChars(1)}`; });
  showRef('WINZY!'.slice(0, REF_LEN).padEnd(REF_LEN, '!'));
  $('#arBulbs').innerHTML = Array.from({ length: 11 }, () => '<i></i>').join('');
  const arBulbs = $$('#arBulbs i');
  let chase = 0;
  setInterval(() => {
    if (!roomVisible || method !== 'slot') return;
    chase++;
    const fast = phase === 'running' || phase === 'revealing';
    arBulbs.forEach((b, i) => b.classList.toggle('on', fast ? (i + chase) % 3 === 0 : (i + Math.floor(chase / 4)) % 2 === 0));
  }, 110);

  /* ---- Running and landing, per machine ---- */
  function startMachine() {
    if (method === 'bowl') bowl.target = 1;
    else if (method === 'spinner') { wheelRun.speed = RM ? 0 : .14; wheelRun.brake = null; }
    else {
      arcade.classList.add('pull'); setTimeout(() => arcade.classList.remove('pull'), 500);
      arStrips.forEach(s => { const band = randChars(8); s.style.transition = 'none'; s.style.transform = ''; s.innerHTML = band + band + band; s.classList.add('rolling'); });
    }
  }
  function landMachine(p, done) {
    if (method === 'bowl') {
      bowl.target = 0;
      const slip = BOWL_SLIPS.find(s => s.p === p) || BOWL_SLIPS[Math.floor(Math.random() * BOWL_SLIPS.length)];
      if (slip.p !== p) slip.p = p;
      slip.hidden = true;
      bowl.reveal = { slip, start: performance.now(), dur: 2400 };
      later(done, RM ? 60 : 2500);
    } else if (method === 'spinner') {
      const g = groupOf(POOL.indexOf(p)), sw = TAU / SLOTS;
      const target = -(g + (Math.random() - .5) * .5) * sw;
      const rem = (((target - idWheel.theta) % TAU) + TAU) % TAU;
      const dur = RM ? 400 : 3400;
      const want = wheelRun.speed * 60 / 1000 * dur / 3; // brake from the speed it is already turning at
      const delta = rem + TAU * Math.max(0, Math.round((want - rem) / TAU));
      wheelRun.brake = { from: idWheel.theta, to: idWheel.theta + delta, start: performance.now(), dur, last: idWheel.segmentAt(), done };
      wheelRun.speed = 0;
    } else {
      const ch = $('.ar-reel', arReels).offsetHeight / 3 || 52;
      arStrips.forEach((s, k) => later(() => {
        s.classList.remove('rolling');
        s.style.transition = 'none'; s.style.transform = 'translateY(0)';
        s.innerHTML = randChars(10) + `<span>${p.id[k]}</span>` + randChars(1);
        void s.offsetHeight;
        s.style.transition = `transform ${RM ? .01 : .9}s cubic-bezier(.12,.9,.22,1.04)`;
        s.style.transform = `translateY(${-9 * ch}px)`;
      }, RM ? 0 : k * 320));
      later(done, RM ? 80 : REF_LEN * 320 + 1000);
    }
  }

  /* ---- The draw ---- */
  function resetRoom() {
    drawTimers.forEach(clearTimeout); drawTimers = [];
    verifySteps.forEach((li, i) => { li.classList.remove('on', 'busy'); $('span', li).textContent = i ? 'Waiting' : 'Waiting for the draw'; });
    winnerCard.classList.remove('show');
    $('#wName').textContent = 'Not drawn yet';
    ['#wId', '#wHow', '#wWhen'].forEach(s => { $(s).textContent = '…'; });
    bowl.reveal = null; bowl.target = 0;
    BOWL_SLIPS.forEach(s => { s.hidden = false; });
    countdown.hidden = true;
  }
  function showTier() {
    const t = TIERS[Math.min(tierIdx, TIERS.length - 1)];
    roomTier.textContent = `${t.tier}: ${t.prize}`;
    $('#wTier').textContent = t.tier; $('#wPrize').textContent = t.prize;
  }
  function setMethod(m) {
    if (phase !== 'idle' && phase !== 'revealed') return;
    method = m;
    drawTabs.forEach(b => b.setAttribute('aria-selected', b.dataset.m === m));
    $$('#roomStage .room-m').forEach(d => { d.hidden = d.dataset.m !== m; });
    resetRoom();
    setPhase('idle');
    showTier();
    if (m === 'spinner') idWheel.size();
    if (m === 'bowl') sizeBowl();
  }
  drawTabs.forEach(b => b.addEventListener('click', () => setMethod(b.dataset.m)));

  function announce(p) {
    const t = TIERS[tierIdx];
    const step = (i, text, delay) => later(() => {
      verifySteps[i].classList.remove('busy'); verifySteps[i].classList.add('on');
      $('span', verifySteps[i]).textContent = text;
      if (verifySteps[i + 1]) verifySteps[i + 1].classList.add('busy');
    }, delay);
    const gap = RM ? 40 : 650;
    const where = method === 'spinner' ? ` · Group ${groupOf(POOL.indexOf(p)) + 1}` : '';
    step(0, `Participant ID #${p.id}${where}`, 0);
    step(1, `${p.name} · ${p.how} · entered ${p.when}`, gap);
    step(2, 'Eligible · meets the campaign rules', gap * 2);
    step(3, `${t.tier} awarded live`, gap * 3);
    later(() => {
      $('#wName').textContent = p.name; $('#wId').textContent = '#' + p.id;
      $('#wHow').textContent = p.how; $('#wWhen').textContent = p.when;
      winnerCard.classList.add('show');
      setPhase('revealed', `Winner · ${t.tier}`);
      eligible = eligible.filter(e => e !== p);
      poolCount.textContent = eligible.length;
      tierIdx++;
      drawBtn.disabled = false;
      drawBtn.textContent = tierIdx < TIERS.length ? `Draw ${TIERS[tierIdx].tier}` : 'Start a new draw';
      drawTabs.forEach(b => { b.disabled = false; });
    }, gap * 3 + 150);
  }

  function startDraw() {
    if (phase !== 'idle' && phase !== 'revealed') return;
    if (tierIdx >= TIERS.length) { tierIdx = 0; eligible = POOL.slice(); poolCount.textContent = eligible.length; }
    resetRoom();
    showTier();
    drawBtn.disabled = true;
    drawTabs.forEach(b => { b.disabled = true; });
    verifySteps[0].classList.add('busy');
    $('span', verifySteps[0]).textContent = 'Drawing…';
    // A fixed lead-in countdown before the machine starts (DrawStartCountdown).
    const N = RM ? 1 : 5;
    countdown.hidden = false;
    let n = N;
    const tick = () => {
      cdNum.textContent = n;
      cdRing.style.strokeDashoffset = (326.7 * (1 - n / N)).toFixed(1);
      setPhase('countdown', `Starting in ${n}`);
      if (n === 0) {
        countdown.hidden = true;
        setPhase('running');
        startMachine();
        // Runs with no result until the winner is announced — then lands on it.
        later(() => {
          const p = eligible[Math.floor(Math.random() * eligible.length)];
          setPhase('revealing');
          landMachine(p, () => announce(p));
        }, RM ? 80 : 2600);
        return;
      }
      n--;
      later(tick, RM ? 30 : 1000);
    };
    tick();
  }
  drawBtn.addEventListener('click', startDraw);
  showTier();
  poolCount.textContent = eligible.length;

  function liveFrame(now) {
    if (!roomVisible && !wheelRun.brake) return;
    if (method === 'bowl') drawBowl(now);
    else if (method === 'spinner') {
      const b = wheelRun.brake;
      if (b) {
        const t = clamp((now - b.start) / b.dur);
        idWheel.theta = b.from + (b.to - b.from) * (1 - Math.pow(1 - t, 3));
        idWheel.phase += .04;
        const s = idWheel.segmentAt();
        if (s !== b.last) { b.last = s; idWheel.deflect = -1; }
        if (t >= 1) { wheelRun.brake = null; b.done(); }
      } else {
        idWheel.theta += wheelRun.speed || (RM ? 0 : .0015);
        idWheel.phase += wheelRun.speed ? .05 : .006;
        if (wheelRun.speed && Math.random() < .5) idWheel.deflect = -1;
      }
      idWheel.deflect *= .8;
      idWheel.draw();
    }
  }

  /* ---------------------------------------------------------
     EVENTS
     --------------------------------------------------------- */
  // Each event type with the participation methods and games that suit it.
  const EV_ICONS = {
    festival: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
    launch: '<path d="M5 15c-1 1-1.5 3.5-1.5 5.5 2 0 4.5-.5 5.5-1.5"/><path d="M9 15l-3-3c1-4 4.5-8 12-8 0 7.5-4 11-8 12z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
    activation: '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    corporate: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    retail: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    exhibition: '<path d="M3 20h18M5 20V10l7-6 7 6v10"/><path d="M10 20v-5h4v5"/>',
    college: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
    promo: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  };
  const EVENTS = [
    ['festival', 'Festivals', 'Seasonal campaigns and live games for Dashain, Tihar and every season in between.', ['Jhandi Burja', 'Live draw']],
    ['launch', 'Product Launches', 'Turn the reveal into a moment the whole audience takes part in.', ['Quiz', 'Live draw']],
    ['activation', 'Brand Activations', 'Pull passers-by into the booth with a spin or a quick guess.', ['Spin & Win', 'Guess & Win']],
    ['corporate', 'Corporate Events', 'Quizzes, polls and Yes/No rounds that get the whole room answering.', ['Quiz', 'Poll', 'Yes/No']],
    ['retail', 'Retail Events', 'Every purchase becomes points and a live draw entry.', ['Bill Scan', 'Points']],
    ['exhibition', 'Exhibitions', 'Give every stall visitor a reason to stop, play and stay.', ['Spin & Win', 'Slot Machine']],
    ['college', 'College Events', 'Guess & Win, polls and live games built for loud crowds.', ['Guess & Win', 'Jhandi Burja']],
    ['promo', 'Promotional Events', 'Daily rewards that bring people back for the whole campaign.', ['Slot Machine', 'Daily rewards']],
  ];
  $('#eventGrid').innerHTML = EVENTS.map(([ic, n, d, tags], i) => `
    <li class="event rv" style="--d:${(i % 4) * 70}ms">
      <span class="ev-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${EV_ICONS[ic]}</svg></span>
      <b>${esc(n)}</b><p>${esc(d)}</p>
      <span class="ev-tags">${tags.map(t => `<i>${esc(t)}</i>`).join('')}</span>
    </li>`).join('');

  observeReveals(document);
  io.observe($('#timeline'));
  const howTabs = $$('#howTabs button'), timelines = [$('#timeline'), $('#timelineGames')];
  howTabs.forEach(b => b.addEventListener('click', () => {
    howTabs.forEach(x => x.setAttribute('aria-selected', x === b));
    timelines.forEach(tl => {
      const on = tl.dataset.t === b.dataset.t;
      tl.hidden = !on;
      if (on) { tl.classList.remove('in'); requestAnimationFrame(() => requestAnimationFrame(() => tl.classList.add('in'))); }
    });
  }));

  /* ---------------------------------------------------------
     PLAY — the real Spin & Win, on canvas
     --------------------------------------------------------- */
  // One sample per prize type the backend supports, including Try again (which earns an extra spin).
  const PRIZES = [
    { t: 'RS 500 CASH', ic: 'Rs' }, { t: '20% VOUCHER', ic: '%' }, { t: 'GIFT HAMPER', ic: '♥' }, { t: 'SURPRISE', ic: '?' },
    { t: 'FREE PRODUCT', ic: '★' }, { t: 'RS 100 CASH', ic: 'Rs' }, { t: 'TRY AGAIN', ic: '↻', again: true }, { t: 'GRAND PRIZE', ic: '♛' },
  ];
  const wrap = $('#wheelWrap'), playWheel = createWheel($('#wheel'), PRIZES.map(p => p.t));
  const spinBtn = $('#spinBtn'), hubBtn = $('#hubBtn'), reward = $('#reward');
  const N = PRIZES.length, SEG = TAU / N;
  let spinning = false, lastSeg = -1;
  let spinStart = 0, spinFrom = 0, spinTo = 0, spinDur = 5200;
  const spinsLeftEl = $('#spinsLeft');
  let spinsLeft = 1;
  const setSpins = n => { spinsLeft = n; spinsLeftEl.textContent = n; };
  function spin() {
    if (spinning) return;
    if (spinsLeft < 1) setSpins(1); // demo: a fresh play
    setSpins(spinsLeft - 1);
    spinning = true;
    wrap.classList.add('spinning');
    spinBtn.disabled = hubBtn.disabled = true;
    spinBtn.textContent = 'Spinning…';
    reward.classList.remove('show');
    const win = Math.floor(Math.random() * N);
    const target = -(win + (Math.random() - .5) * .6) * SEG;
    const delta = (((target - playWheel.theta) % TAU) + TAU) % TAU;
    spinFrom = playWheel.theta;
    spinTo = playWheel.theta + delta + TAU * (6 + Math.floor(Math.random() * 2));
    spinDur = RM ? 600 : 5200;
    spinStart = performance.now();
    lastSeg = playWheel.segmentAt();
  }
  function finishSpin() {
    spinning = false;
    wrap.classList.remove('spinning');
    const prize = PRIZES[playWheel.segmentAt()];
    $('#rwIc').textContent = prize.ic;
    reward.classList.toggle('again', !!prize.again);
    if (prize.again) {
      // Try again: no prize, but the player gets an extra spin.
      setSpins(spinsLeft + 1);
      $('#rwLabel').textContent = 'Try again';
      $('#rwName').textContent = 'Extra spin unlocked';
      $('#rwCode').textContent = 'No code needed';
      spinBtn.textContent = 'Use extra spin';
    } else {
      $('#rwLabel').textContent = 'You won';
      $('#rwName').textContent = prize.t;
      // Same format as the backend's claim codes: 8 characters, no look-alikes (0/O, 1/I/L).
      const AB = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
      $('#rwCode').textContent = Array.from({ length: 8 }, () => AB[Math.floor(Math.random() * AB.length)]).join('');
      spinBtn.textContent = 'Play again';
      confetti();
    }
    reward.classList.add('show');
    spinBtn.disabled = hubBtn.disabled = false;
  }
  spinBtn.addEventListener('click', spin);
  hubBtn.addEventListener('click', spin);
  new IntersectionObserver(es => es.forEach(e => { playWheel.visible = e.isIntersecting; })).observe(wrap);

  // Gold confetti
  const cf = $('#confetti'), cfx = cf.getContext('2d'), playSec = $('#play');
  let bits = [];
  function confetti() {
    if (RM) return;
    const pr = playSec.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    cf.width = pr.width * dpr; cf.height = pr.height * dpr;
    cfx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = wr.left - pr.left + wr.width / 2, oy = wr.top - pr.top + wr.height / 2;
    const cols = [C.gold, C.goldHi, '#fffaf0', '#b58cff', RED];
    bits = Array.from({ length: 140 }, () => {
      const a = Math.random() * TAU, v = 4 + Math.random() * 9;
      return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: Math.random() * TAU, vr: (Math.random() - .5) * .35, w: 5 + Math.random() * 7, h: 3 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)], life: 1 };
    });
  }
  function confettiFrame() {
    if (!bits.length) return;
    cfx.clearRect(0, 0, cf.width, cf.height);
    bits.forEach(b => {
      b.vy += .22; b.vx *= .985; b.vy *= .985; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life -= .008;
      cfx.save(); cfx.globalAlpha = Math.max(0, b.life); cfx.translate(b.x, b.y); cfx.rotate(b.r);
      cfx.fillStyle = b.c; cfx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
      cfx.restore();
    });
    bits = bits.filter(b => b.life > 0);
    if (!bits.length) cfx.clearRect(0, 0, cf.width, cf.height);
  }

  /* ---------------------------------------------------------
     ANALYTICS — ten things a brand can track, each with its own view.
     Every figure here is sample data.
     --------------------------------------------------------- */
  const AN_COLORS = ['#5300b7', '#7c3ff2', '#a77bff', '#ffc21f', '#ff7a12', '#c9b6ff'];
  const hbars = (rows, unit = '') => {
    const max = Math.max(...rows.map(r => r[1]));
    return `<div class="hb">${rows.map(([l, v, note], i) => `
      <div class="hb-row"><span class="hb-l">${esc(l)}</span>
        <span class="hb-t"><i style="--w:${(v / max * 100).toFixed(1)}%;--c:${AN_COLORS[i % AN_COLORS.length]}"></i></span>
        <span class="hb-v">${fmt(v)}${unit}${note ? `<small>${esc(note)}</small>` : ''}</span></div>`).join('')}</div>`;
  };
  const pairCols = (rows, legend) => {
    const max = Math.max(...rows.flatMap(r => [r[1], r[2]]));
    return `<div class="legend"><span class="k1">${legend[0]}</span><span class="k2">${legend[1]}</span></div>
      <div class="vc">${rows.map(([l, a, b]) => `
        <div class="vc-g"><div class="vc-bars"><i class="b1" style="--h:${(a / max * 100).toFixed(1)}%"></i><i class="b2" style="--h:${(b / max * 100).toFixed(1)}%"></i></div>
        <span class="vc-up">+${Math.round((b / a - 1) * 100)}%</span><span class="vc-l">${esc(l)}</span></div>`).join('')}</div>`;
  };
  const cols = (vals, labels) => {
    const max = Math.max(...vals);
    return `<div class="vc single">${vals.map((v, i) => `<div class="vc-g"><div class="vc-bars"><i class="b1" style="--h:${(v / max * 100).toFixed(1)}%" title="${fmt(v)}"></i></div><span class="vc-l">${labels[i]}</span></div>`).join('')}</div>`;
  };
  const funnel = steps => `<div class="fn">${steps.map(([l, v], i) => `
    <div class="fn-row"><span class="fn-l">${esc(l)}</span>
      <span class="fn-t"><i style="--w:${(v / steps[0][1] * 100).toFixed(1)}%"></i></span>
      <span class="fn-v">${fmt(v)}${i ? `<small>${Math.round(v / steps[i - 1][1] * 100)}% of previous</small>` : ''}</span></div>`).join('')}</div>`;
  const donut = (segs, title) => {
    let acc = 0;
    const stops = segs.map(([, v], i) => { const s = `${AN_COLORS[i % AN_COLORS.length]} ${acc}% ${acc + v}%`; acc += v; return s; }).join(', ');
    return `<div class="dn"><div class="dn-ring" style="--g:conic-gradient(${stops})"><span>${esc(title)}</span></div>
      <ul class="dn-leg">${segs.map(([l, v], i) => `<li><i style="background:${AN_COLORS[i % AN_COLORS.length]}"></i>${esc(l)}<b>${v}%</b></li>`).join('')}</ul></div>`;
  };
  const lines = (series, labels) => {
    const W = 600, H = 200, max = Math.max(...series.flatMap(s => s.v)) * 1.1;
    const pts = v => v.map((y, i) => [i / (v.length - 1) * W, H - y / max * H]);
    const path = p => p.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
    return `<div class="legend">${series.map((s, i) => `<span class="k${i + 1}">${s.name}</span>`).join('')}</div>
      <svg class="ln-chart" viewBox="0 0 ${W} ${H + 24}" preserveAspectRatio="none" role="img" aria-label="Users in the live room through the evening">
        ${[0, 1, 2, 3].map(g => `<line x1="0" x2="${W}" y1="${g * H / 3}" y2="${g * H / 3}" class="gl"/>`).join('')}
        ${series.map((s, i) => `<path d="${path(pts(s.v))} L${W} ${H} L0 ${H}Z" class="ar a${i + 1}"/><path d="${path(pts(s.v))}" class="ln l${i + 1}"/>`).join('')}
        ${labels.map((l, i) => `<text x="${i / (labels.length - 1) * W}" y="${H + 18}" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}" class="ax">${l}</text>`).join('')}
      </svg>`;
  };
  const table = (head, rows) => `<div class="an-table"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? '' : ' class="first"'}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  const ANALYTICS = [
    { t: 'Campaign Participation', d: 'How many users participated in each campaign.',
      k: [['Participants', '48,260'], ['Campaigns', '6'], ['Avg. per campaign', '8,043']],
      v: () => hbars([['Dashain Mega Draw', 18420], ['Tihar Lights Quiz', 11960], ['Everest Coffee Guess & Win', 7380], ['CityMart Bill Scan', 5940], ['Summit Mobile Poll', 3210], ['Weekend Yes/No', 1350]]) },
    { t: 'Game Engagement', d: 'How many users played each game, and how often they played.',
      k: [['Players', '21,640'], ['Game plays', '132,904'], ['Plays per player', '6.1']],
      v: () => hbars([['Jhandi Burja', 84210, '9,860 players · 8.5 each'], ['Spin & Win', 31480, '7,920 players · 4.0 each'], ['Slot Machine', 17214, '3,860 players · 4.5 each']], ' plays') },
    { t: 'Brand Campaign Choice', d: 'Which brand campaigns users are selecting and joining most.',
      k: [['Brand campaigns', '14'], ['Most joined', 'Summit Mobile'], ['Join rate', '38%']],
      v: () => hbars([['Summit Mobile · Jhandi Burja', 9860], ['Everest Coffee · Spin & Win', 7920], ['Peak Motors · Dashain Mega Draw', 6410], ['CityMart · Slot Machine', 3860], ['Mountain Foods · Quiz', 2740]], ' joined') },
    { t: 'User Preferences', d: 'Which brands, campaigns, games and participation methods users prefer.',
      k: [['Top method', 'Bill Scan'], ['Top game', 'Jhandi Burja'], ['Top brand', 'Summit Mobile']],
      v: () => donut([['Bill Scan', 34], ['Quiz', 22], ['Guess & Win', 16], ['Points', 12], ['Poll', 10], ['Yes/No', 6]], 'Participation methods') },
    { t: 'Live Room Engagement', d: 'How many users join the live game rooms, and how many take part.',
      k: [['Peak in the room', '2,431'], ['Joined tonight', '6,820'], ['Playing, not watching', '71%']],
      v: () => lines([{ name: 'In the room', v: [310, 820, 1460, 2120, 2431, 1980, 1240, 560] }, { name: 'Playing', v: [190, 560, 1030, 1540, 1760, 1400, 870, 380] }],
        ['6 PM', '7', '8', '9', '10', '11', '12', '1 AM']) },
    { t: 'Bill Scan Performance', d: 'Bills scanned, and the participation they generated.',
      k: [['Bills scanned', '16,410'], ['Share of participation', '34%'], ['Bills rejected', '3.2%']],
      v: () => cols([620, 740, 810, 960, 880, 1020, 1210, 1180, 1340, 1620, 1510, 1440, 1480, 1590], Array.from({ length: 14 }, (_, i) => `D${i + 1}`)) },
    { t: 'Product Sales Impact', d: 'Sales generated through bill-scan campaigns, and whether the campaign drove extra purchases.',
      k: [['Sales via bill scan', 'Rs 42.6 lakh'], ['Units purchased', '18,730'], ['Uplift during campaign', '+31%']],
      v: () => pairCols([['Coffee 250g', 1240, 1810], ['Instant noodles', 8900, 11300], ['Fruit juice 1L', 2100, 2560], ['Shampoo 180ml', 1460, 1890]], ['Weekly units before', 'During campaign']) },
    { t: 'Campaign Conversion', d: 'How participation turns into purchases, points, rewards and other actions.',
      k: [['Participation to purchase', '34%'], ['Points earned', '1.2M'], ['Rewards claimed', '9,418']],
      v: () => funnel([['Saw the campaign', 92400], ['Participated', 48260], ['Purchased (bill scan)', 16410], ['Earned points', 14980], ['Claimed a reward', 9418]]) },
    { t: 'Reward Performance', d: 'Rewards distributed, winners, and how people engage with rewards.',
      k: [['Rewards distributed', '9,418'], ['Live-draw winners', '42'], ['Claim rate', '91%']],
      v: () => hbars([['Vouchers', 4120], ['Cash', 2380], ['Products', 1640], ['Gift hampers', 910], ['Surprise gifts', 356], ['Grand prizes', 12]], ' given') },
    { t: 'Campaign Comparison', d: 'Compare campaigns, events, brands, products and time periods side by side.',
      k: [['Best engagement', 'Dashain Mega Draw'], ['Best uplift', '+34%'], ['Period', 'Last 30 days']],
      v: () => table(['Campaign', 'Event', 'Participants', 'Game plays', 'Sales', 'Uplift'], [
        ['Dashain Mega Draw', 'Dashain', '18,420', '41,300', 'Rs 21.4L', '<b class="up">+34%</b>'],
        ['Tihar Lights Quiz', 'Tihar', '11,960', '22,150', 'Rs 8.7L', '<b class="up">+19%</b>'],
        ['CityMart Bill Scan', 'Summer Sale', '5,940', '9,800', 'Rs 6.1L', '<b class="up">+22%</b>'],
        ['Everest Coffee Guess & Win', 'Coffee Week', '7,380', '12,460', 'Rs 4.2L', '<b class="up">+15%</b>']]) },
  ];
  // Each question a brand asks, with the answer Winzy gives from the same sample data.
  const QUESTIONS = [
    { q: 'How many users participated?', a: '48,260', s: 'across 6 campaigns. Dashain Mega Draw led with 18,420.', i: 0 },
    { q: 'Which brand campaigns are users choosing?', a: 'Summit Mobile', s: 'Its Jhandi Burja campaign drew 9,860 players, the most joined.', i: 2 },
    { q: 'Which games generate the most engagement?', a: 'Jhandi Burja', s: '84,210 plays, 8.5 per player. Spin & Win is next with 31,480.', i: 1 },
    { q: 'Which products are being purchased?', a: 'Instant noodles', s: '11,300 units a week during the campaign, the top seller.', i: 6 },
    { q: 'How many sales came through Bill Scan campaigns?', a: 'Rs 42.6 lakh', s: 'from 16,410 scanned bills and 18,730 units purchased.', i: 5 },
    { q: 'Did the campaign increase product sales?', a: 'Yes, +31%', s: 'Coffee 250g rose the most: 1,240 to 1,810 units a week.', i: 6 },
    { q: 'Which campaigns generate the highest user engagement?', a: 'Dashain Mega Draw', s: '18,420 participants and 41,300 game plays.', i: 9 },
  ];
  const anNav = $('#anNav'), anPanel = $('#anPanel');
  anNav.innerHTML = ANALYTICS.map((a, i) => `<button type="button" role="tab" id="an-${i}" aria-controls="anPanel" aria-selected="false" tabindex="-1"><span class="en">${pad2(i + 1)}</span><span class="et">${esc(a.t)}</span></button>`).join('');
  const anBtns = $$('button', anNav);
  let anIdx = -1;
  function setAn(i, focus) {
    if (i === anIdx) return;
    anIdx = i;
    anBtns.forEach((b, k) => { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
    if (focus) anBtns[i].focus();
    anPanel.setAttribute('aria-labelledby', 'an-' + i);
    const a = ANALYTICS[i];
    anPanel.classList.remove('go');
    anPanel.innerHTML = `
      <div class="an-head"><span class="ep-tag">${pad2(i + 1)} / ${ANALYTICS.length}</span><h4>${esc(a.t)}</h4><p>${esc(a.d)}</p></div>
      <div class="an-kpis">${a.k.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="an-viz">${a.v()}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => anPanel.classList.add('go')));
  }
  anBtns.forEach((b, i) => b.addEventListener('click', () => setAn(i)));
  anNav.addEventListener('keydown', e => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    setAn((anIdx + d + ANALYTICS.length) % ANALYTICS.length, true);
  });
  $('#anQs').innerHTML = QUESTIONS.map(({ q, a, s, i }) => `
    <button type="button" data-i="${i}">
      <span class="q-q">${esc(q)}</span>
      <span class="q-ans"><span class="q-a">${esc(a)}</span><span class="q-s">${esc(s)}</span></span>
      <span class="q-go">${esc(ANALYTICS[i].t)} <i aria-hidden="true">→</i></span>
    </button>`).join('');
  $$('#anQs button').forEach(b => b.addEventListener('click', () => {
    setAn(+b.dataset.i);
    anPanel.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  }));
  setAn(0);

  /* ---------------------------------------------------------
     Frame loop — only the hero parallax, the wheel and confetti
     --------------------------------------------------------- */
  function frame(now) {
    if (heroVisible && FINE && !RM) {
      mouse.x = lerp(mouse.x, mouse.tx, .06);
      mouse.y = lerp(mouse.y, mouse.ty, .06);
      heroParts.forEach(({ el, d }) => {
        el.style.transform = `translate3d(${(mouse.x * d * 26).toFixed(2)}px, ${(mouse.y * d * 20).toFixed(2)}px, 0)`;
      });
    }
    const idle = RM ? 0 : 1;
    // Hero and gallery wheels turn slowly, lights chasing.
    if (heroVisible) {
      heroWheel.theta += .0025 * idle; heroWheel.phase += .006 * idle;
      heroWheel.draw();
    }
    if (galleryWheel.visible) {
      galleryWheel.theta += (gwFast ? .03 : .004) * idle;
      galleryWheel.phase += (gwFast ? .03 : .008) * idle;
      galleryWheel.deflect *= .82;
      if (gwFast && !RM && Math.random() < .25) galleryWheel.deflect = -1;
      galleryWheel.draw();
    }
    // The playable wheel: eased spin, faster lights, pointer flicked by every peg.
    if (spinning) {
      const t = clamp((now - spinStart) / spinDur);
      playWheel.theta = spinFrom + (spinTo - spinFrom) * (1 - Math.pow(1 - t, 4));
      playWheel.phase += .05;
      const s = playWheel.segmentAt();
      if (s !== lastSeg) { lastSeg = s; playWheel.deflect = -1; }
      if (t >= 1) finishSpin();
    } else if (playWheel.visible) {
      playWheel.theta += .002 * idle;
      playWheel.phase += .006 * idle;
    }
    playWheel.deflect *= .8;
    if (playWheel.visible || spinning) playWheel.draw();
    liveFrame(now);
    confettiFrame();
    requestAnimationFrame(frame);
  }

  function layout() {
    [heroWheel, galleryWheel, playWheel, idWheel].forEach(w => w.size());
    sizeBowl();
    placeReels();
  }
  let rT = 0;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(layout, 150); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(layout);
  layout();
  requestAnimationFrame(frame);

  // Demo CTA — placeholder until a real form or inbox is wired up.
  $$('[data-demo]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const old = a.innerHTML;
    a.textContent = 'Connect your demo form here';
    setTimeout(() => { a.innerHTML = old; }, 2200);
  }));
})();

/* mountSky(el, data, opts) — polar "instrument" constellation for Vitalia's path.
   data: { events:[{id,title,sphere,start,end,status,metric,what_it_gave,why,links_to}], spheres:[{id,name_en,...}] }
   (the older *_en field names are accepted as a fallback)
   opts: { hudEl, labels:'auto'|n, start:'ozon', intro, align:'right', onTime(t), onSelect(id), onFilter(k), onEnd() }
   returns { setTime(t), play(), pause(), filter(k|null), select(id|null), time, destroy() }
   Colours and fonts come only from CSS variables (tokens.css). */
(function (g) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  // cyclic order chosen so the chronological path mostly steps to the next sector clockwise
  const ORDER = ['art', 'edu', 'med', 'eng', 'res', 'soc', 'ent', 'com'];
  const T0 = 2017, T1 = 2028, NOW = 2026.9;
  // piecewise time -> radius fraction: recent years get most of the disc
  const KNOTS = [[2017, 0], [2021, 0.18], [2024, 0.45], [2027, 0.92], [2028, 1]];
  const KEY = ['ozon', 'helm', 'iso', 'splat', 'tum', 'patent', 'hse', 'speed', 'doklady', 'theatre'];
  const KEY_NARROW = ['iso', 'helm', 'ozon', 'splat', 'tum'];
  // hand-placed label directions (screen radians: 0 = right, PI/2 = down); others default to outward
  const LABEL_DIR = { theatre: Math.PI, hse: 0 };
  // events whose month is unconfirmed: show the year only
  const YEAR_ONLY = new Set(['hacks']);
  const SHORT = { ozon: 'Ozon Tech', helm: 'Helmholtz', iso: 'ISOcopilot', splat: 'SPLAT Global', tum: 'TUM M.Sc.', patent: 'Patent', hse: 'HSE B.Sc.', speed: 'AI Speed Dating', doklady: 'Doklady RAN', theatre: 'Stage' };
  const PATH = ['theatre', 'hse', 'splat', 'ozon', 'patent', 'tum', 'helm', 'speed', 'iso'];
  // narrow screens: whole words, never clipped abbreviations
  const NARROW_NAME = { eng: 'Engineering', res: 'Research', med: 'Medicine', soc: 'Society', ent: 'Founding', com: 'Community', art: 'Art', edu: 'Education' };
  const SHORT_NARROW = { ozon: 'Ozon', helm: 'Helmholtz', iso: 'ISOcopilot', splat: 'SPLAT', tum: 'TUM' };
  const YEAR_LABELS = [2017, 2020, 2023, 2025];
  const AXIS_A = Math.PI; // year labels sit on the 9 o'clock spoke (between AI & society and Founding)

  const css = `
.sky{position:relative;width:100%;height:100%;font-family:var(--f-mono);color:var(--ink)}
.sky svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;touch-action:manipulation}
.sky text{font-family:var(--f-mono);font-size:12px;fill:var(--mute)}
.sky .halo{paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round}
.sky .ax{paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round;fill:var(--faint)}
.sky .sl text{font-family:var(--f-display);font-size:13px;font-weight:500;fill:var(--ink)}
.sky.narrow .sl text{font-size:12px}
.sky .sl .n{font-family:var(--f-mono);font-size:12px;font-weight:400;fill:var(--faint)}
.sky .sl{cursor:pointer}.sky .sl:focus{outline:none}.sky .sl:focus-visible .fr{stroke:var(--ink);stroke-width:1.5px}
.sky .ev{cursor:pointer}.sky .ev:focus{outline:none}.sky .ev:focus-visible .hit{stroke:var(--ink);stroke-width:1.5px}
.sky .lab text{fill:var(--ink)}.sky .lab .t{fill:var(--mute)}.sky .lab line{stroke:var(--mute);stroke-width:1px}
.sky [data-s],.sky .traj,.sky .lab,.sky .tl{transition:opacity var(--d-base,200ms) ease}
.sky .cg{transform-origin:var(--ox) var(--oy);transition:opacity var(--d-base,200ms) ease,transform var(--d-slow,600ms) var(--ease,ease)}
.sky .cg.em{transform:scale(1.035)}
.sky .cg.em .cl{stroke:currentColor;stroke-width:.9px}
.sky .tw{transition:opacity var(--d-base,200ms) ease}.sky .tw.em{opacity:.11!important}
.sky .fut{opacity:0!important;pointer-events:none}
.sky .pulse{transform-box:fill-box;transform-origin:center;animation:skyp 2.6s ease-in-out infinite}
@keyframes skyp{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:0;transform:scale(1.8)}}
.sky .cl.tk{transform-box:fill-box;transform-origin:center;stroke:currentColor;stroke-width:0;stroke-opacity:0;animation:skytw var(--tw,6s) ease-in-out var(--twd,0s) infinite}
@keyframes skytw{0%,100%{opacity:var(--o0,.2);transform:scale(1);stroke-width:0;stroke-opacity:0}50%{opacity:.9;transform:scale(2.5);stroke-width:1px;stroke-opacity:.3}}
.sky .gl{pointer-events:none}
.sky.off .cl.tk,.sky.off .pulse{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.sky .pulse,.sky .cl.tk{animation:none}.sky .gl{display:none}.sky [data-s],.sky .traj,.sky .lab,.sky .cg,.sky .tw{transition:none}.sky .cg.em{transform:none}}
.sky-hud{font-family:var(--f-mono);font-size:12px;line-height:1.5;color:var(--mute)}
.sky-hud .k{color:var(--faint);display:flex;gap:8px;align-items:center;margin-bottom:8px}
.sky-hud .k i{width:8px;height:8px;display:inline-block;flex:none}
.sky-hud h4{font-family:var(--f-display);font-weight:500;font-size:var(--t-m,20px);line-height:1.2;letter-spacing:-.01em;color:var(--ink);margin:0 0 10px;text-wrap:balance}
.sky-hud dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;margin:0}
.sky-hud dt{color:var(--faint)}.sky-hud dd{margin:0;color:var(--ink);overflow-wrap:break-word;text-wrap:pretty}
`;
  function injectCSS() {
    if (document.getElementById('sky-css')) return;
    const s = document.createElement('style'); s.id = 'sky-css';
    let dim = ''; ORDER.forEach(k => { dim += `.sky svg[data-fs="${k}"] [data-s]:not([data-s="${k}"]):not(.lk):not(.tw){opacity:.16}\n`; });
    dim += '.sky svg[data-fs] .traj,.sky svg[data-fs] .tl{opacity:.3}\n';
    s.textContent = css + dim; document.head.appendChild(s);
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const ym = d => { if (!d) return null; const [y, m] = String(d).split('-').map(Number); return y + ((m || 1) - 1) / 12; };
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // i18n: every visible string the plot writes. Overridden per page with opts.i18n.
  const L0 = {
    mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    now: 'now', planned: 'planned', metric: 'metric', did: 'did', why: 'why',
    nothingYet: 'nothing yet', pressPlay: 'Press play or drag the time slider', filter: 'Filter',
    aria: 'Constellation of Vitalia\u2019s path: eight spheres by angle, years by radius, the line is her path in order',
    short: {}, shortNarrow: {}, narrowName: {}
  };
  let L = L0;
  const fmt = d => { const [y, m] = d.split('-'); return L.mon[+m - 1] + ' ' + y; };
  // strip internal notes: parentheticals about dates/approximations, and any "≈"
  const clean = s => {
    if (s == null) return '';
    return String(s).replace(/\s*\([^)]*(dates?|≈|approx|to confirm)[^)]*\)/gi, '').replace(/\(dates[^)]*\)?/gi, '').replace(/≈\s*/g, '').replace(/\s{2,}/g, ' ').trim();
  };
  const publicMetric = m => { const c = clean(m); return (c && !/^target/i.test(c)) ? c : null; };
  function when(e) {
    if (e.when) return e.when;
    if (e.yearOnly) { const a = e.start.slice(0, 4), b = e.end ? e.end.slice(0, 4) : null; return (!b || b === a) ? a : a + '–' + b; }
    if (e.status === 'next') return L.planned + ' · ' + fmt(e.start);
    const a = fmt(e.start);
    if (!e.end) return a + ' – ' + L.now;
    if (e.end === e.start) return a;
    return a + ' – ' + (e.status === 'now' ? L.now : fmt(e.end));
  }
  function norm(e) { // read only the whitelisted fields
    return {
      id: e.id, sphere: e.sphere, start: e.start, end: e.end || null, status: e.status,
      title: clean(e.title != null ? e.title : e.title_en),
      metric: e.metric, gave: clean(e.what_it_gave != null ? e.what_it_gave : e.what_it_gave_en),
      why: clean(e.why != null ? e.why : e.why_en), links_to: Array.isArray(e.links_to) ? e.links_to : [],
      when: typeof e.when === 'string' ? clean(e.when) : null, yearOnly: e.precision === 'year' || YEAR_ONLY.has(e.id),
      t: ym(e.start)
    };
  }

  function mountSky(host, data, opts) {
    opts = opts || {};
    L = Object.assign({}, L0, opts.i18n || {});
    ['short', 'shortNarrow', 'narrowName'].forEach(k => { L[k] = Object.assign({}, L0[k], (opts.i18n || {})[k] || {}); });
    injectCSS();
    const spheres = Object.fromEntries(data.spheres.map(s => [s.id, s]));
    const E = data.events.filter(e => e.public !== false && spheres[e.sphere] && e.start).map(norm);
    const byId = Object.fromEntries(E.map(e => [e.id, e]));
    const path = PATH.filter(id => byId[id]).sort((a, b) => byId[a].t - byId[b].t);

    const root = document.createElement('div'); root.className = 'sky'; host.appendChild(root);
    const svg = el('svg', { role: 'group', 'aria-label': L.aria }, root);
    const hud = opts.hudEl || null;

    let W = 0, H = 0, cx = 0, cy = 0, R = 0, r0 = 0, narrow = false;
    let time = T1 - 0.01, filt = null, hov = null, hovS = null, sel = opts.start || 'ozon', raf = null;
    const P = {};
    let segs = [], marker = null, gConn = null, gGl = null, obst = [], rovEv = null, rovSL = null, lastPtr = 'mouse';

    const ang = k => -Math.PI / 2 + Math.PI / 8 + ORDER.indexOf(k) * Math.PI / 4;
    const half = Math.PI / 8;
    function frac(t) {
      t = Math.max(T0, Math.min(T1, t));
      for (let i = 1; i < KNOTS.length; i++) { const [ta, fa] = KNOTS[i - 1], [tb, fb] = KNOTS[i]; if (t <= tb) return fa + (t - ta) / (tb - ta) * (fb - fa); }
      return 1;
    }
    function unfrac(f) {
      for (let i = 1; i < KNOTS.length; i++) { const [ta, fa] = KNOTS[i - 1], [tb, fb] = KNOTS[i]; if (f <= fb) return ta + (f - fa) / (fb - fa) * (tb - ta); }
      return T1;
    }
    const rad = t => r0 + frac(t) * (R - r0);
    const pol = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const size = e => KEY.indexOf(e.id) > -1 && KEY.indexOf(e.id) < 6 ? 5.5 : (publicMetric(e.metric) || KEY.includes(e.id)) ? 4.2 : 3.1;
    const yy2 = t => '’' + String(Math.floor(t)).slice(2);

    function layoutEvents() {
      ORDER.forEach(k => {
        const list = E.filter(e => e.sphere === k).sort((a, b) => a.t - b.t);
        const rnd = mulberry(ORDER.indexOf(k) * 977 + 13);
        const span = half * 0.7;
        list.forEach((e, i) => {
          const slot = list.length === 1 ? 0 : (i % 2 ? 1 : -1) * (0.25 + 0.75 * ((i * 0.618) % 1));
          const a = ang(k) + slot * span + (rnd() - 0.5) * span * 0.18;
          P[e.id] = { a, r: rad(e.t), x: 0, y: 0, s: size(e) };
        });
        for (let it = 0; it < 50; it++) {
          for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const p = P[list[i].id], q = P[list[j].id];
            const [x1, y1] = pol(p.a, p.r), [x2, y2] = pol(q.a, q.r);
            const d = Math.hypot(x2 - x1, y2 - y1), min = p.s + q.s + 10;
            if (d < min) { const push = (min - d) / 2 / Math.max(40, p.r); const sgn = p.a < q.a ? 1 : -1; p.a -= sgn * push; q.a += sgn * push; }
          }
          list.forEach(e => { const p = P[e.id]; p.a = Math.max(ang(k) - half * 0.84, Math.min(ang(k) + half * 0.84, p.a)); });
        }
        list.forEach(e => { const p = P[e.id];[p.x, p.y] = pol(p.a, p.r); });
      });
    }

    // a path segment in polar space: angle always advances clockwise, radius follows time -> one outward spiral
    function segPts(a, b, n) {
      const pa = P[a], pb = P[b], ta = byId[a].t, tb = byId[b].t;
      const a1 = pa.a; let a2 = pb.a; while (a2 <= a1 + 0.05) a2 += Math.PI * 2;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n, e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
        let r = rad(ta + (tb - ta) * e);
        if (i === 0) r = pa.r; if (i === n) r = pb.r;
        pts.push(pol(a1 + (a2 - a1) * e, r));
      }
      return pts;
    }
    const toD = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');

    // labels sit next to their own star: a short gap first, a visible leader only when needed, else dropped (the HUD covers it)
    function placeLabels(ids, gl) {
      const boxes = obst.slice(); // includes the path line: no label is drawn across it
      const fs = 12, cw = 7.2, pad = 3;
      const dots = E.map(e => ({ id: e.id, x: P[e.id].x - P[e.id].s - 3, y: P[e.id].y - P[e.id].s - 3, w: P[e.id].s * 2 + 6, h: P[e.id].s * 2 + 6 }));
      dots.push({ id: '_c', x: cx - r0 - 4, y: cy - r0 - 4, w: r0 * 2 + 8, h: r0 * 2 + 8 });
      const hit = (b, list) => list.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
      let n = 0;
      ids.forEach(id => {
        const e = byId[id]; if (!e) return; const p = P[id];
        const txt = (narrow && (L.shortNarrow[id] || SHORT_NARROW[id])) || L.short[id] || SHORT[id] || e.title, yr = yy2(e.t);
        const w = (txt.length + 1 + yr.length) * cw + pad * 2, h = fs + pad * 2;
        const pref = LABEL_DIR[id] != null ? LABEL_DIR[id] : Math.atan2(p.y - cy, p.x - cx);
        const dirs = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI].map(d => pref + d);
        const ringBox = p.s + 4; // milestone squares are drawn larger than the dot
        let best = null;
        for (const gap of (narrow ? [4, 9, 16, 26, 36] : [4, 9, 16, 26])) {
          for (const a of dirs) {
            const c = Math.cos(a), sn = Math.sin(a);
            const ax = p.x + c * (ringBox + gap), ay = p.y + sn * (ringBox + gap);
            const anchor = c > 0.38 ? 'start' : c < -0.38 ? 'end' : 'middle';
            const bx = anchor === 'start' ? ax : anchor === 'end' ? ax - w : ax - w / 2;
            const by = anchor === 'middle' ? (sn < 0 ? ay - h : ay) : ay - h / 2;
            const b = { x: bx, y: by, w, h };
            if (b.x < 2 || b.x + b.w > W - 2 || b.y < 2 || b.y + b.h > H - 2) continue;
            if (hit(b, boxes) || hit(b, dots.filter(d => d.id !== id))) continue;
            best = { b, ax, ay, anchor, gap }; break;
          }
          if (best) break;
        }
        if (!best) return;
        boxes.push(best.b); n++;
        const gg = el('g', { class: 'lab', 'data-s': e.sphere, 'data-t': e.t }, gl);
        const b = best.b;
        if (best.gap > 9) { // leader from the star edge to the nearest point of the label box
          const nx = Math.max(b.x, Math.min(p.x, b.x + b.w)), ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
          const dl = Math.hypot(nx - p.x, ny - p.y) || 1;
          el('line', { x1: (p.x + (nx - p.x) * (p.s + 2) / dl).toFixed(1), y1: (p.y + (ny - p.y) * (p.s + 2) / dl).toFixed(1), x2: nx.toFixed(1), y2: ny.toFixed(1) }, gg);
        }
        const tx = best.anchor === 'start' ? b.x + pad : best.anchor === 'end' ? b.x + b.w - pad : b.x + b.w / 2;
        const t = el('text', { class: 'halo', x: tx.toFixed(1), y: (b.y + h / 2 + 4).toFixed(1), 'text-anchor': best.anchor }, gg);
        t.innerHTML = esc(txt) + '<tspan class="t" dx="5">' + esc(yr) + '</tspan>';
      });
      return n;
    }

    function draw() {
      W = root.clientWidth; H = root.clientHeight; if (!W || !H) return;
      narrow = W < 600; root.classList.toggle('narrow', narrow);
      const longest = Math.max(...ORDER.map(k => (spheres[k].name_en || '').length));
      const longestN = Math.max(...ORDER.map(k => (L.narrowName[k] || NARROW_NAME[k] || '').length));
      const side = narrow ? 62 : Math.max(124, Math.round(longest * 7.6 + 46));
      R = Math.min(W / 2 - side, H / 2 - (narrow ? 34 : 44));
      r0 = R * 0.08;
      cx = (opts.align === 'right' && W > H * 1.3) ? W - H / 2 : W / 2; cy = H / 2;
      svg.innerHTML = ''; segs = []; obst = [];
      root.style.setProperty('--ox', cx + 'px'); root.style.setProperty('--oy', cy + 'px');
      const gBg = el('g', {}, svg), gCl = el('g', {}, svg);
      gGl = el('g', { class: 'gl', 'aria-hidden': 'true' }, svg);
      const gHit = el('g', {}, svg), gTr = el('g', {}, svg);
      gConn = el('g', { 'pointer-events': 'none' }, svg);
      const gEv = el('g', {}, svg), gLab = el('g', { 'pointer-events': 'none' }, svg), gAx = el('g', { 'pointer-events': 'none' }, svg), gSL = el('g', {}, svg);

      const wedge = (k, ra, rb) => { const a1 = ang(k) - half, a2 = ang(k) + half, [x1, y1] = pol(a1, ra), [x2, y2] = pol(a1, rb), [x3, y3] = pol(a2, rb), [x4, y4] = pol(a2, ra); return `M${x1},${y1}L${x2},${y2}A${rb},${rb} 0 0 1 ${x3},${y3}L${x4},${y4}A${ra},${ra} 0 0 0 ${x1},${y1}Z`; };
      ORDER.forEach(k => el('path', { d: wedge(k, r0, R), class: 'tw', 'data-s': k, opacity: .04, style: 'fill:var(--s-' + k + ')' }, gBg));
      el('circle', { cx, cy, r: R, fill: 'none', style: 'stroke:var(--line-2)' }, gBg);
      for (let i = 0; i < 120; i++) {
        const a = i / 120 * Math.PI * 2 - Math.PI / 2, major = i % 15 === 0, len = major ? 9 : (i % 5 ? 3 : 5);
        const [x1, y1] = pol(a, R), [x2, y2] = pol(a, R + len);
        el('line', { x1, y1, x2, y2, style: 'stroke:var(' + (major ? '--mute' : '--line-2') + ')' }, gBg);
      }
      for (let y = T0 + 1; y <= 2027; y++) el('circle', { cx, cy, r: rad(y), fill: 'none', style: 'stroke:var(--line)', 'stroke-dasharray': YEAR_LABELS.includes(y) ? '' : '1 4' }, gBg);
      ORDER.forEach(k => { const a = ang(k) - half; const [x1, y1] = pol(a, r0), [x2, y2] = pol(a, R); el('line', { x1, y1, x2, y2, style: 'stroke:var(--line)' }, gBg); });
      el('circle', { cx, cy, r: rad(NOW), fill: 'none', style: 'stroke:var(--signal-2)', opacity: .7, 'stroke-dasharray': '3 3' }, gBg);
      el('circle', { cx, cy, r: r0, fill: 'none', style: 'stroke:var(--line-2)' }, gBg);
      el('line', { x1: cx - 4, y1: cy, x2: cx + 4, y2: cy, style: 'stroke:var(--mute)' }, gBg);
      el('line', { x1: cx, y1: cy - 4, x2: cx, y2: cy + 4, style: 'stroke:var(--mute)' }, gBg);

      layoutEvents();

      // decorative point field, capped (≤1.2px, ≤.35 opacity) so it never reads as an event
      ORDER.forEach(k => {
        const list = E.filter(e => e.sphere === k);
        const rnd = mulberry(ORDER.indexOf(k) * 7919 + 3);
        const n = Math.round((260 + list.length * 8) * (narrow ? 0.55 : 1));
        const gs = el('g', { 'data-s': k, class: 'cg', style: 'color:var(--s-' + k + ')' }, gCl);
        const maxT = list.length ? Math.max.apply(null, list.map(e => e.t)) + 0.6 : 2024;
        const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
        const tw = mulberry(ORDER.indexOf(k) * 4271 + 11); // twinkle picks: separate stream, layout unchanged
        for (let i = 0; i < n; i++) {
          let a, r;
          if (rnd() < 0.6 && list.length) { const e = list[Math.floor(rnd() * list.length)], p = P[e.id]; a = p.a + gauss() * 0.17; r = p.r + gauss() * (R - r0) * 0.08; }
          else { a = ang(k) + gauss() * half * 0.85; r = r0 + Math.pow(rnd(), 0.6) * (rad(maxT) - r0); }
          a = Math.max(ang(k) - half * 0.95, Math.min(ang(k) + half * 0.95, a)); r = Math.max(r0 + 3, Math.min(R - 3, r));
          const [x, y] = pol(a, r), tt = unfrac((r - r0) / (R - r0));
          const cr = (0.6 + rnd() * 0.6).toFixed(2), op = (0.14 + rnd() * 0.21).toFixed(2);
          const c = el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: cr, class: 'cl', 'data-t': tt.toFixed(2), fill: 'currentColor', opacity: op }, gs);
          if (tw() < (narrow ? 0.02 : 0.03)) { c.classList.add('tk'); c.style.cssText = '--o0:' + op + ';--tw:' + (4 + tw() * 5).toFixed(1) + 's;--twd:-' + (tw() * 9).toFixed(1) + 's'; }
        }
      });

      ORDER.forEach(k => {
        const w = el('path', { d: wedge(k, r0, R), fill: 'transparent', 'data-w': k }, gHit);
        w.addEventListener('pointerenter', ev => { if (ev.pointerType === 'touch') return; hovS = k; apply(); });
        w.addEventListener('pointerleave', ev => { if (ev.pointerType === 'touch') return; if (hovS === k) { hovS = null; apply(); } });
      });

      // trajectory: bg under-stroke + ink line
      const pathPts = [];
      for (let i = 0; i < path.length - 1; i++) {
        const pts = segPts(path[i], path[i + 1], 48), d = toD(pts);
        const u = el('path', { d, class: 'traj', fill: 'none', style: 'stroke:var(--panel);stroke-width:4;stroke-linecap:round;stroke-linejoin:round' }, gTr);
        const p = el('path', { d, class: 'traj', fill: 'none', opacity: .9, style: 'stroke:var(--ink);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round' }, gTr);
        segs.push({ els: [u, p], L: p.getTotalLength(), t1: byId[path[i]].t, t2: byId[path[i + 1]].t, ref: p });
        pts.forEach((q, j) => { pathPts.push(q); if (j % 3 === 1) obst.push({ x: q[0] - 2, y: q[1] - 2, w: 4, h: 4, path: true }); });
      }
      path.forEach(id => {
        const p = P[id], s = p.s * 2 + 7;
        el('rect', { x: (p.x - s / 2).toFixed(1), y: (p.y - s / 2).toFixed(1), width: s, height: s, class: 'tl', 'data-t': byId[id].t, fill: 'var(--panel)', 'fill-opacity': .6, opacity: .9, style: 'stroke:var(--ink)' }, gTr);
      });
      marker = el('g', { class: 'mk', 'pointer-events': 'none', style: 'opacity:0' }, gTr);
      el('circle', { r: 9, style: 'fill:var(--signal-2)', opacity: .2 }, marker);
      el('rect', { x: -3.5, y: -3.5, width: 7, height: 7, style: 'fill:var(--signal-2)' }, marker);

      // year axis on the 9 o'clock spoke, centred on the spoke; flips below the axis if the path or a star is in the way
      const ep = narrow ? 7 : 2; // on phones, room for the selection ring and the 'now' pulse around a star
      const evBoxes = E.map(e => ({ x: P[e.id].x - P[e.id].s - ep, y: P[e.id].y - P[e.id].s - ep, w: P[e.id].s * 2 + ep * 2, h: P[e.id].s * 2 + ep * 2 }));
      const hitAny = (b, list) => list.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
      const labs = (narrow ? [2022, 2025] : YEAR_LABELS).map(y => [y, String(y)]).concat([[NOW, L.now]]);
      let prevRight = Infinity;
      if (narrow) {
        // phones: the 9 o'clock spoke is crowded by the path, so each year label (now first) tries the eight
        // sector-boundary spokes and sits on its own ring wherever that spot is clear of stars, path and other labels
        const spokes = [Math.PI, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 0];
        const placed = [], m = 3;
        const clear = b => b.x > 2 && b.x + b.w < W - 2 && b.y > 2 && b.y + b.h < H - 2 && !hitAny(b, evBoxes) && !hitAny(b, placed)
          && !pathPts.some(q => q[0] > b.x - m && q[0] < b.x + b.w + m && q[1] > b.y - m && q[1] < b.y + b.h + m);
        [[NOW, L.now], [2022, '2022'], [2025, '2025']].forEach(([y, s]) => {
          const wd = s.length * 7.2;
          for (const a of spokes) {
            const [px, py] = pol(a, rad(y));
            const b = [py + 4, py - 5, py + 15].map(by => ({ x: px - wd / 2 - 2, y: by - 11, w: wd + 4, h: 14, by })).find(clear);
            if (!b) continue;
            const t = el('text', { class: 'ax', x: px.toFixed(1), y: b.by.toFixed(1), 'text-anchor': 'middle' }, gAx); t.textContent = s;
            if (s === L.now) t.style.fill = 'var(--signal-2)';
            placed.push(b); obst.push({ x: b.x, y: b.y, w: b.w, h: b.h });
            return;
          }
        });
      } else labs.forEach(([y, s]) => {
        const r = y === T0 ? r0 + 2 : rad(y), [x] = pol(AXIS_A, r), wd = s.length * 7.2;
        if (x + wd / 2 > prevRight - (narrow ? 10 : 4)) return; // too close to the previous (inner) label
        const cand = [cy - 5, cy + 15].map(by => ({ x: x - wd / 2 - 2, y: by - 11, w: wd + 4, h: 14, by }));
        const m = narrow ? 3 : 0; // clearance from the 1.5px path stroke
        const pick = cand.find(b => !hitAny(b, evBoxes) && !pathPts.some(q => q[0] > b.x - m && q[0] < b.x + b.w + m && q[1] > b.y - m && q[1] < b.y + b.h + m)) || (narrow ? null : cand[0]);
        if (!pick) return;
        const t = el('text', { class: 'ax', x: x.toFixed(1), y: pick.by.toFixed(1), 'text-anchor': 'middle' }, gAx); t.textContent = s;
        if (s === L.now) t.style.fill = 'var(--signal-2)';
        obst.push({ x: pick.x, y: pick.y, w: pick.w, h: pick.h });
        prevRight = x - wd / 2;
      });

      E.forEach(e => {
        const p = P[e.id], c = 'var(--s-' + e.sphere + ')';
        const gg = el('g', { class: 'ev', 'data-s': e.sphere, 'data-id': e.id, 'data-t': e.t, tabindex: -1, role: 'button', 'aria-label': e.title + ', ' + when(e) }, gEv);
        el('circle', { cx: p.x, cy: p.y, r: 13, class: 'hit', fill: 'transparent' }, gg);
        if (e.status === 'now') el('circle', { cx: p.x, cy: p.y, r: p.s + 3.5, class: 'pulse', fill: 'none', style: 'stroke:' + c }, gg);
        if (e.status === 'next') el('circle', { cx: p.x, cy: p.y, r: p.s, style: 'fill:var(--panel);stroke:' + c + ';stroke-width:1.4', 'stroke-dasharray': '2 2' }, gg);
        else el('circle', { cx: p.x, cy: p.y, r: p.s, style: 'fill:' + c + ';stroke:var(--panel);stroke-width:1.5' }, gg);
      });

      sectorLabels(gSL);

      const nLab = opts.labels === 'auto' || opts.labels == null ? KEY.length : opts.labels;
      placeLabels(narrow ? KEY_NARROW : KEY.slice(0, nLab), gLab);
      markSel(); apply(); setTime(time, true);
    }

    // sector names outside the rim; on narrow screens full names are used only if all eight fit, else short names for all
    function sectorLabels(gSL) {
      const tryAll = (useShort, force) => {
        gSL.innerHTML = ''; const boxes = [];
        for (const k of ORDER) {
          const name = useShort ? (L.narrowName[k] || NARROW_NAME[k]) : spheres[k].name_en;
          const cnt = E.filter(e => e.sphere === k).length;
          const offs = narrow ? [0, 0.12, -0.12, 0.24, -0.24, 0.34, -0.34] : [0];
          let ok = null;
          for (const da of offs) {
            const a = ang(k) + da, [x, y] = pol(a, R + (narrow ? 14 : 20));
            const c = Math.cos(a), anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
            const yy = y + (Math.sin(a) > 0.5 ? 12 : Math.sin(a) < -0.5 ? -2 : 4);
            const gg = el('g', { class: 'sl', 'data-s': k, tabindex: -1, role: 'button', 'aria-label': L.filter + ': ' + spheres[k].name_en, 'aria-pressed': String(filt === k) }, gSL);
            const tx = anchor === 'end' && !narrow ? x - 22 : anchor === 'start' && narrow ? x + 10 : x;
            const t = el('text', { x: tx, y: yy, 'text-anchor': anchor }, gg); t.textContent = name;
            const w = t.getComputedTextLength() || name.length * 7.4;
            const left = anchor === 'start' ? tx : anchor === 'end' ? tx - w : tx - w / 2;
            if (!narrow) { const n = el('text', { class: 'n', x: anchor === 'end' ? x : left + w + 6, y: yy, 'text-anchor': anchor === 'end' ? 'end' : 'start' }, gg); n.textContent = String(cnt).padStart(2, '0'); }
            el('rect', { x: left - 11, y: yy - 8, width: 6, height: 6, style: 'fill:var(--s-' + k + ')' }, gg);
            const bw = w + 15 + (narrow ? 0 : 24), bx = left - 13;
            const fr = el('rect', { class: 'fr', x: bx, y: yy - 13, width: bw, height: 19, fill: 'transparent', rx: 2, stroke: 'transparent' });
            gg.insertBefore(fr, gg.firstChild);
            const b = { x: bx, y: yy - 13, w: bw, h: 19 };
            const fits = force || b.x >= 1 && b.x + b.w <= W - 1 && b.y >= 1 && b.y + b.h <= H - 1 && !boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
            if (fits || da === offs[offs.length - 1]) { ok = { gg, b, fits }; if (fits) break; }
            if (!fits) gg.remove();
          }
          if (!ok || !ok.fits) return false;
          boxes.push(ok.b); ok.gg.dataset.k = k;
        }
        return boxes;
      };
      let boxes = tryAll(false);
      if (!boxes && narrow) boxes = tryAll(true);
      if (!boxes) boxes = tryAll(!!narrow, true);
      // keep only one label per sector (a failed attempt may leave one behind)
      const seen = new Set(); gSL.querySelectorAll('.sl').forEach(g => { if (seen.has(g.dataset.s)) g.remove(); else seen.add(g.dataset.s); });
      boxes.forEach(b => obst.push(b));
      gSL.querySelectorAll('.sl').forEach(gg => {
        const k = gg.dataset.s;
        gg.addEventListener('click', () => filter(filt === k ? null : k));
        gg.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); filter(filt === k ? null : k); return; }
          const d = (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') ? -1 : 0;
          if (!d) return; ev.preventDefault();
          const nk = ORDER[(ORDER.indexOf(k) + d + ORDER.length) % ORDER.length];
          rovSL = nk; roving(); const n = svg.querySelector('.sl[data-s="' + nk + '"]'); if (n) n.focus();
        });
        gg.addEventListener('pointerenter', ev => { if (ev.pointerType === 'touch') return; hovS = k; apply(); });
        gg.addEventListener('pointerleave', ev => { if (ev.pointerType === 'touch') return; hovS = null; apply(); });
      });
    }

    // roving tabindex: one tab stop for the events (the selected one), one for the sector labels
    function roving() {
      const evs = [...svg.querySelectorAll('.ev')];
      const vis = evs.filter(n => !n.classList.contains('fut'));
      const cur = vis.find(n => n.dataset.id === (rovEv || sel)) || vis.find(n => n.dataset.id === sel) || vis[0];
      evs.forEach(n => n.setAttribute('tabindex', n === cur ? '0' : '-1'));
      const sls = [...svg.querySelectorAll('.sl')];
      const sc = sls.find(n => n.dataset.s === (rovSL || filt)) || sls[0];
      sls.forEach(n => n.setAttribute('tabindex', n === sc ? '0' : '-1'));
    }

    function markSel() {
      svg.querySelectorAll('.selr').forEach(n => n.remove());
      if (!sel || !P[sel]) { roving(); return; }
      const p = P[sel], gg = svg.querySelector('.ev[data-id="' + sel + '"]');
      if (gg) el('circle', { cx: p.x, cy: p.y, r: p.s + 6, fill: 'none', class: 'selr', style: 'stroke:var(--ink);stroke-width:1' }, gg);
      roving();
    }

    function connectors(id) {
      gConn.innerHTML = '';
      if (!id) return;
      const e = byId[id], p = P[id];
      e.links_to.forEach(l => {
        const q = P[l]; if (!q || byId[l].t > time) return;
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, k = 0.35;
        el('path', { d: `M${p.x},${p.y}Q${mx + (cx - mx) * k},${my + (cy - my) * k} ${q.x},${q.y}`, fill: 'none', opacity: .55, style: 'stroke:var(--ink)', 'stroke-dasharray': '2 3' }, gConn);
      });
    }

    function apply() {
      const focusS = hov ? byId[hov].sphere : (hovS || filt);
      if (focusS) svg.setAttribute('data-fs', focusS); else svg.removeAttribute('data-fs');
      const emS = hov ? byId[hov].sphere : (hovS || filt);
      svg.querySelectorAll('.cg,.tw').forEach(n => n.classList.toggle('em', n.dataset.s === emS));
      const links = hov ? new Set(byId[hov].links_to) : new Set();
      svg.querySelectorAll('.ev').forEach(n => n.classList.toggle('lk', links.has(n.dataset.id)));
      svg.querySelectorAll('.sl').forEach(n => n.setAttribute('aria-pressed', String(filt === n.dataset.s)));
      connectors(hov);
      readout(hov || sel);
    }

    function readout(id) {
      if (!hud) return;
      const e = byId[id];
      if (!e) { hud.removeAttribute('title'); hud.innerHTML = '<div class="k">t=' + time.toFixed(1) + ' · ' + esc(L.nothingYet) + '</div><h4>' + esc(L.pressPlay) + '</h4>'; return; }
      const s = spheres[e.sphere], met = publicMetric(e.metric);
      hud.title = [e.title, when(e), met, e.gave, e.why].filter(Boolean).join(' · ');
      hud.innerHTML = '<div class="k"><i style="background:var(--s-' + esc(e.sphere) + ')"></i>' + esc(s.name_en.toLowerCase()) + ' · ' + esc(when(e)) + '</div>'
        + '<h4>' + esc(e.title) + '</h4><dl>'
        + (met ? '<dt>' + esc(L.metric) + '</dt><dd>' + esc(met) + '</dd>' : '')
        + (e.gave ? '<dt>' + esc(L.did) + '</dt><dd>' + esc(e.gave) + '</dd>' : '')
        + (e.why ? '<dt>' + esc(L.why) + '</dt><dd>' + esc(e.why) + '</dd>' : '') + '</dl>';
    }

    function setSel(id, notify) {
      if (sel === id) return; sel = id; rovEv = null; markSel();
      if (notify && opts.onSelect) opts.onSelect(id);
    }

    function setTime(t, silent) {
      time = Math.max(T0, Math.min(T1 - 0.01, t));
      svg.querySelectorAll('[data-t]').forEach(n => n.classList.toggle('fut', +n.dataset.t > time + 0.001));
      roving();
      let pos = null;
      segs.forEach(s => {
        const f = Math.max(0, Math.min(1, (time - s.t1) / (s.t2 - s.t1)));
        s.els.forEach(p => { p.setAttribute('stroke-dasharray', s.L + ' ' + s.L); p.setAttribute('stroke-dashoffset', (s.L * (1 - f)).toFixed(1)); });
        if (time >= s.t1 && time <= s.t2) pos = s.ref.getPointAtLength(s.L * f);
      });
      if (marker) {
        marker.style.opacity = (raf && pos) ? 1 : 0;
        if (pos) marker.setAttribute('transform', `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`);
      }
      if (!silent) {
        if (time < T1 - 0.05) { // follow the path: show the latest milestone reached
          const reached = path.filter(id => byId[id].t <= time + 0.001);
          setSel(reached.length ? reached[reached.length - 1] : null, true);
          if (!hov) readout(sel);
        }
        if (opts.onTime) opts.onTime(time);
      }
    }

    // Playback runs along the drawn path at constant speed, not at constant years per second. Milestones are
    // sparse early (2017-2021 is one segment) and dense late (six between 2024 and 2026), so equal time per year
    // crawled at the start and raced at the end. Each segment now gets time in proportion to its length.
    // A short lead-in before the first milestone and a tail after the last keep their own small share.
    const PRE = 0.03, POST = 0.06;
    function lens() { const tot = segs.reduce((a, s) => a + s.L, 0); return { tot, pre: tot * PRE, post: tot * POST, all: tot * (1 + PRE + POST) }; }
    function progToTime(p) { // p in [0,1] of the whole run -> plot time
      if (!segs.length) return T0 + p * (T1 - 0.01 - T0);
      const { pre, post, all } = lens(), tA = segs[0].t1, tB = segs[segs.length - 1].t2;
      let l = Math.max(0, Math.min(1, p)) * all;
      if (l <= pre) return T0 + (l / pre) * (tA - T0);
      l -= pre;
      for (const s of segs) { if (l <= s.L) return s.t1 + (l / s.L) * (s.t2 - s.t1); l -= s.L; }
      return tB + Math.min(1, l / post) * (T1 - 0.01 - tB);
    }
    function timeToProg(t) { // inverse, so play resumes from where the slider is
      if (!segs.length) return (t - T0) / (T1 - 0.01 - T0);
      const { pre, post, all } = lens(), tA = segs[0].t1, tB = segs[segs.length - 1].t2;
      if (t <= tA) return Math.max(0, (t - T0) / (tA - T0)) * pre / all;
      let l = pre;
      for (const s of segs) { if (t <= s.t2) return (l + (t - s.t1) / (s.t2 - s.t1) * s.L) / all; l += s.L; }
      return Math.min(1, (l + (t - tB) / (T1 - 0.01 - tB) * post) / all);
    }
    function play() {
      if (raf) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { // no animation: each press jumps to the next milestone
        const nxt = path.find(id => byId[id].t > time + 0.001 && time < T1 - 0.05);
        if (!nxt) { setTime(T0, true); setSel(null, true); apply(); setTime(byId[path[0]].t); }
        else setTime(byId[nxt].t);
        if (opts.onEnd) opts.onEnd(); return;
      }
      const p0 = time >= 2027 ? 0 : timeToProg(time), dur = 9000 * (1 - p0), t0 = performance.now();
      const step = n => {
        const k = Math.min(1, (n - t0) / dur); setTime(progToTime(p0 + (1 - p0) * k));
        if (k < 1) raf = requestAnimationFrame(step);
        else { raf = null; setTime(T1, true); setSel(path[path.length - 1], true); apply(); if (opts.onTime) opts.onTime(time); if (opts.onEnd) opts.onEnd(); }
      };
      raf = requestAnimationFrame(step);
    }
    function pause() { if (raf) { cancelAnimationFrame(raf); raf = null; setTime(time, true); } }
    function filter(k) {
      filt = k || null; if (filt) rovSL = filt;
      if (filt) { // select the sphere's latest event already reached
        const list = E.filter(e => e.sphere === filt && e.status !== 'next' && e.t <= time + 0.001).sort((a, b) => a.t - b.t);
        if (list.length) setSel(list[list.length - 1].id, true);
      }
      apply(); if (opts.onFilter) opts.onFilter(filt);
    }
    function select(id) { if (id && !byId[id]) return; setSel(id, true); apply(); }

    const evOf = t => t.closest && t.closest('.ev');
    // remember how the last interaction happened: a touch tap must not leave the chart in its dimmed "hover" state
    svg.addEventListener('pointerdown', ev => { lastPtr = ev.pointerType || 'mouse'; }, true);
    const onKey = () => { lastPtr = 'key'; };
    window.addEventListener('keydown', onKey, true);
    svg.addEventListener('pointerover', ev => { const gg = evOf(ev.target); if (gg && ev.pointerType !== 'touch') { hov = gg.dataset.id; apply(); } });
    svg.addEventListener('pointerout', ev => { const gg = evOf(ev.target); if (gg && ev.pointerType !== 'touch' && !gg.contains(ev.relatedTarget)) { hov = null; apply(); } });
    svg.addEventListener('click', ev => {
      const gg = evOf(ev.target); if (!gg) return;
      if (lastPtr === 'touch') { hov = null; hovS = null; }
      rovEv = gg.dataset.id; select(gg.dataset.id);
    });
    svg.addEventListener('focusin', ev => { const gg = evOf(ev.target); if (gg && lastPtr === 'key') { hov = gg.dataset.id; apply(); } });
    svg.addEventListener('focusout', ev => { if (evOf(ev.target) && hov) { hov = null; apply(); } });
    const chrono = () => [...svg.querySelectorAll('.ev')].filter(n => !n.classList.contains('fut')).sort((a, b) => (+a.dataset.t) - (+b.dataset.t) || ORDER.indexOf(a.dataset.s) - ORDER.indexOf(b.dataset.s));
    svg.addEventListener('keydown', ev => {
      const gg = evOf(ev.target); if (!gg) return;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(gg.dataset.id); return; }
      const list = chrono(), i = list.indexOf(gg);
      let j = -1;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = Math.min(list.length - 1, i + 1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = Math.max(0, i - 1);
      else if (ev.key === 'Home') j = 0; else if (ev.key === 'End') j = list.length - 1;
      if (j < 0) return; ev.preventDefault();
      const n = list[j]; rovEv = n.dataset.id; select(n.dataset.id); n.focus(); hov = n.dataset.id; apply();
    });

    // occasional glint on a random visible dust point; never on events, never while hidden or in reduced motion
    let glT = 0, inView = false;
    const STAR = 'M0,-8L1.2,-1.2L8,0L1.2,1.2L0,8L-1.2,1.2L-8,0L-1.2,-1.2Z';
    function glint() {
      glT = setTimeout(glint, 1200 + Math.random() * 1800);
      if (!inView || document.hidden || !gGl || !gGl.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (gGl.childElementCount >= 2) return; // at most two glints at a time
      const fs = svg.getAttribute('data-fs');
      const pool = svg.querySelectorAll((fs ? '.cg[data-s="' + fs + '"]' : '.cg') + ' .cl:not(.fut)');
      if (!pool.length) return;
      const d = pool[Math.floor(Math.random() * pool.length)], k = d.parentNode.dataset.s;
      const x = +d.getAttribute('cx'), y = +d.getAttribute('cy');
      const g = el('g', { style: 'transform-origin:0 0' }, gGl);
      el('circle', { r: 4.5, style: 'fill:var(--s-' + k + ')', opacity: .35 }, g);
      el('path', { d: STAR, style: 'fill:var(--ink-hi,#fff)' }, g);
      const tf = s => 'translate(' + x + 'px,' + y + 'px) scale(' + s + ') rotate(' + (s * 45) + 'deg)';
      const an = g.animate([{ transform: tf(0), opacity: 0 }, { transform: tf(1), opacity: .9, offset: .3 }, { transform: tf(.8), opacity: .7, offset: .55 }, { transform: tf(0), opacity: 0 }], { duration: 1600, easing: 'ease-in-out' });
      an.onfinish = () => g.remove();
    }
    const gio = new IntersectionObserver(es => { inView = es[0].isIntersecting; root.classList.toggle('off', !inView); }); gio.observe(root);
    root.classList.add('off'); // until the observer reports it on screen
    glT = setTimeout(glint, 1500);
    const ro = new ResizeObserver(() => draw()); ro.observe(root);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    draw();
    if (opts.intro && !matchMedia('(prefers-reduced-motion: reduce)').matches) { setTime(T0); play(); }

    return { setTime: t => setTime(t), play, pause, filter, select, get time() { return time; }, destroy() { pause(); clearTimeout(glT); gio.disconnect(); ro.disconnect(); window.removeEventListener('keydown', onKey, true); root.remove(); } };
  }
  g.mountSky = mountSky;
})(window);

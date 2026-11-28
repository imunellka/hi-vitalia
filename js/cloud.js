/* Hero point cloud: 8 sphere-coloured clusters around the portrait, gentle cursor parallax, idle drift. */
{
  const intro = document.getElementById('intro');
  if (intro) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const SPH = ['--s-art', '--s-edu', '--s-med', '--s-eng', '--s-ent', '--s-res', '--s-soc', '--s-com'];
  const rel = el => { const a = el.getBoundingClientRect(), b = intro.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, r: a.right - b.left, b: a.bottom - b.top }; };
  const fx2 = document.createElement('div'); fx2.className = 'fx'; fx2.id = 'fx2'; fx2.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas'); fx2.appendChild(cv);
  intro.prepend(fx2);
  let pts = [], ex = [], box = null, raf2 = null, mx = 0, my = 0, tx = 0, ty = 0, born = 0, visible = true;
  function seed(n) { let s = n; return () => (s = s * 16807 % 2147483647) / 2147483647; }
  function build2(animate) {
    const W = intro.clientWidth, H = intro.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fr = rel(intro.querySelector('.subject .frame'));
    const met = rel(intro.querySelector('.metrics'));
    const narrow = W <= 900;
    const cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2;
    box = narrow
      ? { x0: 0, y0: fr.y - 70, x1: W, y1: Math.min(met.y - 6, fr.b + 70) }
      : { x0: Math.max(0, fr.x - 170), y0: 0, x1: W, y1: met.y - 10 };
    const pad = 14;
    ex = ['.name', '.lead', '.cta', '.hstatus', '.subject dl', '.subject .frame'].map(s => intro.querySelector(s)).filter(Boolean).map(el => { const r = rel(el); return { x0: r.x - pad, y0: r.y - pad, x1: r.r + pad, y1: r.b + pad }; });
    const rnd = seed(29); pts = [];
    const R = Math.max(box.x1 - box.x0, box.y1 - box.y0) * .62;
    for (let k = 0; k < 8; k++) {
      const a0 = -Math.PI / 2 + k * Math.PI / 4, col = css(SPH[k]);
      for (let i = 0; i < 150; i++) {
        const a = a0 + (rnd() - .5) * (Math.PI / 4) * .95;
        const rr = (narrow ? 66 : 100) + Math.pow(rnd(), 1.6) * R * (narrow ? .5 : .78);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * (narrow ? .7 : .85);
        if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) continue;
        pts.push({ x, y, z: .3 + rnd() * .7, s: .8 + rnd() * 1.2, a: .22 + rnd() * .42, c: col, ph: rnd() * 6.28, sp: .00018 + rnd() * .00025, d: rnd() * 900 });
      }
    }
    // emphasise a few as "events"
    for (let i = 0; i < pts.length; i += 29) { pts[i].s = 3; pts[i].a = .9; }
    born = animate && !reduce ? performance.now() : -1e6;
    mx = my = tx = ty = 0;
    loop2();
  }
  // on touch screens there is no cursor parallax: once every point has faded in, the frame never changes
  const settled = t => touch && t - born > 1800;
  function inside(p, x, y) { for (const r of ex) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true; return false; }
  function draw2(t) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    mx += (tx - mx) * .06; my += (ty - my) * .06;
    const age = t - born;
    for (const p of pts) {
      const drift = reduce ? 0 : 2.2;
      const x = p.x + mx * 8 * p.z + Math.sin(t * p.sp + p.ph) * drift;
      const y = p.y + my * 8 * p.z + Math.cos(t * p.sp * .8 + p.ph) * drift;
      if (inside(p, x, y)) continue;
      const fade = Math.max(0, Math.min(1, (age - p.d) / 700));
      ctx.globalAlpha = p.a * fade; ctx.fillStyle = p.c;
      ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }
  function loop2() {
    cancelAnimationFrame(raf2);
    const tick = t => { if (!visible) { raf2 = null; return; } draw2(t); if (!reduce && !settled(t)) raf2 = requestAnimationFrame(tick); else raf2 = null; };
    raf2 = requestAnimationFrame(tick);
    if (reduce) draw2(performance.now());
  }
  if (!touch) intro.addEventListener('pointermove', e => {
    const r = intro.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2;
  });
  intro.addEventListener('pointerleave', () => { tx = ty = 0; });
  const io = new IntersectionObserver(es => { const was = visible; visible = es[0].isIntersecting; if (visible && !was && !reduce && pts.length && !settled(performance.now())) { cancelAnimationFrame(raf2); const tick = t => { if (!visible) return; draw2(t); raf2 = requestAnimationFrame(tick); }; raf2 = requestAnimationFrame(tick); } }); io.observe(intro);
  const go = () => build2(true);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(go));
  let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => build2(false), 120); }); ro.observe(intro);
  }
}

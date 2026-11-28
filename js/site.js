/* Site wiring: graph controls, sector links, readout state, figure caption, scroll-spy. */
{
const D = window.SKY_DATA;
const U = Object.assign({ play: 'play', pause: 'pause', next: 'next ›', now: 'now', nothing_yet: 'nothing yet' }, window.SKY_UI || {});
const $ = id => document.getElementById(id);
const scrub = $('scrub'), out = $('tout'), playB = $('play'), cap = $('figcap'), hud = $('hud');
const touch = matchMedia('(hover: none)').matches;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const capText = touch ? (cap.dataset.touch || cap.textContent.replace(/Hover a square/i, 'Tap a square').replace(/Fahren Sie über ein Quadrat/, 'Tippen Sie auf ein Quadrat')) : cap.textContent;
cap.textContent = capText;
const meaning = Object.fromEntries(D.spheres.map(s => [s.id, s]));
const byTitle = Object.fromEntries(D.events.map(e => [e.title_en || e.title, e]));
const ym = d => { const [y, m] = d.split('-').map(Number); return y + ((m || 1) - 1) / 12; };
const live = D.events.filter(e => e.status !== 'next');
/* path milestones in time order: the readout follows these while the path plays or is scrubbed */
const MILE = ['theatre', 'hse', 'splat', 'ozon', 'patent', 'tum', 'helm', 'speed', 'iso'].map(id => D.events.find(e => e.id === id)).filter(Boolean).sort((a, b) => ym(a.start) - ym(b.start));
const DEF = $('viz').dataset.default || 'iso';
let driving = false, cur = DEF, api = null;

/* readout finish: "did" label, heading level (no h4 after h1/h2), public date labels. Idempotent. */
const polish = () => {
  hud.querySelectorAll('dd,.h').forEach(n => { if (/\w-\w/.test(n.textContent)) n.textContent = n.textContent.replace(/(\w)-(\w)/g, '$1\u2011$2'); });
  const h = hud.querySelector('h4');
  if (h) { const p = document.createElement('p'); p.className = 'h'; p.textContent = h.textContent; h.replaceWith(p); }
  const title = hud.querySelector('.h');
  const ev = title && byTitle[title.textContent];
  if (ev && ev.date_label) {
    const k = hud.querySelector('.k');
    if (k) for (const n of k.childNodes) if (n.nodeType === 3 && /\d{4}/.test(n.textContent) && !n.textContent.endsWith(ev.date_label)) n.textContent = n.textContent.replace(/·\s.*$/, '· ' + ev.date_label);
    if (hud.title) hud.title = hud.title.replace(/[A-Z][a-z]{2} \d{4}( – [A-Z][a-z]{2} \d{4})?/, ev.date_label);
  }
};
new MutationObserver(polish).observe(hud, { childList: true, subtree: true });

/* announce only on deliberate selection (click / Enter), never on hover or during play */
let liveT = 0;
const announce = () => { hud.setAttribute('aria-live', 'polite'); clearTimeout(liveT); liveT = setTimeout(() => hud.setAttribute('aria-live', 'off'), 1200); };
$('viz').addEventListener('click', announce);
$('viz').addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') announce(); });

const setPlay = st => { playB.dataset.state = st; playB.textContent = U[st] || U.play; };
const sel = id => { if (api && id && id !== cur) { cur = id; api.select(id); } };
api = window.mountSky($('viz'), D, {
  hudEl: hud, start: DEF, labels: 'auto', i18n: window.SKY_I18N || {},
  onTime: t => {
    scrub.value = t; out.textContent = t >= 2027.9 ? 't=' + U.now : 't=' + t.toFixed(1);
    if (!driving) return;
    const m = MILE.filter(e => ym(e.start) <= t + 0.001).pop();
    if (m) sel(m.id);
    else { cur = null; hud.innerHTML = ''; const sp = document.createElement('span'); sp.className = 'empty'; sp.textContent = 't=' + t.toFixed(1) + ' · ' + U.nothing_yet; hud.append(sp); }
  },
  onSelect: id => { cur = id; },
  onEnd: () => { setPlay('play'); driving = false; },
  onFilter: k => {
    if (k && meaning[k]) {
      cap.textContent = ''; const b = document.createElement('b'); b.textContent = meaning[k].name_en + ' · '; cap.append(b, meaning[k].description);
      const last = live.filter(e => e.sphere === k).sort((a, b2) => ym(a.start) - ym(b2.start)).pop();
      if (last) sel(last.id);
    } else cap.textContent = capText;
  }
});
polish();

scrub.addEventListener('input', () => { api.pause(); setPlay('play'); driving = true; api.setTime(+scrub.value); driving = false; });
let step = -1;
playB.addEventListener('click', () => {
  if (playB.dataset.state === 'pause') { api.pause(); setPlay('play'); driving = false; return; }
  if (reduce()) {
    /* no animation: each press jumps to the next milestone */
    step = (step + 1) % MILE.length;
    const m = MILE[step]; driving = true; api.setTime(Math.min(2027.99, ym(m.start) + 0.05)); driving = false; sel(m.id);
    setPlay(step === MILE.length - 1 ? 'play' : 'next');
    return;
  }
  setPlay('pause'); driving = true; api.play();
});

/* section links back into the instrument: scroll to the figure and filter it to that sector */
document.querySelectorAll('.figlink[data-filter]').forEach(a => a.addEventListener('click', ev => {
  ev.preventDefault();
  $('sky').scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
  if (typeof api.filter === 'function') api.filter(a.dataset.filter);
}));

/* scroll-spy: the nav link of the section in view gets aria-current */
const links = [...document.querySelectorAll('.nav .links a')];
const setCur = id => { const t = '#' + id; links.forEach(a => a.getAttribute('href') === t ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')); };
const io = new IntersectionObserver(es => {
  const vis = es.filter(x => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
  if (vis[0]) setCur(vis[0].target.id);
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('[data-spy]').forEach(s => io.observe(s));
setCur('intro');

/* language switch keeps the section you are on */
document.querySelectorAll('a[data-lang-switch]').forEach(a => a.addEventListener('click', () => { const h = location.hash; if (h && /^#[\w-]+$/.test(h)) a.href = a.getAttribute('href').split('#')[0] + h; }));
}

/* CV download through the artifact viewer's downloads capability; plain link elsewhere */
{
  const cv=document.querySelector('a[data-cv]');
  if(cv&&window.claude&&typeof window.claude.use==='function'){
    window.claude.use('downloads').then(dl=>{
      if(!dl)return;
      cv.addEventListener('click',async ev=>{
        ev.preventDefault();
        try{
          const blob=await (await fetch(cv.getAttribute('href'))).blob();
          await dl.save({filename:'Vitalia_Stepashkina_CV.pdf',data:blob});
        }catch(err){
          if(err&&err.code==='declined')return;
          cv.removeAttribute('download');window.open(cv.href,'_blank','noopener');
        }
      });
    }).catch(()=>{});
  }
}

/* partners popover: tap/click toggles (hover and focus handled in CSS) */
{
  const b=document.querySelector('.ptip'),p=document.getElementById('mpop');
  if(b&&p){
    b.addEventListener('click',e=>{e.stopPropagation();const o=!p.classList.contains('open');p.classList.toggle('open',o);b.setAttribute('aria-expanded',String(o))});
    document.addEventListener('click',e=>{if(!p.contains(e.target)){p.classList.remove('open');b.setAttribute('aria-expanded','false')}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){p.classList.remove('open');p.classList.add('dismissed');b.setAttribute('aria-expanded','false')}});
    const m=b.closest('.metric');m.addEventListener('pointerenter',()=>p.classList.remove('dismissed'));b.addEventListener('focus',()=>p.classList.remove('dismissed'));
  }
}

/* Reload keeps your place. An in-page link leaves #section in the URL, and on reload the browser jumps there
   instead of back to where you were. Remember the scroll position per page and restore it on reload and
   back/forward. A fresh visit to a link with #section still goes to that section. */
{
  const KEY = 'scrollY:' + location.pathname;
  const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
  let saved = NaN;
  try { saved = parseFloat(sessionStorage.getItem(KEY)); } catch (e) {}
  const returning = (navType === 'reload' || navType === 'back_forward') && isFinite(saved);
  let restoring = returning;
  const save = () => { if (!restoring) try { sessionStorage.setItem(KEY, String(Math.round(scrollY))); } catch (e) {} };
  let st = 0;
  addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(save, 150); }, { passive: true });
  addEventListener('pagehide', save);
  // smooth scrolling only for clicks after the page is up (see html.smooth in site.css)
  addEventListener('load', () => requestAnimationFrame(() => document.documentElement.classList.add('smooth')), { once: true });
  if (returning) {
    // the hash would win again on the next reload; the position is what matters now
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    const go = () => scrollTo({ top: saved, behavior: 'instant' });
    go();
    // fonts and the plot change the page height after this script runs; restore again once layout settles
    addEventListener('load', go, { once: true });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .then(() => requestAnimationFrame(() => { go(); setTimeout(() => { go(); restoring = false; }, 250); }));
  }
}

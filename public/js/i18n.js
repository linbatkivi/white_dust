// ==========================================================================
// White Dust · v26.7 SPROG – Engelsk (standard) · Dansk · Fransk · Spansk · Tysk · Mandarin
//   Spillets kildetekster er danske. Oversættelsen sker i selve brugerfladen: alle tekstnoder og titler/placeholders i DOM'en slås op i
//   ordbogen (i18n_dict.js: dansk → [en, fr, es, de, zh]) lige når de skrives – også de dynamiske (tal, navne): ord med {0}, {1} er skabeloner.
//   Dansk = originalteksten. Valget gemmes i localStorage ('wd_lang'). tr(tekst) bruges af canvas-tegnet tekst (hideout, sæsonkort).
// ==========================================================================
import { DICT } from '/js/i18n_dict.js';
export const LANGS = [['en', 'English'], ['da', 'Dansk'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['zh', '中文 (Mandarin)']];
const IDX = { en: 0, fr: 1, es: 2, de: 3, zh: 4 };
const EXACT = new Map(), PATS = [];
for (const [k, v] of Object.entries(DICT)) {
  if (/\{\d+\}/.test(k)) {
    const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d+\}/g, '(.+?)') + '$', 'is');
    PATS.push({ re, v, n: k.length });
  } else EXACT.set(k.toLowerCase(), v);
}
PATS.sort((a, b) => b.n - a.n);
let cur = 'en'; try { const s = localStorage.getItem('wd_lang'); if (LANGS.some(l => l[0] === s)) cur = s; } catch (e) {}
const listeners = [];
export const getLang = () => cur;

const isCaps = s => s.length > 1 && s === s.toUpperCase() && s !== s.toLowerCase();
function lookup(core) {
  const ix = IDX[cur]; if (ix === undefined) return null;
  let t = null; const e = EXACT.get(core.toLowerCase());
  if (e) t = e[ix] || e[0];
  else for (const p of PATS) { const m = core.match(p.re); if (m) { t = (p.v[ix] || p.v[0]).replace(/\{(\d+)\}/g, (_, i) => tr(m[+i + 1] || '')); break; } }
  if (t !== null && cur !== 'zh' && isCaps(core)) t = t.toUpperCase();         // VERSALER i kilden → versaler i oversættelsen
  return t;
}
// oversæt en (dansk) tekst; ukendt tekst beholdes uændret. Sammensat tekst "A · B" oversættes led for led.
export function tr(s) {
  if (typeof s !== 'string' || cur === 'da' || !s) return s;
  const lead = /^\s*/.exec(s)[0], core = s.replace(/[\u00a0\s]+/g, " ").trim(); if (!core) return s;
  if (core.endsWith('▮') && core.length > 2) { const t0 = tr(core.slice(0, -1).trim()); return t0 === core.slice(0, -1).trim() ? s : lead + t0 + ' ▮' + /\s*$/.exec(s)[0]; }
  let r = lookup(core);
  if (r === null) for (const sep of [' ▮ ', ' · ', ' — ', ' – ', ' | ']) if (core.includes(sep)) { const parts = core.split(sep).map(p => lookup(p.trim()) ?? p); if (parts.some((p, i) => p !== core.split(sep)[i])) { r = parts.join(sep); break; } }
  if (r === null && /[:：]\s/.test(core)) { const i = core.indexOf(': '); if (i > 0) { const a = lookup(core.slice(0, i)), b = lookup(core.slice(i + 2)); if (a !== null || b !== null) r = (a ?? core.slice(0, i)) + ': ' + (b ?? core.slice(i + 2)); } }
  return r === null ? s : lead + r + /\s*$/.exec(s)[0];
}

// ---- DOM ----
const ORIG = new WeakMap(), WROTE = new WeakMap(), AORIG = new WeakMap();
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS', 'NOSCRIPT']);
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
function doText(n) {
  const v = n.nodeValue; if (!v || !/\S/.test(v)) return;
  const pe = n.parentElement; if (pe && pe.closest && pe.closest('[translate=no]')) return;       // spillernes egne navne/chat oversættes ikke
  if (WROTE.has(n) && WROTE.get(n) === v) return;                      // vores egen oversættelse – ikke en ny kilde
  ORIG.set(n, v); const t = tr(v);
  if (t !== v) { WROTE.set(n, t); n.nodeValue = t; } else WROTE.delete(n);
}
function doAttrs(el) {
  if (!el.hasAttribute) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue; const v = el.getAttribute(a), m = AORIG.get(el) || {};
    if (m[a] && m[a].w === v) continue; m[a] = { o: v, w: v }; AORIG.set(el, m);
    const t = tr(v); if (t !== v) { m[a].w = t; el.setAttribute(a, t); }
  }
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) { if (!SKIP.has(root.parentNode && root.parentNode.nodeName)) doText(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
  doAttrs(root);
  for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
}
// sprogskift: find kilden igen for alle noder og oversæt til det nye sprog
function retranslateAll() {
  const doc = document.body; if (!doc) return;
  const w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      if (SKIP.has(n.parentNode.nodeName)) continue; const now = n.nodeValue; if (!now || !/\S/.test(now)) continue;
      if (n.parentElement && n.parentElement.closest && n.parentElement.closest('[translate=no]')) continue;
      const src = WROTE.has(n) && WROTE.get(n) === now ? ORIG.get(n) : now; ORIG.set(n, src);
      const t = tr(src); if (t !== now) n.nodeValue = t; if (t !== src) WROTE.set(n, t); else WROTE.delete(n);
    } else {
      const m = AORIG.get(n); if (m) for (const a of Object.keys(m)) { if (!n.hasAttribute(a)) continue; const cv = n.getAttribute(a); if (cv !== m[a].w) m[a] = { o: cv, w: cv }; const t = tr(m[a].o); if (cv !== t) n.setAttribute(a, t); m[a].w = t; }
      doAttrs(n);
    }
  }
}
let obs = null;
function start() {
  if (obs || !document.body) return;
  walk(document.body);
  obs = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') { if (!SKIP.has(m.target.parentNode && m.target.parentNode.nodeName)) doText(m.target); }
      else if (m.type === 'attributes') { if (m.attributeName && ATTRS.includes(m.attributeName)) doAttrs(m.target); }
      else for (const a of m.addedNodes) walk(a);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
export function setLang(l) {
  if (!LANGS.some(x => x[0] === l)) return; cur = l; try { localStorage.setItem('wd_lang', l); } catch (e) {}
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l; document.body.classList.toggle('lang-zh', l === 'zh');
  retranslateAll(); document.title = tr('WHITE DUST'); for (const f of listeners) try { f(l); } catch (e) {}
}
export const onLang = f => listeners.push(f);
export function initI18n() {
  document.documentElement.lang = cur === 'zh' ? 'zh-CN' : cur; document.body.classList.toggle('lang-zh', cur === 'zh');
  start(); document.documentElement.classList.remove('i18n-wait');
}
window.WD_I18N = { tr, setLang, getLang, LANGS };
if (document.readyState !== 'loading') initI18n(); else document.addEventListener('DOMContentLoaded', initI18n);

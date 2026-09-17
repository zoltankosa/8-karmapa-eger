import { ITEMS } from './calc.js';
import { STRINGS } from './i18n.js';

const KEYS = { lang: 'kbc.lang', mine: 'kbc.mine' };
const POLL_MS = 10000;

export function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: preferences just won't persist */
  }
}

let lang = STRINGS[readLS(KEYS.lang, 'hu')] ? readLS(KEYS.lang, 'hu') : 'hu';
export const getLang = () => lang;

export function t(key, ...args) {
  const v = STRINGS[lang][key];
  return typeof v === 'function' ? v(...args) : v;
}

// Always group thousands (hu-HU leaves 4-digit numbers ungrouped, which breaks column alignment).
export const nf = { format: (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') };
export const ft = (n) => `${nf.format(n)} Ft`;
export const dayLabel = (d) => t('days')[d];
export const itemLabel = (it) => t('kinds')[it.kind];
export const fullItemLabel = (it) => `${dayLabel(it.day)} ${itemLabel(it).toLowerCase()}`;
export const itemById = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
export const timeStr = (d) =>
  d.toLocaleTimeString(lang === 'hu' ? 'hu-HU' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
export const $ = (sel) => document.querySelector(sel);

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  chevron: 'm6 9 6 6 6-6',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  print: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
};
export function icon(name, cls = 'icon') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

export function disclosure(openSet, key, summaryChildren, bodyChildren, cls = '') {
  const d = h('details', { class: `disclosure ${cls}`, open: openSet.has(key) },
    h('summary', {}, h('span', { class: 'summary-main' }, summaryChildren), icon('chevron', 'icon chevron')),
    h('div', { class: 'disclosure-body' }, bodyChildren));
  d.addEventListener('toggle', () => {
    if (d.open) openSet.add(key);
    else openSet.delete(key);
  });
  return d;
}

let toastTimer;
export function toast(message, kind = 'ok') {
  const el = $('#toast');
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export function confirmDialog(message, confirmLabel) {
  const dlg = $('#confirm');
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      if (dlg.open) dlg.close();
      resolve(val);
    };
    dlg.replaceChildren(
      h('div', { class: 'confirm-body' },
        h('p', { text: message }),
        h('div', { class: 'button-row' },
          h('button', { class: 'btn btn-ghost', type: 'button', text: t('cancel'), onclick: () => done(false) }),
          h('button', { class: 'btn btn-danger', type: 'button', text: confirmLabel, onclick: () => done(true) })))
    );
    dlg.addEventListener('close', () => done(false), { once: true });
    dlg.onclick = (e) => { if (e.target === dlg) done(false); };
    dlg.showModal();
  });
}

export const mine = {
  all: () => readLS(KEYS.mine, {}),
  has: (id) => Object.hasOwn(mine.all(), id),
  set(id, name) {
    writeLS(KEYS.mine, { ...mine.all(), [id]: name });
  },
  remove(id) {
    const all = mine.all();
    delete all[id];
    writeLS(KEYS.mine, all);
  },
};

const PAGES = [
  ['register', './'],
  ['people', 'resztvevok.html'],
  ['kitchen', 'konyha.html'],
  ['program', 'program.html'],
];

export function initShell(page, render, store) {
  const draw = () => {
    document.documentElement.lang = t('htmlLang');
    document.title = `${t('pageTitles')[page]} · ${t('title')}`;
    $('#brandTitle').textContent = t('title');
    $('#brandSub').replaceChildren(h('span', { text: t('dates') }), h('span', { text: t('place') }));
    const langBtn = $('#langBtn');
    langBtn.textContent = t('switchLang');
    langBtn.setAttribute('aria-label', t('switchLangLabel'));
    $('#nav').replaceChildren(
      ...PAGES.map(([id, href]) =>
        h('a', { href, class: 'nav-link', 'aria-current': id === page ? 'page' : null, text: t('pageTitles')[id] }))
    );
    const banner = $('#demoBanner');
    banner.hidden = !store?.demo;
    banner.textContent = t('demo');
    render();
  };
  $('#langBtn').addEventListener('click', () => {
    lang = lang === 'hu' ? 'en' : 'hu';
    writeLS(KEYS.lang, lang);
    draw();
  });
  draw();
  return draw;
}

// Polls the store while the page is visible and reports changes to onChange(people).
export function liveSync(store, onChange) {
  const btn = $('#statusBtn');
  const s = { status: 'syncing', lastSync: null, sig: null, inflight: false, loaded: false };

  const paint = () => {
    btn.hidden = false;
    btn.dataset.status = s.status;
    const label =
      s.status === 'error' ? t('offline')
        : !s.lastSync ? t('syncing')
          : `${t('live')} · ${timeStr(s.lastSync)}`;
    btn.replaceChildren(h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'status-text', text: label }));
    btn.setAttribute('aria-label', s.lastSync ? `${t('updatedAt', timeStr(s.lastSync))}. ${t('refresh')}` : t('refresh'));
  };

  const apply = (people) => {
    const sig = JSON.stringify(people);
    s.lastSync = new Date();
    s.status = 'ok';
    s.loaded = true;
    if (sig !== s.sig) {
      s.sig = sig;
      onChange(people);
    }
    paint();
  };

  const refresh = async () => {
    if (s.inflight) return;
    s.inflight = true;
    if (!s.lastSync) paint();
    try {
      const res = await store.list();
      s.inflight = false;
      apply(res.people || []);
    } catch (err) {
      console.error(err);
      s.inflight = false;
      s.status = 'error';
      paint();
      if (!s.loaded) {
        s.loaded = true;
        onChange(null);
      }
    }
  };

  btn.addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
  refresh();
  return { refresh, apply, repaint: paint, state: s };
}

import { DAYS, ITEMS, foldText, normalizePerson, personTotal, sortPeople, summarize } from './calc.js';
import { API_URL } from './config.js';
import { STRINGS } from './i18n.js';
import { PROGRAM } from './program.js';
import { createStore } from './store.js';

const POLL_MS = 10000;
const KEYS = { lang: 'kbc.lang', tab: 'kbc.tab', mine: 'kbc.mine' };
const TABS = ['people', 'kitchen', 'program'];

const store = createStore(API_URL);
// Always group thousands (hu-HU leaves 4-digit numbers ungrouped, which breaks column alignment).
const nf = { format: (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') };

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: preferences just won't persist */
  }
}

const state = {
  people: [],
  sig: null,
  lang: STRINGS[readLS(KEYS.lang, 'hu')] ? readLS(KEYS.lang, 'hu') : 'hu',
  tab: TABS.includes(readLS(KEYS.tab, 'people')) ? readLS(KEYS.tab, 'people') : 'people',
  query: '',
  filter: 'all',
  status: 'syncing',
  lastSync: null,
  open: new Set(DAYS.map((d) => `prog:${d}`)),
  mine: new Set(readLS(KEYS.mine, [])),
  inflight: false,
};

const $ = (sel) => document.querySelector(sel);
const t = (key, ...args) => {
  const v = STRINGS[state.lang][key];
  return typeof v === 'function' ? v(...args) : v;
};
const ft = (n) => `${nf.format(n)} Ft`;
const itemById = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
const itemLabel = (it) => t('kinds')[it.kind];
const dayLabel = (d) => t('days')[d];
const fullItemLabel = (it) => `${dayLabel(it.day)} ${itemLabel(it).toLowerCase()}`;
const timeStr = (d) => d.toLocaleTimeString(state.lang === 'hu' ? 'hu-HU' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

function h(tag, props = {}, ...children) {
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
  people: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 9v-1a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.75',
  kitchen: 'M6 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 13v8M16 3c-1.7 0-3 2.2-3 5s1.3 4 3 4v9',
  program: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm6 9 6 6 6-6',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  print: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};
function icon(name, cls = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function disclosure(key, summaryChildren, bodyChildren, cls = '') {
  const d = h('details', { class: `disclosure ${cls}`, open: state.open.has(key) },
    h('summary', {}, h('span', { class: 'summary-main' }, summaryChildren), icon('chevron', 'icon chevron')),
    h('div', { class: 'disclosure-body' }, bodyChildren));
  d.addEventListener('toggle', () => {
    if (d.open) state.open.add(key);
    else state.open.delete(key);
  });
  return d;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(message, kind = 'ok') {
  const el = $('#toast');
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------- shell ---------- */
function renderShell() {
  document.documentElement.lang = t('htmlLang');
  document.title = `${t('title')} · ${t('place')}`;
  $('#title').textContent = t('title');
  $('#subtitle').textContent = `${t('place')} · ${t('dates')}`;
  const lang = $('#langBtn');
  lang.textContent = t('switchLang');
  lang.setAttribute('aria-label', t('switchLangLabel'));
  $('#demoBanner').hidden = !store.demo;
  $('#demoBanner').textContent = t('demo');

  const tabbar = $('#tabbar');
  tabbar.replaceChildren(
    ...TABS.map((tab) =>
      h('button', {
        class: 'tab',
        type: 'button',
        'aria-current': state.tab === tab ? 'page' : null,
        onclick: () => setTab(tab),
      }, icon(tab), h('span', { text: t(`tab${tab[0].toUpperCase()}${tab.slice(1)}`) }))
    )
  );
  const fab = $('#fab');
  fab.replaceChildren(icon('plus'), h('span', { text: t('add') }));
  fab.hidden = state.tab !== 'people';
  renderStatus();
  mountView();
}

function setTab(tab) {
  if (tab === state.tab) return;
  state.tab = tab;
  writeLS(KEYS.tab, tab);
  renderShell();
  window.scrollTo({ top: 0 });
}

function renderStatus() {
  const btn = $('#statusBtn');
  btn.dataset.status = state.status;
  const label =
    state.status === 'error' ? t('offline')
      : state.status === 'syncing' && !state.lastSync ? t('syncing')
        : state.lastSync ? `${t('live')} · ${timeStr(state.lastSync)}` : t('live');
  btn.replaceChildren(h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'status-text', text: label }));
  btn.title = state.lastSync ? `${t('updatedAt', timeStr(state.lastSync))}. ${t('refresh')}` : t('refresh');
  btn.setAttribute('aria-label', btn.title);
}

/* ---------- views ---------- */
function mountView() {
  const main = $('#view');
  main.replaceChildren();
  main.dataset.view = state.tab;
  if (state.tab === 'people') mountPeople(main);
  else if (state.tab === 'kitchen') mountKitchen(main);
  else mountProgram(main);
  updateView();
}

function updateView() {
  if (state.tab === 'people') updatePeople();
  else if (state.tab === 'kitchen') updateKitchen();
}

function mountPeople(main) {
  const filter = h('select', {
    id: 'filter',
    class: 'input',
    onchange: (e) => {
      state.filter = e.target.value;
      updatePeople();
    },
  },
  h('option', { value: 'all', text: t('filterAll') }),
  DAYS.map((d) =>
    h('optgroup', { label: `${dayLabel(d)} · ${t('dayDates')[d]}` },
      ITEMS.filter((it) => it.day === d).map((it) => h('option', { value: it.id, text: fullItemLabel(it) })))
  ));
  filter.value = state.filter;

  const search = h('input', {
    id: 'search',
    class: 'input',
    type: 'search',
    placeholder: t('searchPh'),
    autocomplete: 'off',
    value: state.query,
    oninput: (e) => {
      state.query = e.target.value;
      updatePeople();
    },
  });

  main.append(
    h('section', { class: 'stack' },
      h('div', { class: 'summary-strip', id: 'peopleSummary', 'aria-live': 'polite' }),
      h('div', { class: 'toolbar' },
        h('label', { class: 'field' }, h('span', { class: 'field-label', text: t('filter') }), filter),
        h('label', { class: 'field' }, h('span', { class: 'field-label', text: t('search') }), search)),
      h('div', { id: 'peopleList', class: 'list' }))
  );
}

function updatePeople() {
  const sum = summarize(state.people);
  const q = foldText(state.query.trim());
  const shown = state.people.filter(
    (p) => (state.filter === 'all' || p.meals[state.filter]) && (!q || foldText(p.name).includes(q))
  );

  const strip = $('#peopleSummary');
  const parts = [
    h('strong', { text: t('peopleCount', sum.people) }),
    h('span', { text: `${t('meat')} ${sum.meat}` }),
    h('span', { text: `${t('veg')} ${sum.veg}` }),
  ];
  if (state.filter !== 'all' || q) {
    const fs = summarize(shown);
    parts.push(h('span', { class: 'accent', text: `${t('filtered', shown.length)} (${t('meat').toLowerCase()} ${fs.meat}, ${t('vegShort').toLowerCase()} ${fs.veg})` }));
  }
  strip.replaceChildren(...parts);

  const list = $('#peopleList');
  if (!state.people.length) {
    list.replaceChildren(
      h('div', { class: 'empty' }, h('p', { class: 'empty-title', text: state.sig === null ? t('syncing') : t('emptyTitle') }),
        state.sig === null ? null : h('p', { text: t('emptyBody') }))
    );
    return;
  }
  if (!shown.length) {
    list.replaceChildren(h('div', { class: 'empty' }, h('p', { text: t('noMatch') })));
    return;
  }
  list.replaceChildren(...shown.map(personRow));
}

function personRow(p) {
  const total = personTotal(p);
  const byDay = DAYS.map((d) => {
    const picked = ITEMS.filter((it) => it.day === d && p.meals[it.id]);
    if (!picked.length) return null;
    return h('div', { class: 'kv' },
      h('span', { class: 'kv-key', text: dayLabel(d) }),
      h('span', { class: 'kv-val', text: picked.map(itemLabel).join(', ') }),
      h('span', { class: 'num', text: ft(picked.reduce((s, it) => s + it.price, 0)) }));
  }).filter(Boolean);

  return disclosure(`p:${p.id}`,
    [
      h('span', { class: 'person-name' }, p.name, state.mine.has(p.id) ? h('span', { class: 'tag', text: t('mine') }) : null),
      h('span', { class: `diet diet-${p.diet}`, text: p.diet === 'veg' ? t('veg') : t('meat') }),
      h('span', { class: 'num person-total', text: ft(total) }),
    ],
    [
      byDay.length ? h('div', { class: 'kv-list' }, byDay) : h('p', { class: 'muted', text: t('noItems') }),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => openEditor(p) }, icon('edit'), t('edit')),
        h('button', { class: 'btn btn-ghost danger', type: 'button', onclick: () => deletePerson(p) }, icon('trash'), t('del'))),
    ],
    'person');
}

function mountKitchen(main) {
  main.append(
    h('section', { class: 'stack' },
      h('p', { class: 'intro', text: t('kitchenIntro') }),
      h('div', { id: 'kpis', class: 'kpis' }),
      h('div', { id: 'kitchenDays', class: 'stack' }),
      h('div', { id: 'shopping' }),
      h('div', { id: 'money' }))
  );
}

function nameColumns(s) {
  const col = (label, names) =>
    h('div', { class: 'names-col' },
      h('p', { class: 'names-head', text: `${label} (${names.length})` }),
      names.length ? h('ol', { class: 'names' }, names.map((n) => h('li', { text: n }))) : h('p', { class: 'muted', text: t('nobody') }));
  return h('div', { class: 'names-grid' }, col(t('meat'), s.names.meat), col(t('veg'), s.names.veg));
}

function splitBar(s) {
  const pct = s.count ? Math.round((s.meat / s.count) * 100) : 0;
  return h('div', { class: 'split', role: 'img', 'aria-label': `${t('meat')} ${s.meat}, ${t('veg')} ${s.veg}` },
    h('span', { class: 'split-meat', style: `width:${s.count ? pct : 0}%` }),
    h('span', { class: 'split-veg', style: `width:${s.count ? 100 - pct : 0}%` }));
}

function updateKitchen() {
  const sum = summarize(state.people);
  const kpi = (label, value, sub) =>
    h('div', { class: 'kpi' }, h('p', { class: 'kpi-label', text: label }), h('p', { class: 'kpi-value num', text: value }), sub ? h('p', { class: 'kpi-sub', text: sub }) : null);
  $('#kpis').replaceChildren(
    kpi(t('attendees'), nf.format(sum.people)),
    kpi(t('meat'), nf.format(sum.meat)),
    kpi(t('veg'), nf.format(sum.veg)),
    kpi(t('revenue'), ft(sum.total))
  );

  $('#kitchenDays').replaceChildren(
    ...DAYS.map((d) =>
      h('section', { class: 'day' },
        h('h2', { class: 'day-head' }, dayLabel(d), h('span', { class: 'muted', text: t('dayDates')[d] })),
        h('div', { class: 'meal-grid' },
          ITEMS.filter((it) => it.day === d).map((it) => {
            const s = sum.items[it.id];
            return h('article', { class: `meal ${it.food ? '' : 'meal-room'}` },
              h('div', { class: 'meal-top' },
                h('p', { class: 'meal-label', text: itemLabel(it) }),
                h('p', { class: 'meal-count' }, h('span', { class: 'num', text: nf.format(s.count) }), ` ${it.food ? t('portions') : t('beds')}`)),
              splitBar(s),
              h('p', { class: 'meal-split' },
                h('span', {}, h('i', { class: 'swatch swatch-meat' }), `${t('meat')} `, h('b', { class: 'num', text: s.meat })),
                h('span', {}, h('i', { class: 'swatch swatch-veg' }), `${t('veg')} `, h('b', { class: 'num', text: s.veg }))),
              disclosure(`k:${it.id}`, [h('span', { text: `${t('names')} (${s.count})` })], [nameColumns(s)], 'compact'));
          })))
    )
  );

  const foodItems = ITEMS.filter((it) => it.food);
  const rows = foodItems.map((it) => {
    const s = sum.items[it.id];
    return h('tr', {},
      h('th', { scope: 'row', text: fullItemLabel(it) }),
      h('td', { class: 'num', text: s.meat }),
      h('td', { class: 'num', text: s.veg }),
      h('td', { class: 'num strong', text: s.count }));
  });
  $('#shopping').replaceChildren(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {}, h('h2', { text: t('shopping') }), h('p', { class: 'muted', text: t('shoppingHint') })),
        h('div', { class: 'card-actions no-print' },
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => copySummary(sum) }, icon('copy'), t('copy')),
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => window.print() }, icon('print'), t('print')))),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col', text: t('meal') }),
            h('th', { scope: 'col', class: 'num', text: t('meat') }),
            h('th', { scope: 'col', class: 'num', text: t('vegShort') }),
            h('th', { scope: 'col', class: 'num', text: t('total') }))),
          h('tbody', {}, rows),
          h('tfoot', {}, h('tr', {},
            h('th', { scope: 'row', text: t('portionsTotal') }),
            h('td', { class: 'num', text: foodItems.reduce((a, it) => a + sum.items[it.id].meat, 0) }),
            h('td', { class: 'num', text: foodItems.reduce((a, it) => a + sum.items[it.id].veg, 0) }),
            h('td', { class: 'num strong', text: sum.portions })))))
    )
  );

  $('#money').replaceChildren(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: t('money') })),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col', text: t('meal') }),
            h('th', { scope: 'col', class: 'num', text: t('qty') }),
            h('th', { scope: 'col', class: 'num', text: t('amount') }))),
          h('tbody', {},
            ITEMS.map((it) => {
              const s = sum.items[it.id];
              return h('tr', {},
                h('th', { scope: 'row' }, fullItemLabel(it), h('span', { class: 'muted small', text: ` · ${ft(it.price)}` })),
                h('td', { class: 'num', text: s.count }),
                h('td', { class: 'num', text: ft(s.revenue) }));
            })),
          h('tfoot', {},
            h('tr', {}, h('th', { scope: 'row', colspan: '2', text: t('foodTotal') }), h('td', { class: 'num', text: ft(sum.food) })),
            h('tr', {}, h('th', { scope: 'row', colspan: '2', text: t('roomTotal') }), h('td', { class: 'num', text: ft(sum.room) })),
            h('tr', { class: 'grand' }, h('th', { scope: 'row', colspan: '2', text: t('grandTotal') }), h('td', { class: 'num strong', text: ft(sum.total) })))))
    )
  );
}

async function copySummary(sum) {
  const lines = [t('shareTitle', timeStr(state.lastSync || new Date()))];
  for (const it of ITEMS) {
    const s = sum.items[it.id];
    lines.push(it.food ? t('shareLine', fullItemLabel(it), s.count, s.meat, s.veg) : t('shareRoom', fullItemLabel(it), s.count));
  }
  const text = lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { class: 'sr-only' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(t('copied'));
}

function mountProgram(main) {
  const col = state.lang === 'hu' ? 1 : 2;
  main.append(
    h('section', { class: 'stack' },
      PROGRAM.map((day) =>
        disclosure(`prog:${day.day}`,
          [h('span', { class: 'prog-day', text: dayLabel(day.day) }), h('span', { class: 'muted', text: t('dayDates')[day.day] })],
          [h('ol', { class: 'timeline' },
            day.items.map((row) =>
              h('li', {}, h('span', { class: 'time num', text: row[0] }), h('span', { text: row[col] }))))],
          'card program'))
    )
  );
}

/* ---------- editor ---------- */
let editing = null;

function openEditor(person = null) {
  editing = person;
  const dlg = $('#editor');
  const nameInput = h('input', {
    id: 'f-name',
    class: 'input',
    name: 'name',
    required: true,
    maxlength: '80',
    autocomplete: 'name',
    placeholder: t('namePh'),
    value: person?.name ?? '',
  });
  const nameError = h('p', { class: 'field-error', id: 'f-name-err', hidden: true, text: t('nameRequired') });
  nameInput.setAttribute('aria-describedby', 'f-name-err');

  const diet = person?.diet ?? 'meat';
  const dietSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('diet') },
    ['meat', 'veg'].map((v) =>
      h('label', { class: 'seg-opt' },
        h('input', { type: 'radio', name: 'diet', value: v, checked: diet === v }),
        h('span', { text: v === 'veg' ? t('veg') : t('meat') }))));

  const totalEl = h('span', { class: 'num sheet-total-val' });
  const form = h('form', { class: 'sheet-form', novalidate: true });

  const dayBlocks = DAYS.map((d) => {
    const boxes = ITEMS.filter((it) => it.day === d).map((it) =>
      h('label', { class: 'switch-row' },
        h('span', { class: 'switch-text' }, h('span', { text: itemLabel(it) }), h('span', { class: 'muted num', text: ft(it.price) })),
        h('input', { type: 'checkbox', name: it.id, class: 'switch', checked: Boolean(person?.meals[it.id]) })));
    const toggleAll = h('button', {
      class: 'link-btn',
      type: 'button',
      onclick: () => {
        const inputs = [...form.querySelectorAll(`fieldset[data-day="${d}"] input[type=checkbox]`)];
        const next = !inputs.every((i) => i.checked);
        inputs.forEach((i) => { i.checked = next; });
        syncToggle();
        updateTotal();
      },
    });
    const syncToggle = () => {
      const inputs = [...form.querySelectorAll(`fieldset[data-day="${d}"] input[type=checkbox]`)];
      toggleAll.textContent = inputs.length && inputs.every((i) => i.checked) ? t('none') : t('all');
    };
    const fs = h('fieldset', { class: 'day-set', dataset: { day: d } },
      h('legend', {}, h('span', {}, dayLabel(d), h('span', { class: 'muted', text: ` · ${t('dayDates')[d]}` })), toggleAll),
      boxes);
    fs.addEventListener('change', syncToggle);
    queueMicrotask(syncToggle);
    return fs;
  });

  const updateTotal = () => {
    const meals = readMeals(form);
    totalEl.textContent = ft(personTotal({ meals }));
  };

  const saveBtn = h('button', { class: 'btn btn-primary', type: 'submit', text: t('save') });
  form.append(
    h('div', { class: 'sheet-head' },
      h('h2', { id: 'editor-title', text: person ? t('editTitle') : t('newTitle') }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('close'), onclick: () => dlg.close() }, icon('close'))),
    h('div', { class: 'sheet-body' },
      h('label', { class: 'field' }, h('span', { class: 'field-label', text: t('name') }), nameInput, nameError),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: t('diet') }), dietSeg),
      dayBlocks),
    h('div', { class: 'sheet-foot' },
      h('p', { class: 'sheet-total' }, h('span', { class: 'muted', text: t('total') }), totalEl),
      h('div', { class: 'sheet-buttons' },
        h('button', { class: 'btn btn-ghost', type: 'button', text: t('cancel'), onclick: () => dlg.close() }),
        saveBtn))
  );
  form.addEventListener('change', updateTotal);
  nameInput.addEventListener('input', () => { nameError.hidden = true; nameInput.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.replace(/\s+/g, ' ').trim();
    if (!name) {
      nameError.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    const payload = {
      id: editing?.id || '',
      name,
      diet: form.querySelector('input[name=diet]:checked')?.value === 'veg' ? 'veg' : 'meat',
      meals: readMeals(form),
    };
    saveBtn.disabled = true;
    saveBtn.textContent = t('saving');
    try {
      const res = await store.save(payload);
      if (!payload.id && res.id) {
        state.mine.add(res.id);
        writeLS(KEYS.mine, [...state.mine]);
      }
      applyPeople(res.people, true);
      dlg.close();
      toast(t('saved'));
    } catch (err) {
      console.error(err);
      toast(t('saveError'), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = t('save');
    }
  });

  dlg.replaceChildren(form);
  dlg.setAttribute('aria-labelledby', 'editor-title');
  updateTotal();
  dlg.showModal();
  if (!person) nameInput.focus();
}

function readMeals(form) {
  const meals = {};
  for (const it of ITEMS) meals[it.id] = Boolean(form.querySelector(`input[name="${it.id}"]`)?.checked);
  return meals;
}

function confirmDialog(message, confirmLabel) {
  const dlg = $('#confirm');
  return new Promise((resolve) => {
    const done = (val) => {
      dlg.close();
      resolve(val);
    };
    dlg.replaceChildren(
      h('div', { class: 'confirm-body' },
        h('p', { text: message }),
        h('div', { class: 'sheet-buttons' },
          h('button', { class: 'btn btn-ghost', type: 'button', text: t('cancel'), onclick: () => done(false) }),
          h('button', { class: 'btn btn-danger', type: 'button', text: confirmLabel, onclick: () => done(true) })))
    );
    dlg.addEventListener('cancel', () => resolve(false), { once: true });
    dlg.showModal();
  });
}

async function deletePerson(p) {
  if (!(await confirmDialog(t('confirmDelete', p.name), t('del')))) return;
  try {
    const res = await store.remove(p.id);
    state.mine.delete(p.id);
    writeLS(KEYS.mine, [...state.mine]);
    applyPeople(res.people, true);
    toast(t('deleted'));
  } catch (err) {
    console.error(err);
    toast(t('deleteError'), 'error');
  }
}

/* ---------- data sync ---------- */
function applyPeople(raw, fromWrite = false) {
  const people = sortPeople((raw || []).map(normalizePerson).filter((p) => p.id && p.name));
  const sig = JSON.stringify(people.map((p) => [p.id, p.name, p.diet, p.meals]));
  state.lastSync = new Date();
  state.status = 'ok';
  if (sig !== state.sig) {
    state.people = people;
    state.sig = sig;
    updateView();
  }
  renderStatus();
  if (fromWrite) refresh();
}

async function refresh() {
  if (state.inflight) return;
  state.inflight = true;
  if (!state.lastSync) {
    state.status = 'syncing';
    renderStatus();
  }
  try {
    const res = await store.list();
    state.inflight = false;
    applyPeople(res.people);
  } catch (err) {
    console.error(err);
    state.inflight = false;
    state.status = 'error';
    renderStatus();
    if (state.sig === null) {
      state.sig = '';
      updateView();
      toast(t('loadError'), 'error');
    }
  }
}

/* ---------- boot ---------- */
function boot() {
  $('#langBtn').addEventListener('click', () => {
    state.lang = state.lang === 'hu' ? 'en' : 'hu';
    writeLS(KEYS.lang, state.lang);
    renderShell();
  });
  $('#statusBtn').addEventListener('click', () => refresh());
  $('#fab').addEventListener('click', () => openEditor());
  for (const id of ['#editor', '#confirm']) {
    $(id).addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.close();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('online', () => refresh());
  window.addEventListener('focus', () => refresh());
  setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, POLL_MS);

  renderShell();
  refresh();
}

boot();

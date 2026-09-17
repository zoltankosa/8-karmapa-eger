import { DAYS, ITEMS, foldText, normalizePerson, personTotal, sortPeople, summarize } from './calc.js';
import { API_URL } from './config.js';
import { createStore } from './store.js';
import {
  $, confirmDialog, dayLabel, disclosure, ft, fullItemLabel, h, icon, initShell, itemLabel, liveSync, mine, t, toast,
} from './ui.js';

const store = createStore(API_URL);
const state = { people: null, query: '', filter: 'all', open: new Set() };

function mount() {
  const filter = h('select', {
    id: 'filter', class: 'input',
    onchange: (e) => { state.filter = e.target.value; update(); },
  },
  h('option', { value: 'all', text: t('filterAll') }),
  DAYS.map((d) =>
    h('optgroup', { label: `${dayLabel(d)} · ${t('dayDates')[d]}` },
      ITEMS.filter((it) => it.day === d).map((it) => h('option', { value: it.id, text: fullItemLabel(it) })))));
  filter.value = state.filter;

  const search = h('input', {
    id: 'search', class: 'input', type: 'search', placeholder: t('searchPh'), autocomplete: 'off', value: state.query,
    oninput: (e) => { state.query = e.target.value; update(); },
  });

  $('#view').replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', { text: t('pageTitles').people }),
      h('p', { class: 'lead', text: t('peopleIntro') })),
    h('section', { class: 'stack' },
      h('div', { class: 'toolbar' },
        h('label', { class: 'field' }, h('span', { class: 'field-label', text: t('filter') }), filter),
        h('label', { class: 'field' }, h('span', { class: 'field-label', text: t('search') }), search)),
      h('div', { class: 'summary-strip', id: 'peopleSummary', 'aria-live': 'polite' }),
      h('div', { id: 'peopleList', class: 'list' })));
  update();
}

function update() {
  const list = $('#peopleList');
  if (!list) return;
  if (state.people === null) {
    list.replaceChildren(h('p', { class: 'muted center pad', text: t('loading') }));
    return;
  }
  const sum = summarize(state.people);
  const q = foldText(state.query.trim());
  const shown = state.people.filter(
    (p) => (state.filter === 'all' || p.meals[state.filter]) && (!q || foldText(p.name).includes(q)));

  const parts = [
    h('strong', { text: t('peopleCount', sum.people) }),
    h('span', { text: `${t('meat')} ${sum.meat}` }),
    h('span', { text: `${t('veg')} ${sum.veg}` }),
  ];
  if (state.filter !== 'all' || q) {
    const fs = summarize(shown);
    parts.push(h('span', { class: 'accent', text: `${t('filtered', shown.length)}: ${t('meat').toLowerCase()} ${fs.meat}, ${t('vegShort').toLowerCase()} ${fs.veg}` }));
  }
  $('#peopleSummary').replaceChildren(...parts);

  if (!state.people.length) {
    list.replaceChildren(h('div', { class: 'empty' },
      h('p', { class: 'empty-title', text: t('emptyTitle') }),
      h('p', {}, h('a', { class: 'link', href: './' }, t('emptyBody')))));
    return;
  }
  if (!shown.length) {
    list.replaceChildren(h('div', { class: 'empty' }, h('p', { text: t('noMatch') })));
    return;
  }
  list.replaceChildren(...shown.map(row));
}

function row(p) {
  const own = mine.has(p.id);
  const byDay = DAYS.map((d) => {
    const picked = ITEMS.filter((it) => it.day === d && p.meals[it.id]);
    if (!picked.length) return null;
    return h('div', { class: 'kv' },
      h('span', { class: 'kv-key', text: dayLabel(d) }),
      h('span', { class: 'kv-val', text: picked.map(itemLabel).join(', ') }),
      h('span', { class: 'num', text: ft(picked.reduce((s, it) => s + it.price, 0)) }));
  }).filter(Boolean);

  return disclosure(state.open, `p:${p.id}`,
    [
      h('span', { class: 'person-name' }, p.name, own ? h('span', { class: 'tag', text: t('mine') }) : null),
      h('span', { class: `diet diet-${p.diet}`, text: p.diet === 'veg' ? t('veg') : t('meat') }),
      h('span', { class: 'num person-total', text: ft(personTotal(p)) }),
    ],
    [
      byDay.length ? h('div', { class: 'kv-list' }, byDay) : h('p', { class: 'muted', text: t('noItems') }),
      own
        ? h('div', { class: 'row-actions' },
          h('a', { class: 'btn btn-ghost', href: `./?edit=${encodeURIComponent(p.id)}` }, icon('edit'), t('edit')),
          h('button', { class: 'btn btn-ghost danger', type: 'button', onclick: () => remove(p) }, icon('trash'), t('del')))
        : null,
    ],
    'person');
}

async function remove(p) {
  if (!(await confirmDialog(t('confirmDelete', p.name), t('del')))) return;
  try {
    const res = await store.remove(p.id);
    mine.remove(p.id);
    sync.apply(res.people);
    toast(t('deleted'));
  } catch (err) {
    console.error(err);
    toast(t('deleteError'), 'error');
  }
}

initShell('people', mount, store);
const sync = liveSync(store, (raw) => {
  if (raw === null) {
    state.people = [];
    toast(t('loadError'), 'error');
  } else {
    state.people = sortPeople(raw.map(normalizePerson).filter((p) => p.id && p.name));
  }
  update();
});
$('#langBtn').addEventListener('click', () => sync.repaint());

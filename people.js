import { DAYS, ITEMS, normalizePerson, sortPeople } from './calc.js';
import { API_URL } from './config.js';
import { createStore } from './store.js';
import { $, dayLabel, fullItemLabel, h, icon, initShell, liveSync, mine, t, toast } from './ui.js';

const store = createStore(API_URL);
const state = { people: null, filter: 'all' };

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

  $('#view').replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', { text: t('pageTitles').people }),
      h('p', { class: 'lead', text: t('peopleIntro') })),
    h('section', { class: 'stack' },
      h('label', { class: 'field' }, h('span', { class: 'field-label', text: t('filter') }), filter),
      h('p', { class: 'count', id: 'peopleCount', 'aria-live': 'polite' }),
      h('div', { id: 'peopleList' })));
  update();
}

function update() {
  const list = $('#peopleList');
  if (!list) return;
  if (state.people === null) {
    $('#peopleCount').textContent = '';
    list.replaceChildren(h('p', { class: 'muted center pad', text: t('loading') }));
    return;
  }
  const shown = state.people.filter((p) => state.filter === 'all' || p.meals[state.filter]);
  $('#peopleCount').textContent = t('peopleCount', shown.length);

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
  list.replaceChildren(
    h('ol', { class: 'roster' },
      shown.map((p) =>
        h('li', {},
          h('span', { class: 'roster-name', text: p.name }),
          mine.has(p.id)
            ? h('a', { class: 'link small', href: `./?edit=${encodeURIComponent(p.id)}` }, t('edit'), icon('arrow', 'icon icon-sm'))
            : null))));
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

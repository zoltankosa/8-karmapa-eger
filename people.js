import { normalizePerson, sortPeople } from './calc.js?v=202609221409';
import { API_URL } from './config.js?v=202609221409';
import { createStore } from './store.js?v=202609221409';
import { $, h, icon, initShell, liveSync, mine, t, toast } from './ui.js?v=202609221409';

const store = createStore(API_URL);
const state = { people: null };

function mount() {
  $('#view').replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', { text: t('pageTitles').people }),
      h('p', { class: 'lead', text: t('peopleIntro') })),
    h('section', { class: 'stack' },
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
  $('#peopleCount').textContent = t('peopleCount', state.people.length);
  if (!state.people.length) {
    list.replaceChildren(h('div', { class: 'empty' },
      h('p', { class: 'empty-title', text: t('emptyTitle') }),
      h('p', {}, h('a', { class: 'link', href: './' }, t('emptyBody')))));
    return;
  }
  list.replaceChildren(
    h('ol', { class: 'roster' },
      state.people.map((p) =>
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

import { DAYS, normalizePerson, summarize } from './calc.js?v=202609171215';
import { API_URL } from './config.js?v=202609171215';
import { createStore } from './store.js?v=202609171215';
import { $, dayLabel, h, initShell, liveSync, nf, t, toast } from './ui.js?v=202609171215';

const store = createStore(API_URL);
const state = { people: null };

function mount() {
  $('#view').replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', { text: t('pageTitles').kitchen }),
      h('p', { class: 'lead', text: t('kitchenIntro') })),
    h('section', { class: 'stack' },
      h('div', { id: 'kpis', class: 'kpis kpis-3' }),
      h('div', { id: 'kitchenDays', class: 'stack' })));
  update();
}

const stat = (label, value, cls = '') =>
  h('div', { class: `stat ${cls}` }, h('span', { class: 'stat-value num', text: nf.format(value) }), h('span', { class: 'stat-label', text: label }));

function update() {
  if (!$('#kpis')) return;
  if (state.people === null) {
    $('#kitchenDays').replaceChildren(h('p', { class: 'muted center pad', text: t('loading') }));
    return;
  }
  const sum = summarize(state.people);
  $('#kpis').replaceChildren(
    h('div', { class: 'kpi' }, h('p', { class: 'kpi-label', text: t('attendees') }), h('p', { class: 'kpi-value num', text: nf.format(sum.people) })),
    h('div', { class: 'kpi' }, h('p', { class: 'kpi-label', text: t('meat') }), h('p', { class: 'kpi-value num', text: nf.format(sum.meat) })),
    h('div', { class: 'kpi' }, h('p', { class: 'kpi-label', text: t('veg') }), h('p', { class: 'kpi-value num', text: nf.format(sum.veg) })));

  $('#kitchenDays').replaceChildren(
    h('p', { class: 'eyebrow', text: t('perDay') }),
    ...DAYS.map((d) => {
      const s = sum.days[d];
      return h('article', { class: 'day-card' },
        h('div', { class: 'day-card-head' },
          h('h2', {}, dayLabel(d), h('span', { class: 'muted', text: t('dayDates')[d] }))),
        h('div', { class: 'stats' },
          stat(t('persons'), s.eating, 'stat-main'),
          stat(t('meat'), s.meat),
          stat(t('veg'), s.veg, 'stat-veg')));
    }));
}

initShell('kitchen', mount, store);
const sync = liveSync(store, (raw) => {
  if (raw === null) {
    state.people = [];
    toast(t('loadError'), 'error');
  } else {
    state.people = raw.map(normalizePerson).filter((p) => p.id && p.name);
  }
  update();
});
$('#langBtn').addEventListener('click', () => sync.repaint());

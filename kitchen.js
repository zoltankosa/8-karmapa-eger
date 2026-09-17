import { DAYS, ITEMS, normalizePerson, summarize } from './calc.js';
import { API_URL } from './config.js';
import { createStore } from './store.js';
import {
  $, dayLabel, disclosure, ft, fullItemLabel, h, icon, initShell, itemLabel, liveSync, nf, t, timeStr, toast,
} from './ui.js';

const store = createStore(API_URL);
const state = { people: null, open: new Set() };

function mount() {
  $('#view').replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', { text: t('pageTitles').kitchen }),
      h('p', { class: 'lead', text: t('kitchenIntro') })),
    h('section', { class: 'stack' },
      h('div', { id: 'kpis', class: 'kpis' }),
      h('div', { id: 'kitchenDays', class: 'stack' }),
      h('div', { id: 'shopping' }),
      h('div', { id: 'money' })));
  update();
}

function nameColumns(s) {
  const col = (label, names) =>
    h('div', { class: 'names-col' },
      h('p', { class: 'names-head', text: `${label} (${names.length})` }),
      names.length
        ? h('ol', { class: 'names' }, names.map((n) => h('li', { text: n })))
        : h('p', { class: 'muted small', text: t('nobody') }));
  return h('div', { class: 'names-grid' }, col(t('meat'), s.names.meat), col(t('veg'), s.names.veg));
}

function splitBar(s) {
  const pct = s.count ? Math.round((s.meat / s.count) * 100) : 0;
  return h('div', { class: 'split', role: 'img', 'aria-label': `${t('meat')} ${s.meat}, ${t('veg')} ${s.veg}` },
    h('span', { class: 'split-meat', style: `width:${s.count ? pct : 0}%` }),
    h('span', { class: 'split-veg', style: `width:${s.count ? 100 - pct : 0}%` }));
}

function update() {
  if (!$('#kpis')) return;
  if (state.people === null) {
    $('#kitchenDays').replaceChildren(h('p', { class: 'muted center pad', text: t('loading') }));
    return;
  }
  const sum = summarize(state.people);
  const kpi = (label, value) =>
    h('div', { class: 'kpi' }, h('p', { class: 'kpi-label', text: label }), h('p', { class: 'kpi-value num', text: value }));
  $('#kpis').replaceChildren(
    kpi(t('attendees'), nf.format(sum.people)),
    kpi(t('meat'), nf.format(sum.meat)),
    kpi(t('veg'), nf.format(sum.veg)),
    kpi(t('revenue'), ft(sum.total)));

  $('#kitchenDays').replaceChildren(
    ...DAYS.map((d) =>
      h('section', { class: 'day' },
        h('h2', { class: 'day-head' }, dayLabel(d), h('span', { class: 'muted', text: t('dayDates')[d] })),
        h('div', { class: 'meal-grid' },
          ITEMS.filter((it) => it.day === d).map((it) => {
            const s = sum.items[it.id];
            return h('article', { class: `meal${it.food ? '' : ' meal-room'}` },
              h('div', { class: 'meal-top' },
                h('p', { class: 'meal-label', text: itemLabel(it) }),
                h('p', { class: 'meal-count' },
                  h('span', { class: 'num', text: nf.format(s.count) }), ` ${it.food ? t('portions') : t('beds')}`)),
              splitBar(s),
              h('p', { class: 'meal-split' },
                h('span', {}, h('i', { class: 'swatch swatch-meat' }), `${t('meat')} `, h('b', { class: 'num', text: s.meat })),
                h('span', {}, h('i', { class: 'swatch swatch-veg' }), `${t('veg')} `, h('b', { class: 'num', text: s.veg }))),
              disclosure(state.open, `k:${it.id}`, [h('span', { text: `${t('names')} (${s.count})` })], [nameColumns(s)], 'compact'));
          })))));

  const foodItems = ITEMS.filter((it) => it.food);
  $('#shopping').replaceChildren(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {}, h('h2', { text: t('shopping') }), h('p', { class: 'muted', text: t('shoppingHint') })),
        h('div', { class: 'card-actions no-print' },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => copySummary(sum) }, icon('copy'), t('copy')),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => window.print() }, icon('print'), t('print')))),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col', text: t('meal') }),
            h('th', { scope: 'col', class: 'num', text: t('meat') }),
            h('th', { scope: 'col', class: 'num', text: t('vegShort') }),
            h('th', { scope: 'col', class: 'num', text: t('total') }))),
          h('tbody', {}, foodItems.map((it) => {
            const s = sum.items[it.id];
            return h('tr', {},
              h('th', { scope: 'row', text: fullItemLabel(it) }),
              h('td', { class: 'num', text: s.meat }),
              h('td', { class: 'num', text: s.veg }),
              h('td', { class: 'num strong', text: s.count }));
          })),
          h('tfoot', {}, h('tr', {},
            h('th', { scope: 'row', text: t('portionsTotal') }),
            h('td', { class: 'num', text: foodItems.reduce((a, it) => a + sum.items[it.id].meat, 0) }),
            h('td', { class: 'num', text: foodItems.reduce((a, it) => a + sum.items[it.id].veg, 0) }),
            h('td', { class: 'num strong', text: sum.portions })))))));

  $('#money').replaceChildren(
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: t('money') })),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col', text: t('meal') }),
            h('th', { scope: 'col', class: 'num', text: t('qty') }),
            h('th', { scope: 'col', class: 'num', text: t('amount') }))),
          h('tbody', {}, ITEMS.map((it) => {
            const s = sum.items[it.id];
            return h('tr', {},
              h('th', { scope: 'row' }, fullItemLabel(it), h('span', { class: 'muted small', text: ` · ${ft(it.price)}` })),
              h('td', { class: 'num', text: s.count }),
              h('td', { class: 'num', text: ft(s.revenue) }));
          })),
          h('tfoot', {},
            h('tr', {}, h('th', { scope: 'row', colspan: '2', text: t('foodTotal') }), h('td', { class: 'num', text: ft(sum.food) })),
            h('tr', {}, h('th', { scope: 'row', colspan: '2', text: t('roomTotal') }), h('td', { class: 'num', text: ft(sum.room) })),
            h('tr', { class: 'grand' },
              h('th', { scope: 'row', colspan: '2', text: t('grandTotal') }),
              h('td', { class: 'num strong', text: ft(sum.total) })))))));
}

async function copySummary(sum) {
  const lines = [t('shareTitle', timeStr(sync.state.lastSync || new Date()))];
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

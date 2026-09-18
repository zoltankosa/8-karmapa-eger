import { API_URL } from './config.js?v=202609180904';
import { PROGRAM } from './program.js?v=202609180904';
import { createStore } from './store.js?v=202609180904';
import { $, dayLabel, getLang, h, initShell, outbox, t } from './ui.js?v=202609180904';

function mount() {
  const col = getLang() === 'hu' ? 1 : 2;
  $('#view').replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', { text: t('pageTitles').program }),
      h('p', { class: 'lead', text: t('programIntro') })),
    h('section', { class: 'stack' },
      PROGRAM.map((day) =>
        h('section', { class: 'card program' },
          h('h2', { class: 'prog-day' }, dayLabel(day.day), h('span', { class: 'muted', text: t('dayDates')[day.day] })),
          h('ol', { class: 'timeline' },
            day.items.map((row) =>
              h('li', {}, h('span', { class: 'time num', text: row[0] }), h('span', { text: row[col] }))))))));
}

initShell('program', mount, null);
outbox.attach(createStore(API_URL));

import { DAYS, ITEMS, foldText, normalizePerson, personTotal } from './calc.js?v=202609171226';
import { API_URL } from './config.js?v=202609171226';
import { createStore } from './store.js?v=202609171226';
import {
  $, cache, confirmDialog, dayLabel, ft, h, icon, initShell, itemLabel, mine, newId, outbox, overlay, t,
} from './ui.js?v=202609171226';

const store = createStore(API_URL);
const editId = new URLSearchParams(location.search).get('edit') || '';

const emptyDraft = () => ({ id: '', name: '', diet: 'meat', meals: Object.fromEntries(ITEMS.map((it) => [it.id, false])) });

const view = {
  mode: editId ? 'loading' : 'form', // form | loading | notfound | loaderror | done | deleted
  draft: emptyDraft(),
  people: null,
  saved: null,
  wasEdit: false,
  nameError: false,
};

const editLink = (id) => `./?edit=${encodeURIComponent(id)}`;

function setMode(mode) {
  view.mode = mode;
  render();
  window.scrollTo({ top: 0 });
}

function startNew() {
  view.draft = emptyDraft();
  view.nameError = false;
  history.replaceState(null, '', './');
  setMode('form');
  $('#f-name')?.focus();
}

function render() {
  const main = $('#view');
  document.body.classList.toggle('has-submitbar', view.mode === 'form');
  if (view.mode === 'loading') {
    main.replaceChildren(h('p', { class: 'muted center pad', text: t('loading') }));
  } else if (view.mode === 'notfound') {
    main.replaceChildren(message(t('notFound')));
  } else if (view.mode === 'loaderror') {
    main.replaceChildren(message(t('loadError')));
  } else if (view.mode === 'deleted') {
    main.replaceChildren(message(t('deletedTitle')));
  } else if (view.mode === 'done') {
    main.replaceChildren(doneView());
  } else {
    main.replaceChildren(formView());
  }
}

function message(text) {
  return h('section', { class: 'done' },
    h('p', { class: 'done-lead', text }),
    h('div', { class: 'button-col' },
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: startNew }, icon('plus'), t('another'))));
}

function yourRegistrations() {
  const entries = Object.entries(mine.all());
  if (!entries.length || view.draft.id) return null;
  return h('section', { class: 'yours' },
    h('p', { class: 'eyebrow', text: t('yours') }),
    h('ul', { class: 'yours-list' },
      entries.map(([id, name]) =>
        h('li', {},
          h('span', {}, name, outbox.isPending(id) ? h('span', { class: 'tag tag-pending', text: t('pendingTag') }) : null),
          h('a', { class: 'link', href: editLink(id) }, t('edit'), icon('arrow', 'icon icon-sm'))))));
}

function formView() {
  const d = view.draft;
  const isEdit = Boolean(d.id);

  const nameInput = h('input', {
    id: 'f-name',
    class: 'input input-lg',
    name: 'name',
    maxlength: '80',
    autocomplete: 'name',
    autocapitalize: 'words',
    enterkeyhint: 'done',
    placeholder: t('namePh'),
    value: d.name,
    'aria-invalid': view.nameError ? 'true' : null,
    'aria-describedby': 'f-name-err',
    oninput: (e) => {
      d.name = e.target.value;
      if (view.nameError) {
        view.nameError = false;
        e.target.removeAttribute('aria-invalid');
        $('#f-name-err').hidden = true;
      }
    },
  });

  const dietSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('diet') },
    ['meat', 'veg'].map((v) =>
      h('label', { class: 'seg-opt' },
        h('input', {
          type: 'radio', name: 'diet', value: v, checked: d.diet === v,
          onchange: () => { d.diet = v; },
        }),
        h('span', { text: v === 'veg' ? t('veg') : t('meat') }))));

  const totalEl = h('span', { class: 'num total-val', text: ft(personTotal(d)) });
  const refreshTotals = () => {
    totalEl.textContent = ft(personTotal(d));
    for (const btn of document.querySelectorAll('[data-toggle-day]')) {
      const day = btn.dataset.toggleDay;
      const allOn = ITEMS.filter((it) => it.day === day).every((it) => d.meals[it.id]);
      btn.textContent = allOn ? t('none') : t('all');
    }
  };

  const days = DAYS.map((day) => {
    const items = ITEMS.filter((it) => it.day === day);
    const allOn = items.every((it) => d.meals[it.id]);
    return h('fieldset', { class: 'day-set' },
      h('legend', { class: 'day-legend' },
        h('span', { class: 'day-name' }, dayLabel(day), h('span', { class: 'muted', text: ` · ${t('dayDates')[day]}` })),
        h('button', {
          class: 'link-btn', type: 'button', dataset: { toggleDay: day }, text: allOn ? t('none') : t('all'),
          onclick: (e) => {
            const next = !items.every((it) => d.meals[it.id]);
            for (const it of items) {
              d.meals[it.id] = next;
              e.target.closest('fieldset').querySelector(`input[name="${it.id}"]`).checked = next;
            }
            refreshTotals();
          },
        })),
      items.map((it) =>
        h('label', { class: 'switch-row' },
          h('span', { class: 'switch-text' },
            h('span', { class: 'switch-label', text: itemLabel(it) }),
            h('span', { class: 'muted num', text: ft(it.price) })),
          h('input', {
            type: 'checkbox', class: 'switch', name: it.id, checked: d.meals[it.id],
            onchange: (e) => { d.meals[it.id] = e.target.checked; refreshTotals(); },
          }))));
  });

  const submitLabel = isEdit ? t('saveChanges') : t('submit');
  const form = h('form', { id: 'regForm', class: 'reg', novalidate: true, onsubmit: onSubmit },
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: 'f-name', text: t('name') }),
      nameInput,
      h('p', { class: 'field-error', id: 'f-name-err', hidden: !view.nameError, text: t('nameRequired') })),
    h('div', { class: 'field' },
      h('span', { class: 'field-label', text: t('diet') }),
      dietSeg),
    h('div', { class: 'field' },
      h('span', { class: 'field-label', text: t('choose') }),
      h('div', { class: 'days' }, days)),
    isEdit
      ? h('div', { class: 'edit-extra' },
        h('a', { class: 'link', href: './', text: t('cancel') }),
        h('button', { class: 'link-btn danger', type: 'button', onclick: onDelete }, icon('trash', 'icon icon-sm'), t('cancelRegistration')))
      : null,
    h('div', { class: 'submitbar' },
      h('div', { class: 'submitbar-inner' },
        h('p', { class: 'total' }, h('span', { class: 'total-label', text: t('total') }), totalEl),
        h('button', { class: 'btn btn-primary btn-wide', type: 'submit', text: submitLabel }))));

  return h('div', { class: 'register' },
    h('header', { class: 'page-head' },
      h('h1', { text: isEdit ? t('editTitle') : t('pageTitles').register }),
      h('p', { class: 'lead', text: isEdit ? t('editIntro') : t('registerIntro') })),
    yourRegistrations(),
    form);
}

function doneView() {
  const p = view.saved;
  const rows = DAYS.map((day) => {
    const picked = ITEMS.filter((it) => it.day === day && p.meals[it.id]);
    if (!picked.length) return null;
    return h('div', { class: 'kv' },
      h('span', { class: 'kv-key', text: dayLabel(day) }),
      h('span', { class: 'kv-val', text: picked.map(itemLabel).join(', ') }),
      h('span', { class: 'num', text: ft(picked.reduce((s, it) => s + it.price, 0)) }));
  }).filter(Boolean);

  return h('section', { class: 'done' },
    h('div', { class: 'done-badge' }, icon('check', 'icon icon-xl')),
    h('h1', { text: view.wasEdit ? t('updatedTitle') : t('doneTitle', p.name) }),
    h('p', { class: 'lead', text: t('doneBody') }),
    h('div', { id: 'saveStatus', class: 'save-status', 'aria-live': 'polite' }, saveStatus(p.id)),
    h('div', { class: 'receipt' },
      h('div', { class: 'receipt-head' },
        h('span', { class: 'receipt-name', text: p.name }),
        h('span', { class: `diet diet-${p.diet}`, text: p.diet === 'veg' ? t('veg') : t('meat') })),
      rows.length ? h('div', { class: 'kv-list' }, rows) : h('p', { class: 'muted', text: t('nothingPicked') }),
      h('div', { class: 'receipt-total' }, h('span', { text: t('total') }), h('span', { class: 'num', text: ft(personTotal(p)) }))),
    h('div', { class: 'button-col' },
      h('a', { class: 'btn btn-ghost btn-block', href: editLink(p.id) }, icon('edit'), t('edit')),
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: startNew }, icon('plus'), t('another')),
      h('p', { class: 'muted center small', text: t('anotherHint') }),
      h('a', { class: 'link center', href: 'program.html' }, t('seeProgram'), icon('arrow', 'icon icon-sm'))));
}

function saveStatus(id) {
  if (!outbox.isPending(id)) {
    return [h('span', { class: 'save-ok' }, icon('check', 'icon icon-sm'), t('savedStatus'))];
  }
  if (outbox.failing) {
    return [
      h('span', { class: 'save-wait' }, t('retrying')),
      h('button', { class: 'link-btn', type: 'button', text: t('retry'), onclick: () => outbox.flush() }),
    ];
  }
  return [h('span', { class: 'save-wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), t('savingStatus'))];
}

function onSubmit(e) {
  e.preventDefault();
  const d = view.draft;
  const name = d.name.replace(/\s+/g, ' ').trim();
  if (!name) {
    view.nameError = true;
    const input = $('#f-name');
    input.setAttribute('aria-invalid', 'true');
    $('#f-name-err').hidden = false;
    input.focus();
    return;
  }
  const finish = () => {
    const person = { id: d.id || newId(), name, diet: d.diet, meals: { ...d.meals } };
    mine.set(person.id, name);
    outbox.add({ type: 'save', person });
    view.people = overlay(cache.get() || []);
    view.wasEdit = Boolean(d.id);
    view.saved = normalizePerson(person);
    view.draft = emptyDraft();
    history.replaceState(null, '', './');
    setMode('done');
  };
  const dup = !d.id && view.people?.some((p) => foldText(p.name) === foldText(name));
  if (!dup) return finish();
  confirmDialog(t('dupName', name), t('addAnyway')).then((ok) => { if (ok) finish(); });
}

async function onDelete() {
  const d = view.draft;
  if (!(await confirmDialog(t('confirmDelete', d.name), t('del')))) return;
  outbox.add({ type: 'delete', id: d.id });
  mine.remove(d.id);
  view.people = overlay(cache.get() || []);
  view.draft = emptyDraft();
  history.replaceState(null, '', './');
  setMode('deleted');
}

function useList(list, final) {
  view.people = list;
  if (!editId || view.mode !== 'loading') return;
  const found = list?.find((p) => p.id === editId);
  if (found) {
    const p = normalizePerson(found);
    view.draft = { id: p.id, name: p.name, diet: p.diet, meals: { ...p.meals } };
    setMode('form');
  } else if (final && list) {
    mine.remove(editId);
    setMode('notfound');
  } else if (final) {
    setMode('loaderror');
  }
}

async function load() {
  const cached = cache.get();
  if (cached) useList(overlay(cached), false);
  try {
    const res = await store.list();
    cache.set(res.people || []);
    useList(overlay(res.people || []), true);
  } catch (err) {
    console.error(err);
    useList(cached ? overlay(cached) : null, true);
  }
}

outbox.onChange(() => {
  const box = $('#saveStatus');
  if (box && view.saved) box.replaceChildren(...saveStatus(view.saved.id));
  const yours = $('.yours');
  if (yours && view.mode === 'form') yours.replaceWith(yourRegistrations() || '');
});

initShell('register', render, store);
outbox.attach(store);
load();

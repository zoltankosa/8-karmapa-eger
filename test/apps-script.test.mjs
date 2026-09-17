// Runs Code.gs against a small in-memory stand-in for the Google Sheets API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function fakeSheet() {
  const rows = [];
  let frozen = 0;
  const sheet = {
    rows,
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    getDataRange() {
      const width = Math.max(1, ...rows.map((r) => r.length));
      return sheet.getRange(1, 1, Math.max(1, rows.length), width);
    },
    setFrozenRows: (n) => { frozen = n; },
    get frozen() { return frozen; },
    deleteRow: (r) => rows.splice(r - 1, 1),
    getRange(row, col, numRows = 1, numCols = 1) {
      const range = {
        setValues(values) {
          values.forEach((vals, i) => {
            const r = row - 1 + i;
            while (rows.length <= r) rows.push([]);
            vals.forEach((v, j) => {
              if (typeof v === 'string' && v.startsWith('=')) throw new Error('formula written');
              rows[r][col - 1 + j] = v;
            });
          });
          return range;
        },
        setValue(v) { return range.setValues([[v]]); },
        getValues() {
          return Array.from({ length: numRows }, (_, i) =>
            Array.from({ length: numCols }, (_, j) => rows[row - 1 + i]?.[col - 1 + j] ?? ''));
        },
        setFontWeight: () => range,
        setNumberFormat: () => range,
      };
      return range;
    },
  };
  return sheet;
}

function loadScript() {
  const sheet = fakeSheet();
  let uuid = 0;
  const props = new Map();
  const cacheStore = new Map();
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cacheStore.get(k) ?? null, put: (k, v) => cacheStore.set(k, v) }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }),
      flush: () => {},
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}` },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);
  const call = (method, body) => JSON.parse(ctx[method](body ? { postData: { contents: JSON.stringify(body) } } : {}).text);
  return { sheet, call, cacheStore };
}

test('create, list, edit, delete', () => {
  const { sheet, call } = loadScript();
  assert.deepEqual(call('doGet').people, []);

  const created = call('doPost', { action: 'save', person: { name: '  Kiss  Anna ', diet: 'veg', meals: { fri_dinner: true, sat_room: true } } });
  assert.equal(created.ok, true);
  assert.ok(created.id);
  assert.equal(created.people.length, 1);
  const p = created.people[0];
  assert.equal(p.name, 'Kiss Anna');
  assert.equal(p.diet, 'veg');
  assert.equal(p.meals.fri_dinner, true);
  assert.equal(p.meals.sat_room, true);
  assert.equal(p.meals.sun_lunch, false);
  assert.equal(sheet.rows[0][0], 'ID');
  assert.equal(sheet.rows[1][11], 3800, 'total column');
  assert.equal(sheet.rows[1][2], 'vegetáriánus');

  const edited = call('doPost', { action: 'save', person: { id: created.id, name: 'Kiss Anna', diet: 'meat', meals: { sun_lunch: true } } });
  assert.equal(edited.people.length, 1);
  assert.equal(edited.people[0].diet, 'meat');
  assert.equal(edited.people[0].meals.fri_dinner, false);
  assert.equal(edited.people[0].meals.sun_lunch, true);
  assert.equal(sheet.rows[1][11], 1800);

  call('doPost', { action: 'save', person: { name: 'Nagy Béla', meals: {} } });
  const removed = call('doPost', { action: 'delete', id: created.id });
  assert.deepEqual(removed.people.map((x) => x.name), ['Nagy Béla']);
});

test('rejects bad input and neutralises formulas', () => {
  const { call } = loadScript();
  assert.equal(call('doPost', { action: 'save', person: { name: '   ' } }).ok, false);
  assert.equal(call('doPost', { action: 'nope' }).ok, false);
  const res = call('doPost', { action: 'save', person: { name: '=HYPERLINK("x")', meals: { fri_dinner: 'yes' } } });
  assert.equal(res.ok, true);
  assert.equal(res.people[0].name, 'HYPERLINK("x")');
  assert.equal(res.people[0].meals.fri_dinner, false, 'only real booleans count');
});

test('hand-edited sheet rows are read tolerantly', () => {
  const { sheet, call, cacheStore } = loadScript();
  call('doGet');
  sheet.rows.push(['manual-1', 'Kézi Péter', 'Vegetarian', 'x', '', 0, '1800', 'nem', '', '', '']);
  cacheStore.clear();
  const people = call('doGet').people;
  assert.equal(people[0].diet, 'veg');
  assert.equal(people[0].meals.fri_dinner, true);
  assert.equal(people[0].meals.sat_breakfast, false);
  assert.equal(people[0].meals.sat_lunch, true);
  assert.equal(people[0].meals.sat_dinner, false);
});

test('keeps a client-generated id and serves reads from the cache after a write', () => {
  const { sheet, call } = loadScript();
  const id = '3f1c2a9e-1111-4222-8333-444455556666';
  const res = call('doPost', { action: 'save', person: { id, name: 'Kliens Id', meals: { sat_lunch: true } } });
  assert.equal(res.id, id);
  sheet.rows[1][1] = 'Changed Behind Cache';
  assert.equal(call('doGet').people[0].name, 'Kliens Id', 'cached copy is served');
  const again = call('doPost', { action: 'save', person: { id, name: 'Kliens Id', meals: {} } });
  assert.equal(again.people.length, 1, 'same id updates, never duplicates');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, foldText, normalizePerson, personTotal, sortPeople, summarize } from '../calc.js';

const all = Object.fromEntries(ITEMS.map((it) => [it.id, true]));
const people = [
  normalizePerson({ id: '1', name: 'Anna', diet: 'meat', meals: { fri_dinner: true, fri_room: true, sat_lunch: true, sat_dinner: true, sat_room: true, sun_lunch: true } }),
  normalizePerson({ id: '2', name: 'Béla', diet: 'meat', meals: { fri_room: true, sat_room: true } }),
  normalizePerson({ id: '3', name: 'Cili', diet: 'veg', meals: all }),
];

test('prices match the spreadsheet', () => {
  assert.equal(personTotal(people[0]), 11200);
  assert.equal(personTotal(people[1]), 4000);
  assert.equal(personTotal(people[2]), 13200);
});

test('summary totals and diet split', () => {
  const s = summarize(people);
  assert.equal(s.people, 3);
  assert.equal(s.meat, 2);
  assert.equal(s.veg, 1);
  assert.equal(s.total, 28400);
  assert.equal(s.room, 12000);
  assert.equal(s.food, 16400);
  assert.equal(s.food + s.room, s.total);
  assert.deepEqual(
    ITEMS.map((it) => s.items[it.id].count),
    [2, 3, 1, 2, 2, 3, 1, 2]
  );
  assert.equal(s.items.fri_dinner.meat, 1);
  assert.equal(s.items.fri_dinner.veg, 1);
  assert.deepEqual(s.items.sat_room.names, { meat: ['Anna', 'Béla'], veg: ['Cili'] });
  assert.equal(s.portions, 10);
});

test('empty list', () => {
  const s = summarize([]);
  assert.equal(s.total, 0);
  assert.equal(s.people, 0);
  assert.equal(s.items.sun_lunch.count, 0);
});

test('normalizePerson is defensive', () => {
  const p = normalizePerson({ id: 7, name: '  Kiss   Éva ', diet: 'weird', meals: { fri_dinner: 1, bogus: true } });
  assert.equal(p.id, '7');
  assert.equal(p.name, 'Kiss Éva');
  assert.equal(p.diet, 'meat');
  assert.equal(p.meals.fri_dinner, true);
  assert.equal(p.meals.sat_lunch, false);
  assert.equal('bogus' in p.meals, false);
});

test('Hungarian sorting and accent-insensitive search', () => {
  const sorted = sortPeople([{ name: 'Zoltán' }, { name: 'Ádám' }, { name: 'Béla' }]).map((p) => p.name);
  assert.deepEqual(sorted, ['Ádám', 'Béla', 'Zoltán']);
  assert.ok(foldText('Minta Gábor').includes(foldText('gabor')));
});

export const DAYS = ['fri', 'sat', 'sun'];

export const ITEMS = [
  { id: 'fri_dinner', day: 'fri', kind: 'dinner', price: 1800, food: true },
  { id: 'fri_room', day: 'fri', kind: 'room', price: 2000, food: false },
  { id: 'sat_breakfast', day: 'sat', kind: 'breakfast', price: 1000, food: true },
  { id: 'sat_lunch', day: 'sat', kind: 'lunch', price: 1800, food: true },
  { id: 'sat_dinner', day: 'sat', kind: 'dinner', price: 1800, food: true },
  { id: 'sat_room', day: 'sat', kind: 'room', price: 2000, food: false },
  { id: 'sun_breakfast', day: 'sun', kind: 'breakfast', price: 1000, food: true },
  { id: 'sun_lunch', day: 'sun', kind: 'lunch', price: 1800, food: true },
];

const collator = new Intl.Collator('hu', { sensitivity: 'base' });

export function normalizePerson(raw) {
  const meals = {};
  for (const it of ITEMS) meals[it.id] = Boolean(raw?.meals?.[it.id]);
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? '').replace(/\s+/g, ' ').trim(),
    diet: raw?.diet === 'veg' ? 'veg' : 'meat',
    meals,
    updatedAt: String(raw?.updatedAt ?? ''),
  };
}

export function sortPeople(people) {
  return [...people].sort((a, b) => collator.compare(a.name, b.name));
}

export function personTotal(person) {
  return ITEMS.reduce((sum, it) => sum + (person.meals[it.id] ? it.price : 0), 0);
}

export function summarize(people) {
  const items = {};
  for (const it of ITEMS) {
    items[it.id] = { ...it, count: 0, meat: 0, veg: 0, revenue: 0, names: { meat: [], veg: [] } };
  }
  const days = Object.fromEntries(DAYS.map((d) => [d, { eating: 0, meat: 0, veg: 0 }]));
  const out = { people: people.length, meat: 0, veg: 0, total: 0, food: 0, room: 0, portions: 0, items, days };
  for (const p of people) {
    out[p.diet] += 1;
    for (const d of DAYS) {
      if (ITEMS.some((it) => it.day === d && it.food && p.meals[it.id])) {
        days[d].eating += 1;
        days[d][p.diet] += 1;
      }
    }
    for (const it of ITEMS) {
      if (!p.meals[it.id]) continue;
      const s = items[it.id];
      s.count += 1;
      s[p.diet] += 1;
      s.revenue += it.price;
      s.names[p.diet].push(p.name);
      out.total += it.price;
      if (it.food) {
        out.food += it.price;
        out.portions += 1;
      } else {
        out.room += it.price;
      }
    }
  }
  for (const s of Object.values(items)) {
    s.names.meat.sort(collator.compare);
    s.names.veg.sort(collator.compare);
  }
  return out;
}

export function foldText(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

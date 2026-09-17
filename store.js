const TIMEOUT_MS = 20000;
const DEMO_KEY = 'kbc.demo.people';

async function request(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Request failed');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Apps Script only answers "simple" CORS requests, so POST bodies go as text/plain.
function remoteStore(url) {
  const post = (payload) =>
    request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
  return {
    demo: false,
    async list() {
      const data = await request(`${url}?action=list&t=${Date.now()}`, { method: 'GET' });
      return { people: data.people };
    },
    async save(person) {
      const data = await post({ action: 'save', person });
      return { people: data.people, id: data.id };
    },
    async remove(id) {
      const data = await post({ action: 'delete', id });
      return { people: data.people };
    },
    beacon(op) {
      const payload = op.type === 'save' ? { action: 'save', person: op.person } : { action: 'delete', id: op.id };
      try {
        fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
      } catch {
        /* the queued copy will be sent on the next visit */
      }
    },
  };
}

function demoStore() {
  let storageOk = true;
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(DEMO_KEY)) || [];
    } catch {
      storageOk = false;
      return memory;
    }
  };
  const persist = (people) => {
    memory = people;
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(people));
    } catch {
      storageOk = false;
    }
  };
  let memory = [];
  memory = load();
  const newId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return {
    demo: true,
    async list() {
      if (storageOk) memory = load();
      return { people: memory };
    },
    async save(person) {
      const people = [...memory];
      const id = person.id || newId();
      const record = { ...person, id, updatedAt: new Date().toISOString() };
      const idx = people.findIndex((p) => p.id === id);
      if (idx >= 0) people[idx] = record;
      else people.push(record);
      persist(people);
      return { people, id };
    },
    async remove(id) {
      const people = memory.filter((p) => p.id !== id);
      persist(people);
      return { people };
    },
  };
}

export function createStore(url) {
  return url ? remoteStore(url) : demoStore();
}

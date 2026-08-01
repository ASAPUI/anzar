// ============================================================
// ANZAR — Storage (IndexedDB)
// Recovery-branch logic: versioned schema + migrations
// ============================================================

export const DB_NAME    = 'anzar';
export const DB_VERSION = 4; // bumped to add 'tasks' store

const SCHEMA = {
  1: {
    stores: [
      { name: 'notes',  keyPath: 'id', indexes: [{ name: 'updated', keyPath: 'updated', unique: false }] },
      { name: 'events', keyPath: 'id', indexes: [{ name: 'date',    keyPath: 'date',    unique: false }] }
    ]
  },
  2: {
    stores: [
      { name: 'graph', keyPath: 'id', indexes: [{ name: 'type', keyPath: 'type', unique: false }] }
    ]
  },
  3: {
    stores: [
      { name: 'today', keyPath: 'id' }
    ]
  },
  4: {
    stores: [
      // 'tasks' store mirrors the calendar tasks model
      { name: 'tasks', keyPath: 'id', indexes: [{ name: 'date', keyPath: 'date', unique: false }] },
      // 'folders' store for note folders
      { name: 'folders', keyPath: 'id' },
      // 'settings' store
      { name: 'settings', keyPath: 'id' }
    ]
  }
};

const MIGRATIONS = {
  1: (db) => {
    SCHEMA[1].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
      (s.indexes || []).forEach((idx) => store.createIndex(idx.name, idx.keyPath, { unique: idx.unique }));
    });
  },
  2: (db) => {
    SCHEMA[2].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
      (s.indexes || []).forEach((idx) => store.createIndex(idx.name, idx.keyPath, { unique: idx.unique }));
    });
  },
  3: (db) => {
    SCHEMA[3].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      db.createObjectStore(s.name, { keyPath: s.keyPath });
    });
  },
  4: (db) => {
    SCHEMA[4].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
      (s.indexes || []).forEach((idx) => store.createIndex(idx.name, idx.keyPath, { unique: idx.unique }));
    });
  }
};

let _db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      for (let v = e.oldVersion + 1; v <= e.newVersion; v++) {
        if (MIGRATIONS[v]) MIGRATIONS[v](database);
      }
    };
  });
}

export async function put(store, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function get(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function getAll(store, indexName, query) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readonly');
    const os = tx.objectStore(store);
    const source = indexName ? os.index(indexName) : os;
    const req = query ? source.getAll(query) : source.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror  = () => reject(req.error);
  });
}

export async function remove(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror  = () => reject(req.error);
  });
}

export async function clear(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror  = () => reject(req.error);
  });
}

// ---- Helpers ------------------------------------------------

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
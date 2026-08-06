const DB_NAME = 'anzar';
const DB_VERSION = 3;

const SCHEMA = {
  1: {
    stores: [
      { name: 'notes', keyPath: 'id', indexes: [{ name: 'updated', keyPath: 'updated', unique: false }] },
      { name: 'events', keyPath: 'id', indexes: [{ name: 'date', keyPath: 'date', unique: false }] }
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
  }
};

const MIGRATIONS = {
  1: (db) => {
    SCHEMA[1].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
      s.indexes.forEach((idx) => store.createIndex(idx.name, idx.keyPath, { unique: idx.unique }));
    });
  },
  2: (db) => {
    SCHEMA[2].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
      s.indexes.forEach((idx) => store.createIndex(idx.name, idx.keyPath, { unique: idx.unique }));
    });
  },
  3: (db) => {
    SCHEMA[3].stores.forEach((s) => {
      if (db.objectStoreNames.contains(s.name)) return;
      db.createObjectStore(s.name, { keyPath: s.keyPath });
    });
  }
};

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      for (let v = e.oldVersion + 1; v <= e.newVersion; v++) {
        if (MIGRATIONS[v]) MIGRATIONS[v](database);
      }
    };
  });
}

async function put(store, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([store], 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(store, id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([store], 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(store, indexName, query) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([store], 'readonly');
    const os = tx.objectStore(store);
    const source = indexName ? os.index(indexName) : os;
    const req = query ? source.getAll(query) : source.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function remove(store, id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([store], 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clear(store) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([store], 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export { openDB, put, get, getAll, remove, clear, DB_VERSION };
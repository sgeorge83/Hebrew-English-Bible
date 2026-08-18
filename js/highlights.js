const DB_NAME = "hebrew-english-bible";
const STORE = "highlights";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("bookId", "bookId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listHighlights() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve(
        request.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addHighlight(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const payload = { ...entry, createdAt: new Date().toISOString() };
    const request = store.add(payload);
    request.onsuccess = () => resolve({ ...payload, id: request.result });
    request.onerror = () => reject(request.error);
  });
}

export async function removeHighlight(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearHighlights() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getHighlightForVerse(bookId, chapter, verse) {
  const all = await listHighlights();
  return all.find(
    (h) => h.bookId === bookId && h.chapter === chapter && h.verse === verse
  );
}

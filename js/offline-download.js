import { loadBooks } from "./books.js";
import { ENGLISH_BASE, ORIGINAL_BASE } from "./config.js";

const DATA_CACHE = "hebrew-english-bible-data-v1";
const FLAG_KEY = "offlineBibleDownloaded";

export function isOfflineDownloaded() {
  return localStorage.getItem(FLAG_KEY) === "yes";
}

async function cacheUrl(cache, url) {
  const existing = await cache.match(url);
  if (existing) return;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  await cache.put(url, response);
}

export async function downloadFullBible(onProgress) {
  if (!("caches" in window)) {
    throw new Error("Offline storage is not supported in this browser");
  }

  try {
    await navigator.storage?.persist?.();
  } catch {
    /* non-fatal */
  }

  const books = await loadBooks();
  const cache = await caches.open(DATA_CACHE);

  await cacheUrl(cache, `${ORIGINAL_BASE}/books.json`);
  await cacheUrl(cache, `${ENGLISH_BASE}/books.json`);

  const chapters = [];
  for (const book of books) {
    for (let ch = 1; ch <= book.chapterCount; ch += 1) {
      chapters.push({ bookId: book.id, chapter: ch });
    }
  }

  const total = chapters.length;
  let done = 0;
  const queue = [...chapters];

  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      await cacheUrl(cache, `${ORIGINAL_BASE}/chapters/${item.bookId}/${item.chapter}.json`);
      await cacheUrl(cache, `${ENGLISH_BASE}/chapters/${item.bookId}/${item.chapter}.json`);
      done += 1;
      onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: 6 }, worker));

  localStorage.setItem(FLAG_KEY, "yes");
  return { total };
}

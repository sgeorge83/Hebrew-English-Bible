/**
 * Verse audio: stream from MP3_OpenHebrewGreekBible_fast ZIP archives,
 * cache blobs in IndexedDB, optional per-book offline download.
 */
import { AUDIO_BASE } from "./config.js";

const DB_NAME = "hebrew-english-bible-audio";
const DB_VERSION = 1;
const STORE = "verse-audio";

export const BOOK_AUDIO_ZIPS = {
  1: ["01_Genesis_1-25.zip", "01_Genesis_26-50.zip"],
  2: ["02_Exodus_1-20.zip", "02_Exodus_21-40.zip"],
  3: ["03_Leviticus.zip"],
  4: ["04_Numbers_1-18.zip", "04_Numbers_19-36.zip"],
  5: ["05_Deuteronomy_1-17.zip", "05_Deuteronomy_18-34.zip"],
  6: ["06_Joshua.zip"],
  7: ["07_Judges.zip"],
  8: ["08_Ruth.zip"],
  9: ["09_1Samuel.zip"],
  10: ["10_2Samuel.zip"],
  11: ["11_1Kings.zip"],
  12: ["12_2Kings.zip"],
  13: ["13_1Chronicles.zip"],
  14: ["14_2Chronicles_1-18.zip", "14_2Chronicles_19-36.zip"],
  15: ["15_Ezra.zip"],
  16: ["16_Nehemiah.zip"],
  17: ["17_Esther.zip"],
  18: ["18_Job.zip"],
  19: ["19_Psalms_1-75.zip", "19_Psalms_76-150.zip"],
  20: ["20_Proverbs.zip"],
  21: ["21_Ecclesiastes.zip"],
  22: ["22_Song_of_Songs.zip"],
  23: ["23_Isaiah_1-33.zip", "23_Isaiah_34-66.zip"],
  24: ["24_Jeremiah_1-26.zip", "24_Jeremiah_27-52.zip"],
  25: ["25_Lamentations.zip"],
  26: ["26_Ezekiel_1-24.zip", "26_Ezekiel_1-25.zip"],
  27: ["27_Daniel.zip"],
  28: ["28_Hosea.zip"],
  29: ["29_Joel.zip"],
  30: ["30_Amos.zip"],
  31: ["31_Obadiah.zip"],
  32: ["32_Jonah.zip"],
  33: ["33_Micah.zip"],
  34: ["34_Nahum.zip"],
  35: ["35_Habakkuk.zip"],
  36: ["36_Zephaniah.zip"],
  37: ["37_Haggai.zip"],
  38: ["38_Zechariah.zip"],
  39: ["39_Malachi.zip"],
  40: ["40_Matthew.zip"],
  41: ["41_Mark.zip"],
  42: ["42_Luke.zip"],
  43: ["43_John.zip"],
  44: ["44_Acts_of_Apostles.zip"],
  45: ["45_Romans.zip"],
  46: ["46_1Corinthians.zip"],
  47: ["47_2Corinthians.zip"],
  48: ["48_Galatians.zip"],
  49: ["49_Ephesians.zip"],
  50: ["50_Philippians.zip"],
  51: ["51_Colossians.zip"],
  52: ["52_1Thessalonians.zip"],
  53: ["53_2Thessalonians.zip"],
  54: ["54_1Timothy.zip"],
  55: ["55_2Timothy.zip"],
  56: ["56_Titus.zip"],
  57: ["57_Philemon.zip"],
  58: ["58_Hebrews.zip"],
  59: ["59_James.zip"],
  60: ["60_1Peter.zip"],
  61: ["61_2Peter.zip"],
  62: ["62_1John.zip"],
  63: ["63_2John.zip"],
  64: ["64_3John.zip"],
  65: ["65_Jude.zip"],
  66: ["66_Revelation.zip"],
};

let jsZipPromise = null;
let dbPromise = null;
let currentAudio = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function loadJsZip() {
  if (!jsZipPromise) {
    jsZipPromise = import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm").then((m) => m.default);
  }
  return jsZipPromise;
}

function cacheKey(book, chapter, verse) {
  return `${book}/${chapter}/${verse}`;
}

export function verseFilenameCandidates(book, chapter, verse) {
  const b = String(book).padStart(2, "0");
  const c = String(chapter).padStart(3, "0");
  const v = String(verse).padStart(3, "0");
  return [
    `${b}${c}${v}.mp3`,
    `${book}_${c}_${v}.mp3`,
    `${b}_${c}_${v}.mp3`,
    `${book}_${chapter}_${verse}.mp3`,
    `${b}C${c}V${v}.mp3`,
    `${b}-${c}-${v}.mp3`,
  ];
}

function findEntryInZip(zip, book, chapter, verse) {
  const names = Object.keys(zip.files);
  const candidates = new Set(verseFilenameCandidates(book, chapter, verse));
  for (const name of names) {
    const base = name.split("/").pop();
    if (candidates.has(base)) return name;
  }
  const suffix = `C${String(chapter).padStart(3, "0")}V${String(verse).padStart(3, "0")}`;
  return names.find((n) => n.endsWith(".mp3") && n.includes(suffix)) ?? null;
}

async function getCachedBlob(book, chapter, verse) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(cacheKey(book, chapter, verse));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function putCachedBlob(book, chapter, verse, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, cacheKey(book, chapter, verse));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function extractVerseFromZip(zipName, book, chapter, verse) {
  const JSZip = await loadJsZip();
  const url = `${AUDIO_BASE}/${zipName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Audio archive not found: ${zipName}`);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const entry = findEntryInZip(zip, book, chapter, verse);
  if (!entry) throw new Error(`Verse audio not found in ${zipName}`);
  return zip.file(entry).async("blob");
}

export async function getVerseAudioBlob(book, chapter, verse) {
  const cached = await getCachedBlob(book, chapter, verse);
  if (cached) return cached;

  const zips = BOOK_AUDIO_ZIPS[book] ?? [];
  let lastError = null;
  for (const zipName of zips) {
    try {
      const blob = await extractVerseFromZip(zipName, book, chapter, verse);
      await putCachedBlob(book, chapter, verse, blob);
      return blob;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("No audio archives for this book");
}

export async function playVerseAudio(book, chapter, verse) {
  const blob = await getVerseAudioBlob(book, chapter, verse);
  if (currentAudio) {
    currentAudio.pause();
    if (currentAudio.src.startsWith("blob:")) URL.revokeObjectURL(currentAudio.src);
  }
  currentAudio = new Audio(URL.createObjectURL(blob));
  await currentAudio.play();
  return currentAudio;
}

export function stopVerseAudio() {
  if (!currentAudio) return;
  currentAudio.pause();
  if (currentAudio.src.startsWith("blob:")) URL.revokeObjectURL(currentAudio.src);
  currentAudio = null;
}

export function isBookAudioDownloaded(bookId) {
  return localStorage.getItem(`audioBookDownloaded:${bookId}`) === "yes";
}

export async function downloadBookAudio(bookId, onProgress) {
  const zips = BOOK_AUDIO_ZIPS[bookId];
  if (!zips?.length) throw new Error("No audio for this book");

  const JSZip = await loadJsZip();
  let done = 0;
  const total = zips.length;

  for (const zipName of zips) {
    const response = await fetch(`${AUDIO_BASE}/${zipName}`);
    if (!response.ok) throw new Error(`Failed to download ${zipName}`);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());

    const entries = Object.keys(zip.files).filter((n) => n.endsWith(".mp3"));
    for (const entry of entries) {
      const blob = await zip.file(entry).async("blob");
      const base = entry.split("/").pop().replace(".mp3", "");
      const match =
        base.match(/^(\d{2})(\d{3})(\d{3})$/) ??
        base.match(/^(\d+)_(\d+)_(\d+)$/) ??
        base.match(/^(\d+)C(\d{3})V(\d{3})$/i);
      if (match) {
        const [, b, c, v] = match;
        await putCachedBlob(Number(b), Number(c), Number(v), blob);
      }
    }

    done += 1;
    onProgress?.(done, total);
  }

  localStorage.setItem(`audioBookDownloaded:${bookId}`, "yes");
}

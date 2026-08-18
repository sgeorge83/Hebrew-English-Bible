/**
 * Verse audio from MP3_OpenHebrewGreekBible_fast.
 * Zip layout: {book}_{chapter}/OHGB_{book}_{chapter}_{verse}.mp3
 */
import { AUDIO_BASE } from "./config.js";

const DB_NAME = "hebrew-english-bible-audio";
const DB_VERSION = 2;
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
const zipCache = new Map();
const zipLoads = new Map();

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
  return `${Number(book)}/${Number(chapter)}/${Number(verse)}`;
}

export function verseEntryCandidates(book, chapter, verse) {
  const b = Number(book);
  const c = Number(chapter);
  const v = Number(verse);
  const b2 = String(b).padStart(2, "0");
  return [
    `${b}_${c}/OHGB_${b}_${c}_${v}.mp3`,
    `${b2}_${c}/OHGB_${b}_${c}_${v}.mp3`,
    `${b}_${c}/OHGB_${b2}_${c}_${v}.mp3`,
    `OHGB_${b}_${c}_${v}.mp3`,
  ];
}

function findEntryInZip(zip, book, chapter, verse) {
  const files = zip.files;
  for (const path of verseEntryCandidates(book, chapter, verse)) {
    if (files[path] && !files[path].dir) return path;
  }

  const wanted = `OHGB_${Number(book)}_${Number(chapter)}_${Number(verse)}.mp3`.toLowerCase();
  for (const name of Object.keys(files)) {
    if (files[name].dir) continue;
    const base = name.split("/").pop().toLowerCase();
    if (base === wanted) return name;
  }
  return null;
}

function zipsForChapter(book, chapter) {
  const zips = BOOK_AUDIO_ZIPS[Number(book)] ?? [];
  const ranged = [];
  const whole = [];
  for (const name of zips) {
    const match = name.match(/_(\d+)-(\d+)\.zip$/);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (chapter >= start && chapter <= end) ranged.push(name);
    } else {
      whole.push(name);
    }
  }
  return ranged.length ? ranged : whole.length ? whole : zips;
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

function zipUrls(zipName) {
  return [
    `${AUDIO_BASE}/${zipName}`,
    `https://media.githubusercontent.com/media/eliranwong/MP3_OpenHebrewGreekBible_fast/main/${zipName}`,
  ];
}

async function fetchZipBuffer(zipName) {
  let lastError = null;
  for (const url of zipUrls(zipName)) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Audio archive not found (${response.status}): ${zipName}`);
        continue;
      }
      return response.arrayBuffer();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error(`Audio archive not found: ${zipName}`);
}

async function loadZip(zipName) {
  if (zipCache.has(zipName)) return zipCache.get(zipName);
  if (zipLoads.has(zipName)) return zipLoads.get(zipName);

  const pending = (async () => {
    const JSZip = await loadJsZip();
    const buffer = await fetchZipBuffer(zipName);
    const zip = await JSZip.loadAsync(buffer);
    zipCache.set(zipName, zip);
    zipLoads.delete(zipName);
    return zip;
  })().catch((err) => {
    zipLoads.delete(zipName);
    throw err;
  });

  zipLoads.set(zipName, pending);
  return pending;
}

async function extractVerseFromZip(zipName, book, chapter, verse) {
  const zip = await loadZip(zipName);
  const entry = findEntryInZip(zip, book, chapter, verse);
  if (!entry) throw new Error(`Verse audio not found: OHGB_${book}_${chapter}_${verse}.mp3`);
  return zip.file(entry).async("blob");
}

export async function getVerseAudioBlob(book, chapter, verse) {
  const b = Number(book);
  const c = Number(chapter);
  const v = Number(verse);
  if (!b || !c || !v) {
    throw new Error("Missing book, chapter, or verse for audio");
  }

  const cached = await getCachedBlob(b, c, v);
  if (cached) return cached;

  const zips = zipsForChapter(b, c);
  let lastError = null;
  for (const zipName of zips) {
    try {
      const blob = await extractVerseFromZip(zipName, b, c, v);
      await putCachedBlob(b, c, v, blob);
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

function parseOhgbName(path) {
  const base = path.split("/").pop().replace(/\.mp3$/i, "");
  const match = base.match(/^OHGB_(\d+)_(\d+)_(\d+)$/i);
  if (!match) return null;
  return { book: Number(match[1]), chapter: Number(match[2]), verse: Number(match[3]) };
}

export async function downloadBookAudio(bookId, onProgress) {
  const zips = BOOK_AUDIO_ZIPS[bookId];
  if (!zips?.length) throw new Error("No audio for this book");

  let done = 0;
  const total = zips.length;

  for (const zipName of zips) {
    const zip = await loadZip(zipName);
    const entries = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith(".mp3"));
    for (const entry of entries) {
      const parsed = parseOhgbName(entry);
      if (!parsed) continue;
      const blob = await zip.file(entry).async("blob");
      await putCachedBlob(parsed.book, parsed.chapter, parsed.verse, blob);
    }

    done += 1;
    onProgress?.(done, total);
  }

  localStorage.setItem(`audioBookDownloaded:${bookId}`, "yes");
}

import { ENGLISH_BASE, ENGLISH_BOOK_NAMES, ORIGINAL_BASE } from "./config.js";

function verseMap(chapter, field) {
  return new Map(chapter.verses.map((v) => [v.verse, v[field] ?? v.text]));
}

function verseObjectMap(chapter) {
  return new Map(chapter.verses.map((v) => [v.verse, v]));
}

/**
 * Merge original-language + WEB chapters by numeric book id, chapter, and verse.
 */
export function mergeChapters(originalChapter, englishChapter) {
  const bookId = originalChapter.book;

  if (englishChapter.book !== bookId) {
    throw new Error(
      `Book ID mismatch: original ${originalChapter.book}, English ${englishChapter.book}`
    );
  }
  if (originalChapter.chapter !== englishChapter.chapter) {
    throw new Error(
      `Chapter mismatch: original ${originalChapter.chapter}, English ${englishChapter.chapter}`
    );
  }

  const englishByVerse = verseMap(englishChapter, "text");
  const originalByVerse = verseObjectMap(originalChapter);
  const maxVerse = Math.max(
    originalChapter.verse_count ?? originalChapter.verses.length,
    englishChapter.verse_count ?? englishChapter.verses.length
  );

  const verses = [];
  for (let verse = 1; verse <= maxVerse; verse += 1) {
    const orig = originalByVerse.get(verse);
    verses.push({
      verse,
      script: orig?.script ?? null,
      original: orig?.text ?? null,
      transliteration: orig?.transliteration ?? null,
      words: orig?.words ?? [],
      english: englishByVerse.get(verse) ?? null,
    });
  }

  return {
    bookId,
    bookNameEnglish: ENGLISH_BOOK_NAMES[bookId] ?? englishChapter.book_name,
    bookNameOriginal: originalChapter.book_name,
    chapter: originalChapter.chapter,
    verses,
  };
}

export async function fetchMergedChapter(bookId, chapter) {
  const [originalRes, englishRes] = await Promise.all([
    fetch(`${ORIGINAL_BASE}/chapters/${bookId}/${chapter}.json`),
    fetch(`${ENGLISH_BASE}/chapters/${bookId}/${chapter}.json`),
  ]);

  if (!originalRes.ok || !englishRes.ok) {
    throw new Error(`Chapter not found: book ${bookId}, chapter ${chapter}`);
  }

  const originalChapter = await originalRes.json();
  const englishChapter = await englishRes.json();

  return mergeChapters(originalChapter, englishChapter);
}

export function countWords(chapter) {
  let words = 0;
  for (const v of chapter.verses) {
    if (v.original) words += v.original.split(/\s+/).filter(Boolean).length;
    if (v.english) words += v.english.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

export async function fetchMergedPassage(passageSpecs, meta = {}) {
  if (!passageSpecs?.length) {
    throw new Error("No passage references provided");
  }

  const chapterCache = new Map();
  const verses = [];

  for (const spec of passageSpecs) {
    const cacheKey = `${spec.bookId}:${spec.chapter}`;
    if (!chapterCache.has(cacheKey)) {
      chapterCache.set(cacheKey, await fetchMergedChapter(spec.bookId, spec.chapter));
    }

    const chapter = chapterCache.get(cacheKey);
    const maxVerse = chapter.verses.reduce((max, verse) => Math.max(max, verse.verse), 0);
    const verseStart = spec.verseStart ?? 1;
    const verseEnd = spec.verseEnd ?? maxVerse;

    for (const verse of chapter.verses) {
      if (verse.verse < verseStart || verse.verse > verseEnd) continue;
      if (!verse.original && !verse.english) continue;
      verses.push({
        verse: verse.verse,
        script: verse.script,
        original: verse.original,
        transliteration: verse.transliteration,
        words: verse.words,
        english: verse.english,
        chapter: spec.chapter,
        bookId: spec.bookId,
      });
    }
  }

  if (!verses.length) {
    throw new Error("Passage has no readable verses");
  }

  const firstSpec = passageSpecs[0];
  const firstChapter = chapterCache.get(`${firstSpec.bookId}:${firstSpec.chapter}`);
  const chaptersUsed = new Set(verses.map((verse) => verse.chapter));
  const multiChapter = chaptersUsed.size > 1;

  for (const verse of verses) {
    verse.showChapter = multiChapter;
  }

  return {
    bookId: firstSpec.bookId,
    bookNameEnglish: firstSpec.bookName,
    bookNameOriginal: firstChapter?.bookNameOriginal ?? firstSpec.bookName,
    chapter: firstSpec.chapter,
    referenceLabel: meta.referenceLabel ?? passageSpecs.map((spec) => spec.label).join("; "),
    verses,
    isPassage: true,
    multiChapter,
    planContext: meta.planContext ?? null,
  };
}

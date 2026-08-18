import { ENGLISH_BOOK_NAMES } from "./config.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBookLookup() {
  const lookup = [];
  for (const [id, name] of Object.entries(ENGLISH_BOOK_NAMES)) {
    lookup.push({ id: Number(id), name, pattern: name });
  }
  lookup.push({ id: 19, name: "Psalms", pattern: "Psalm" });
  lookup.sort((a, b) => b.pattern.length - a.pattern.length);
  return lookup;
}

const BOOK_LOOKUP = buildBookLookup();

function matchBook(segment) {
  for (const entry of BOOK_LOOKUP) {
    const re = new RegExp(`^${escapeRegex(entry.pattern)}\\s+(.+)$`, "i");
    const match = segment.trim().match(re);
    if (match) {
      return {
        bookId: entry.id,
        bookName: ENGLISH_BOOK_NAMES[entry.id] ?? entry.name,
        rest: match[1].trim(),
      };
    }
  }
  return null;
}

function parseRest(bookId, bookName, rest) {
  const specs = [];

  let match = rest.match(/^(\d+)-(\d+):(\d+)$/);
  if (match) {
    const startChapter = Number(match[1]);
    const endChapter = Number(match[2]);
    const endVerse = Number(match[3]);
    for (let chapter = startChapter; chapter < endChapter; chapter += 1) {
      specs.push({
        bookId,
        bookName,
        chapter,
        verseStart: 1,
        verseEnd: null,
        label: `${bookName} ${chapter}`,
      });
    }
    specs.push({
      bookId,
      bookName,
      chapter: endChapter,
      verseStart: 1,
      verseEnd: endVerse,
      label: `${bookName} ${endChapter}:1-${endVerse}`,
    });
    return specs;
  }

  match = rest.match(/^(\d+)-(\d+)$/);
  if (match) {
    const startChapter = Number(match[1]);
    const endChapter = Number(match[2]);
    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      specs.push({
        bookId,
        bookName,
        chapter,
        verseStart: 1,
        verseEnd: null,
        label: `${bookName} ${chapter}`,
      });
    }
    return specs;
  }

  match = rest.match(/^(\d+):(\d+)-(\d+)$/);
  if (match) {
    return [
      {
        bookId,
        bookName,
        chapter: Number(match[1]),
        verseStart: Number(match[2]),
        verseEnd: Number(match[3]),
        label: `${bookName} ${match[1]}:${match[2]}-${match[3]}`,
      },
    ];
  }

  match = rest.match(/^(\d+):(\d+)$/);
  if (match) {
    const verse = Number(match[2]);
    return [
      {
        bookId,
        bookName,
        chapter: Number(match[1]),
        verseStart: verse,
        verseEnd: verse,
        label: `${bookName} ${match[1]}:${match[2]}`,
      },
    ];
  }

  match = rest.match(/^(\d+)$/);
  if (match) {
    return [
      {
        bookId,
        bookName,
        chapter: Number(match[1]),
        verseStart: 1,
        verseEnd: null,
        label: `${bookName} ${match[1]}`,
      },
    ];
  }

  throw new Error(`Cannot parse reference segment: ${bookName} ${rest}`);
}

export function parseReferenceString(reference) {
  if (!reference?.trim()) return [];

  const segments = reference.split(";").map((part) => part.trim()).filter(Boolean);
  const specs = [];

  for (const segment of segments) {
    const matched = matchBook(segment);
    if (!matched) {
      throw new Error(`Unknown book in reference: ${segment}`);
    }
    specs.push(...parseRest(matched.bookId, matched.bookName, matched.rest));
  }

  return specs;
}

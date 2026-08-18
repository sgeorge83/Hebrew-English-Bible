import { ENGLISH_BASE, OT_BOOK_COUNT, ORIGINAL_BASE } from "./config.js";

let cachedBooks = null;

export async function loadBooks() {
  if (cachedBooks) return cachedBooks;

  const [originalRes, englishRes] = await Promise.all([
    fetch(`${ORIGINAL_BASE}/books.json`),
    fetch(`${ENGLISH_BASE}/books.json`),
  ]);

  if (!originalRes.ok || !englishRes.ok) {
    throw new Error("Failed to load book lists");
  }

  const originalBooks = await originalRes.json();
  const englishBooks = await englishRes.json();
  const englishById = Object.fromEntries(englishBooks.map((b) => [b.id, b]));

  cachedBooks = originalBooks
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((origBook) => {
      const englishBook = englishById[origBook.id];
      if (!englishBook) {
        throw new Error(`Missing English metadata for book ${origBook.id}`);
      }
      if (origBook.chapter_count !== englishBook.chapter_count) {
        console.warn(
          `Chapter count mismatch book ${origBook.id}: original ${origBook.chapter_count}, English ${englishBook.chapter_count}`
        );
      }
      return {
        id: origBook.id,
        nameOriginal: origBook.name_original ?? origBook.name,
        nameEnglish: englishBook.name,
        chapterCount: origBook.chapter_count,
        script: origBook.script ?? (origBook.id <= OT_BOOK_COUNT ? "hebrew" : "greek"),
        testament: origBook.id <= OT_BOOK_COUNT ? "ot" : "nt",
      };
    });

  return cachedBooks;
}

export function getBook(books, bookId) {
  return books.find((b) => b.id === bookId) ?? null;
}

export function getAdjacentChapter(books, bookId, chapter, direction) {
  const book = getBook(books, bookId);
  if (!book) return null;

  if (direction === "next") {
    if (chapter < book.chapterCount) {
      return { bookId, chapter: chapter + 1, startPage: "first" };
    }
    const nextBook = getBook(books, bookId + 1);
    if (nextBook) {
      return { bookId: nextBook.id, chapter: 1, startPage: "first" };
    }
    return null;
  }

  if (chapter > 1) {
    return { bookId, chapter: chapter - 1, startPage: "last" };
  }
  const prevBook = getBook(books, bookId - 1);
  if (prevBook) {
    return { bookId: prevBook.id, chapter: prevBook.chapterCount, startPage: "last" };
  }
  return null;
}

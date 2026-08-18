import { WPM } from "./config.js";

export function readingStats(totalWords, currentPage, totalPages) {
  const percent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const wordsRead = totalPages > 0 ? Math.round((totalWords * currentPage) / totalPages) : 0;
  const wordsLeft = Math.max(0, totalWords - wordsRead);
  const minutesLeft = Math.max(1, Math.ceil(wordsLeft / WPM));
  return { percent, minutesLeft };
}

export function countWordsInVerses(verses) {
  let words = 0;
  for (const v of verses) {
    if (v.original) words += v.original.split(/\s+/).filter(Boolean).length;
    if (v.transliteration) words += v.transliteration.split(/\s+/).filter(Boolean).length;
    if (v.english) words += v.english.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

import { playVerseAudio } from "./audio.js";

let panelEl = null;
let activeWordEl = null;
let activeRomanEl = null;

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.createElement("div");
  panelEl.id = "word-learn-panel";
  panelEl.className = "word-learn-panel";
  panelEl.hidden = true;
  document.body.appendChild(panelEl);
  return panelEl;
}

function clearActiveWord() {
  if (activeWordEl) {
    activeWordEl.classList.remove("word--active");
    activeWordEl = null;
  }
  if (activeRomanEl) {
    activeRomanEl.classList.remove("word--active");
    activeRomanEl = null;
  }
}

export function closeWordPanel() {
  clearActiveWord();
  if (panelEl) panelEl.hidden = true;
}

function audioRefFrom(word, fallback) {
  const audio = word?.audio;
  return {
    book: Number(audio?.book || fallback.book),
    chapter: Number(audio?.chapter || fallback.chapter),
    verse: Number(audio?.verse || fallback.verse),
  };
}

async function playAlignedAudio(btn, book, chapter, verse) {
  if (!book || !chapter || !verse) {
    btn.textContent = "Audio unavailable";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Loading audio…";
  try {
    await playVerseAudio(book, chapter, verse);
    btn.textContent = "Play verse audio";
  } catch (err) {
    btn.textContent = "Audio unavailable";
    console.warn(err);
  } finally {
    btn.disabled = false;
  }
}

export function openWordPanel({ word, reference, book, chapter, verse, anchorEl, autoPlay = false }) {
  const panel = ensurePanel();
  clearActiveWord();
  if (anchorEl) {
    anchorEl.classList.add("word--active");
    activeWordEl = anchorEl;
    const pair = anchorEl.closest(".verse-pair");
    const roman = pair?.querySelector(`.roman-token[data-word="${anchorEl.dataset.word}"]`);
    if (roman) {
      roman.classList.add("word--active");
      activeRomanEl = roman;
    }
  }

  const audio = audioRefFrom(word, { book, chapter, verse });
  const canPlay = Boolean(word.key && audio.book && audio.chapter && audio.verse);

  panel.innerHTML = `
    <div class="word-learn-panel__header">
      <span class="word-learn-panel__ref">${escapeHtml(reference)}</span>
      <button type="button" class="word-learn-panel__close" aria-label="Close">×</button>
    </div>
    <p class="word-learn-panel__original">${escapeHtml(word.text)}</p>
    <p class="word-learn-panel__roman">${escapeHtml(word.transliteration)}</p>
    <p class="word-learn-panel__gloss">${escapeHtml(word.gloss || "")}</p>
    ${word.strongs ? `<p class="word-learn-panel__strongs">${escapeHtml(word.strongs)}</p>` : ""}
    ${
      canPlay
        ? `<button type="button" class="word-learn-panel__play plan-btn plan-btn--primary">Play verse audio</button>
           <p class="word-learn-panel__credit">Audio: CC BY 4.0 · verse ${audio.book}:${audio.chapter}:${audio.verse}</p>`
        : `<p class="word-learn-panel__credit">No verse audio mapped for this word.</p>`
    }
  `;

  panel.querySelector(".word-learn-panel__close").addEventListener("click", closeWordPanel);
  const playBtn = panel.querySelector(".word-learn-panel__play");
  if (playBtn) {
    playBtn.addEventListener("click", () => playAlignedAudio(playBtn, audio.book, audio.chapter, audio.verse));
    if (autoPlay) playAlignedAudio(playBtn, audio.book, audio.chapter, audio.verse);
  }

  panel.hidden = false;
}

function resolveLocation(pair, word, root) {
  const audio = word?.audio;
  const verseNum = Number(pair.dataset.verse);
  const bookFromPair = Number(pair.dataset.bookId);
  const chapterFromPair = Number(pair.dataset.chapter);
  return {
    book: Number(audio?.book || bookFromPair || window.__hebBibleBookId),
    chapter: Number(audio?.chapter || chapterFromPair || window.__hebBibleChapter),
    verse: Number(audio?.verse || verseNum),
  };
}

export function bindWordLearn(root) {
  root.addEventListener("click", (e) => {
    const wordEl = e.target.closest(".word");
    if (!wordEl) return;

    const pair = wordEl.closest(".verse-pair");
    if (!pair) return;

    const verseNum = Number(pair.dataset.verse);
    const wordIndex = Number(wordEl.dataset.word);

    const verseData = window.__hebBibleCurrentVerses?.find((v) => {
      if (v.verse !== verseNum) return false;
      if (pair.dataset.chapter && v.chapter != null) {
        return v.chapter === Number(pair.dataset.chapter);
      }
      return true;
    });
    const word = verseData?.words?.[wordIndex];
    if (!word) return;

    e.stopPropagation();
    const loc = resolveLocation(pair, word, root);
    const ref = `${window.__hebBibleBookName || "Bible"} ${loc.chapter}:${loc.verse}`;

    openWordPanel({
      word,
      reference: ref,
      book: loc.book,
      chapter: loc.chapter,
      verse: loc.verse,
      anchorEl: wordEl,
      autoPlay: Boolean(word.key),
    });
  });
}

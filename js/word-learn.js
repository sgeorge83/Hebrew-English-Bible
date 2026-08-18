import { playVerseAudio } from "./audio.js";

let panelEl = null;
let activeWordEl = null;

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
}

export function closeWordPanel() {
  clearActiveWord();
  if (panelEl) panelEl.hidden = true;
}

export function openWordPanel({ word, reference, book, chapter, verse, anchorEl }) {
  const panel = ensurePanel();
  clearActiveWord();
  if (anchorEl) {
    anchorEl.classList.add("word--active");
    activeWordEl = anchorEl;
  }

  panel.innerHTML = `
    <div class="word-learn-panel__header">
      <span class="word-learn-panel__ref">${escapeHtml(reference)}</span>
      <button type="button" class="word-learn-panel__close" aria-label="Close">×</button>
    </div>
    <p class="word-learn-panel__original">${escapeHtml(word.text)}</p>
    <p class="word-learn-panel__roman">${escapeHtml(word.transliteration)}</p>
    <p class="word-learn-panel__gloss">${escapeHtml(word.gloss || "")}</p>
    ${word.strongs ? `<p class="word-learn-panel__strongs">${escapeHtml(word.strongs)}</p>` : ""}
    <button type="button" class="word-learn-panel__play plan-btn plan-btn--primary">Play verse audio</button>
    <p class="word-learn-panel__credit">Audio: CC BY 4.0 · MP3_OpenHebrewGreekBible_fast</p>
  `;

  panel.querySelector(".word-learn-panel__close").addEventListener("click", closeWordPanel);
  panel.querySelector(".word-learn-panel__play").addEventListener("click", async () => {
    const btn = panel.querySelector(".word-learn-panel__play");
    btn.disabled = true;
    btn.textContent = "Playing…";
    try {
      await playVerseAudio(book, chapter, verse);
    } catch (err) {
      btn.textContent = "Audio unavailable";
      console.warn(err);
    } finally {
      btn.disabled = false;
      if (btn.textContent === "Playing…") btn.textContent = "Play verse audio";
    }
  });

  panel.hidden = false;
}

export function bindWordLearn(root) {
  root.addEventListener("click", (e) => {
    const wordEl = e.target.closest(".word");
    if (!wordEl) return;

    const pair = wordEl.closest(".verse-pair");
    if (!pair) return;

    const verseNum = Number(pair.dataset.verse);
    const chapterNum = Number(pair.dataset.chapter || root.closest("[data-chapter]")?.dataset.chapter);
    const bookId = Number(pair.dataset.bookId || root.closest("[data-book-id]")?.dataset.bookId);
    const wordIndex = Number(wordEl.dataset.word);

    const verseData = window.__hebBibleCurrentVerses?.find(
      (v) =>
        v.verse === verseNum &&
        (pair.dataset.chapter ? v.chapter === Number(pair.dataset.chapter) : true)
    );
    const word = verseData?.words?.[wordIndex];
    if (!word) return;

    e.stopPropagation();
    const book = bookId || window.__hebBibleBookId;
    const chapter = chapterNum || window.__hebBibleChapter;
    const ref = `${window.__hebBibleBookName || "Bible"} ${chapter}:${verseNum}`;

    openWordPanel({
      word,
      reference: ref,
      book,
      chapter,
      verse: verseNum,
      anchorEl: wordEl,
    });
  });
}

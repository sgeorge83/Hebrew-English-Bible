import { escapeHtml } from "./word-learn.js";

function isRtlScript(script) {
  return script === "hebrew" || script === "aramaic";
}

function buildWordSpans(words, script, learnWordsOnly) {
  if (!words?.length) return "";

  const visible = learnWordsOnly ? words.filter((w) => w.key) : words;
  return visible
    .map((word, index) => {
      const idx = words.indexOf(word);
      const classes = ["word"];
      if (word.key) classes.push("word--key");
      const maqaf = word.maqaf ? "־" : "";
      return `<span class="${classes.join(" ")}" data-word="${idx}" role="button" tabindex="0">${escapeHtml(word.text)}</span>${maqaf}`;
    })
    .join(" ");
}

function buildRomanLine(words, learnWordsOnly) {
  if (!words?.length) return "";
  const visible = learnWordsOnly ? words.filter((w) => w.key) : words;
  return visible
    .map((word) => {
      const idx = words.indexOf(word);
      const classes = ["roman-token"];
      if (word.key) classes.push("roman-token--key");
      return `<span class="${classes.join(" ")}" data-word="${idx}">${escapeHtml(word.transliteration)}</span>`;
    })
    .join(" ");
}

export function buildVerseElement(verse, settings, highlightColor) {
  const el = document.createElement("article");
  el.className = "verse-pair";
  el.dataset.verse = String(verse.verse);
  if (verse.chapter != null) {
    el.dataset.chapter = String(verse.chapter);
  }
  if (verse.bookId != null) {
    el.dataset.bookId = String(verse.bookId);
  }

  const num = document.createElement("div");
  num.className = "verse-num";
  num.textContent = verse.showChapter ? `${verse.chapter}:${verse.verse}` : String(verse.verse);
  el.appendChild(num);

  if (verse.original) {
    const original = document.createElement("p");
    original.className = "verse-original";
    const rtl = isRtlScript(verse.script);
    original.dir = rtl ? "rtl" : "ltr";
    original.lang = rtl ? "he" : "el";
    if (verse.script === "greek") original.classList.add("verse-original--greek");

    if (verse.words?.length) {
      original.innerHTML = buildWordSpans(verse.words, verse.script, settings.learnWordsOnly);
    } else {
      original.textContent = verse.original;
    }
    el.appendChild(original);
  }

  if (verse.transliteration) {
    const roman = document.createElement("p");
    roman.className = "verse-roman";
    if (verse.words?.length) {
      roman.innerHTML = buildRomanLine(verse.words, settings.learnWordsOnly);
    } else {
      roman.textContent = verse.transliteration;
    }
    el.appendChild(roman);
  }

  if (verse.english) {
    const english = document.createElement("p");
    english.className = "verse-english";
    english.dir = "ltr";
    english.lang = "en";
    english.textContent = verse.english;
    el.appendChild(english);
  }

  if (!verse.original || !verse.english) {
    el.classList.add("verse-pair--partial");
  }

  if (highlightColor) {
    el.style.setProperty("--highlight", highlightColor);
    el.classList.add("verse-pair--highlighted");
  }

  return el;
}

function pageHasContent(inner) {
  return inner.querySelector(".verse-pair") !== null;
}

export function paginateVerses(verses, measureEl, pageHeight, settings, highlightMap) {
  measureEl.innerHTML = "";
  measureEl.style.setProperty("--reader-font-size", `${settings.fontSize}px`);
  measureEl.style.setProperty("--reader-margin", settings.marginPadding ?? "18px");
  measureEl.classList.toggle("text-justified", settings.justified);

  const pages = [];
  let inner = document.createElement("div");
  inner.className = "reader-page-inner";
  measureEl.appendChild(inner);

  const usableHeight = Math.max(pageHeight - 4, 120);

  for (const verse of verses) {
    const highlightKey = verse.showChapter ? `${verse.chapter}:${verse.verse}` : verse.verse;
    const color = highlightMap?.get(highlightKey);
    const block = buildVerseElement(verse, settings, color);
    inner.appendChild(block);

    while (inner.scrollHeight > usableHeight && inner.childElementCount > 1) {
      inner.removeChild(block);
      pages.push(inner.innerHTML);
      inner = document.createElement("div");
      inner.className = "reader-page-inner";
      measureEl.innerHTML = "";
      measureEl.appendChild(inner);
      inner.appendChild(block);
    }
  }

  if (pageHasContent(inner)) {
    pages.push(inner.innerHTML);
  }

  measureEl.innerHTML = "";
  return pages.length ? pages : [];
}

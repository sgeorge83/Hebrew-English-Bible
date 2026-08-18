import { ABOUT_CONTENT, GUIDE_CONTENT } from "./about.js";
import { loadBooks, getBook, getAdjacentChapter } from "./books.js";
import { fetchMergedChapter, fetchMergedPassage } from "./bible-data.js";
import {
  addHighlight,
  clearHighlights,
  getHighlightForVerse,
  listHighlights,
  removeHighlight,
} from "./highlights.js";
import { paginateVerses } from "./pagination.js";
import { downloadFullBible, isOfflineDownloaded } from "./offline-download.js";
import { getStats, isDayComplete, markDayComplete, resetPlan, startPlan } from "./plan-progress.js";
import { countWordsInVerses, readingStats } from "./progress.js";
import { getPlanDay, getPlanMeta, getSectionByKey, loadPlan } from "./reading-plan.js";
import { ENGLISH_BOOK_NAMES } from "./config.js";
import { loadSettings, saveSettings, marginPadding } from "./settings.js";
import { downloadBookAudio, isBookAudioDownloaded } from "./audio.js";
import { bindWordLearn, escapeHtml } from "./word-learn.js";

const HIGHLIGHT_COLORS = [
  { id: "yellow", value: "rgba(255, 214, 102, 0.45)" },
  { id: "green", value: "rgba(144, 238, 168, 0.45)" },
  { id: "blue", value: "rgba(153, 204, 255, 0.45)" },
];

const state = {
  books: [],
  route: parseRoute(),
  settings: loadSettings(),
  chapter: null,
  pages: [],
  pageIndex: 0,
  highlights: new Map(),
  totalWords: 0,
  startPage: "first",
};

const els = {
  screens: {},
  libraryList: document.getElementById("library-list"),
  chapterTitle: document.getElementById("chapter-title"),
  chapterSubtitle: document.getElementById("chapter-subtitle"),
  chapterGrid: document.getElementById("chapter-grid"),
  chapterAudioBar: document.getElementById("chapter-audio-bar"),
  readerShell: document.getElementById("reader-shell"),
  readerHeaderEn: document.getElementById("reader-header-en"),
  readerHeaderOrig: document.getElementById("reader-header-orig"),
  pageTrack: document.getElementById("page-track"),
  readerFooter: document.getElementById("reader-footer"),
  measure: document.getElementById("measure"),
  aaSheet: document.getElementById("aa-sheet"),
  notebookList: document.getElementById("notebook-list"),
  aboutSheet: document.getElementById("about-sheet"),
  aboutContent: document.getElementById("about-content"),
  guideSheet: document.getElementById("guide-sheet"),
  guideContent: document.getElementById("guide-content"),
  aaSheetTitle: document.getElementById("aa-sheet-title"),
  aaReaderOnly: document.getElementById("aa-reader-only"),
  planDashboard: document.getElementById("plan-dashboard"),
  planDayTitle: document.getElementById("plan-day-title"),
  planDaySubtitle: document.getElementById("plan-day-subtitle"),
  planDayContent: document.getElementById("plan-day-content"),
  loader: document.getElementById("global-loader"),
  error: document.getElementById("global-error"),
};

function isReaderRoute(route = state.route) {
  return route.name === "read" || route.name === "planPassage";
}

function isNormalReaderRoute(route = state.route) {
  return route.name === "read";
}

function parseRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "plan") {
    if (parts[1] === "day" && parts[2] && parts[3]) {
      return {
        name: "planPassage",
        dayIndex: Number(parts[2]),
        sectionKey: parts[3],
      };
    }
    if (parts[1] === "day" && parts[2]) {
      return { name: "planDay", dayIndex: Number(parts[2]) };
    }
    return { name: "plan" };
  }
  if (parts[0] === "read" && parts[1] && parts[2]) {
    return { name: "read", bookId: Number(parts[1]), chapter: Number(parts[2]) };
  }
  if (parts[0] === "book" && parts[1]) {
    return { name: "book", bookId: Number(parts[1]) };
  }
  if (parts[0] === "notebook") {
    return { name: "notebook" };
  }
  return { name: "library" };
}

function routeToPath(route) {
  if (route.name === "planPassage") {
    return `#/plan/day/${route.dayIndex}/${route.sectionKey}`;
  }
  if (route.name === "planDay") {
    return `#/plan/day/${route.dayIndex}`;
  }
  if (route.name === "plan") {
    return "#/plan";
  }
  if (route.name === "read") {
    return `#/read/${route.bookId}/${route.chapter}`;
  }
  if (route.name === "book") {
    return `#/book/${route.bookId}`;
  }
  if (route.name === "notebook") {
    return "#/notebook";
  }
  return "#/";
}

function navigate(route) {
  if (els.aboutSheet) els.aboutSheet.hidden = true;
  if (els.guideSheet) els.guideSheet.hidden = true;
  if (els.aaSheet) els.aaSheet.hidden = true;
  const path = routeToPath(route);
  if (location.hash !== path) location.hash = path;
  state.route = route;
  render();
}

function showScreen(name) {
  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.hidden = el.dataset.screen !== name;
  });
  document.body.dataset.screen = name;
}

function setLoading(on) {
  els.loader.hidden = !on;
}

function setError(message) {
  if (!message) {
    els.error.hidden = true;
    els.error.textContent = "";
    return;
  }
  els.error.hidden = false;
  els.error.textContent = message;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.style.setProperty("--reader-font-size", `${state.settings.fontSize}px`);
  document.documentElement.style.setProperty("--reader-margin", marginPadding(state.settings.margin));
  document.documentElement.classList.toggle("text-justified", state.settings.justified);
  updateThemeQuickButtons();
}

function updateThemeQuickButtons() {
  document.querySelectorAll("[data-theme-quick]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeQuick === state.settings.theme);
  });
}

async function init() {
  document.querySelectorAll("[data-screen]").forEach((el) => {
    els.screens[el.dataset.screen] = el;
  });

  bindChrome();
  applyTheme();
  bindAaControls();

  try {
    setLoading(true);
    state.books = await loadBooks();
    setError("");
  } catch (err) {
    setError(err.message || "Failed to load Bible catalog");
  } finally {
    setLoading(false);
  }

  window.addEventListener("hashchange", () => {
    state.route = parseRoute();
    render();
  });

  render();
}

function bindChrome() {
  document.getElementById("btn-plan").addEventListener("click", () => navigate({ name: "plan" }));
  document.getElementById("btn-back-plan-home").addEventListener("click", () => navigate({ name: "library" }));
  document.getElementById("btn-back-plan").addEventListener("click", () => navigate({ name: "plan" }));
  document.getElementById("btn-notebook").addEventListener("click", () => navigate({ name: "notebook" }));
  document.getElementById("btn-back-home").addEventListener("click", () => navigate({ name: "library" }));
  document.getElementById("btn-about").addEventListener("click", () => {
    renderAboutSheet();
    els.guideSheet.hidden = true;
    els.aboutSheet.hidden = false;
  });
  document.getElementById("btn-close-about").addEventListener("click", () => {
    els.aboutSheet.hidden = true;
  });
  document.getElementById("btn-guide").addEventListener("click", () => {
    renderGuideSheet();
    els.aboutSheet.hidden = true;
    els.guideSheet.hidden = false;
  });
  document.getElementById("btn-close-guide").addEventListener("click", () => {
    els.guideSheet.hidden = true;
  });
  document.getElementById("btn-back-library").addEventListener("click", () => navigate({ name: "library" }));
  document.getElementById("btn-back-chapters").addEventListener("click", () => {
    if (state.route.name === "planPassage") {
      navigate({ name: "planDay", dayIndex: state.route.dayIndex });
      return;
    }
    if (state.route.name === "read") {
      navigate({ name: "book", bookId: state.route.bookId });
    }
  });
  document.querySelectorAll(".btn-open-settings").forEach((btn) => {
    btn.addEventListener("click", toggleSettingsSheet);
  });
  document.querySelectorAll("[data-theme-quick]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeQuick));
  });
  document.getElementById("btn-close-aa").addEventListener("click", () => {
    els.aaSheet.hidden = true;
  });

  document.getElementById("btn-prev-page").addEventListener("click", () => goPage(state.pageIndex - 1));
  document.getElementById("btn-next-page").addEventListener("click", () => goPage(state.pageIndex + 1));

  els.pageTrack.addEventListener("click", (e) => {
    if (e.target.closest(".word")) return;
    const pair = e.target.closest(".verse-pair");
    if (!pair || !isReaderRoute()) return;
    const chapter = pair.dataset.chapter ? Number(pair.dataset.chapter) : undefined;
    handleVerseTap(Number(pair.dataset.verse), chapter);
  });

  bindWordLearn(els.pageTrack);
  setupSwipe(els.pageTrack);
  setupLongPress(els.pageTrack);
}

function toggleSettingsSheet() {
  updateSettingsSheetMode();
  els.aaSheet.hidden = !els.aaSheet.hidden;
}

function updateSettingsSheetMode() {
  const isReader = isReaderRoute();
  if (els.aaReaderOnly) els.aaReaderOnly.hidden = !isReader;
  if (els.aaSheetTitle) {
    els.aaSheetTitle.textContent = isReader ? "Reading settings" : "Display theme";
  }
  document.querySelectorAll(".btn-open-settings").forEach((btn) => {
    btn.setAttribute("aria-label", isReader ? "Reading settings" : "Display theme");
  });
}

function bindAaControls() {
  const fontSlider = document.getElementById("font-size");
  fontSlider.value = state.settings.fontSize;
  fontSlider.addEventListener("input", () => {
    state.settings.fontSize = Number(fontSlider.value);
    document.getElementById("font-size-label").textContent = `${state.settings.fontSize}px`;
    persistSettingsAndRepaginate();
  });

  document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeBtn));
  });

  document.querySelectorAll("[data-margin-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.settings.margin = btn.dataset.marginBtn;
      document.querySelectorAll("[data-margin-btn]").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      persistSettingsAndRepaginate();
    });
  });

  document.getElementById("justify-toggle").checked = state.settings.justified;
  document.getElementById("justify-toggle").addEventListener("change", (e) => {
    state.settings.justified = e.target.checked;
    persistSettingsAndRepaginate();
  });

  const learnToggle = document.getElementById("learn-words-toggle");
  learnToggle.checked = state.settings.learnWordsOnly;
  learnToggle.addEventListener("change", (e) => {
    state.settings.learnWordsOnly = e.target.checked;
    persistSettingsAndRepaginate();
  });

  document.querySelectorAll("[data-theme-btn]").forEach((b) => {
    b.classList.toggle("active", b.dataset.themeBtn === state.settings.theme);
  });
  document.querySelectorAll("[data-margin-btn]").forEach((b) => {
    b.classList.toggle("active", b.dataset.marginBtn === state.settings.margin);
  });
}

function setTheme(theme) {
  state.settings.theme = theme;
  document.querySelectorAll("[data-theme-btn]").forEach((b) => {
    b.classList.toggle("active", b.dataset.themeBtn === theme);
  });
  persistSettingsAndRepaginate();
}

function persistSettingsAndRepaginate() {
  saveSettings(state.settings);
  applyTheme();
  if (isReaderRoute() && state.chapter) {
    repaginate();
  }
}

async function render() {
  setError("");
  applyTheme();
  updateSettingsSheetMode();

  if (state.route.name === "library") {
    showScreen("library");
    renderLibrary();
    return;
  }

  if (state.route.name === "book") {
    showScreen("chapters");
    renderChapters(state.route.bookId);
    return;
  }

  if (state.route.name === "notebook") {
    showScreen("notebook");
    await renderNotebook();
    return;
  }

  if (state.route.name === "plan") {
    showScreen("plan");
    await renderPlanDashboard();
    return;
  }

  if (state.route.name === "planDay") {
    showScreen("plan-day");
    await renderPlanDay(state.route.dayIndex);
    return;
  }

  if (state.route.name === "planPassage") {
    showScreen("reader");
    await renderPlanPassage(state.route.dayIndex, state.route.sectionKey);
    return;
  }

  if (state.route.name === "read") {
    showScreen("reader");
    await renderReader(state.route.bookId, state.route.chapter);
  }
}

function renderLibrary() {
  els.libraryList.innerHTML = "";

  const otBooks = state.books.filter((b) => b.testament === "ot");
  const ntBooks = state.books.filter((b) => b.testament === "nt");

  els.libraryList.appendChild(
    buildTestamentSection("Old Testament", "תנ״ך", otBooks, { dir: "rtl", lang: "he" })
  );
  els.libraryList.appendChild(
    buildTestamentSection("New Testament", "Καινή Διαθήκη", ntBooks, { dir: "ltr", lang: "el" })
  );
  els.libraryList.appendChild(buildOfflineCard());
}

function buildOfflineCard() {
  const card = document.createElement("article");
  card.className = "plan-card offline-card";

  if (isOfflineDownloaded()) {
    card.innerHTML = `
      <h3>✓ Available offline</h3>
      <p>The complete Bible is downloaded to this device. You can read every chapter in original languages and English without an internet connection.</p>
    `;
    return card;
  }

  card.innerHTML = `
    <h3>Download for offline use</h3>
    <p>Save the complete Bible — all 66 books in original languages and English — on this device (about 8 MB). After that, everything works without internet.</p>
    <div class="plan-progress" id="offline-progress" hidden>
      <div class="plan-progress__bar">
        <div class="plan-progress__fill" id="offline-progress-fill" style="width:0%"></div>
      </div>
      <p class="plan-progress__text" id="offline-progress-text"></p>
    </div>
    <div class="plan-actions">
      <button type="button" class="plan-btn plan-btn--primary" id="btn-offline-download">Download full Bible</button>
    </div>
  `;

  const btn = card.querySelector("#btn-offline-download");
  btn.addEventListener("click", async () => {
    if (!navigator.onLine) {
      setError("You are offline. Connect to the internet to download the Bible.");
      return;
    }

    const progressWrap = card.querySelector("#offline-progress");
    const fill = card.querySelector("#offline-progress-fill");
    const text = card.querySelector("#offline-progress-text");

    btn.disabled = true;
    btn.textContent = "Downloading…";
    progressWrap.hidden = false;

    try {
      await downloadFullBible((done, total) => {
        const percent = Math.round((done / total) * 100);
        fill.style.width = `${percent}%`;
        text.textContent = `${done} of ${total} chapters downloaded (${percent}%)`;
      });
      renderLibrary();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Resume download";
      text.textContent = "Download interrupted — tap Resume to continue where it stopped.";
      setError(err.message || "Download failed. Check your connection and try again.");
    }
  });

  return card;
}

function buildTestamentSection(titleEn, titleOriginal, books, labelAttrs = { dir: "rtl", lang: "he" }) {
  const section = document.createElement("section");
  section.className = "testament-section";

  const heading = document.createElement("div");
  heading.className = "section-heading";
  heading.innerHTML = `
    <h2 class="section-label">${escapeHtml(titleEn)}</h2>
    <p class="section-label-original" dir="${labelAttrs.dir}" lang="${labelAttrs.lang}">${escapeHtml(titleOriginal)}</p>
  `;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "book-grid";

  for (const book of books) {
    const isGreek = book.script === "greek";
    const origDir = isGreek ? "ltr" : "rtl";
    const origLang = isGreek ? "el" : "he";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "book-cell";
    btn.innerHTML = `
      <span class="book-cell__english">${escapeHtml(book.nameEnglish)}</span>
      <span class="book-cell__original" dir="${origDir}" lang="${origLang}">${escapeHtml(book.nameOriginal)}</span>
    `;
    btn.addEventListener("click", () => navigate({ name: "book", bookId: book.id }));
    grid.appendChild(btn);
  }

  section.appendChild(grid);
  return section;
}

function renderAboutSheet() {
  if (!els.aboutContent) return;

  const blocks = [ABOUT_CONTENT.original, ABOUT_CONTENT.english, ABOUT_CONTENT.audio];
  els.aboutContent.innerHTML = blocks
    .map((block) => {
      const origTitle = block.titleOriginal
        ? `<p class="about-block__original-title">${escapeHtml(block.titleOriginal)}</p>`
        : "";
      const points = block.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
      return `
        <article class="about-block">
          <h3>${escapeHtml(block.title)}</h3>
          ${origTitle}
          <p class="about-meta">${escapeHtml(block.year)} · ${escapeHtml(block.license)}</p>
          <ul>${points}</ul>
          <a class="about-link" href="${escapeHtml(block.link)}" target="_blank" rel="noopener noreferrer">Learn more</a>
        </article>
      `;
    })
    .join("");
}

function renderGuideSheet() {
  if (!els.guideContent) return;

  els.guideContent.innerHTML = GUIDE_CONTENT.map((section) => {
    const points = section.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
    return `
      <article class="about-block">
        <h3>${escapeHtml(section.title)}</h3>
        <ul>${points}</ul>
      </article>
    `;
  }).join("");
}

function renderChapterAudioBar(bookId) {
  if (!els.chapterAudioBar) return;

  const book = getBook(state.books, bookId);
  if (!book) {
    els.chapterAudioBar.innerHTML = "";
    return;
  }

  if (isBookAudioDownloaded(bookId)) {
    els.chapterAudioBar.innerHTML = `
      <p class="chapter-audio-bar__status">✓ Book audio available offline</p>
    `;
    return;
  }

  els.chapterAudioBar.innerHTML = `
    <p class="chapter-audio-bar__hint">Download verse audio for all of ${escapeHtml(book.nameEnglish)} for offline listening.</p>
    <div class="plan-progress" id="book-audio-progress" hidden>
      <div class="plan-progress__bar">
        <div class="plan-progress__fill" id="book-audio-progress-fill" style="width:0%"></div>
      </div>
      <p class="plan-progress__text" id="book-audio-progress-text"></p>
    </div>
    <div class="plan-actions">
      <button type="button" class="plan-btn plan-btn--primary" id="btn-book-audio-download">Download book audio</button>
    </div>
  `;

  const btn = els.chapterAudioBar.querySelector("#btn-book-audio-download");
  btn.addEventListener("click", async () => {
    if (!navigator.onLine) {
      setError("You are offline. Connect to the internet to download book audio.");
      return;
    }

    const progressWrap = els.chapterAudioBar.querySelector("#book-audio-progress");
    const fill = els.chapterAudioBar.querySelector("#book-audio-progress-fill");
    const text = els.chapterAudioBar.querySelector("#book-audio-progress-text");

    btn.disabled = true;
    btn.textContent = "Downloading…";
    progressWrap.hidden = false;

    try {
      await downloadBookAudio(bookId, (done, total) => {
        const percent = Math.round((done / total) * 100);
        fill.style.width = `${percent}%`;
        text.textContent = `${done} of ${total} archives downloaded (${percent}%)`;
      });
      renderChapterAudioBar(bookId);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Resume download";
      text.textContent = "Download interrupted — tap Resume to continue.";
      setError(err.message || "Audio download failed. Check your connection and try again.");
    }
  });
}

function renderChapters(bookId) {
  const book = getBook(state.books, bookId);
  if (!book) {
    setError("Book not found");
    navigate({ name: "library" });
    return;
  }

  els.chapterTitle.textContent = `${book.nameEnglish} · ${book.nameOriginal}`;
  els.chapterSubtitle.textContent = `${book.chapterCount} chapters`;
  els.chapterGrid.innerHTML = "";
  renderChapterAudioBar(bookId);

  for (let ch = 1; ch <= book.chapterCount; ch += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chapter-cell";
    btn.textContent = ch;
    btn.addEventListener("click", () => navigate({ name: "read", bookId, chapter: ch }));
    els.chapterGrid.appendChild(btn);
  }
}

async function loadChapterHighlights(bookId, chapter) {
  const all = await listHighlights();
  const map = new Map();
  for (const h of all) {
    if (h.bookId === bookId && h.chapter === chapter) {
      map.set(h.verse, h.color);
    }
  }
  state.highlights = map;
}

async function loadPassageHighlights(verses) {
  const all = await listHighlights();
  const map = new Map();
  for (const verse of verses) {
    for (const h of all) {
      if (h.bookId === verse.bookId && h.chapter === verse.chapter && h.verse === verse.verse) {
        const key = verse.showChapter ? `${verse.chapter}:${verse.verse}` : verse.verse;
        map.set(key, h.color);
      }
    }
  }
  state.highlights = map;
}

async function renderPlanDashboard() {
  if (!els.planDashboard) return;

  try {
    setLoading(true);
    await loadPlan();
    const meta = getPlanMeta();
    const stats = await getStats(meta.totalDays);

    els.planDashboard.innerHTML = `
      <div class="plan-stats">
        <div class="plan-stat">
          <span class="plan-stat__value">${stats.streak}</span>
          <span class="plan-stat__label">Day streak</span>
        </div>
        <div class="plan-stat">
          <span class="plan-stat__value">${stats.completed}</span>
          <span class="plan-stat__label">Days done</span>
        </div>
      </div>
      <article class="plan-card">
        <h3>${escapeHtml(meta.name)}</h3>
        <p>${escapeHtml(meta.subtitle)}</p>
        <div class="plan-progress">
          <div class="plan-progress__bar">
            <div class="plan-progress__fill" style="width:${stats.percent}%"></div>
          </div>
          <p class="plan-progress__text">${stats.completed} of ${stats.total} days complete (${stats.percent}%)</p>
        </div>
        <div class="plan-actions">
          ${
            stats.started
              ? `<button type="button" class="plan-btn plan-btn--primary" id="btn-plan-continue">Continue Day ${stats.currentDay}</button>
                 <button type="button" class="plan-btn plan-btn--danger" id="btn-plan-reset">Restart from beginning</button>`
              : `<button type="button" class="plan-btn plan-btn--primary" id="btn-plan-start">Start plan</button>`
          }
        </div>
      </article>
      <article class="plan-card">
        <h3>How it works</h3>
        <p>Each day has five readings from the Book of Common Prayer lectionary. Tap a passage to read it in original languages and English from your Bible text. Mark the day complete when finished.</p>
      </article>
    `;

    document.getElementById("btn-plan-start")?.addEventListener("click", async () => {
      await startPlan();
      navigate({ name: "planDay", dayIndex: 1 });
    });
    document.getElementById("btn-plan-continue")?.addEventListener("click", () => {
      navigate({ name: "planDay", dayIndex: stats.currentDay });
    });
    document.getElementById("btn-plan-reset")?.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Restart the reading plan from Day 1?\n\nThis clears all completed days and your streak. This cannot be undone."
      );
      if (!confirmed) return;
      await resetPlan();
      await renderPlanDashboard();
    });
  } catch (err) {
    setError(err.message || "Failed to load reading plan");
  } finally {
    setLoading(false);
  }
}

async function renderPlanDay(dayIndex) {
  if (!els.planDayContent) return;

  try {
    setLoading(true);
    const day = await getPlanDay(dayIndex);
    const meta = getPlanMeta();
    const complete = await isDayComplete(dayIndex);

    els.planDayTitle.textContent = `Day ${dayIndex}`;
    els.planDaySubtitle.textContent = `${dayIndex} of ${meta.totalDays}`;

    const list = document.createElement("div");
    list.className = "plan-passage-list";

    for (const section of day.sections) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "plan-passage-card";
      card.innerHTML = `
        <span class="plan-passage-card__title">${escapeHtml(section.title)}</span>
        <span class="plan-passage-card__ref">${escapeHtml(section.displayText)}</span>
      `;
      card.addEventListener("click", () => {
        navigate({ name: "planPassage", dayIndex, sectionKey: section.key });
      });
      list.appendChild(card);
    }

    els.planDayContent.innerHTML = "";
    els.planDayContent.appendChild(list);

    const completeBtn = document.createElement("button");
    completeBtn.type = "button";
    completeBtn.className = "plan-btn plan-btn--primary plan-complete-btn";
    completeBtn.textContent = complete ? "Day completed" : "Mark day complete";
    completeBtn.disabled = complete;
    completeBtn.addEventListener("click", async () => {
      await markDayComplete(dayIndex);
      await renderPlanDay(dayIndex);
    });
    els.planDayContent.appendChild(completeBtn);

    const nav = document.createElement("div");
    nav.className = "plan-day-nav";
    if (dayIndex > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "plan-btn";
      prev.textContent = `← Day ${dayIndex - 1}`;
      prev.addEventListener("click", () => navigate({ name: "planDay", dayIndex: dayIndex - 1 }));
      nav.appendChild(prev);
    } else {
      nav.appendChild(document.createElement("span"));
    }
    if (dayIndex < meta.totalDays) {
      const next = document.createElement("button");
      next.type = "button";
      next.className = "plan-btn";
      next.textContent = `Day ${dayIndex + 1} →`;
      next.addEventListener("click", () => navigate({ name: "planDay", dayIndex: dayIndex + 1 }));
      nav.appendChild(next);
    }
    els.planDayContent.appendChild(nav);
  } catch (err) {
    setError(err.message || "Failed to load plan day");
  } finally {
    setLoading(false);
  }
}

async function renderPlanPassage(dayIndex, sectionKey) {
  const section = getSectionByKey(sectionKey);
  if (!section) {
    setError("Reading section not found");
    navigate({ name: "planDay", dayIndex });
    return;
  }

  try {
    setLoading(true);
    els.readerShell?.classList.add("reader-shell--changing");
    const day = await getPlanDay(dayIndex);
    const daySection = day.sections.find((item) => item.key === sectionKey);
    if (!daySection?.passageSpecs?.length) {
      throw new Error("No passage references for this reading");
    }

    state.chapter = await fetchMergedPassage(daySection.passageSpecs, {
      referenceLabel: daySection.displayText,
      planContext: {
        dayIndex,
        sectionKey,
        sectionTitle: section.title,
      },
    });

    window.__hebBibleCurrentVerses = state.chapter.verses;
    window.__hebBibleBookId = state.chapter.bookId;
    window.__hebBibleChapter = state.chapter.chapter;
    window.__hebBibleBookName = state.chapter.bookNameEnglish;

    await loadPassageHighlights(state.chapter.verses);
    state.totalWords = countWordsInVerses(state.chapter.verses);

    els.readerHeaderEn.textContent = `${section.title} · ${state.chapter.referenceLabel}`;
    els.readerHeaderOrig.textContent = `Daily Reading Plan · Day ${dayIndex}`;

    state.pageIndex = 0;
    state.startPage = "first";
    repaginate();
    renderPages();
    updateFooter();
    updateNavButtons();
  } catch (err) {
    setError(err.message || "Failed to load passage");
    navigate({ name: "planDay", dayIndex });
  } finally {
    setLoading(false);
    requestAnimationFrame(() => {
      els.readerShell?.classList.remove("reader-shell--changing");
    });
  }
}

function applyReaderHeaderOrig(book) {
  if (!els.readerHeaderOrig) return;

  if (book?.script === "greek") {
    els.readerHeaderOrig.dir = "ltr";
    els.readerHeaderOrig.lang = "el";
    els.readerHeaderOrig.classList.add("reader-bar__orig--greek");
  } else {
    els.readerHeaderOrig.dir = "rtl";
    els.readerHeaderOrig.lang = "he";
    els.readerHeaderOrig.classList.remove("reader-bar__orig--greek");
  }
}

async function renderReader(bookId, chapter) {
  const book = getBook(state.books, bookId);
  if (!book) {
    setError("Book not found");
    return;
  }

  els.readerHeaderEn.textContent = `${book.nameEnglish} ${chapter}`;
  els.readerHeaderOrig.textContent = `${book.nameOriginal} ${chapter}`;
  applyReaderHeaderOrig(book);

  const readerScreen = document.querySelector('[data-screen="reader"]');
  if (readerScreen) {
    readerScreen.dataset.bookId = String(bookId);
  }

  try {
    setLoading(true);
    els.readerShell?.classList.add("reader-shell--changing");
    state.chapter = await fetchMergedChapter(bookId, chapter);

    window.__hebBibleCurrentVerses = state.chapter.verses;
    window.__hebBibleBookId = bookId;
    window.__hebBibleChapter = chapter;
    window.__hebBibleBookName = book.nameEnglish;

    await loadChapterHighlights(bookId, chapter);
    state.totalWords = countWordsInVerses(state.chapter.verses);
    repaginate();
    if (state.startPage === "last") {
      state.pageIndex = Math.max(0, state.pages.length - 1);
    } else {
      state.pageIndex = 0;
    }
    state.startPage = "first";
    renderPages();
    updateFooter();
    updateNavButtons();
  } catch (err) {
    setError(err.message || "Failed to load chapter");
  } finally {
    setLoading(false);
    requestAnimationFrame(() => {
      els.readerShell?.classList.remove("reader-shell--changing");
    });
  }
}

function repaginate() {
  if (!state.chapter) return;

  const viewport = document.querySelector(".reader-viewport");
  const pageHeight = viewport ? viewport.clientHeight : 480;
  const measureHost = els.measure.parentElement;
  if (viewport && measureHost) {
    measureHost.style.width = `${viewport.clientWidth}px`;
    measureHost.style.height = `${pageHeight}px`;
  }
  const settings = {
    ...state.settings,
    marginPadding: marginPadding(state.settings.margin),
  };

  state.pages = paginateVerses(
    state.chapter.verses,
    els.measure,
    pageHeight,
    settings,
    state.highlights
  );

  if (state.pageIndex >= state.pages.length) {
    state.pageIndex = Math.max(0, state.pages.length - 1);
  }

  renderPages();
  updateFooter();
  updateNavButtons();
}

function renderPages() {
  els.pageTrack.innerHTML = "";
  state.pages.forEach((html, index) => {
    const page = document.createElement("div");
    page.className = "reader-page";
    page.dataset.page = String(index);
    page.innerHTML = `<div class="reader-page-inner">${html}</div>`;
    if (index === state.pageIndex) page.classList.add("reader-page--active");
    els.pageTrack.appendChild(page);
  });
  els.pageTrack.style.transform = `translateX(-${state.pageIndex * 100}%)`;
}

function goAdjacentChapter(direction) {
  if (!isNormalReaderRoute()) return;
  const adj = getAdjacentChapter(
    state.books,
    state.route.bookId,
    state.route.chapter,
    direction
  );
  if (!adj) return;
  els.readerShell?.classList.add("reader-shell--changing");
  state.startPage = adj.startPage;
  navigate({ name: "read", bookId: adj.bookId, chapter: adj.chapter });
}

function updateNavButtons() {
  const prevBtn = document.getElementById("btn-prev-page");
  const nextBtn = document.getElementById("btn-next-page");
  if (!prevBtn || !nextBtn || !isReaderRoute()) return;

  let hasPrev = state.pageIndex > 0;
  let hasNext = state.pageIndex < state.pages.length - 1;

  if (isNormalReaderRoute()) {
    hasPrev =
      hasPrev ||
      getAdjacentChapter(state.books, state.route.bookId, state.route.chapter, "prev");
    hasNext =
      hasNext ||
      getAdjacentChapter(state.books, state.route.bookId, state.route.chapter, "next");
  }

  prevBtn.disabled = !hasPrev;
  nextBtn.disabled = !hasNext;
  prevBtn.style.opacity = hasPrev ? "0.35" : "0.12";
  nextBtn.style.opacity = hasNext ? "0.35" : "0.12";
}

function goPage(index) {
  if (index >= state.pages.length) {
    if (isNormalReaderRoute()) goAdjacentChapter("next");
    return;
  }
  if (index < 0) {
    if (isNormalReaderRoute()) goAdjacentChapter("prev");
    return;
  }
  state.pageIndex = index;
  els.pageTrack.querySelectorAll(".reader-page").forEach((p, i) => {
    p.classList.toggle("reader-page--active", i === index);
  });
  els.pageTrack.style.transform = `translateX(-${index * 100}%)`;
  updateFooter();
  updateNavButtons();
}

function updateFooter() {
  const { percent, minutesLeft } = readingStats(
    state.totalWords,
    state.pageIndex + 1,
    state.pages.length
  );

  if (state.route.name === "planPassage" && state.chapter?.planContext) {
    const ctx = state.chapter.planContext;
    els.readerFooter.textContent =
      `Daily Reading Plan · Day ${ctx.dayIndex} · ${ctx.sectionTitle} · Page ${state.pageIndex + 1} of ${state.pages.length} · ${minutesLeft} min left · ${percent}% read`;
    return;
  }

  const book = getBook(state.books, state.route.bookId);
  const en = book ? `${book.nameEnglish} ${state.route.chapter}` : "";
  const orig = book ? `${book.nameOriginal} ${state.route.chapter}` : "";
  els.readerFooter.textContent = `${en} · ${orig} · Page ${state.pageIndex + 1} of ${state.pages.length} · ${minutesLeft} min left · ${percent}% read`;
}

function setupSwipe(el) {
  let startX = 0;
  el.addEventListener(
    "touchstart",
    (e) => {
      startX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  el.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].screenX - startX;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) goPage(state.pageIndex + 1);
      else goPage(state.pageIndex - 1);
    },
    { passive: true }
  );
}

function setupLongPress(el) {
  let timer = null;
  el.addEventListener("touchstart", (e) => {
    const pair = e.target.closest(".verse-pair");
    if (!pair) return;
    const verse = Number(pair.dataset.verse);
    const chapter = pair.dataset.chapter ? Number(pair.dataset.chapter) : undefined;
    timer = setTimeout(() => openHighlightMenu(verse, chapter), 550);
  });
  el.addEventListener("touchend", () => clearTimeout(timer));
  el.addEventListener("touchmove", () => clearTimeout(timer));
}

function handleVerseTap(verse, chapterOverride) {
  if (!isReaderRoute()) return;
  openHighlightMenu(verse, chapterOverride);
}

async function openHighlightMenu(verse, chapterOverride) {
  const chapterNumber = chapterOverride ?? state.route.chapter;
  const bookId = state.chapter?.isPassage
    ? state.chapter.verses.find((v) => v.verse === verse && (!chapterOverride || v.chapter === chapterOverride))?.bookId ?? state.chapter.bookId
    : state.route.bookId;

  const existing = await getHighlightForVerse(bookId, chapterNumber, verse);
  const verseData = state.chapter.verses.find(
    (v) => v.verse === verse && (chapterOverride ? v.chapter === chapterOverride : true)
  );
  if (!verseData) return;

  const choice = window.prompt(
    `Verse ${verse}\n\nEnter color: yellow, green, blue\nOr type "remove" to delete highlight\nOr type a short note after color (e.g. yellow: my note)`,
    existing ? "remove" : "yellow"
  );
  if (choice === null) return;

  const trimmed = choice.trim().toLowerCase();
  if (trimmed === "remove" && existing) {
    await removeHighlight(existing.id);
    const highlightKey = state.chapter?.multiChapter ? `${chapterNumber}:${verse}` : verse;
    state.highlights.delete(highlightKey);
    repaginate();
    return;
  }

  const match = trimmed.match(/^(yellow|green|blue)(?::(.+))?$/);
  if (!match) return;

  const colorDef = HIGHLIGHT_COLORS.find((c) => c.id === match[1]);
  if (!colorDef) return;

  if (existing) await removeHighlight(existing.id);

  await addHighlight({
    bookId,
    chapter: chapterNumber,
    verse,
    color: colorDef.value,
    colorName: colorDef.id,
    note: match[2]?.trim() || "",
    previewOriginal: verseData.original || "",
    previewEnglish: verseData.english || "",
    reference: `${ENGLISH_BOOK_NAMES[bookId]} ${chapterNumber}:${verse}`,
  });

  const highlightKey = state.chapter?.multiChapter ? `${chapterNumber}:${verse}` : verse;
  state.highlights.set(highlightKey, colorDef.value);
  repaginate();
}

async function renderNotebook() {
  const items = await listHighlights();
  els.notebookList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No highlights yet. Long-press a verse in the reader to save one.";
    els.notebookList.appendChild(empty);
    return;
  }

  for (const item of items) {
    const book = getBook(state.books, item.bookId);
    const isGreek = book?.script === "greek";
    const origDir = isGreek ? "ltr" : "rtl";
    const origLang = isGreek ? "el" : "he";

    const card = document.createElement("article");
    card.className = "notebook-card";
    card.style.borderLeftColor = item.color;
    card.innerHTML = `
      <div class="notebook-card__header">
        <h3>${escapeHtml(item.reference)}</h3>
        <button type="button" class="notebook-delete" aria-label="Delete this highlight" title="Delete">✕</button>
      </div>
      ${item.previewOriginal ? `<p class="notebook-original" dir="${origDir}" lang="${origLang}">${escapeHtml(item.previewOriginal)}</p>` : ""}
      ${item.previewEnglish ? `<p class="notebook-en">${escapeHtml(item.previewEnglish)}</p>` : ""}
      ${item.note ? `<p class="notebook-note">${escapeHtml(item.note)}</p>` : ""}
    `;
    card.addEventListener("click", () => {
      navigate({ name: "read", bookId: item.bookId, chapter: item.chapter });
    });
    card.querySelector(".notebook-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = window.confirm(`Delete highlight for ${item.reference}?`);
      if (!confirmed) return;
      await removeHighlight(item.id);
      await renderNotebook();
    });
    els.notebookList.appendChild(card);
  }

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "plan-btn plan-btn--danger notebook-clear-btn";
  clearBtn.textContent = "Clear all highlights";
  clearBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      `Delete all ${items.length} highlights?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    await clearHighlights();
    await renderNotebook();
  });
  els.notebookList.appendChild(clearBtn);
}

window.addEventListener("resize", () => {
  if (isReaderRoute() && state.chapter) {
    repaginate();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

init();

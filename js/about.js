/** Translation information shown in the About panel. */

export const GUIDE_CONTENT = [
  {
    title: "Purpose of this app",
    points: [
      "Read the Holy Bible in Hebrew (Old Testament), Greek (New Testament), and English together — original language, Roman transliteration, and World English Bible.",
      "Key words are underlined so you can tap to learn pronunciation, gloss, and Strong's numbers.",
      "Seeing all three layers helps you understand Scripture in the original languages while reading fluent English.",
    ],
  },
  {
    title: "How to read",
    points: [
      "Choose a book from the Old or New Testament, then pick a chapter.",
      "Each verse shows: original text (Hebrew RTL or Greek LTR), Roman transliteration, then English WEB.",
      "Swipe left or right to turn pages. Tap Aa for font size, theme, margins, and the Learn words toggle.",
      "Tap any underlined key word to open the learning panel with gloss, Strong's number, and verse audio.",
    ],
  },
  {
    title: "Audio",
    points: [
      "Verse audio plays from MP3_OpenHebrewGreekBible_fast (CC BY 4.0) when you tap Play in the word panel.",
      "First play streams from the archive; later plays use your device cache.",
      "On the chapter screen, download audio for the whole book for offline listening.",
    ],
  },
  {
    title: "Highlights and notes",
    points: [
      "Long-press or tap a verse to highlight in yellow, green, or blue.",
      "Add a note with: yellow: my note. Saved highlights appear in Notebook.",
    ],
  },
  {
    title: "Daily Reading Plan",
    points: [
      "814-day Book of Common Prayer lectionary with five daily passages.",
      "Tap any passage to read in original languages and English. Mark the day complete to track your streak.",
    ],
  },
  {
    title: "Read offline",
    points: [
      "Download the full Bible text from the home screen (about 8 MB).",
      "Download per-book audio from the chapter grid for offline verse pronunciation.",
    ],
  },
];

export const ABOUT_CONTENT = {
  original: {
    title: "Original Languages (WLC + Nestle 1904)",
    titleOriginal: "עברית · Ελληνικά",
    year: "Public domain sources",
    license: "Public Domain",
    points: [
      "Old Testament: Westminster Leningrad Codex (Hebrew/Aramaic) with vowels, cantillation stripped.",
      "New Testament: Nestle 1904 Greek critical text.",
      "Roman transliteration uses SBL simple (ASCII) scheme for learners.",
      "Word-level glosses from Strong's dictionaries with curated labels for divine names.",
      "Data: sgeorge83/original-language-bible-data on GitHub.",
    ],
    link: "https://github.com/sgeorge83/original-language-bible-data",
  },
  english: {
    title: "World English Bible (WEB)",
    year: "2006",
    license: "Public Domain",
    points: [
      "Modern English translation in the lineage of the American Standard Version (1901).",
      "Public domain — free to use, share, and republish without restrictions.",
      "Paired verse-by-verse with Hebrew and Greek on book + chapter + verse.",
    ],
    link: "https://worldenglish.bible/",
  },
  audio: {
    title: "Verse Audio",
    year: "2022",
    license: "CC BY 4.0",
    points: [
      "Hebrew and Greek verse pronunciation from MP3_OpenHebrewGreekBible_fast by Eliran Wong.",
      "One MP3 per verse; tap a key word to hear the parent verse read aloud.",
      "Attribution required when redistributing audio files.",
    ],
    link: "https://github.com/eliranwong/MP3_OpenHebrewGreekBible_fast",
  },
};

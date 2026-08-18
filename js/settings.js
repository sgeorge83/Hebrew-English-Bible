const STORAGE_KEY = "hebrewReaderSettings";

export const DEFAULT_SETTINGS = {
  fontSize: 17,
  theme: "sepia",
  margin: "medium",
  justified: true,
  learnWordsOnly: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function marginPadding(margin) {
  if (margin === "tight") return "12px";
  if (margin === "wide") return "28px";
  return "18px";
}

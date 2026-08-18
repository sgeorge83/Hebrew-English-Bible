import { parseReferenceString } from "./reference-parser.js";

const PLAN_URL = "./data/book-of-common-prayer-plan.json";
const PLAN_FALLBACK_URL =
  "https://raw.githubusercontent.com/sgeorge83/Hebrew-English-Bible/main/data/book-of-common-prayer-plan.json";

export const PLAN_SECTIONS = [
  { key: "first-psalm", jsonKey: "First Psalm", title: "First Psalm" },
  { key: "second-psalm", jsonKey: "Second Psalm", title: "Second Psalm" },
  { key: "old-testament", jsonKey: "Old Testament", title: "Old Testament" },
  { key: "new-testament", jsonKey: "New Testament", title: "New Testament" },
  { key: "gospel", jsonKey: "Gospel", title: "Gospel" },
];

const SECTION_BY_KEY = Object.fromEntries(PLAN_SECTIONS.map((section) => [section.key, section]));

let cachedPlan = null;

export function getPlanMeta() {
  return {
    id: "bcp-daily",
    name: "Daily Reading Plan",
    subtitle: "Book of Common Prayer · 814 days",
    totalDays: cachedPlan?.length ?? 814,
    sections: PLAN_SECTIONS,
  };
}

async function fetchPlanFrom(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Plan fetch failed (${response.status})`);
  }
  const plan = await response.json();
  if (!Array.isArray(plan) || !plan.length) {
    throw new Error("Plan data is empty");
  }
  return plan;
}

export async function loadPlan() {
  if (cachedPlan) return cachedPlan;

  try {
    cachedPlan = await fetchPlanFrom(PLAN_URL);
  } catch {
    cachedPlan = await fetchPlanFrom(PLAN_FALLBACK_URL);
  }
  return cachedPlan;
}

export function getSectionByKey(sectionKey) {
  return SECTION_BY_KEY[sectionKey] ?? null;
}

export async function getPlanDay(dayIndex) {
  const plan = await loadPlan();
  const index = dayIndex - 1;
  if (index < 0 || index >= plan.length) {
    throw new Error(`Plan day not found: ${dayIndex}`);
  }

  const rawDay = plan[index];
  const sections = PLAN_SECTIONS.map((section) => {
    const displayText = rawDay[section.jsonKey] ?? "";
    const passageSpecs = displayText ? parseReferenceString(displayText) : [];
    return {
      key: section.key,
      title: section.title,
      displayText,
      passageSpecs,
    };
  });

  return { dayIndex, sections };
}

const DB_NAME = "hebrew-english-bible-plan";
const STORE = "progress";
const DB_VERSION = 1;
const PLAN_ID = "bcp-daily";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "planId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function defaultProgress() {
  return {
    planId: PLAN_ID,
    startedAt: null,
    completedDays: [],
    completionDates: {},
    currentDay: 1,
  };
}

async function readProgress() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(PLAN_ID);
    request.onsuccess = () => resolve({ ...defaultProgress(), ...(request.result ?? {}) });
    request.onerror = () => reject(request.error);
  });
}

async function writeProgress(progress) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...progress, planId: PLAN_ID });
    tx.oncomplete = () => resolve(progress);
    tx.onerror = () => reject(tx.error);
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function calculateStreak(completionDates) {
  const dates = [...new Set(Object.values(completionDates))].sort().reverse();
  if (!dates.length) return 0;

  const today = todayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dates[0] !== today && dates[0] !== yesterdayKey) {
    return 0;
  }

  let streak = 0;
  let cursor = dates[0] === today ? today : yesterdayKey;

  while (dates.includes(cursor)) {
    streak += 1;
    const next = new Date(`${cursor}T12:00:00`);
    next.setDate(next.getDate() - 1);
    cursor = next.toISOString().slice(0, 10);
  }

  return streak;
}

export async function getPlanProgress() {
  return readProgress();
}

export async function resetPlan() {
  return writeProgress(defaultProgress());
}

export async function startPlan() {
  const progress = await readProgress();
  if (progress.startedAt) return progress;

  const next = {
    ...progress,
    startedAt: new Date().toISOString(),
    currentDay: 1,
  };
  return writeProgress(next);
}

export async function isDayComplete(dayIndex) {
  const progress = await readProgress();
  return progress.completedDays.includes(dayIndex);
}

export async function markDayComplete(dayIndex) {
  const progress = await readProgress();
  if (!progress.startedAt) {
    progress.startedAt = new Date().toISOString();
  }

  if (!progress.completedDays.includes(dayIndex)) {
    progress.completedDays.push(dayIndex);
  }
  progress.completionDates[String(dayIndex)] = todayKey();
  progress.currentDay = Math.min(dayIndex + 1, 814);
  return writeProgress(progress);
}

export async function getStats(totalDays = 814) {
  const progress = await readProgress();
  const completed = progress.completedDays.length;
  return {
    started: Boolean(progress.startedAt),
    startedAt: progress.startedAt,
    completed,
    total: totalDays,
    percent: totalDays ? Math.round((completed / totalDays) * 100) : 0,
    streak: calculateStreak(progress.completionDates),
    currentDay: progress.currentDay || 1,
  };
}

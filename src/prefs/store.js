const fs = require("fs").promises;
const path = require("path");

const PREFS_PATH = path.resolve(__dirname, "../../data/prefs.json");

async function ensureFile() {
  try { await fs.access(PREFS_PATH); }
  catch {
    const seed = { version: 1, users: {} };
    await fs.mkdir(path.dirname(PREFS_PATH), { recursive: true });
    await fs.writeFile(PREFS_PATH, JSON.stringify(seed, null, 2));
  }
}

async function loadAll() {
  await ensureFile();
  const raw = await fs.readFile(PREFS_PATH, "utf8");
  try { return JSON.parse(raw || "{}"); }
  catch { return { version: 1, users: {} }; }
}

async function saveAll(data) {
  await fs.writeFile(PREFS_PATH, JSON.stringify(data, null, 2));
}

function emptyUserPrefs() {
  return {
    calendar: { courseColors: {}, eventOverrides: {} },
    ui: { defaultView: "dayGridMonth", showPastEvents: true }
  };
}

async function getUserPrefs(userid) {
  const all = await loadAll();
  if (!all.users[userid]) {
    all.users[userid] = emptyUserPrefs();
    await saveAll(all);
  }
  return all.users[userid];
}

async function setCourseColor(userid, courseId, color) {
  const all = await loadAll();
  if (!all.users[userid]) all.users[userid] = emptyUserPrefs();
  all.users[userid].calendar.courseColors[String(courseId)] = String(color);
  await saveAll(all);
  return all.users[userid];
}

async function setEventOverride(userid, id, patch = {}) {
  const all = await loadAll();
  if (!all.users[userid]) all.users[userid] = emptyUserPrefs();
  const cur = all.users[userid].calendar.eventOverrides[id] || {};
  all.users[userid].calendar.eventOverrides[id] = { ...cur, ...patch };
  await saveAll(all);
  return all.users[userid];
}

module.exports = {
  getUserPrefs,
  setCourseColor,
  setEventOverride,
};
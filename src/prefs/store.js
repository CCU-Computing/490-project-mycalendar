const { getDatabase } = require("../db/init");

/**
 * get default empty user preferences structure
 */
function emptyUserPrefs() {
  return {
    calendar: { courseColors: {}, eventOverrides: {}, assignmentTypeColors: {} },
    ui: { defaultView: "dayGridMonth", showPastEvents: true },
  };
}

/**
 * get all preferences for a user
 * returns same structure as JSON-based system for backward compatibility
 */
async function getUserPrefs(userid) {
  const db = getDatabase();
  const uid = String(userid);

  // get course colors
  const colors = db
    .prepare("SELECT course_id, color FROM course_colors WHERE user_id = ?")
    .all(uid);

  const courseColors = {};
  for (const row of colors) {
    courseColors[row.course_id] = row.color;
  }

  // get event overrides
  const overrides = db
    .prepare(
      "SELECT event_id, color, text_color FROM event_overrides WHERE user_id = ?"
    )
    .all(uid);

  const eventOverrides = {};
  for (const row of overrides) {
    eventOverrides[row.event_id] = {
      ...(row.color ? { color: row.color } : {}),
      ...(row.text_color ? { textColor: row.text_color } : {}),
    };
  }

  // get assignment type colors
  const typeColors = db
    .prepare("SELECT assignment_type, color FROM assignment_type_colors WHERE user_id = ?")
    .all(uid);

  const assignmentTypeColors = {};
  for (const row of typeColors) {
    assignmentTypeColors[row.assignment_type] = row.color;
  }

  // get UI prefs
  const uiPref = db
    .prepare("SELECT pref_value FROM user_preferences WHERE user_id = ? AND pref_key = 'ui'")
    .get(uid);

  let ui = { defaultView: "dayGridMonth", showPastEvents: true };
  if (uiPref) {
    try {
      ui = JSON.parse(uiPref.pref_value);
    } catch (e) {
      console.error("[prefs] Failed to parse UI prefs:", e);
    }
  }

  return {
    calendar: { courseColors, eventOverrides, assignmentTypeColors },
    ui,
  };
}

/**
 * set a course color for a user
 */
async function setCourseColor(userid, courseId, color) {
  const db = getDatabase();
  const uid = String(userid);
  const cid = String(courseId);
  const col = String(color);

  db.prepare(
    `INSERT INTO course_colors (user_id, course_id, color, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, course_id)
     DO UPDATE SET color = ?, updated_at = datetime('now')`
  ).run(uid, cid, col, col);

  return getUserPrefs(userid);
}

/**
 * set an event override for a user
 */
async function setEventOverride(userid, id, patch = {}) {
  const db = getDatabase();
  const uid = String(userid);
  const eid = String(id);

  // get existing override if any
  const existing = db
    .prepare("SELECT color, text_color FROM event_overrides WHERE user_id = ? AND event_id = ?")
    .get(uid, eid);

  const newColor = patch.color || existing?.color || null;
  const newTextColor = patch.textColor || existing?.text_color || null;

  db.prepare(
    `INSERT INTO event_overrides (user_id, event_id, color, text_color, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, event_id)
     DO UPDATE SET color = ?, text_color = ?, updated_at = datetime('now')`
  ).run(uid, eid, newColor, newTextColor, newColor, newTextColor);

  return getUserPrefs(userid);
}

/**
 * set an assignment type color for a user
 */
async function setAssignmentTypeColor(userid, assignmentType, color) {
  const db = getDatabase();
  const uid = String(userid);
  const type = String(assignmentType);
  const col = String(color);

  db.prepare(
    `INSERT INTO assignment_type_colors (user_id, assignment_type, color, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, assignment_type)
     DO UPDATE SET color = ?, updated_at = datetime('now')`
  ).run(uid, type, col, col);

  return getUserPrefs(userid);
}

module.exports = {
  getUserPrefs,
  setCourseColor,
  setEventOverride,
  setAssignmentTypeColor,
};
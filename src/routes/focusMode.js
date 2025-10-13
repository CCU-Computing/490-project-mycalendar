const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");
const { buildDueCalendar } = require("../services/aggregator");

const router = express.Router();

/**
 * GET /focus-mode/today
 * Get all items due today (assignments, quizzes) and study blocks scheduled for today
 */
router.get("/today", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get today's start and end timestamps
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayStartUnix = Math.floor(todayStart.getTime() / 1000);
    const todayEndUnix = Math.floor(todayEnd.getTime() / 1000);

    // Get Moodle assignments/quizzes due today
    let moodleItems = [];
    try {
      const events = await buildDueCalendar({
        token: req.session.moodleToken,
        session: req.session,
      });

      // Filter for today's items
      moodleItems = events.filter(ev => {
        return ev.dueAt >= todayStartUnix && ev.dueAt < todayEndUnix;
      }).map(ev => ({
        id: ev.id,
        title: ev.title,
        type: ev.type || 'assignment',
        dueAt: ev.dueAt,
        courseId: ev.courseId
      }));
    } catch (e) {
      console.error("[focusMode] Error fetching Moodle events:", e);
    }

    // Get study blocks scheduled for today
    const db = getDatabase();
    const studyBlocks = db
      .prepare(
        `SELECT id, title, description, start_time, end_time, color, moodle_assignment_id
         FROM custom_events
         WHERE user_id = ?
         AND date(start_time) = date(?)
         ORDER BY start_time ASC`
      )
      .all(userId, todayStart.toISOString());

    const formattedStudyBlocks = studyBlocks.map(sb => ({
      id: sb.id,
      title: sb.title,
      description: sb.description,
      startTime: sb.start_time,
      endTime: sb.end_time,
      color: sb.color,
      assignmentId: sb.moodle_assignment_id,
      type: 'study-block'
    }));

    res.json({
      assignments: moodleItems.filter(item => item.type === 'assign'),
      quizzes: moodleItems.filter(item => item.type === 'quiz'),
      studyBlocks: formattedStudyBlocks
    });
  } catch (e) {
    console.error("[focusMode] Error in /today:", e);
    res.status(500).json({ error: e.message || "Failed to load today's items" });
  }
});

/**
 * GET /focus-mode/item?id=XXX&type=YYY
 * Get details for a specific item (assignment, quiz, or study-block)
 */
router.get("/item", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const { id, type } = req.query;

    if (!id || !type) {
      return res.status(400).json({ error: "id and type are required" });
    }

    if (type === 'study-block') {
      // Get from custom_events table
      const db = getDatabase();
      const studyBlock = db
        .prepare(
          `SELECT id, course_id, title, description, event_type, start_time, end_time, color, moodle_assignment_id
           FROM custom_events
           WHERE id = ? AND user_id = ?`
        )
        .get(id, userId);

      if (!studyBlock) {
        return res.status(404).json({ error: "Study block not found" });
      }

      return res.json({
        item: {
          id: studyBlock.id,
          title: studyBlock.title,
          description: studyBlock.description,
          type: 'study-block',
          startTime: studyBlock.start_time,
          endTime: studyBlock.end_time,
          color: studyBlock.color,
          courseId: studyBlock.course_id,
          assignmentId: studyBlock.moodle_assignment_id
        }
      });
    }

    if (type === 'assignment' || type === 'assign' || type === 'quiz') {
      // Get from Moodle calendar
      try {
        const events = await buildDueCalendar({
          token: req.session.moodleToken,
          session: req.session,
        });

        const event = events.find(ev => String(ev.id) === String(id));

        if (!event) {
          return res.status(404).json({ error: "Item not found" });
        }

        return res.json({
          item: {
            id: event.id,
            title: event.title,
            type: event.type || type,
            dueAt: event.dueAt,
            courseId: event.courseId,
            description: event.description || null
          }
        });
      } catch (e) {
        return res.status(500).json({ error: "Failed to fetch assignment from Moodle" });
      }
    }

    return res.status(400).json({ error: "Invalid item type" });
  } catch (e) {
    console.error("[focusMode] Error in /item:", e);
    res.status(500).json({ error: e.message || "Failed to load item" });
  }
});

/**
 * GET /focus-mode/notes?id=XXX&type=YYY
 * Get notes for a specific item
 */
router.get("/notes", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const { id, type } = req.query;

    if (!id || !type) {
      return res.status(400).json({ error: "id and type are required" });
    }

    const db = getDatabase();
    const note = db
      .prepare(
        `SELECT notes, updated_at FROM focus_notes
         WHERE user_id = ? AND item_id = ? AND item_type = ?`
      )
      .get(userId, id, type);

    res.json({
      notes: note?.notes || "",
      updatedAt: note?.updated_at || null
    });
  } catch (e) {
    console.error("[focusMode] Error in /notes GET:", e);
    res.status(500).json({ error: e.message || "Failed to load notes" });
  }
});

/**
 * POST /focus-mode/notes
 * Save/update notes for a specific item
 * Body: { id, type, notes }
 */
router.post("/notes", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id, type, notes } = req.body || {};

    if (!id || !type || notes === undefined) {
      return res.status(400).json({ error: "id, type, and notes are required" });
    }

    const db = getDatabase();
    db.prepare(
      `INSERT INTO focus_notes (user_id, item_id, item_type, notes, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, item_id, item_type)
       DO UPDATE SET notes = ?, updated_at = datetime('now')`
    ).run(userId, id, type, notes, notes);

    res.json({ ok: true });
  } catch (e) {
    console.error("[focusMode] Error in /notes POST:", e);
    res.status(500).json({ error: e.message || "Failed to save notes" });
  }
});

/**
 * POST /focus-mode/sessions
 * Create a new focus session (when timer starts)
 * Body: { id, type, sessionType, targetDuration }
 */
router.post("/sessions", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id, type, sessionType, targetDuration } = req.body || {};

    if (!id || !type || !sessionType) {
      return res.status(400).json({ error: "id, type, and sessionType are required" });
    }

    if (!['countdown', 'timer'].includes(sessionType)) {
      return res.status(400).json({ error: "sessionType must be 'countdown' or 'timer'" });
    }

    const startedAt = new Date().toISOString();

    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO focus_sessions
         (user_id, item_id, item_type, session_type, target_duration_seconds, actual_duration_seconds, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        userId,
        id,
        type,
        sessionType,
        targetDuration || null,
        startedAt,
        startedAt  // Placeholder, will be updated on end
      );

    res.json({
      sessionId: result.lastInsertRowid,
      startedAt: startedAt
    });
  } catch (e) {
    console.error("[focusMode] Error in /sessions POST:", e);
    res.status(500).json({ error: e.message || "Failed to create session" });
  }
});

/**
 * PUT /focus-mode/sessions/:sessionId
 * End a focus session (when timer stops/completes)
 * Body: { actualDuration, completed }
 */
router.put("/sessions/:sessionId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const sessionId = req.params.sessionId;
    const { actualDuration, completed } = req.body || {};

    if (actualDuration === undefined || completed === undefined) {
      return res.status(400).json({ error: "actualDuration and completed are required" });
    }

    const endedAt = new Date().toISOString();

    const db = getDatabase();

    // Verify ownership
    const existing = db
      .prepare("SELECT id FROM focus_sessions WHERE id = ? AND user_id = ?")
      .get(sessionId, userId);

    if (!existing) {
      return res.status(404).json({ error: "Session not found" });
    }

    db.prepare(
      `UPDATE focus_sessions
       SET actual_duration_seconds = ?, completed = ?, ended_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(actualDuration, completed ? 1 : 0, endedAt, sessionId, userId);

    res.json({ ok: true });
  } catch (e) {
    console.error("[focusMode] Error in /sessions PUT:", e);
    res.status(500).json({ error: e.message || "Failed to end session" });
  }
});

/**
 * GET /focus-mode/sessions?id=XXX&type=YYY
 * Get session history for a specific item
 */
router.get("/sessions", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const { id, type } = req.query;

    if (!id || !type) {
      return res.status(400).json({ error: "id and type are required" });
    }

    const db = getDatabase();
    const sessions = db
      .prepare(
        `SELECT id, session_type, target_duration_seconds, actual_duration_seconds,
                completed, started_at, ended_at
         FROM focus_sessions
         WHERE user_id = ? AND item_id = ? AND item_type = ?
         ORDER BY started_at DESC`
      )
      .all(userId, id, type);

    res.json({ sessions });
  } catch (e) {
    console.error("[focusMode] Error in /sessions GET:", e);
    res.status(500).json({ error: e.message || "Failed to load sessions" });
  }
});

module.exports = router;
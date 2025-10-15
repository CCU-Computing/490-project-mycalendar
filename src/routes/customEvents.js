const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");

const router = express.Router();

/**
 * GET /custom-events
 * get all custom events for the current user
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { moodleAssignmentId } = req.query;
    const db = getDatabase();
    
    let query = `
      SELECT id, course_id, title, description, event_type,
             start_time, end_time, all_day, color, recurrence_rule,
             moodle_assignment_id, created_at, updated_at
      FROM custom_events
      WHERE user_id = ?
    `;
    const params = [userId];
    
    if (moodleAssignmentId) {
      query += " AND moodle_assignment_id = ?";
      params.push(moodleAssignmentId);
    }
    
    query += " ORDER BY start_time ASC";
    
    const events = db.prepare(query).all(...params);

    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load events" });
  }
});

/**
 * GET /custom-events/:id
 * get a specific custom event
 */
router.get("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const eventId = req.params.id;

    const db = getDatabase();
    const event = db
      .prepare(
        `SELECT * FROM custom_events WHERE id = ? AND user_id = ?`
      )
      .get(eventId, userId);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ event });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load event" });
  }
});

/**
 * POST /custom-events
 * create a new custom event
 */
router.post("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      courseId,
      title,
      description,
      eventType,
      startTime,
      endTime,
      allDay,
      color,
      recurrenceRule,
      moodleAssignmentId,
    } = req.body || {};

    if (!title || !startTime) {
      return res.status(400).json({ error: "title and startTime required" });
    }

    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO custom_events
         (user_id, course_id, title, description, event_type, start_time, end_time, all_day, color, recurrence_rule, moodle_assignment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        courseId || null,
        title,
        description || null,
        eventType || "custom",
        startTime,
        endTime || null,
        allDay ? 1 : 0,
        color || null,
        recurrenceRule || null,
        moodleAssignmentId || null
      );

    const event = db
      .prepare("SELECT * FROM custom_events WHERE id = ?")
      .get(result.lastInsertRowid);

    res.json({ ok: true, event });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to create event" });
  }
});

/**
 * PUT /custom-events/:id
 * update a custom event
 */
router.put("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const eventId = req.params.id;

    const db = getDatabase();

    // verify ownership
    const existing = db
      .prepare("SELECT id FROM custom_events WHERE id = ? AND user_id = ?")
      .get(eventId, userId);

    if (!existing) {
      return res.status(404).json({ error: "Event not found" });
    }

    const {
      courseId,
      title,
      description,
      eventType,
      startTime,
      endTime,
      allDay,
      color,
      recurrenceRule,
      moodleAssignmentId,
    } = req.body || {};

    const updates = [];
    const params = [];

    if (courseId !== undefined) {
      updates.push("course_id = ?");
      params.push(courseId);
    }
    if (title) {
      updates.push("title = ?");
      params.push(title);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description);
    }
    if (eventType) {
      updates.push("event_type = ?");
      params.push(eventType);
    }
    if (startTime) {
      updates.push("start_time = ?");
      params.push(startTime);
    }
    if (endTime !== undefined) {
      updates.push("end_time = ?");
      params.push(endTime);
    }
    if (allDay !== undefined) {
      updates.push("all_day = ?");
      params.push(allDay ? 1 : 0);
    }
    if (color !== undefined) {
      updates.push("color = ?");
      params.push(color);
    }
    if (recurrenceRule !== undefined) {
      updates.push("recurrence_rule = ?");
      params.push(recurrenceRule);
    }
    if (moodleAssignmentId !== undefined) {
      updates.push("moodle_assignment_id = ?");
      params.push(moodleAssignmentId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push("updated_at = datetime('now')");
    params.push(eventId, userId);

    db.prepare(
      `UPDATE custom_events SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...params);

    const event = db
      .prepare("SELECT * FROM custom_events WHERE id = ?")
      .get(eventId);

    res.json({ ok: true, event });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update event" });
  }
});

/**
 * DELETE /custom-events/:id
 * delete a custom event
 */
router.delete("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const eventId = req.params.id;

    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM custom_events WHERE id = ? AND user_id = ?")
      .run(eventId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to delete event" });
  }
});

module.exports = router;
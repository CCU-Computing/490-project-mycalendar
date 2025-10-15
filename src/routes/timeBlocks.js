const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");

const router = express.Router();

/**
 * GET /time-blocks
 * get all time blocks for the current user
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { dayOfWeek, blockType } = req.query;
    const db = getDatabase();

    let query = `
      SELECT id, title, block_type, day_of_week, start_time, end_time,
             specific_date, recurrence_rule, color, location, notes,
             created_at, updated_at
      FROM time_blocks
      WHERE user_id = ?
    `;
    const params = [userId];

    if (dayOfWeek !== undefined) {
      query += " AND day_of_week = ?";
      params.push(parseInt(dayOfWeek));
    }

    if (blockType) {
      query += " AND block_type = ?";
      params.push(blockType);
    }

    query += " ORDER BY day_of_week ASC NULLS LAST, start_time ASC";

    const blocks = db.prepare(query).all(...params);

    res.json({ blocks });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load time blocks" });
  }
});

/**
 * GET /time-blocks/:id
 * get a specific time block
 */
router.get("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const blockId = req.params.id;

    const db = getDatabase();
    const block = db
      .prepare("SELECT * FROM time_blocks WHERE id = ? AND user_id = ?")
      .get(blockId, userId);

    if (!block) {
      return res.status(404).json({ error: "Time block not found" });
    }

    res.json({ block });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load time block" });
  }
});

/**
 * POST /time-blocks
 * create a new time block
 */
router.post("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      title,
      blockType,
      dayOfWeek,
      startTime,
      endTime,
      specificDate,
      recurrenceRule,
      color,
      location,
      notes,
    } = req.body || {};

    if (!title || !startTime || !endTime) {
      return res
        .status(400)
        .json({ error: "title, startTime, and endTime required" });
    }

    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO time_blocks
         (user_id, title, block_type, day_of_week, start_time, end_time,
          specific_date, recurrence_rule, color, location, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        title,
        blockType || "study",
        dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
        startTime,
        endTime,
        specificDate || null,
        recurrenceRule || null,
        color || null,
        location || null,
        notes || null
      );

    const block = db
      .prepare("SELECT * FROM time_blocks WHERE id = ?")
      .get(result.lastInsertRowid);

    res.json({ ok: true, block });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to create time block" });
  }
});

/**
 * PUT /time-blocks/:id
 * update a time block
 */
router.put("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const blockId = req.params.id;

    const db = getDatabase();

    // verify ownership
    const existing = db
      .prepare("SELECT id FROM time_blocks WHERE id = ? AND user_id = ?")
      .get(blockId, userId);

    if (!existing) {
      return res.status(404).json({ error: "Time block not found" });
    }

    const {
      title,
      blockType,
      dayOfWeek,
      startTime,
      endTime,
      specificDate,
      recurrenceRule,
      color,
      location,
      notes,
    } = req.body || {};

    const updates = [];
    const params = [];

    if (title) {
      updates.push("title = ?");
      params.push(title);
    }
    if (blockType) {
      updates.push("block_type = ?");
      params.push(blockType);
    }
    if (dayOfWeek !== undefined) {
      updates.push("day_of_week = ?");
      params.push(dayOfWeek !== null ? parseInt(dayOfWeek) : null);
    }
    if (startTime) {
      updates.push("start_time = ?");
      params.push(startTime);
    }
    if (endTime) {
      updates.push("end_time = ?");
      params.push(endTime);
    }
    if (specificDate !== undefined) {
      updates.push("specific_date = ?");
      params.push(specificDate);
    }
    if (recurrenceRule !== undefined) {
      updates.push("recurrence_rule = ?");
      params.push(recurrenceRule);
    }
    if (color !== undefined) {
      updates.push("color = ?");
      params.push(color);
    }
    if (location !== undefined) {
      updates.push("location = ?");
      params.push(location);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push("updated_at = datetime('now')");
    params.push(blockId, userId);

    db.prepare(
      `UPDATE time_blocks SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...params);

    const block = db
      .prepare("SELECT * FROM time_blocks WHERE id = ?")
      .get(blockId);

    res.json({ ok: true, block });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update time block" });
  }
});

/**
 * DELETE /time-blocks/:id
 * delete a time block
 */
router.delete("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const blockId = req.params.id;

    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM time_blocks WHERE id = ? AND user_id = ?")
      .run(blockId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Time block not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to delete time block" });
  }
});

module.exports = router;
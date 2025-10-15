const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");

const router = express.Router();

/**
 * GET /starred-assignments
 * get all starred assignments for the current user
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();
    const starred = db
      .prepare(
        `SELECT id, moodle_assignment_id, created_at
         FROM starred_assignments
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId);

    res.json({ starred });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to load starred assignments" });
  }
});

/**
 * POST /starred-assignments
 * star an assignment
 * body: { moodleAssignmentId: string }
 */
router.post("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { moodleAssignmentId } = req.body || {};

    if (!moodleAssignmentId) {
      return res.status(400).json({ error: "moodleAssignmentId required" });
    }

    const db = getDatabase();

    // check if already starred
    const existing = db
      .prepare(
        "SELECT id FROM starred_assignments WHERE user_id = ? AND moodle_assignment_id = ?"
      )
      .get(userId, moodleAssignmentId);

    if (existing) {
      return res.json({ ok: true, message: "Already starred", id: existing.id });
    }

    // insert new starred assignment
    const result = db
      .prepare(
        `INSERT INTO starred_assignments (user_id, moodle_assignment_id)
         VALUES (?, ?)`
      )
      .run(userId, moodleAssignmentId);

    res.json({
      ok: true,
      id: result.lastInsertRowid,
      moodleAssignmentId,
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to star assignment" });
  }
});

/**
 * DELETE /starred-assignments/:moodleAssignmentId
 * unstar an assignment
 */
router.delete("/:moodleAssignmentId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const { moodleAssignmentId } = req.params;

    if (!moodleAssignmentId) {
      return res.status(400).json({ error: "moodleAssignmentId required" });
    }

    const db = getDatabase();
    const result = db
      .prepare(
        "DELETE FROM starred_assignments WHERE user_id = ? AND moodle_assignment_id = ?"
      )
      .run(userId, moodleAssignmentId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Starred assignment not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to unstar assignment" });
  }
});

/**
 * GET /starred-assignments/check/:moodleAssignmentId
 * check if an assignment is starred
 */
router.get("/check/:moodleAssignmentId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const { moodleAssignmentId } = req.params;

    const db = getDatabase();
    const starred = db
      .prepare(
        "SELECT id FROM starred_assignments WHERE user_id = ? AND moodle_assignment_id = ?"
      )
      .get(userId, moodleAssignmentId);

    res.json({ isStarred: !!starred });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to check starred status" });
  }
});

module.exports = router;

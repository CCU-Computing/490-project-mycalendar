const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");

const router = express.Router();

/**
 * GET /assignment-ratings
 * Get all difficulty ratings for current user
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;

    const db = getDatabase();
    const ratings = db
      .prepare(
        `SELECT moodle_assignment_id, title, difficulty_rating, course_id, updated_at
         FROM user_assignments
         WHERE user_id = ? AND difficulty_rating IS NOT NULL
         ORDER BY updated_at DESC`
      )
      .all(userId);

    res.json({ ratings });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to get ratings" });
  }
});

/**
 * GET /assignment-ratings/:assignmentId
 * Get difficulty rating for a specific assignment
 */
router.get("/:assignmentId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const assignmentId = req.params.assignmentId;

    const db = getDatabase();
    const assignment = db
      .prepare(
        `SELECT difficulty_rating
         FROM user_assignments
         WHERE user_id = ? AND moodle_assignment_id = ?`
      )
      .get(userId, assignmentId);

    res.json({
      assignmentId,
      difficultyRating: assignment?.difficulty_rating || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to get rating" });
  }
});

/**
 * PUT /assignment-ratings/:assignmentId
 * Set/update difficulty rating for an assignment
 * Body: { rating: 1-5, title?, courseId?, dueDate?, description? }
 */
router.put("/:assignmentId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const assignmentId = req.params.assignmentId;
    const { rating, title, courseId, dueDate, description } = req.body || {};

    // Validate rating
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({
        error: "Rating must be an integer between 1 and 5"
      });
    }

    const db = getDatabase();

    // Check if assignment exists in user_assignments
    const existing = db
      .prepare(
        `SELECT id FROM user_assignments
         WHERE user_id = ? AND moodle_assignment_id = ?`
      )
      .get(userId, assignmentId);

    if (existing) {
      // Update existing record
      db.prepare(
        `UPDATE user_assignments
         SET difficulty_rating = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(rating, existing.id);
    } else {
      // Create new record
      // Require title and courseId for new assignments
      if (!title || !courseId) {
        return res.status(400).json({
          error: "title and courseId are required for rating a new assignment"
        });
      }

      db.prepare(
        `INSERT INTO user_assignments
         (user_id, course_id, moodle_assignment_id, title, description,
          due_date, difficulty_rating)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        courseId,
        assignmentId,
        title,
        description || null,
        dueDate || null,
        rating
      );
    }

    // Return updated rating
    const updated = db
      .prepare(
        `SELECT moodle_assignment_id, title, difficulty_rating, course_id
         FROM user_assignments
         WHERE user_id = ? AND moodle_assignment_id = ?`
      )
      .get(userId, assignmentId);

    res.json({ ok: true, rating: updated });
  } catch (e) {
    console.error("[assignmentRatings] PUT error:", e);
    res.status(500).json({ error: e.message || "Failed to save rating" });
  }
});

/**
 * DELETE /assignment-ratings/:assignmentId
 * Remove difficulty rating (set to null)
 */
router.delete("/:assignmentId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const assignmentId = req.params.assignmentId;

    const db = getDatabase();
    const result = db
      .prepare(
        `UPDATE user_assignments
         SET difficulty_rating = NULL, updated_at = datetime('now')
         WHERE user_id = ? AND moodle_assignment_id = ?`
      )
      .run(userId, assignmentId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to delete rating" });
  }
});

module.exports = router;

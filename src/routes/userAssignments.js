const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");

const router = express.Router();

/**
 * GET /user-assignments
 * get all user assignments (custom and Moodle overrides)
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { courseId, status } = req.query;
    const db = getDatabase();

    let query = `
      SELECT id, course_id, moodle_assignment_id, title, description,
             due_date, predicted_due_date, estimated_hours, priority, status,
             completed_at, notes, created_at, updated_at
      FROM user_assignments
      WHERE user_id = ?
    `;
    const params = [userId];

    if (courseId) {
      query += " AND course_id = ?";
      params.push(courseId);
    }

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY due_date ASC NULLS LAST, predicted_due_date ASC NULLS LAST";

    const assignments = db.prepare(query).all(...params);

    res.json({ assignments });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to load assignments" });
  }
});

/**
 * GET /user-assignments/:id
 * get a specific user assignment
 */
router.get("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const assignmentId = req.params.id;

    const db = getDatabase();
    const assignment = db
      .prepare("SELECT * FROM user_assignments WHERE id = ? AND user_id = ?")
      .get(assignmentId, userId);

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({ assignment });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to load assignment" });
  }
});

/**
 * POST /user-assignments
 * create a new user assignment
 */
router.post("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      courseId,
      moodleAssignmentId,
      title,
      description,
      dueDate,
      predictedDueDate,
      estimatedHours,
      priority,
      status,
      notes,
    } = req.body || {};

    if (!courseId || !title) {
      return res.status(400).json({ error: "courseId and title required" });
    }

    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO user_assignments
         (user_id, course_id, moodle_assignment_id, title, description, due_date,
          predicted_due_date, estimated_hours, priority, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        courseId,
        moodleAssignmentId || null,
        title,
        description || null,
        dueDate || null,
        predictedDueDate || null,
        estimatedHours || null,
        priority || "medium",
        status || "pending",
        notes || null
      );

    const assignment = db
      .prepare("SELECT * FROM user_assignments WHERE id = ?")
      .get(result.lastInsertRowid);

    res.json({ ok: true, assignment });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to create assignment" });
  }
});

/**
 * PUT /user-assignments/:id
 * update a user assignment
 */
router.put("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const assignmentId = req.params.id;

    const db = getDatabase();

    // verify ownership
    const existing = db
      .prepare("SELECT id FROM user_assignments WHERE id = ? AND user_id = ?")
      .get(assignmentId, userId);

    if (!existing) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const {
      courseId,
      title,
      description,
      dueDate,
      predictedDueDate,
      estimatedHours,
      priority,
      status,
      notes,
    } = req.body || {};

    const updates = [];
    const params = [];

    if (courseId) {
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
    if (dueDate !== undefined) {
      updates.push("due_date = ?");
      params.push(dueDate);
    }
    if (predictedDueDate !== undefined) {
      updates.push("predicted_due_date = ?");
      params.push(predictedDueDate);
    }
    if (estimatedHours !== undefined) {
      updates.push("estimated_hours = ?");
      params.push(estimatedHours);
    }
    if (priority) {
      updates.push("priority = ?");
      params.push(priority);
    }
    if (status) {
      updates.push("status = ?");
      params.push(status);

      // If marking as completed, set completed_at
      if (status === "completed") {
        updates.push("completed_at = datetime('now')");
      } else {
        updates.push("completed_at = NULL");
      }
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push("updated_at = datetime('now')");
    params.push(assignmentId, userId);

    db.prepare(
      `UPDATE user_assignments SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...params);

    const assignment = db
      .prepare("SELECT * FROM user_assignments WHERE id = ?")
      .get(assignmentId);

    res.json({ ok: true, assignment });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to update assignment" });
  }
});

/**
 * DELETE /user-assignments/:id
 * delete a user assignment
 */
router.delete("/:id", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const assignmentId = req.params.id;

    const db = getDatabase();
    const result = db
      .prepare("DELETE FROM user_assignments WHERE id = ? AND user_id = ?")
      .run(assignmentId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ error: e.message || "Failed to delete assignment" });
  }
});

module.exports = router;
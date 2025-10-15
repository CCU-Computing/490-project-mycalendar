const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");

const router = express.Router();

/**
 * GET /course-metadata
 * get all course metadata for the current user
 */
router.get("/", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();
    const metadata = db
      .prepare(
        `SELECT id, course_id, course_name, custom_image_url, instructor_name, office_hours,
                external_url, notes, avg_assignments_per_week, typical_due_day,
                typical_due_time, created_at, updated_at
         FROM course_metadata
         WHERE user_id = ?
         ORDER BY course_id ASC`
      )
      .all(userId);

    res.json({ metadata });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load metadata" });
  }
});

/**
 * GET /course-metadata/:courseId
 * get metadata for a specific course
 */
router.get("/:courseId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const courseId = req.params.courseId;

    const db = getDatabase();
    const metadata = db
      .prepare(
        "SELECT * FROM course_metadata WHERE course_id = ? AND user_id = ?"
      )
      .get(courseId, userId);

    if (!metadata) {
      return res.status(404).json({ error: "Metadata not found" });
    }

    res.json({ metadata });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load metadata" });
  }
});

/**
 * PUT /course-metadata/:courseId
 * create or update course metadata
 */
router.put("/:courseId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const courseId = req.params.courseId;
    const {
      courseName,
      customImageUrl,
      instructorName,
      officeHours,
      externalUrl,
      notes,
      avgAssignmentsPerWeek,
      typicalDueDay,
      typicalDueTime,
    } = req.body || {};

    const db = getDatabase();

    // check if metadata already exists
    const existing = db
      .prepare(
        "SELECT id FROM course_metadata WHERE course_id = ? AND user_id = ?"
      )
      .get(courseId, userId);

    if (existing) {
      // update existing
      const updates = [];
      const params = [];

      if (courseName !== undefined) {
        updates.push("course_name = ?");
        params.push(courseName);
      }
      if (customImageUrl !== undefined) {
        updates.push("custom_image_url = ?");
        params.push(customImageUrl);
      }
      if (instructorName !== undefined) {
        updates.push("instructor_name = ?");
        params.push(instructorName);
      }
      if (officeHours !== undefined) {
        updates.push("office_hours = ?");
        params.push(officeHours);
      }
      if (externalUrl !== undefined) {
        updates.push("external_url = ?");
        params.push(externalUrl);
      }
      if (notes !== undefined) {
        updates.push("notes = ?");
        params.push(notes);
      }
      if (avgAssignmentsPerWeek !== undefined) {
        updates.push("avg_assignments_per_week = ?");
        params.push(avgAssignmentsPerWeek);
      }
      if (typicalDueDay !== undefined) {
        updates.push("typical_due_day = ?");
        params.push(typicalDueDay);
      }
      if (typicalDueTime !== undefined) {
        updates.push("typical_due_time = ?");
        params.push(typicalDueTime);
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(existing.id);

        db.prepare(
          `UPDATE course_metadata SET ${updates.join(", ")} WHERE id = ?`
        ).run(...params);
      }
    } else {
      // insert new
      db.prepare(
        `INSERT INTO course_metadata
         (user_id, course_id, course_name, custom_image_url, instructor_name, office_hours, external_url,
          notes, avg_assignments_per_week, typical_due_day, typical_due_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        courseId,
        courseName || null,
        customImageUrl || null,
        instructorName || null,
        officeHours || null,
        externalUrl || null,
        notes || null,
        avgAssignmentsPerWeek || null,
        typicalDueDay || null,
        typicalDueTime || null
      );
    }

    const metadata = db
      .prepare(
        "SELECT * FROM course_metadata WHERE course_id = ? AND user_id = ?"
      )
      .get(courseId, userId);

    res.json({ ok: true, metadata });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update metadata" });
  }
});

/**
 * DELETE /course-metadata/:courseId
 * delete course metadata
 */
router.delete("/:courseId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const courseId = req.params.courseId;

    const db = getDatabase();
    const result = db
      .prepare(
        "DELETE FROM course_metadata WHERE course_id = ? AND user_id = ?"
      )
      .run(courseId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Metadata not found" });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to delete metadata" });
  }
});

module.exports = router;

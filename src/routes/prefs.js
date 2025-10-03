const express = require("express");
const requireSession = require("../middleware/sessionAuth.js");
const { getUserPrefs, setCourseColor, setEventOverride, setAssignmentTypeColor } = require("../prefs/store.js");

const router = express.Router();

router.get("/", requireSession, async (req, res) => {
  try {
    const userid = req.session.userid;
    if (!userid) return res.status(400).json({ error: "Missing userid in session" });
    const prefs = await getUserPrefs(String(userid));
    res.json({ prefs });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to load prefs" });
  }
});

router.put("/courseColor", requireSession, async (req, res) => {
  try {
    const userid = req.session.userid;
    const { courseId, color } = req.body || {};
    if (!userid) return res.status(400).json({ error: "Missing userid in session" });
    if (!courseId || !color) return res.status(400).json({ error: "courseId and color required" });
    const prefs = await setCourseColor(String(userid), String(courseId), String(color));
    res.json({ ok: true, prefs });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update course color" });
  }
});

router.put("/eventOverride", requireSession, async (req, res) => {
  try {
    const userid = req.session.userid;
    const { id, color, textColor } = req.body || {};
    if (!userid) return res.status(400).json({ error: "Missing userid in session" });
    if (!id) return res.status(400).json({ error: "id (e.g. 'assign:123') required" });
    const prefs = await setEventOverride(String(userid), String(id), {
      ...(color ? { color: String(color) } : {}),
      ...(textColor ? { textColor: String(textColor) } : {}),
    });
    res.json({ ok: true, prefs });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update event override" });
  }
});

router.put("/assignmentTypeColor", requireSession, async (req, res) => {
  try {
    const userid = req.session.userid;
    const { assignmentType, color } = req.body || {};
    if (!userid) return res.status(400).json({ error: "Missing userid in session" });
    if (!assignmentType || !color) {
      return res.status(400).json({ error: "assignmentType and color required" });
    }
    const prefs = await setAssignmentTypeColor(String(userid), String(assignmentType), String(color));
    res.json({ ok: true, prefs });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update assignment type color" });
  }
});

module.exports = router;
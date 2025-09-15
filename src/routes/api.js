const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const {
  bootstrapSession,
  buildCourseCards,
  getWorkItemsByCourse,
  buildDueCalendar,
} = require("../services/aggregator");

const router = express.Router();

/**
 * fake login: store name + moodle token (hash) in session
 * body: { name: string, token: string }
 */
router.post("/login", async (req, res) => {
  const { name, token } = req.body || {};
  if (!token) return res.status(400).json({ error: "token is required" });

  req.session.userDisplayName = name || "Student";
  req.session.moodleToken = token;

  try {
    const boot = await bootstrapSession({
      token: req.session.moodleToken,
      session: req.session,
    });
    return res.json({
      ok: true,
      me: {
        name: req.session.userDisplayName,
        userid: boot.userid,
        sitename: boot.sitename,
        username: boot.username,
      },
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Login bootstrap failed" });
  }
});

/** logout */
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

/** who am i / bootstrap (refresh) */
router.get("/me", requireSession, async (req, res) => {
  try {
    const boot = await bootstrapSession({
      token: req.session.moodleToken,
      session: req.session,
    });
    res.json({
      name: req.session.userDisplayName,
      userid: boot.userid,
      sitename: boot.sitename,
      username: boot.username,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** course cards (name, image, progress, overall grade) */
router.get("/courses", requireSession, async (req, res) => {
  try {
    const data = await buildCourseCards({
      token: req.session.moodleToken,
      session: req.session,
    });
    res.json({ courses: data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** due-only calendar across current courses */
router.get("/calendar", requireSession, async (req, res) => {
  try {
    const events = await buildDueCalendar({
      token: req.session.moodleToken,
      session: req.session,
    });
    res.json({ events });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * work items grouped by course (assignments + quizzes, with fallback)
 * optional: ?courseId=NN to filter to one course
 */
router.get("/work", requireSession, async (req, res) => {
  try {
    const map = await getWorkItemsByCourse({
      token: req.session.moodleToken,
      session: req.session,
    });

    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    if (courseId) {
      const row = map.get(courseId) || { courseId, assignments: [], quizzes: [] };
      return res.json(row);
    }

    // convert Map -> array
    res.json({ courses: Array.from(map.values()) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
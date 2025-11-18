const express = require("express");
const requireSession = require("../middleware/sessionAuth");
const { getDatabase } = require("../db/init");
const {
  buildCourseCards,
  getWorkItemsByCourse
} = require("../services/aggregator");

const router = express.Router();

/**
 * Helper: Convert seconds to hours
 */
function secondsToHours(seconds) {
  return seconds ? Math.round((seconds / 3600) * 10) / 10 : 0;
}

/**
 * Helper: Format duration as readable string (e.g., "2h 30m")
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Helper: Build item_id -> course_id mapping from work items
 */
function buildItemToCourseMap(workItemsByCourse) {
  const map = {};
  workItemsByCourse.forEach(course => {
    const allItems = [...(course.assignments || []), ...(course.quizzes || [])];
    allItems.forEach(item => {
      map[item.id] = course.courseId;
    });
  });
  return map;
}

/**
 * GET /api/analytics/summary
 * Overall dashboard summary stats
 */
router.get("/summary", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();

    // Total study hours from focus sessions
    const sessionResult = db
      .prepare(
        `SELECT COALESCE(SUM(actual_duration_seconds), 0) as total_seconds,
                COUNT(*) as session_count,
                COUNT(CASE WHEN completed = 1 THEN 1 END) as completed_count
         FROM focus_sessions
         WHERE user_id = ?`
      )
      .get(userId);

    const totalStudyHours = secondsToHours(sessionResult.total_seconds);

    // Get assignments from Moodle (source of truth)
    let assignmentsCompleted = 0;
    let assignmentsTotal = 0;
    let completionRate = 0;

    try {
      const workItemsMap = await getWorkItemsByCourse({
        token: req.session.moodleToken,
        session: req.session
      });

      // Convert Map to array of courses
      const courses = Array.from(workItemsMap.values());
      const allItems = courses.flatMap(course => [
        ...(course.assignments || []),
        ...(course.quizzes || [])
      ]);

      assignmentsTotal = allItems.length;
      assignmentsCompleted = allItems.filter(item =>
        ["graded", "submitted"].includes(item.status)
      ).length;

      completionRate = assignmentsTotal > 0
        ? Math.round((assignmentsCompleted / assignmentsTotal) * 100)
        : 0;
    } catch (e) {
      console.error("[analytics] Error fetching assignments from Moodle:", e.message);
    }

    // Get GPA from courses (from Moodle)
    let gpa = null;
    let gradeCount = 0;
    try {
      const courseCards = await buildCourseCards({
        token: req.session.moodleToken,
        session: req.session
      });

      const grades = courseCards
        .filter(c => c.grade !== null && c.grade !== undefined)
        .map(c => {
          // Convert percentage to 4.0 scale
          const percentage = Math.min(100, parseFloat(c.grade) || 0);
          if (percentage >= 93) return 4.0;
          if (percentage >= 90) return 3.7;
          if (percentage >= 87) return 3.3;
          if (percentage >= 83) return 3.0;
          if (percentage >= 80) return 2.7;
          if (percentage >= 77) return 2.3;
          if (percentage >= 73) return 2.0;
          if (percentage >= 70) return 1.7;
          if (percentage >= 67) return 1.3;
          if (percentage >= 65) return 1.0;
          return 0.0;
        });

      if (grades.length > 0) {
        gpa = (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2);
        gradeCount = grades.length;
      }
    } catch (e) {
      console.error("[analytics] Error fetching GPA:", e.message);
    }

    // Average session duration
    const avgSessionResult = db
      .prepare(
        `SELECT AVG(actual_duration_seconds) as avg_seconds
         FROM focus_sessions
         WHERE user_id = ? AND actual_duration_seconds > 0`
      )
      .get(userId);

    const avgSessionDuration = avgSessionResult.avg_seconds
      ? formatDuration(Math.round(avgSessionResult.avg_seconds))
      : "N/A";

    res.json({
      totalStudyHours,
      sessionCount: sessionResult.session_count,
      completedSessions: sessionResult.completed_count,
      assignmentsCompleted,
      assignmentsTotal,
      completionRate,
      gpa,
      courseCount: gradeCount,
      avgSessionDuration
    });
  } catch (e) {
    console.error("[analytics] Error in /summary:", e);
    res.status(500).json({ error: e.message || "Failed to load summary" });
  }
});

/**
 * GET /api/analytics/study-time
 * Study time aggregated by course
 */
router.get("/study-time", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();

    // Build item -> course mapping from Moodle
    let itemToCourseMap = {};
    try {
      const workItemsMap = await getWorkItemsByCourse({
        token: req.session.moodleToken,
        session: req.session
      });
      // Convert Map to array of courses
      const courses = Array.from(workItemsMap.values());
      itemToCourseMap = buildItemToCourseMap(courses);
    } catch (e) {
      console.error("[analytics] Error building item map:", e.message);
    }

    // Get focus sessions from database
    const sessionsByItem = db
      .prepare(
        `SELECT
           item_id,
           SUM(actual_duration_seconds) as total_seconds,
           COUNT(id) as session_count
         FROM focus_sessions
         WHERE user_id = ?
         GROUP BY item_id`
      )
      .all(userId);

    // Aggregate by course
    const result = {};
    sessionsByItem.forEach(row => {
      const courseId = itemToCourseMap[row.item_id];
      if (courseId) {
        if (!result[courseId]) {
          result[courseId] = { hours: 0, seconds: 0, sessions: 0 };
        }
        result[courseId].hours += secondsToHours(row.total_seconds);
        result[courseId].seconds += row.total_seconds;
        result[courseId].sessions += row.session_count;
      }
    });

    res.json(result);
  } catch (e) {
    console.error("[analytics] Error in /study-time:", e);
    res.status(500).json({ error: e.message || "Failed to load study time" });
  }
});

/**
 * GET /api/analytics/time-trends
 * Daily study time for the last 30 days
 */
router.get("/time-trends", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();

    const trends = db
      .prepare(
        `SELECT
           DATE(started_at) as date,
           SUM(actual_duration_seconds) as total_seconds,
           COUNT(*) as session_count
         FROM focus_sessions
         WHERE user_id = ? AND started_at >= datetime('now', '-30 days')
         GROUP BY DATE(started_at)
         ORDER BY date DESC`
      )
      .all(userId);

    const result = trends.map(t => ({
      date: t.date,
      hours: secondsToHours(t.total_seconds),
      sessionCount: t.session_count
    }));

    res.json(result);
  } catch (e) {
    console.error("[analytics] Error in /time-trends:", e);
    res.status(500).json({ error: e.message || "Failed to load time trends" });
  }
});

/**
 * GET /api/analytics/assignment-analytics
 * Assignment statistics by status and difficulty
 */
router.get("/assignment-analytics", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();

    // Get all work items from Moodle
    let byStatus = { pending: 0, graded: 0, submitted: 0, overdue: 0 };
    let totalAssignments = 0;

    try {
      const workItemsMap = await getWorkItemsByCourse({
        token: req.session.moodleToken,
        session: req.session
      });

      // Convert Map to array of courses
      const courses = Array.from(workItemsMap.values());
      const allItems = courses.flatMap(course => [
        ...(course.assignments || []),
        ...(course.quizzes || [])
      ]);

      totalAssignments = allItems.length;
      allItems.forEach(item => {
        const status = item.status || "pending";
        byStatus[status] = (byStatus[status] || 0) + 1;
      });
    } catch (e) {
      console.error("[analytics] Error fetching assignments from Moodle:", e.message);
    }

    // Get difficulty correlations (only for items user has rated in local DB)
    const itemsWithDifficulty = db
      .prepare(
        `SELECT
           fs.item_id,
           ua.difficulty_rating,
           SUM(fs.actual_duration_seconds) as total_seconds
         FROM focus_sessions fs
         LEFT JOIN user_assignments ua ON fs.item_id = ua.moodle_assignment_id
         WHERE fs.user_id = ? AND ua.difficulty_rating IS NOT NULL
         GROUP BY fs.item_id, ua.difficulty_rating`
      )
      .all(userId);

    const sessionsByAssignment = itemsWithDifficulty.map(row => ({
      difficulty: row.difficulty_rating,
      hours: secondsToHours(row.total_seconds)
    }));

    // Convert byStatus object to assignments array format
    const assignments = Object.entries(byStatus).map(([status, count]) => ({
      status,
      count
    }));

    res.json({
      assignments,
      sessionsByAssignment,
      totalAssignments
    });
  } catch (e) {
    console.error("[analytics] Error in /assignment-analytics:", e);
    res
      .status(500)
      .json({ error: e.message || "Failed to load assignment analytics" });
  }
});

/**
 * GET /api/analytics/course/:courseId
 * Course-specific analytics
 */
router.get("/course/:courseId", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    const { courseId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();

    // Get course name and grade from Moodle
    let courseName = `Course ${courseId}`;
    let grade = null;
    let assignments = [];

    try {
      const courseCards = await buildCourseCards({
        token: req.session.moodleToken,
        session: req.session
      });
      const course = courseCards.find(c => String(c.id) === String(courseId));
      if (course) {
        courseName = course.name;
        grade = course.grade;
      }
    } catch (e) {
      console.error("[analytics] Error fetching course from Moodle:", e.message);
    }

    // Get assignments for this course from Moodle
    try {
      const workItemsMap = await getWorkItemsByCourse({
        token: req.session.moodleToken,
        session: req.session
      });
      // Get the specific course from the Map
      const courseWork = workItemsMap.get(Number(courseId));

      if (courseWork) {
        assignments = [
          ...(courseWork.assignments || []),
          ...(courseWork.quizzes || [])
        ];
      }
    } catch (e) {
      console.error("[analytics] Error fetching course assignments:", e.message);
    }

    // Get study time for course
    const assignmentIds = assignments.map(a => a.id);
    let studyHours = 0;
    let sessionCount = 0;
    let avgSessionDuration = null;

    if (assignmentIds.length > 0) {
      const placeholders = assignmentIds.map(() => "?").join(",");
      const studyDetailResult = db
        .prepare(
          `SELECT
             SUM(actual_duration_seconds) as total_seconds,
             COUNT(id) as session_count,
             AVG(actual_duration_seconds) as avg_seconds
           FROM focus_sessions
           WHERE user_id = ? AND item_id IN (${placeholders})`
        )
        .get(userId, ...assignmentIds);

      if (studyDetailResult && studyDetailResult.total_seconds) {
        studyHours = secondsToHours(studyDetailResult.total_seconds);
        sessionCount = studyDetailResult.session_count || 0;
        avgSessionDuration = studyDetailResult.avg_seconds
          ? formatDuration(Math.round(studyDetailResult.avg_seconds))
          : null;
      }
    }

    // Calculate grade metrics (separate averages for assignments vs quizzes)
    const assignmentGrades = assignments
      .filter(a => a.type === "assign" && a.gradeRaw != null)
      .map(a => a.gradeRaw);

    const quizGrades = assignments
      .filter(a => a.type === "quiz" && a.gradeRaw != null)
      .map(a => a.gradeRaw);

    const assignmentAverage = assignmentGrades.length > 0
      ? Math.round((assignmentGrades.reduce((a, b) => a + b, 0) / assignmentGrades.length) * 10) / 10
      : null;

    const quizAverage = quizGrades.length > 0
      ? Math.round((quizGrades.reduce((a, b) => a + b, 0) / quizGrades.length) * 10) / 10
      : null;

    const overallAverage = (assignmentGrades.length > 0 || quizGrades.length > 0)
      ? Math.round((([...assignmentGrades, ...quizGrades].reduce((a, b) => a + b, 0) / (assignmentGrades.length + quizGrades.length))) * 10) / 10
      : null;

    res.json({
      courseId,
      courseName,
      grade,
      assignments: assignments.map(a => ({
        id: a.id,
        title: a.name,
        type: a.type,
        status: a.status,
        dueDate: a.dueAt ? new Date(a.dueAt * 1000).toISOString() : null,
        // Grade properties
        gradeRaw: a.gradeRaw,
        gradeFormatted: a.gradeFormatted,
        gradeMax: a.gradeMax,
        gradePercent: a.gradePercent,
        gradeLetter: a.gradeLetter,
        gradingStatus: a.gradingStatus,
        gradedAt: a.gradedAt ? new Date(a.gradedAt * 1000).toISOString() : null,
        instructorComments: a.instructorComments
      })),
      gradeMetrics: {
        assignmentAverage,
        quizAverage,
        overallAverage,
        assignmentCount: assignmentGrades.length,
        quizCount: quizGrades.length,
        totalGraded: assignmentGrades.length + quizGrades.length
      },
      studyTime: {
        totalHours: studyHours,
        sessionCount,
        avgSessionDuration
      }
    });
  } catch (e) {
    console.error("[analytics] Error in /course/:courseId:", e);
    res.status(500).json({ error: e.message || "Failed to load course analytics" });
  }
});

/**
 * GET /api/analytics/top-stats
 * Quick stats for cards
 */
router.get("/top-stats", requireSession, async (req, res) => {
  try {
    const userId = req.session.userId || req.session.userid;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const db = getDatabase();

    // Longest session
    const longestSession = db
      .prepare(
        `SELECT MAX(actual_duration_seconds) as max_seconds
         FROM focus_sessions
         WHERE user_id = ?`
      )
      .get(userId);

    // Most studied course (by time)
    // Build item -> course map from Moodle
    let itemToCourseMap = {};
    try {
      const workItemsMap = await getWorkItemsByCourse({
        token: req.session.moodleToken,
        session: req.session
      });
      // Convert Map to array of courses
      const courses = Array.from(workItemsMap.values());
      itemToCourseMap = buildItemToCourseMap(courses);
    } catch (e) {
      console.error("[analytics] Error building item map:", e.message);
    }

    const sessionsByItem = db
      .prepare(
        `SELECT
           item_id,
           SUM(actual_duration_seconds) as total_seconds
         FROM focus_sessions
         WHERE user_id = ?
         GROUP BY item_id`
      )
      .all(userId);

    // Aggregate by course
    const studyByCourse = {};
    sessionsByItem.forEach(row => {
      const courseId = itemToCourseMap[row.item_id];
      if (courseId) {
        studyByCourse[courseId] = (studyByCourse[courseId] || 0) + row.total_seconds;
      }
    });

    // Find most studied
    let mostStudiedCourse = null;
    let maxSeconds = 0;
    Object.entries(studyByCourse).forEach(([courseId, seconds]) => {
      if (seconds > maxSeconds) {
        maxSeconds = seconds;
        mostStudiedCourse = { courseId, hours: secondsToHours(seconds) };
      }
    });

    res.json({
      longestSession: longestSession.max_seconds
        ? formatDuration(longestSession.max_seconds)
        : "N/A",
      mostStudiedCourse
    });
  } catch (e) {
    console.error("[analytics] Error in /top-stats:", e);
    res.status(500).json({ error: e.message || "Failed to load top stats" });
  }
});

module.exports = router;

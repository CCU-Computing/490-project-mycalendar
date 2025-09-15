const {
  getSiteInfo,
  getInProgressCourses,
  getAssignments,
  getQuizzes,
  getUserGradeItems,
} = require("../moodle/api");

// helper: safe percent from grade item fields
function extractCourseTotal(gradeItemsPayload) {
  try {
    const usergrades = gradeItemsPayload?.usergrades?.[0];
    const items = usergrades?.gradeitems || [];
    const courseTotal = items.find((it) => it.itemtype === "course");
    // prefer percentageformatted; fallback to gradeformatted
    return {
      courseTotalFormatted:
        courseTotal?.percentageformatted || courseTotal?.gradeformatted || null,
      courseTotalRaw: courseTotal?.graderaw ?? null,
      courseTotalMax: courseTotal?.grademax ?? null,
    };
  } catch {
    return { courseTotalFormatted: null, courseTotalRaw: null, courseTotalMax: null };
  }
}

function indexAssignmentsByCourse(assignPayload) {
  const byCourse = new Map();
  const courses = assignPayload?.courses || [];
  for (const c of courses) {
    byCourse.set(
      c.id,
      (c.assignments || []).map((a) => ({
        type: "assign",
        id: a.id,
        cmid: a.cmid,
        courseId: a.course,
        name: a.name,
        dueAt: a.duedate && a.duedate > 0 ? a.duedate : null,
        cutoffAt: a.cutoffdate && a.cutoffdate > 0 ? a.cutoffdate : null,
      }))
    );
  }
  return byCourse;
}

function indexQuizzesByCourse(quizzesPayload) {
  // quizzes payload usually returns { quizzes: [...] } or { courses: [...] } depending on version.
  const byCourse = new Map();

  // handle both shapes defensively:
  const quizzes =
    quizzesPayload?.quizzes ||
    quizzesPayload?.courses?.flatMap((c) =>
      (c.quizzes || []).map((q) => ({ ...q, course: c.id }))
    ) ||
    [];

  for (const q of quizzes) {
    const list = byCourse.get(q.course) || [];
    list.push({
      type: "quiz",
      id: q.id,
      courseId: q.course,
      name: q.name,
      // treat timeclose as the due date (if present)
      dueAt: q.timeclose && q.timeclose > 0 ? q.timeclose : null,
      openAt: q.timeopen && q.timeopen > 0 ? q.timeopen : null,
    });
    byCourse.set(q.course, list);
  }
  return byCourse;
}

/**
 * fallback: use grade items to synthesize "assignment-like" entries
 * when mod_assign_get_assignments returns none for a course.
 */
function synthesizeAssignmentsFromGrades(gradeItemsPayload, existingAssignIds) {
  const items =
    gradeItemsPayload?.usergrades?.[0]?.gradeitems?.filter(
      (g) => g.itemtype === "mod" && g.itemmodule === "assign"
    ) || [];

  const synth = [];
  for (const it of items) {
    // if we already have this assign from mod_assign, skip
    if (existingAssignIds.has(it.iteminstance)) continue;

    synth.push({
      type: "assign",
      id: it.iteminstance, // instance id of the assign activity
      cmid: it.cmid || null,
      courseId: gradeItemsPayload?.usergrades?.[0]?.courseid || null,
      name: it.itemname || "Assignment",
      dueAt: null, // gradebook doesn't carry due dates
      cutoffAt: null,
      // you could also carry grade hints here if useful
    });
  }
  return synth;
}

/**
 * bootstrap: ensure we have userid and current courses
 */
async function bootstrapSession({ token, session }) {
  if (!session.userid) {
    const site = await getSiteInfo(token);
    session.userid = site?.userid;
    session.sitename = site?.sitename;
    session.username = site?.fullname || site?.username;
  }
  if (!session.courses || !Array.isArray(session.courses)) {
    const { courses = [] } = await getInProgressCourses(token, { limit: 0, offset: 0 });
    session.courses = courses.map((c) => ({
      id: c.id,
      fullname: c.fullname,
      shortname: c.shortname,
      startdate: c.startdate || null,
      enddate: c.enddate || null,
      progress: c.progress ?? null,
      hasprogress: c.hasprogress ?? false,
      courseimage: c.courseimage || null,
      summary: c.summary || "",
      visible: c.visible ?? 1,
    }));
  }
  return {
    userid: session.userid,
    courses: session.courses,
    username: session.username,
    sitename: session.sitename,
  };
}

/**
 * build course cards: combine course meta + course total grade
 */
async function buildCourseCards({ token, session }) {
  const { userid, courses } = await bootstrapSession({ token, session });

  const result = [];
  for (const c of courses) {
    const grades = await getUserGradeItems(token, c.id, userid);
    const totals = extractCourseTotal(grades);
    result.push({
      id: c.id,
      name: c.fullname,
      image: c.courseimage,
      startdate: c.startdate,
      enddate: c.enddate,
      progress: c.hasprogress ? c.progress : null,
      grade: totals.courseTotalFormatted, // e.g., "95.00 %" or "95.00"
    });
  }
  return result;
}

/**
 * get assignments & quizzes for all in-progress courses, with fallback
 */
async function getWorkItemsByCourse({ token, session }) {
  const { userid, courses } = await bootstrapSession({ token, session });
  const courseIds = courses.map((c) => c.id);

  const [assignPayload, quizPayload] = await Promise.all([
    getAssignments(token, courseIds),
    getQuizzes(token, courseIds),
  ]);

  const assignsByCourse = indexAssignmentsByCourse(assignPayload);
  const quizzesByCourse = indexQuizzesByCourse(quizPayload);

  const byCourse = new Map();
  for (const id of courseIds) {
    const assigns = assignsByCourse.get(id) || [];
    const quizzes = quizzesByCourse.get(id) || [];

    // fallback: if we have no assigns, check gradebook-derived ones
    let finalAssigns = assigns;
    if (!assigns.length) {
      const grades = await getUserGradeItems(token, id, userid);
      const existingIds = new Set(assigns.map((a) => a.id));
      const synth = synthesizeAssignmentsFromGrades(grades, existingIds);
      finalAssigns = [...assigns, ...synth];
    }

    byCourse.set(id, {
      courseId: id,
      assignments: finalAssigns,
      quizzes,
    });
  }
  return byCourse;
}

/**
 * build a "due-only" calendar (assign.duedate, quiz.timeclose)
 */
async function buildDueCalendar({ token, session }) {
  const work = await getWorkItemsByCourse({ token, session });
  const events = [];

  for (const { courseId, assignments, quizzes } of work.values()) {
    for (const a of assignments) {
      if (a.dueAt) {
        events.push({
          id: `assign:${a.id}`,
          courseId,
          title: a.name,
          type: "assign",
          dueAt: a.dueAt,
        });
      }
    }
    for (const q of quizzes) {
      if (q.dueAt) {
        events.push({
          id: `quiz:${q.id}`,
          courseId,
          title: q.name,
          type: "quiz",
          dueAt: q.dueAt,
        });
      }
    }
  }

  // optional: sort by dueAt ascending
  events.sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  return events;
}

/**
 * public aggregations
 */
module.exports = {
  bootstrapSession,
  buildCourseCards,
  getWorkItemsByCourse,
  buildDueCalendar,
};
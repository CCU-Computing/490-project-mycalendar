const {
  getSiteInfo,
  getInProgressCourses,
  getAssignments,
  getQuizzes,
  getUserGradeItems,
  getAssignSubmissionStatus,
} = require("../moodle/api");
const cacheManager = require("./cacheManager");

// helper: safe percent from grade item fields
function extractCourseTotal(gradeItemsPayload) {
  try {
    const usergrades = gradeItemsPayload?.usergrades?.[0];
    const items = usergrades?.gradeitems || [];
    const courseTotal = items.find((it) => it.itemtype === "course");

    // Check if Moodle's course total is valid (not null, not 0, and has percentage)
    const moodleTotal = courseTotal?.percentageformatted || courseTotal?.gradeformatted || null;
    const moodleRaw = courseTotal?.graderaw ?? null;
    const moodleMax = courseTotal?.grademax ?? null;

    // If Moodle has a valid grade, use it
    if (moodleTotal && moodleRaw !== null && moodleRaw !== 0) {
      return {
        courseTotalFormatted: moodleTotal,
        courseTotalRaw: moodleRaw,
        courseTotalMax: moodleMax,
      };
    }

    // Otherwise, calculate from graded module items (assignments and quizzes)
    const gradedItems = items.filter(
      (item) =>
        item.itemtype === "mod" &&
        (item.itemmodule === "assign" || item.itemmodule === "quiz") &&
        item.graderaw !== null &&
        item.graderaw !== undefined &&
        item.grademax !== null &&
        item.grademax !== undefined &&
        item.grademax > 0
    );

    if (gradedItems.length === 0) {
      // No graded items yet, return Moodle's value even if null/0
      return {
        courseTotalFormatted: moodleTotal,
        courseTotalRaw: moodleRaw,
        courseTotalMax: moodleMax,
      };
    }

    // Calculate average percentage from graded items
    let totalPercentage = 0;
    for (const item of gradedItems) {
      const percentage = (item.graderaw / item.grademax) * 100;
      totalPercentage += percentage;
    }
    const averagePercentage = totalPercentage / gradedItems.length;

    // Format as percentage string to match Moodle's format
    const calculatedFormatted = `${averagePercentage.toFixed(2)} %`;

    return {
      courseTotalFormatted: calculatedFormatted,
      courseTotalRaw: averagePercentage, // Store the calculated percentage
      courseTotalMax: 100, // Percentage scale
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
      cmid: q.coursemodule || q.cmid || null,  // extract cmid for grade matching
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
 * extract instructor comments from submission status feedback
 */
function extractInstructorComments(feedbackData) {
  try {
    if (!feedbackData) {
      return null;
    }

    // Look for feedback comments plugin in the plugins array
    const plugins = feedbackData.plugins || [];
    const commentsPlugin = plugins.find(p => p.type === "comments" && p.name === "Feedback comments");

    if (!commentsPlugin) {
      return null;
    }

    // Extract the comments field from editorfields
    const editorfields = commentsPlugin.editorfields || [];
    const commentsField = editorfields.find(f => f.name === "comments");

    if (!commentsField || !commentsField.text) {
      return null;
    }

    return {
      text: commentsField.text,
      format: commentsField.format
    };
  } catch (error) {
    return null;
  }
}

/**
 * enrich work items (assignments/quizzes) with grade and comment data
 * matches grade items by cmid or iteminstance
 * fetches instructor comments from submission status for assignments
 */
function enrichWithGrades(workItems, gradeItemsPayload, itemType) {
  try {
    const gradeItems = gradeItemsPayload?.usergrades?.[0]?.gradeitems || [];

    // build lookup maps for efficient matching
    const gradeMapByCmid = new Map();
    const gradeMapByInstance = new Map();
    const gradeMapByName = new Map();

    for (const item of gradeItems) {
      // only process grade items of matching type
      if (item.itemtype === "mod" && item.itemmodule === itemType) {
        if (item.cmid) gradeMapByCmid.set(item.cmid, item);
        if (item.iteminstance) gradeMapByInstance.set(item.iteminstance, item);
        // Also index by itemname for fallback matching
        if (item.itemname) gradeMapByName.set(item.itemname.toLowerCase(), item);
      }
    }

    // enrich each work item with grade data
    return workItems.map(work => {
      let grade = null;

      // Try matching in order of specificity:
      // 1. First try matching by cmid (most reliable)
      if (work.cmid) {
        grade = gradeMapByCmid.get(work.cmid);
      }

      // 2. Fallback to matching by iteminstance (assignment ID)
      if (!grade) {
        grade = gradeMapByInstance.get(work.id);
      }

      // 3. Final fallback: try matching by name (case-insensitive)
      // This helps when cmid and iteminstance don't match due to course configuration
      if (!grade && work.name) {
        grade = gradeMapByName.get(work.name.toLowerCase());
      }

      // derive status based on grade presence and due date
      let status = "pending";
      if (grade?.graderaw != null) {
        status = "graded";
      } else if (work.dueAt && work.dueAt < Math.floor(Date.now() / 1000)) {
        status = "overdue";
      }

      return {
        ...work,
        gradeRaw: grade?.graderaw ?? null,
        gradeFormatted: grade?.gradeformatted ?? null,
        gradeMax: grade?.grademax ?? null,
        gradePercent: grade?.percentageformatted ?? null,
        gradeLetter: grade?.lettergradeformatted ?? null,
        gradingStatus: grade?.graderaw != null ? "graded" : null,
        gradedAt: grade?.gradeddate ?? null,
        status,
        // instructor comments will be fetched separately for assignments
        instructorComments: null
      };
    });
  } catch (error) {
    console.error(`Error enriching ${itemType}s with grades:`, error);
    // return original work items on error (graceful degradation)
    return workItems;
  }
}

/**
 * enrich assignments with instructor comments by fetching submission status
 */
async function enrichAssignmentsWithComments(assignments, token, userid) {
  try {
    // fetch comments for each assignment in parallel with a reasonable limit
    const commentPromises = assignments.map(async (assignment) => {
      try {
        const submissionStatus = await getAssignSubmissionStatus(token, assignment.id, userid);

        if (!submissionStatus) {
          return { id: assignment.id, instructorComments: null };
        }

        // feedback is at the root level of the submission status response
        const feedback = submissionStatus?.feedback;
        const comments = extractInstructorComments(feedback);

        return { id: assignment.id, instructorComments: comments };
      } catch (error) {
        return { id: assignment.id, instructorComments: null };
      }
    });

    const commentResults = await Promise.all(commentPromises);
    const commentMap = new Map(commentResults.map(r => [r.id, r.instructorComments]));

    // merge comments back into assignments
    const enriched = assignments.map(assignment => ({
      ...assignment,
      instructorComments: commentMap.get(assignment.id) || null
    }));

    return enriched;
  } catch (error) {
    // return assignments without comments on error
    return assignments;
  }
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
 * Cache TTL: 60 minutes (courses rarely change during a semester)
 */
async function buildCourseCards({ token, session }) {
  const { userid, courses } = await bootstrapSession({ token, session });

  // Check cache first
  const cachedCards = cacheManager.get(userid, "courseCards");
  if (cachedCards) {
    return cachedCards;
  }

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

  // Cache for 60 minutes
  cacheManager.set(userid, "courseCards", result, 3600);
  return result;
}

/**
 * get assignments & quizzes for all in-progress courses, with grades enriched
 * Cache TTL: 15 minutes (grades/submissions update periodically)
 */
async function getWorkItemsByCourse({ token, session }) {
  const { userid, courses } = await bootstrapSession({ token, session });

  // Check cache first
  const cachedWorkItems = cacheManager.get(userid, "workItems");
  if (cachedWorkItems) {
    return cachedWorkItems;
  }

  const courseIds = courses.map((c) => c.id);

  const [assignPayload, quizPayload] = await Promise.all([
    getAssignments(token, courseIds),
    getQuizzes(token, courseIds),
  ]);

  const assignsByCourse = indexAssignmentsByCourse(assignPayload);
  const quizzesByCourse = indexQuizzesByCourse(quizPayload);

  const byCourse = new Map();
  for (const id of courseIds) {
    let assigns = assignsByCourse.get(id) || [];
    let quizzes = quizzesByCourse.get(id) || [];

    // fetch grades for this course
    try {
      const grades = await getUserGradeItems(token, id, userid);

      // enrich assignments with grades
      assigns = enrichWithGrades(assigns, grades, "assign");

      // enrich quizzes with grades
      quizzes = enrichWithGrades(quizzes, grades, "quiz");

      // enrich assignments with instructor comments
      assigns = await enrichAssignmentsWithComments(assigns, token, userid);

      // fallback: if we have no assigns, check gradebook-derived ones
      if (assignsByCourse.get(id)?.length === 0) {
        const existingIds = new Set(assigns.map((a) => a.id));
        const synth = synthesizeAssignmentsFromGrades(grades, existingIds);
        assigns = [...assigns, ...synth];
      }
    } catch (error) {
      console.error(`Error fetching grades for course ${id}:`, error);
      // continue without grades for this course (graceful degradation)
    }

    byCourse.set(id, {
      courseId: id,
      assignments: assigns,
      quizzes,
    });
  }

  // Cache for 15 minutes
  cacheManager.set(userid, "workItems", byCourse, 900);
  return byCourse;
}

/**
 * build a "due-only" calendar (assign.duedate, quiz.timeclose) with grade data and comments
 * Cache TTL: 15 minutes (depends on workItems cache)
 */
async function buildDueCalendar({ token, session }) {
  const { userid } = await bootstrapSession({ token, session });

  // Check cache first
  const cachedEvents = cacheManager.get(userid, "calendar");
  if (cachedEvents) {
    return cachedEvents;
  }

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
          gradeFormatted: a.gradeFormatted ?? null,
          gradeMax: a.gradeMax ?? null,
          gradePercent: a.gradePercent ?? null,
          instructorComments: a.instructorComments ?? null
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
          gradeFormatted: q.gradeFormatted ?? null,
          gradeMax: q.gradeMax ?? null,
          gradePercent: q.gradePercent ?? null,
          instructorComments: q.instructorComments ?? null
        });
      }
    }
  }

  // optional: sort by dueAt ascending
  events.sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));

  // Cache for 15 minutes
  cacheManager.set(userid, "calendar", events, 900);
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
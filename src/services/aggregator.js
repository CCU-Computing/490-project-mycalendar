const {
  getSiteInfo,
  getInProgressCourses,
  getAssignments,
  getQuizzes,
  getUserGradeItems,
  getAssignSubmissionStatus,
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
      console.log("extractInstructorComments: no feedbackData provided");
      return null;
    }

    // Look for feedback comments plugin in the plugins array
    const plugins = feedbackData.plugins || [];
    console.log("extractInstructorComments: found", plugins.length, "plugins:", plugins.map(p => ({ type: p.type, name: p.name })));

    const commentsPlugin = plugins.find(p => p.type === "comments" && p.name === "Feedback comments");

    if (!commentsPlugin) {
      console.log("extractInstructorComments: No feedback comments plugin found. Available plugins:", plugins.map(p => `${p.type}/${p.name}`));
      return null;
    }

    // Extract the comments field from editorfields
    const editorfields = commentsPlugin.editorfields || [];
    console.log("extractInstructorComments: found", editorfields.length, "editorfields in comments plugin:", editorfields.map(f => f.name));

    const commentsField = editorfields.find(f => f.name === "comments");

    if (!commentsField || !commentsField.text) {
      console.log("extractInstructorComments: No comments text found in editorfield");
      return null;
    }

    console.log("extractInstructorComments: Successfully extracted comments, length:", commentsField.text.length);
    return {
      text: commentsField.text,
      format: commentsField.format
    };
  } catch (error) {
    console.error("Error extracting instructor comments:", error);
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

    for (const item of gradeItems) {
      // only process grade items of matching type
      if (item.itemtype === "mod" && item.itemmodule === itemType) {
        if (item.cmid) gradeMapByCmid.set(item.cmid, item);
        if (item.iteminstance) gradeMapByInstance.set(item.iteminstance, item);
      }
    }

    // enrich each work item with grade data
    return workItems.map(work => {
      // try matching by cmid first, fallback to instance ID
      const grade = work.cmid
        ? gradeMapByCmid.get(work.cmid)
        : gradeMapByInstance.get(work.id);

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
    console.log(`enrichAssignmentsWithComments: Starting for ${assignments.length} assignments, userid:`, userid);

    // fetch comments for each assignment in parallel with a reasonable limit
    const commentPromises = assignments.map(async (assignment) => {
      try {
        console.log(`enrichAssignmentsWithComments: Fetching submission status for assignment ${assignment.id}`);
        const submissionStatus = await getAssignSubmissionStatus(token, assignment.id, userid);

        if (!submissionStatus) {
          console.warn(`enrichAssignmentsWithComments: No submission status returned for assignment ${assignment.id}`);
          return { id: assignment.id, instructorComments: null };
        }

        const feedback = submissionStatus?.lastattempt?.feedback;
        console.log(`enrichAssignmentsWithComments: Assignment ${assignment.id} has feedback:`, !!feedback, feedback ? Object.keys(feedback) : null);

        const comments = extractInstructorComments(feedback);
        console.log(`enrichAssignmentsWithComments: Extracted comments for assignment ${assignment.id}:`, !!comments);

        return { id: assignment.id, instructorComments: comments };
      } catch (error) {
        console.warn(`Failed to fetch comments for assignment ${assignment.id}:`, error);
        return { id: assignment.id, instructorComments: null };
      }
    });

    const commentResults = await Promise.all(commentPromises);
    console.log(`enrichAssignmentsWithComments: Got ${commentResults.length} comment results`);

    const commentMap = new Map(commentResults.map(r => [r.id, r.instructorComments]));

    // merge comments back into assignments
    const enriched = assignments.map(assignment => ({
      ...assignment,
      instructorComments: commentMap.get(assignment.id) || null
    }));

    console.log(`enrichAssignmentsWithComments: Finished enriching assignments. Sample:`, enriched.slice(0, 2).map(a => ({ id: a.id, hasComments: !!a.instructorComments })));

    return enriched;
  } catch (error) {
    console.error("Error enriching assignments with comments:", error);
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
 * get assignments & quizzes for all in-progress courses, with grades enriched
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
  return byCourse;
}

/**
 * build a "due-only" calendar (assign.duedate, quiz.timeclose) with grade data and comments
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
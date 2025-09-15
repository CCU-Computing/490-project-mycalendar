const { moodleGet } = require("../lib/moodleClient");

// A) who am i? (get user info, including userid)
async function getSiteInfo(token) {
  return moodleGet({
    token,
    wsfunction: "core_webservice_get_site_info",
  });
}

// B) courses - "in progress"
async function getInProgressCourses(token, { limit = 0, offset = 0 } = {}) {
  return moodleGet({
    token,
    wsfunction: "core_course_get_enrolled_courses_by_timeline_classification",
    params: { classification: "inprogress", limit, offset },
  });
}

// C) assignments by courses (batch)
async function getAssignments(token, courseids = []) {
  const params = {};
  if (Array.isArray(courseids) && courseids.length) {
    params["courseids"] = courseids;
  }
  return moodleGet({
    token,
    wsfunction: "mod_assign_get_assignments",
    params,
  });
}

// quizzes by courses (batch)
async function getQuizzes(token, courseids = []) {
  const params = {};
  if (Array.isArray(courseids) && courseids.length) {
    params["courseids"] = courseids;
  }
  return moodleGet({
    token,
    wsfunction: "mod_quiz_get_quizzes_by_courses",
    params,
  });
}

// D) assignment submission status (per assignment)
async function getAssignSubmissionStatus(token, assignid, userid) {
  const params = { assignid };
  // userid optional for student tokens; include when you have it
  if (userid) params.userid = userid;
  return moodleGet({
    token,
    wsfunction: "mod_assign_get_submission_status",
    params,
  });
}

// E) activity completion per course (optional, for checkboxes / progress)
async function getCourseCompletionStatuses(token, courseid, userid) {
  return moodleGet({
    token,
    wsfunction: "core_completion_get_activities_completion_status",
    params: { courseid, userid },
  });
}

// F) gradebook items per course (user-scoped)
async function getUserGradeItems(token, courseid, userid) {
  return moodleGet({
    token,
    wsfunction: "gradereport_user_get_grade_items",
    params: { courseid, userid },
  });
}

// course contents (optional enrichment / cmid mapping)
async function getCourseContents(token, courseid) {
  return moodleGet({
    token,
    wsfunction: "core_course_get_contents",
    params: { courseid },
  });
}

module.exports = {
  getSiteInfo,
  getInProgressCourses,
  getAssignments,
  getQuizzes,
  getAssignSubmissionStatus,
  getCourseCompletionStatuses,
  getUserGradeItems,
  getCourseContents,
};
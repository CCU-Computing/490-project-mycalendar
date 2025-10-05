async function handle(resp) {
  if (resp.status === 401) {
    // not logged in on the server -> bounce to login
    window.location.href = "./login.html";
    throw new Error("Not logged in");
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(txt || resp.statusText);
  }
  return resp.json();
}

export const api = {
  login: (name, token) =>
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, token }),
    }).then(handle),

  me: () => fetch("/api/me").then(handle),

  courses: () => fetch("/api/courses").then(handle),

  // ?courseId=123 optional
  work: (courseId) =>
    fetch("/api/work" + (courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""))
      .then(handle),

  calendar: () => fetch("/api/calendar").then(handle),

  prefs: {
    get: () => fetch("/api/prefs").then(handle),
    setCourseColor: (courseId, color) =>
      fetch("/api/prefs/courseColor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, color }),
      }).then(handle),
    setEventOverride: (id, patch) =>
      fetch("/api/prefs/eventOverride", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      }).then(handle),
    setAssignmentTypeColor: (assignmentType, color) =>
      fetch("/api/prefs/assignmentTypeColor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentType, color }),
      }).then(handle),
  },

  studyBlocks: {
    create: (data) =>
      fetch("/api/custom-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handle),
    getAll: () => fetch("/api/custom-events").then(handle),
    getForAssignment: (assignmentId) =>
      fetch(`/api/custom-events?moodleAssignmentId=${encodeURIComponent(assignmentId)}`)
        .then(handle),
    update: (id, data) =>
      fetch(`/api/custom-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handle),
    delete: (id) =>
      fetch(`/api/custom-events/${id}`, {
        method: "DELETE",
      }).then(handle),
  },

  courseMetadata: {
    getAll: () => fetch("/api/course-metadata").then(handle),
    get: (courseId) => fetch(`/api/course-metadata/${encodeURIComponent(courseId)}`).then(handle),
    update: (courseId, data) =>
      fetch(`/api/course-metadata/${encodeURIComponent(courseId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(handle),
    delete: (courseId) =>
      fetch(`/api/course-metadata/${encodeURIComponent(courseId)}`, {
        method: "DELETE",
      }).then(handle),
  },

  starredAssignments: {
    getAll: () => fetch("/api/starred-assignments").then(handle),
    star: (moodleAssignmentId) =>
      fetch("/api/starred-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleAssignmentId }),
      }).then(handle),
    unstar: (moodleAssignmentId) =>
      fetch(`/api/starred-assignments/${encodeURIComponent(moodleAssignmentId)}`, {
        method: "DELETE",
      }).then(handle),
    check: (moodleAssignmentId) =>
      fetch(`/api/starred-assignments/check/${encodeURIComponent(moodleAssignmentId)}`).then(handle),
  },
};
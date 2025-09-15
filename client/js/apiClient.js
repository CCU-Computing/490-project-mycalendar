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
};
import { api } from "../js/apiClient.js";

function $(id) { return document.getElementById(id); }

function ensureModalDOM() {
  if ($("classModal")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="classModal" class="fixed inset-0 z-50 hidden">
      <div id="modalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 id="mTitle" class="text-lg font-semibold text-slate-900">Course Details</h3>
            <button id="mClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="px-6 py-6">
            <div class="flex items-start gap-4">
              <img id="mImg" src="" alt="Course image" class="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 bg-slate-100">
              <div class="flex-1 min-w-0">
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="font-medium text-slate-900">Category:</span>
                    <span id="mCat" class="ml-2 text-slate-600">—</span>
                  </div>
                  <div>
                    <span class="font-medium text-slate-900">Progress:</span>
                    <span id="mProg" class="ml-2 text-slate-600">—</span>
                  </div>
                  <div>
                    <span class="font-medium text-slate-900">Grade:</span>
                    <span id="mGrade" class="ml-2 text-slate-600">—</span>
                  </div>
                  <div>
                    <span class="font-medium text-slate-900">Next Due:</span>
                    <span id="mNext" class="ml-2 text-slate-600">—</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-6">
              <h4 class="text-sm font-semibold text-slate-900 mb-3">Upcoming Assignments</h4>
              <ul id="mUpcoming" class="space-y-2"></ul>
            </div>
            <div class="mt-6 flex justify-end">
              <a id="mViewCourse" href="#" class="hidden inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                View Course
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);
}

function fmtDate(tsSec) {
  if (!tsSec) return "—";
  try { return new Date(tsSec * 1000).toLocaleString(); } catch (_) { return "—"; }
}

function stripHTML(s) { return String(s || "").replace(/<[^>]*>/g, ""); }

function buildNextMap(workData) {
  const nowSec = Math.floor(Date.now() / 1000);
  const map = {};
  if (!workData || !Array.isArray(workData.courses)) return map;
  workData.courses.forEach(function (c) {
    const allWork = [
      ...(c.assignments || []).map(a => ({ ...a, type: "assign" })),
      ...(c.quizzes || []).map(q => ({ ...q, type: "quiz" }))
    ];
    const ups = allWork.filter(a => a && a.dueAt).sort((a, b) => a.dueAt - b.dueAt);
    const upcoming = ups.filter(a => a.dueAt >= nowSec);
    const next = upcoming[0] || null;
    map[c.courseId] = { next, upcoming };
  });
  return map;
}

function extractCourseGrade(course) {
  if (!course || typeof course.grade !== "string") return null;
  const match = course.grade.match(/[\d.]+/);
  const num = match ? parseFloat(match[0]) : null;
  return { percentText: course.grade.replace("&ndash;", "–"), percentNum: num };
}

export function mountClassList({ containerId = "semesterClasses" } = {}) {
  ensureModalDOM();

  const container = $(containerId);
  if (!container) return { reload: () => {} };

  let courseList = [];
  let nextByCourse = {};
  let gradeByCourse = {};
  let courseColors = {};
  let courseMetadata = {};

  // Modal refs (now guaranteed to exist)
  const modal = $("classModal");
  const mBackdrop = $("modalBackdrop");
  const mClose = $("mClose");
  const mTitle = $("mTitle");
  const mImg = $("mImg");
  const mCat = $("mCat");
  const mProg = $("mProg");
  const mGrade = $("mGrade");
  const mNext = $("mNext");
  const mUpcoming = $("mUpcoming");
  const mViewCourse = $("mViewCourse");

  function openModal(course) {
    if (!modal) return;
    mTitle.textContent = course.fullname || course.fullnamedisplay || course.name || course.shortname || "Course";
    // Use custom image URL if available, otherwise fall back to Moodle image
    const metadata = courseMetadata[String(course.id)];
    mImg.src = (metadata && metadata.custom_image_url) || course.image || course.courseimage || "";
    mImg.alt = course.shortname || "Course image";
    mCat.textContent = course.coursecategory || "—";
    mProg.textContent = (typeof course.progress === "number") ? (course.progress + "%") : "—";
    const g = gradeByCourse[course.id];
    mGrade.textContent = g ? (g.percentText || (g.percentNum + "%")) : "—";
    const next = nextByCourse[course.id]?.next;
    mNext.textContent = next ? (stripHTML(next.name) + " — " + fmtDate(next.dueAt)) : "—";
    mUpcoming.innerHTML = "";
    const list = nextByCourse[course.id]?.upcoming || [];
    list.slice(0, 5).forEach(function (a) {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2";
      li.innerHTML = "<span class='font-medium'>" + stripHTML(a.name) + "</span>" +
                     "<span class='text-slate-600 text-xs'>" + fmtDate(a.dueAt) + "</span>";
      mUpcoming.appendChild(li);
    });
    if (course.viewurl) {
      mViewCourse.classList.remove("hidden");
      mViewCourse.href = course.viewurl;
    } else {
      mViewCourse.classList.add("hidden");
      mViewCourse.removeAttribute("href");
    }
    modal.classList.remove("hidden");
  }
  function closeModal() { modal?.classList.add("hidden"); }
  mBackdrop?.addEventListener("click", closeModal);
  mClose?.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  function renderCourses() {
    if (courseList.length === 0) {
      container.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No classes found. Please check your enrollment or try refreshing.
        </div>`;
      return;
    }
    container.innerHTML = "";
    courseList.forEach(function (c) {
      const next = nextByCourse[c.id]?.next;
      const grade = gradeByCourse[c.id];
      const color = courseColors[String(c.id)] || "";
      const card = document.createElement("button");
      card.type = "button";
      card.className = [
        "group relative flex items-center gap-3 rounded-xl border-3 border-slate-200 bg-white p-3 text-left shadow-sm",
        "hover:shadow-md hover:border-slate-400 transition",
        "cursor-pointer"
      ].join(" ");
      if (color) {
        card.style.borderColor = color;
        card.style.borderWidth = "3px";
      }
      const img = document.createElement("img");
      // Use custom image URL if available, otherwise fall back to Moodle image
      const metadata = courseMetadata[String(c.id)];
      img.src = (metadata && metadata.custom_image_url) || c.image || "";
      img.alt = c.shortname || "Course image";
      img.className = "h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200 bg-slate-100";
      const content = document.createElement("div");
      content.className = "min-w-0 flex-1";
      const title = document.createElement("div");
      title.className = "truncate text-sm font-semibold";
      title.textContent = c.name || "Course";
      const stats = document.createElement("div");
      stats.className = "mt-1 grid grid-cols-3 gap-2 text-[11px] text-slate-600";
      stats.innerHTML =
        "<div class='rounded-lg bg-slate-50 px-2 py-1 border border-slate-200'>" +
          "<div class='font-medium text-slate-900 text-xs'>" + (grade ? (grade.percentText || (grade.percentNum + "%")) : "—") + "</div>" +
          "<div class='uppercase tracking-wide'>Grade</div>" +
        "</div>" +
        "<div class='rounded-lg bg-slate-50 px-2 py-1 border border-slate-200'>" +
          "<div class='font-medium text-slate-900 text-xs'>" + (typeof c.progress === "number" ? (c.progress + "%") : "—") + "</div>" +
          "<div class='uppercase tracking-wide'>Progress</div>" +
        "</div>" +
        "<div class='rounded-lg bg-slate-50 px-2 py-1 border border-slate-200'>" +
          "<div class='font-medium text-slate-900 text-xs'>" + (next ? new Date(next.dueAt * 1000).toLocaleDateString() : "—") + "</div>" +
          "<div class='uppercase tracking-wide'>Next Due</div>" +
        "</div>";
      content.appendChild(title);
      content.appendChild(stats);
      card.appendChild(img);
      card.appendChild(content);
      card.addEventListener("click", function () { openModal(c); });
      container.appendChild(card);
    });
  }

  async function reload() {
    try {
      const [coursesRes, workRes, prefsRes, metadataRes] = await Promise.allSettled([
        api.courses(),
        api.work(),
        api.prefs.get(),
        api.courseMetadata.getAll()
      ]);
      const coursesData = coursesRes.status === "fulfilled" ? coursesRes.value : null;
      const workData = workRes.status === "fulfilled" ? workRes.value : null;
      const prefsData = prefsRes.status === "fulfilled" ? prefsRes.value : null;
      const metadataData = metadataRes.status === "fulfilled" ? metadataRes.value : null;

      if (coursesData && coursesData.courses) {
        courseList = coursesData.courses;
        courseList.forEach(course => {
          const g = extractCourseGrade(course);
          if (g) gradeByCourse[course.id] = g;
        });
      }
      if (workData) nextByCourse = buildNextMap(workData);
      courseColors = (prefsData && prefsData.prefs && prefsData.prefs.calendar && prefsData.prefs.calendar.courseColors) || {};

      // Build metadata map by course_id
      if (metadataData && metadataData.metadata) {
        courseMetadata = {};
        metadataData.metadata.forEach(meta => {
          courseMetadata[meta.course_id] = meta;
        });
      }

      // Example fallback: if empty, color the first course so storytellers can see it
      if (!courseColors || Object.keys(courseColors).length === 0) {
        if (courseList && courseList.length > 0) {
          const firstId = String(courseList[0].id);
          courseColors = { [firstId]: "#4F46E5" }; // Indigo sample
        }
      }
      renderCourses();
    } catch (e) {
      container.innerHTML = `
        <div class="rounded-xl border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-600">${e.message}</div>`;
    }
  }

  reload();
  return { reload };
}
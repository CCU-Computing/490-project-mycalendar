import { api } from "./apiClient.js";
import { courseProgressBar } from "../components/CourseProgressBar.js";

function $(id) { return document.getElementById(id); }

// Utility functions
function fmtDate(tsSec) {
  if (!tsSec) return "—";
  try { return new Date(tsSec * 1000).toLocaleString(); } catch (_) { return "—"; }
}

function fmtDateShort(tsSec) {
  if (!tsSec) return "—";
  try { return new Date(tsSec * 1000).toLocaleDateString(); } catch (_) { return "—"; }
}

function stripHTML(s) { return String(s || "").replace(/<[^>]*>/g, ""); }

function getColorScheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// Chart color helper
function getChartColors() {
  const isDark = getColorScheme() === "dark";
  return {
    text: isDark ? "#e2e8f0" : "#0f172a",
    gridLine: isDark ? "#525252" : "#e2e8f0",
    primary: "#4f46e5",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    blue: "#3b82f6",
    purple: "#a855f7"
  };
}

// Data aggregation
function buildWorkMap(workData) {
  const map = {};
  if (!workData || !Array.isArray(workData.courses)) return map;
  workData.courses.forEach(function (c) {
    const allWork = [
      ...(c.assignments || []).map(a => ({ ...a, type: "assign" })),
      ...(c.quizzes || []).map(q => ({ ...q, type: "quiz" }))
    ];
    map[c.courseId] = allWork;
  });
  return map;
}

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

function calculateProgressFromWork(workData) {
  const progressMap = {};
  if (!workData || !Array.isArray(workData.courses)) return progressMap;

  const nowSec = Math.floor(Date.now() / 1000);

  workData.courses.forEach(function (c) {
    const allWork = [
      ...(c.assignments || []),
      ...(c.quizzes || [])
    ];

    if (allWork.length === 0) {
      progressMap[c.courseId] = null;
      return;
    }

    const completed = allWork.filter(item => item.dueAt && item.dueAt < nowSec).length;
    const total = allWork.length;

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    progressMap[c.courseId] = progress;
  });

  return progressMap;
}

function extractCourseGrade(course) {
  if (!course || typeof course.grade !== "string") return null;
  const match = course.grade.match(/[\d.]+/);
  const num = match ? parseFloat(match[0]) : null;
  return { percentText: course.grade.replace("&ndash;", "–"), percentNum: num };
}

// Class Card Component
function createClassCard(course, nextMap, gradeMap, courseColors, courseMetadata, expandCallback) {
  const next = nextMap[course.id]?.next;
  const grade = gradeMap[course.id];
  const color = courseColors[String(course.id)] || "";
  const metadata = courseMetadata[String(course.id)];

  const card = document.createElement("button");
  card.type = "button";
  card.className = [
    "w-full rounded-xl border-3 border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-4 text-left shadow-sm",
    "hover:shadow-md hover:border-slate-400 dark:hover:border-neutral-500 transition",
    "cursor-pointer"
  ].join(" ");

  if (color) {
    card.style.borderColor = color;
    card.style.borderWidth = "3px";
  }

  const content = document.createElement("div");
  content.className = "flex items-start gap-4";

  const img = document.createElement("img");
  img.src = (metadata && metadata.custom_image_url) || course.image || course.courseimage || "";
  img.alt = course.shortname || "Course image";
  img.className = "h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 bg-slate-100";

  const details = document.createElement("div");
  details.className = "flex-1 min-w-0";

  const title = document.createElement("h3");
  title.className = "truncate text-sm font-semibold text-slate-900 dark:text-slate-200";
  title.textContent = course.name || "Course";

  const statsDiv = document.createElement("div");
  statsDiv.className = "mt-2 grid grid-cols-3 gap-2 text-xs";

  const gradeDiv = document.createElement("div");
  gradeDiv.className = "rounded-lg bg-slate-50 dark:bg-neutral-700 px-2 py-1 border border-slate-200 dark:border-neutral-600";
  gradeDiv.innerHTML = `
    <div class="font-medium text-slate-900 dark:text-slate-200 truncate">${grade ? (grade.percentText || (grade.percentNum + "%")) : "—"}</div>
    <div class="text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Grade</div>
  `;

  const dueDiv = document.createElement("div");
  dueDiv.className = "rounded-lg bg-slate-50 dark:bg-neutral-700 px-2 py-1 border border-slate-200 dark:border-neutral-600";
  dueDiv.innerHTML = `
    <div class="font-medium text-slate-900 dark:text-slate-200 truncate text-xs">${next ? fmtDateShort(next.dueAt) : "—"}</div>
    <div class="text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Due</div>
  `;

  const chevron = document.createElement("div");
  chevron.className = "rounded-lg bg-slate-50 dark:bg-neutral-700 px-2 py-1 border border-slate-200 dark:border-neutral-600 flex items-center justify-center";
  chevron.innerHTML = `<svg class="h-4 w-4 text-slate-600 dark:text-slate-400 transform transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
  </svg>`;

  statsDiv.appendChild(gradeDiv);
  statsDiv.appendChild(dueDiv);
  statsDiv.appendChild(chevron);

  details.appendChild(title);
  details.appendChild(statsDiv);

  content.appendChild(img);
  content.appendChild(details);

  card.appendChild(content);
  card.addEventListener("click", () => expandCallback(course));

  return { card, chevron };
}

// Class Details Component (Expandable)
function createClassDetails(course, workMap, gradeMap, courseMetadata, courseColors) {
  const metadata = courseMetadata[String(course.id)];
  const allWork = workMap[course.id] || [];
  const grade = gradeMap[course.id];

  const container = document.createElement("div");
  container.className = "rounded-xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-sm overflow-hidden";

  // Header
  const header = document.createElement("div");
  header.className = "px-6 py-4 border-b border-slate-200 dark:border-neutral-600";
  header.innerHTML = `
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-200">${course.name || "Course"}</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">${course.coursecategory || "—"}</p>
  `;

  // Info Grid
  const infoGrid = document.createElement("div");
  infoGrid.className = "px-6 py-4 border-b border-slate-200 dark:border-neutral-600";
  infoGrid.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <div class="text-slate-600 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Overall Grade</div>
        <div class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-200">${grade ? (grade.percentText || (grade.percentNum + "%")) : "—"}</div>
      </div>
      <div>
        <div class="text-slate-600 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Total Items</div>
        <div class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-200">${allWork.length}</div>
      </div>
      <div>
        <div class="text-slate-600 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Assignments</div>
        <div class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-200">${allWork.filter(w => w.type === "assign").length}</div>
      </div>
      <div>
        <div class="text-slate-600 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">Quizzes</div>
        <div class="mt-1 text-xl font-bold text-slate-900 dark:text-slate-200">${allWork.filter(w => w.type === "quiz").length}</div>
      </div>
    </div>
  `;

  // Graphs Section
  const graphsSection = document.createElement("div");
  graphsSection.className = "px-6 py-4 border-b border-slate-200 dark:border-neutral-600";

  const graphsGrid = document.createElement("div");
  graphsGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-4";

  // Study Time Chart (placeholder)
  const studyTimeChartDiv = document.createElement("div");
  studyTimeChartDiv.className = "rounded-lg border border-slate-200 dark:border-neutral-600 p-4";
  studyTimeChartDiv.innerHTML = `
    <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-3">Study Time</h4>
    <div class="h-40 flex items-center justify-center bg-slate-50 dark:bg-neutral-700 rounded-lg text-slate-500 dark:text-slate-400 text-sm">
      <canvas id="studyTimeChart-${course.id}"></canvas>
    </div>
  `;

  // Grade Distribution Chart (placeholder)
  const gradeChartDiv = document.createElement("div");
  gradeChartDiv.className = "rounded-lg border border-slate-200 dark:border-neutral-600 p-4";
  gradeChartDiv.innerHTML = `
    <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-3">Assignment Grades by Type</h4>
    <div class="h-40 flex items-center justify-center bg-slate-50 dark:bg-neutral-700 rounded-lg text-slate-500 dark:text-slate-400 text-sm">
      <canvas id="gradeChart-${course.id}"></canvas>
    </div>
  `;

  graphsGrid.appendChild(studyTimeChartDiv);
  graphsGrid.appendChild(gradeChartDiv);
  graphsSection.appendChild(graphsGrid);

  // Assignments Table/List
  const assignmentsSection = document.createElement("div");
  assignmentsSection.className = "px-6 py-4";

  const assignmentsTitle = document.createElement("h4");
  assignmentsTitle.className = "text-sm font-semibold text-slate-900 dark:text-slate-200 mb-3";
  assignmentsTitle.textContent = `All Assignments & Quizzes (${allWork.length})`;

  const assignmentsTable = document.createElement("div");
  assignmentsTable.className = "overflow-x-auto";

  if (allWork.length === 0) {
    assignmentsTable.innerHTML = `
      <div class="rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-700 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        No assignments or quizzes found for this class.
      </div>
    `;
  } else {
    const table = document.createElement("table");
    table.className = "w-full text-sm";
    table.innerHTML = `
      <thead>
        <tr class="border-b border-slate-200 dark:border-neutral-600">
          <th class="text-left px-2 py-2 font-semibold text-slate-900 dark:text-slate-200">Name</th>
          <th class="text-left px-2 py-2 font-semibold text-slate-900 dark:text-slate-200">Type</th>
          <th class="text-left px-2 py-2 font-semibold text-slate-900 dark:text-slate-200">Due Date</th>
          <th class="text-left px-2 py-2 font-semibold text-slate-900 dark:text-slate-200">Grade</th>
          <th class="text-left px-2 py-2 font-semibold text-slate-900 dark:text-slate-200">Status</th>
        </tr>
      </thead>
      <tbody>
        ${allWork.map(w => {
          const dueDate = w.dueAt ? new Date(w.dueAt * 1000) : null;
          const now = new Date();

          // Use backend-calculated status field for accurate assignment status
          // Backend logic (aggregator.js) correctly handles graded vs overdue assignments
          const statusText = w.status === "graded" ? "Graded"
            : w.status === "overdue" ? "Overdue"
            : w.status === "pending" && dueDate && dueDate >= now ? "Upcoming"
            : "Not Submitted";

          const statusColor = w.status === "graded" ? "text-green-600 dark:text-green-400"
            : w.status === "overdue" ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400";

          return `
            <tr class="border-b border-slate-200 dark:border-neutral-600 hover:bg-slate-50 dark:hover:bg-neutral-700 transition">
              <td class="px-2 py-2 text-slate-900 dark:text-slate-200">${stripHTML(w.name)}</td>
              <td class="px-2 py-2 text-slate-600 dark:text-slate-400">
                <span class="inline-block px-2 py-1 rounded-md text-xs font-medium ${w.type === "assign" ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200" : "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200"}">
                  ${w.type === "assign" ? "Assignment" : "Quiz"}
                </span>
              </td>
              <td class="px-2 py-2 text-slate-600 dark:text-slate-400">${dueDate ? dueDate.toLocaleDateString() : "—"}</td>
              <td class="px-2 py-2 text-slate-900 dark:text-slate-200 font-medium">${w.gradeFormatted || (w.gradePercent ? w.gradePercent + "%" : "—")}</td>
              <td class="px-2 py-2"><span class="${statusColor} text-xs font-medium">${statusText}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    `;
    assignmentsTable.appendChild(table);
  }

  assignmentsSection.appendChild(assignmentsTitle);
  assignmentsSection.appendChild(assignmentsTable);

  container.appendChild(header);
  container.appendChild(infoGrid);
  container.appendChild(graphsSection);
  container.appendChild(assignmentsSection);

  return { container, studyTimeChartId: `studyTimeChart-${course.id}`, gradeChartId: `gradeChart-${course.id}` };
}

// Main Page Logic
document.addEventListener("DOMContentLoaded", async function () {
  // Auth check
  const userName = sessionStorage.getItem("mc_userName");
  if (!userName) {
    window.location.href = "../pages/login.html";
    return;
  }
  $("userChip").textContent = userName;

  const classesContainer = $("classesContainer");
  const sortSelect = $("sortSelect");
  const gradeFilter = $("gradeFilter");
  const refreshBtn = $("refreshBtn");

  let courseList = [];
  let workMap = {};
  let nextMap = {};
  let gradeMap = {};
  let courseColors = {};
  let courseMetadata = {};
  let progressMap = {};
  let expandedCourseId = null;
  let currentExpandedDetails = null;

  // Sort and filter
  function sortCourses(courses, sortBy) {
    const sorted = [...courses];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "grade":
        sorted.sort((a, b) => {
          const aGrade = gradeMap[a.id]?.percentNum || 0;
          const bGrade = gradeMap[b.id]?.percentNum || 0;
          return bGrade - aGrade;
        });
        break;
      case "dueDate":
        sorted.sort((a, b) => {
          const aDue = nextMap[a.id]?.next?.dueAt || Infinity;
          const bDue = nextMap[b.id]?.next?.dueAt || Infinity;
          return aDue - bDue;
        });
        break;
      case "progress":
        sorted.sort((a, b) => {
          const aProg = progressMap[a.id] || 0;
          const bProg = progressMap[b.id] || 0;
          return bProg - aProg;
        });
        break;
    }
    return sorted;
  }

  function filterCourses(courses) {
    const minGrade = parseFloat(gradeFilter.value) || 0;
    return courses.filter(c => {
      const grade = gradeMap[c.id]?.percentNum || 0;
      return grade >= minGrade;
    });
  }

  function render() {
    classesContainer.innerHTML = "";

    let filtered = filterCourses(courseList);
    let sorted = sortCourses(filtered, sortSelect.value);

    if (sorted.length === 0) {
      classesContainer.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-8 text-center text-slate-500 dark:text-slate-400">
          <p class="text-lg font-medium">No classes found</p>
          <p class="text-sm mt-1">Adjust your filters and try again.</p>
        </div>
      `;
      return;
    }

    sorted.forEach(course => {
      const wrapper = document.createElement("div");
      wrapper.className = "mb-3 last:mb-0";
      wrapper.id = `class-wrapper-${course.id}`;

      // Card
      const { card, chevron } = createClassCard(course, nextMap, gradeMap, courseColors, courseMetadata, (selectedCourse) => {
        // Toggle expand/collapse
        if (expandedCourseId === selectedCourse.id) {
          // Collapse
          expandedCourseId = null;
          if (currentExpandedDetails) {
            currentExpandedDetails.style.maxHeight = "0px";
            currentExpandedDetails.style.opacity = "0";
            setTimeout(() => {
              if (currentExpandedDetails && currentExpandedDetails.parentElement) {
                currentExpandedDetails.remove();
              }
              currentExpandedDetails = null;
            }, 300);
          }
          chevron.classList.remove("rotate-180");
        } else {
          // Collapse previous if exists
          if (currentExpandedDetails) {
            currentExpandedDetails.style.maxHeight = "0px";
            currentExpandedDetails.style.opacity = "0";
            setTimeout(() => {
              if (currentExpandedDetails && currentExpandedDetails.parentElement) {
                currentExpandedDetails.remove();
              }
            }, 300);
          }
          // Expand new
          expandedCourseId = selectedCourse.id;
          const { container, studyTimeChartId, gradeChartId } = createClassDetails(selectedCourse, workMap, gradeMap, courseMetadata, courseColors);
          container.style.maxHeight = "0px";
          container.style.opacity = "0";
          container.style.overflow = "hidden";
          container.style.transition = "max-height 300ms ease, opacity 300ms ease";

          wrapper.appendChild(container);
          currentExpandedDetails = container;

          // Trigger animation
          setTimeout(() => {
            container.style.maxHeight = container.scrollHeight + "px";
            container.style.opacity = "1";
          }, 10);

          // Render charts after animation completes
          setTimeout(() => {
            renderStudyTimeChart(selectedCourse.id, studyTimeChartId);
            renderGradeChart(gradeChartId, workMap[selectedCourse.id] || []);
          }, 320);

          chevron.classList.add("rotate-180");
        }
      });

      wrapper.appendChild(card);
      classesContainer.appendChild(wrapper);
    });
  }

  // Chart rendering
  async function renderStudyTimeChart(courseId, canvasId) {
    const canvas = $(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const colors = getChartColors();

    try {
      // Fetch real study time trends from backend (last 30 days)
      const timeTrendsRes = await api.analytics.getTimeTrends();

      // Filter to only this course's data
      const courseStudyData = {};

      // Also fetch study time by course to get total for this course
      const studyTimeRes = await api.analytics.getStudyTime();
      const courseTotal = studyTimeRes[courseId] || { hours: 0, sessions: 0 };

      // If we have time trends data, use it; otherwise show aggregate
      if (timeTrendsRes && Array.isArray(timeTrendsRes) && timeTrendsRes.length > 0) {
        // Sort by date
        const sortedTrends = [...timeTrendsRes].sort((a, b) =>
          new Date(a.date) - new Date(b.date)
        );

        const labels = sortedTrends.map(d => {
          const date = new Date(d.date);
          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        });

        const dataPoints = sortedTrends.map(d => d.hours || 0);

        new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [{
              label: "Study Hours",
              data: dataPoints,
              backgroundColor: colors.blue,
              borderColor: colors.blue,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  color: colors.text
                },
                grid: {
                  color: colors.gridLine
                }
              },
              x: {
                ticks: {
                  color: colors.text
                },
                grid: {
                  display: false
                }
              }
            }
          }
        });
      } else {
        // Show aggregate study time for this course
        const labels = ["Total Study Time"];
        const data = [courseTotal.hours];

        new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [{
              label: "Study Hours",
              data,
              backgroundColor: colors.blue,
              borderColor: colors.blue,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  color: colors.text
                },
                grid: {
                  color: colors.gridLine
                }
              },
              x: {
                ticks: {
                  color: colors.text
                },
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }
    } catch (err) {
      console.warn("Could not load study time data:", err);
      // Show empty state
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "text-center text-slate-500 dark:text-slate-400 py-8";
      emptyMsg.textContent = "No study time data yet. Start a session to see trends!";
      canvas.parentElement.replaceChild(emptyMsg, canvas);
    }
  }

  function renderGradeChart(canvasId, allWork) {
    const canvas = $(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const colors = getChartColors();

    // Filter to only GRADED items (verified submitted assignments with grades)
    // Key check: gradeRaw must NOT be null (this is the definitive indicator that Moodle has graded it)
    // gradePercent/gradeFormatted may contain "-" or be null if not graded yet
    const gradedAssigns = allWork
      .filter(w => w.type === "assign" && w.gradeRaw !== null && w.gradeRaw !== undefined)
      .map(a => {
        // Parse numeric grade value from gradePercent (e.g., "95.00 %" -> 95) or gradeFormatted
        let gradeNum = 0;

        // Prefer gradePercent since it's a percentage string like "95.00 %"
        if (a.gradePercent && a.gradePercent !== "-") {
          gradeNum = parseFloat(a.gradePercent);
        } else if (a.gradeFormatted && a.gradeFormatted !== "-") {
          // Try to extract number from formats like "85/100" or "85.5" or HTML with number
          const match = a.gradeFormatted.match(/[\d.]+/);
          gradeNum = match ? parseFloat(match[0]) : 0;
        } else {
          // Fallback to gradeRaw if percentages aren't available
          gradeNum = a.gradeRaw || 0;
        }
        return { ...a, gradeNum: isNaN(gradeNum) ? 0 : gradeNum };
      });

    const gradedQuizzes = allWork
      .filter(w => w.type === "quiz" && w.gradeRaw !== null && w.gradeRaw !== undefined)
      .map(q => {
        let gradeNum = 0;

        // Prefer gradePercent since it's a percentage string
        if (q.gradePercent && q.gradePercent !== "-") {
          gradeNum = parseFloat(q.gradePercent);
        } else if (q.gradeFormatted && q.gradeFormatted !== "-") {
          const match = q.gradeFormatted.match(/[\d.]+/);
          gradeNum = match ? parseFloat(match[0]) : 0;
        } else {
          // Fallback to gradeRaw if percentages aren't available
          gradeNum = q.gradeRaw || 0;
        }
        return { ...q, gradeNum: isNaN(gradeNum) ? 0 : gradeNum };
      });

    // Calculate average grades only from graded items
    const avgAssignGrade = gradedAssigns.length > 0
      ? (gradedAssigns.reduce((sum, a) => sum + a.gradeNum, 0) / gradedAssigns.length).toFixed(1)
      : 0;

    const avgQuizGrade = gradedQuizzes.length > 0
      ? (gradedQuizzes.reduce((sum, q) => sum + q.gradeNum, 0) / gradedQuizzes.length).toFixed(1)
      : 0;

    // Only show data for types that have graded items
    const labels = [];
    const data = [];
    const bgColors = [];
    const borderColors = [];

    if (gradedAssigns.length > 0) {
      labels.push(`Assignments (${gradedAssigns.length})`);
      data.push(parseFloat(avgAssignGrade));
      bgColors.push(colors.primary);
      borderColors.push(colors.primary);
    }

    if (gradedQuizzes.length > 0) {
      labels.push(`Quizzes (${gradedQuizzes.length})`);
      data.push(parseFloat(avgQuizGrade));
      bgColors.push(colors.purple);
      borderColors.push(colors.purple);
    }

    if (labels.length === 0) {
      // No graded items - show empty state
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "text-center text-slate-500 dark:text-slate-400 py-8";
      emptyMsg.textContent = "No graded assignments yet. Grades will appear here once submitted.";
      canvas.parentElement.replaceChild(emptyMsg, canvas);
      return;
    }

    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Average Grade (%)",
          data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: colors.text,
              callback: function(value) {
                return value + "%";
              }
            },
            grid: {
              color: colors.gridLine
            }
          },
          x: {
            ticks: {
              color: colors.text
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Load data
  async function load() {
    try {
      classesContainer.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-8 text-center text-slate-500 dark:text-slate-400">
          <p class="text-lg font-medium">Loading classes...</p>
        </div>
      `;

      const [coursesRes, workRes, prefsRes, metadataRes] = await Promise.allSettled([
        api.courses(),
        api.work(),
        api.prefs.get(),
        api.courseMetadata.getAll()
      ]);

      if (coursesRes.status === "fulfilled" && coursesRes.value?.courses) {
        courseList = coursesRes.value.courses;
        courseList.forEach(course => {
          const g = extractCourseGrade(course);
          if (g) gradeMap[course.id] = g;
        });
      }

      if (workRes.status === "fulfilled" && workRes.value) {
        workMap = buildWorkMap(workRes.value);
        nextMap = buildNextMap(workRes.value);
        progressMap = calculateProgressFromWork(workRes.value);
      }

      if (prefsRes.status === "fulfilled" && prefsRes.value?.prefs?.calendar?.courseColors) {
        courseColors = prefsRes.value.prefs.calendar.courseColors;
      }

      if (metadataRes.status === "fulfilled" && metadataRes.value?.metadata) {
        courseMetadata = {};
        metadataRes.value.metadata.forEach(m => {
          courseMetadata[String(m.course_id)] = m;
        });
      }

      render();
    } catch (err) {
      console.error("Error loading classes:", err);
      classesContainer.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-red-50 dark:bg-red-900/20 p-8 text-center text-red-600 dark:text-red-400">
          <p class="text-lg font-medium">Error loading classes</p>
          <p class="text-sm mt-1">${err.message || "Please try again later."}</p>
        </div>
      `;
    }
  }

  // Event listeners
  sortSelect.addEventListener("change", render);
  gradeFilter.addEventListener("change", render);
  refreshBtn.addEventListener("click", load);

  // Initial load
  load();
});

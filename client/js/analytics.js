import { api } from "./apiClient.js";

// Chart instances
const charts = {};

// Current state
let currentState = {
  summary: null,
  studyTime: null,
  timeTrends: null,
  assignmentAnalytics: null,
  selectedCourse: null,
  isDarkMode: false
};

/**
 * Initialize the page
 */
async function init() {
  // Check if user is logged in
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");

  if (!userName) {
    window.location.href = "./login.html";
    return;
  }

  if (userChip) {
    userChip.textContent = "Hi, " + userName;
  }

  // Check dark mode
  currentState.isDarkMode = document.documentElement.classList.contains("dark");

  // Setup tab navigation
  setupTabs();

  // Setup course selector
  setupCourseSelector();

  // Load initial data
  await loadAllAnalytics();

  // Listen for theme changes
  listenToThemeChanges();
}

/**
 * Setup tab navigation
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      // Update active button
      tabButtons.forEach(btn => {
        btn.classList.remove("border-indigo-600", "text-indigo-700");
        btn.classList.add("border-transparent", "text-slate-600", "dark:text-slate-400");
      });
      button.classList.add("border-indigo-600", "text-indigo-700");
      button.classList.remove("border-transparent", "text-slate-600", "dark:text-slate-400");

      // Update active content
      tabContents.forEach(content => {
        content.classList.add("hidden");
      });
      document.getElementById(`${tabName}-tab`)?.classList.remove("hidden");

      // Trigger chart updates
      setTimeout(() => {
        Object.values(charts).forEach(chart => {
          chart?.resize?.();
        });
      }, 100);
    });
  });
}

/**
 * Setup course selector
 */
async function setupCourseSelector() {
  const courseSelect = document.getElementById("courseSelect");

  try {
    const coursesResponse = await api.courses();

    // Handle different response formats
    const courses = Array.isArray(coursesResponse) ? coursesResponse : (coursesResponse?.courses || []);

    courseSelect.innerHTML = '<option value="">-- Select a course --</option>';

    if (courses && courses.length > 0) {
      courses.forEach(course => {
        const option = document.createElement("option");
        option.value = course.id;
        // Handle different course name fields
        const courseName = course.fullname || course.name || course.fullnamedisplay || `Course ${course.id}`;
        option.textContent = courseName;
        courseSelect.appendChild(option);
      });
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No courses available";
      option.disabled = true;
      courseSelect.appendChild(option);
    }

    courseSelect.addEventListener("change", async (e) => {
      if (e.target.value) {
        await loadCourseAnalytics(e.target.value);
      } else {
        document.getElementById("courseAnalyticsContainer").innerHTML = "";
      }
    });
  } catch (error) {
    console.error("Error loading courses:", error);
    courseSelect.innerHTML = '<option value="">Error loading courses</option>';
  }
}

/**
 * Load all analytics data
 */
async function loadAllAnalytics() {
  try {
    // Load summary with background revalidation
    currentState.summary = await api.analytics.getSummary(async (fresh) => {
      currentState.summary = fresh;
      renderSummaryCards();
    });
    renderSummaryCards();

    // Load study time data
    currentState.studyTime = await api.analytics.getStudyTime(async (fresh) => {
      currentState.studyTime = fresh;
      renderTimeByCoursChart();
    });
    renderTimeByCoursChart();

    // Load time trends
    currentState.timeTrends = await api.analytics.getTimeTrends(async (fresh) => {
      currentState.timeTrends = fresh;
      renderStudyTimeTrendChart();
      renderDailyStudyChart();
    });
    renderStudyTimeTrendChart();
    renderDailyStudyChart();

    // Load assignment analytics
    currentState.assignmentAnalytics = await api.analytics.getAssignmentAnalytics(async (fresh) => {
      currentState.assignmentAnalytics = fresh;
      renderAssignmentCharts();
    });
    renderAssignmentCharts();

    // Render other charts
    renderCompletionRateChart();
    renderWeeklyDistributionChart();
  } catch (error) {
    console.error("Error loading analytics:", error);
    // Show error message
    const summarySection = document.getElementById("summarySection");
    if (summarySection) {
      summarySection.innerHTML = `
        <div class="col-span-full rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 shadow-sm p-5">
          <p class="text-red-800 dark:text-red-200">Error loading analytics: ${error.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Render summary cards
 */
function renderSummaryCards() {
  if (!currentState.summary) return;

  const { summary } = currentState;
  const summarySection = document.getElementById("summarySection");

  const cards = [
    {
      label: "📚 Total Study Hours",
      value: `${summary.totalStudyHours ?? 0}h`,
      subtext: `${summary.sessionCount ?? 0} sessions`
    },
    {
      label: "📈 Current GPA",
      value: summary.gpa ? `${summary.gpa}` : "N/A",
      subtext: summary.courseCount ? `${summary.courseCount} courses` : "No grades"
    },
    {
      label: "✅ Assignments",
      value: `${summary.assignmentsCompleted ?? 0}/${summary.assignmentsTotal ?? 0}`,
      subtext: summary.assignmentsTotal ? `${summary.completionRate ?? 0}% complete` : "No assignments"
    },
    {
      label: "⏱️ Avg Session",
      value: summary.avgSessionDuration || "N/A",
      subtext: summary.completedSessions ? `${summary.completedSessions} completed` : "No sessions"
    }
  ];

  summarySection.innerHTML = cards.map(card => `
    <div class="rounded-2xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm p-5">
      <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">${card.label}</div>
      <div class="text-3xl font-bold text-slate-900 dark:text-slate-200 mb-1">${card.value}</div>
      <div class="text-xs text-slate-500 dark:text-slate-400">${card.subtext}</div>
    </div>
  `).join("");
}

/**
 * Get chart colors based on dark mode
 */
function getChartColors(isDarkMode = false) {
  return {
    primary: isDarkMode ? "#4f46e5" : "#4f46e5",
    primaryLight: isDarkMode ? "#818cf8" : "#6366f1",
    secondary: isDarkMode ? "#10b981" : "#10b981",
    tertiary: isDarkMode ? "#f59e0b" : "#f59e0b",
    danger: isDarkMode ? "#ef4444" : "#ef4444",
    gridLine: isDarkMode ? "#404040" : "#e2e8f0",
    textColor: isDarkMode ? "#e2e8f0" : "#1e293b",
    backgroundColor: isDarkMode ? "rgba(23, 23, 23, 0.8)" : "rgba(255, 255, 255, 0.8)"
  };
}

/**
 * Chart configuration defaults
 */
function getChartDefaults(isDarkMode = false) {
  const colors = getChartColors(isDarkMode);
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: colors.textColor,
          font: { size: 12 },
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: colors.backgroundColor,
        titleColor: colors.textColor,
        bodyColor: colors.textColor,
        borderColor: colors.gridLine,
        borderWidth: 1,
        padding: 12,
        titleFont: { weight: "bold", size: 13 },
        bodyFont: { size: 12 },
        displayColors: true,
        callbacks: {
          labelColor: (context) => ({
            borderColor: context.borderColor || colors.primary,
            backgroundColor: context.borderColor || colors.primary,
            borderRadius: 4
          })
        }
      }
    },
    scales: {
      x: {
        grid: { color: colors.gridLine, drawBorder: false },
        ticks: { color: colors.textColor, font: { size: 11 } }
      },
      y: {
        grid: { color: colors.gridLine, drawBorder: false },
        ticks: { color: colors.textColor, font: { size: 11 } }
      }
    }
  };
}

/**
 * Show empty state message for a chart
 */
function showEmptyChartState(chartId, message = "No data available yet") {
  const ctx = document.getElementById(chartId);
  if (!ctx) return;

  const parent = ctx.parentElement;
  parent.innerHTML = `
    <div class="flex items-center justify-center h-64 bg-slate-50 dark:bg-neutral-800 rounded-lg">
      <p class="text-slate-500 dark:text-slate-400 text-center">${message}</p>
    </div>
  `;
}

/**
 * Render Study Time Trend Chart
 */
function renderStudyTimeTrendChart() {
  if (!currentState.timeTrends || currentState.timeTrends.length === 0) {
    showEmptyChartState("studyTimeTrendChart", "No study data yet. Start a timer in Focus Mode to see trends!");
    return;
  }

  const ctx = document.getElementById("studyTimeTrendChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  // Sort by date (ascending)
  const sortedData = [...currentState.timeTrends].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const labels = sortedData.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const dataPoints = sortedData.map(d => d.hours);

  // Destroy existing chart if it exists
  if (charts.studyTimeTrend) {
    charts.studyTimeTrend.destroy();
  }

  charts.studyTimeTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Study Hours",
          data: dataPoints,
          borderColor: colors.primary,
          backgroundColor: `${colors.primary}15`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: colors.primary,
          pointBorderColor: colors.backgroundColor,
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      ...defaults,
      plugins: {
        ...defaults.plugins,
        filler: { propagate: true }
      }
    }
  });
}

/**
 * Render Time by Course Chart
 */
function renderTimeByCoursChart() {
  if (!currentState.studyTime || Object.keys(currentState.studyTime).length === 0) {
    showEmptyChartState("timeByCoursChart", "Study time by course will appear here once you use Focus Mode");
    return;
  }

  const ctx = document.getElementById("timeByCoursChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  const courseIds = Object.keys(currentState.studyTime);
  const hours = courseIds.map(id => currentState.studyTime[id].hours || 0);

  // Color palette
  const palette = [colors.primary, colors.secondary, colors.tertiary, colors.danger, "#8b5cf6", "#ec4899"];

  // Destroy existing chart
  if (charts.timeByCourse) {
    charts.timeByCourse.destroy();
  }

  charts.timeByCourse = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: courseIds.map((id, idx) => `Course ${id || "Uncategorized"}`.substring(0, 20)),
      datasets: [
        {
          data: hours,
          backgroundColor: palette.slice(0, courseIds.length),
          borderColor: colors.backgroundColor,
          borderWidth: 2
        }
      ]
    },
    options: {
      ...defaults,
      plugins: {
        ...defaults.plugins,
        legend: {
          ...defaults.plugins.legend,
          position: "bottom"
        }
      }
    }
  });
}

/**
 * Render Completion Rate Chart
 */
function renderCompletionRateChart() {
  if (!currentState.summary) return;

  const ctx = document.getElementById("completionRateChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  const rate = currentState.summary.completionRate || 0;
  const remaining = 100 - rate;

  // Destroy existing chart
  if (charts.completionRate) {
    charts.completionRate.destroy();
  }

  charts.completionRate = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending"],
      datasets: [
        {
          data: [rate, remaining],
          backgroundColor: [colors.secondary, colors.gridLine],
          borderColor: colors.backgroundColor,
          borderWidth: 2
        }
      ]
    },
    options: {
      ...defaults,
      plugins: {
        ...defaults.plugins,
        tooltip: {
          ...defaults.plugins.tooltip,
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed}%`
          }
        }
      }
    }
  });
}

/**
 * Render Weekly Distribution Chart
 */
function renderWeeklyDistributionChart() {
  if (!currentState.timeTrends || currentState.timeTrends.length === 0) return;

  const ctx = document.getElementById("weeklyDistributionChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  // Group by day of week
  const dayMap = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
  const weeklyData = {};

  currentState.timeTrends.forEach(d => {
    const date = new Date(d.date);
    const dayName = dayMap[date.getDay()];
    weeklyData[dayName] = (weeklyData[dayName] || 0) + d.hours;
  });

  const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const labels = dayOrder.filter(day => weeklyData[day]);
  const data = labels.map(day => weeklyData[day]);

  // Destroy existing chart
  if (charts.weeklyDistribution) {
    charts.weeklyDistribution.destroy();
  }

  charts.weeklyDistribution = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Hours Studied",
          data,
          backgroundColor: colors.primary,
          borderColor: colors.primaryLight,
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      ...defaults,
      indexAxis: undefined
    }
  });
}

/**
 * Render Daily Study Chart
 */
function renderDailyStudyChart() {
  if (!currentState.timeTrends || currentState.timeTrends.length === 0) return;

  const ctx = document.getElementById("dailyStudyChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  // Last 14 days
  const recentTrends = currentState.timeTrends.slice(0, 14).reverse();

  const labels = recentTrends.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const data = recentTrends.map(d => d.hours);

  // Destroy existing chart
  if (charts.dailyStudy) {
    charts.dailyStudy.destroy();
  }

  charts.dailyStudy = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Hours",
          data,
          backgroundColor: colors.secondary,
          borderRadius: 4
        }
      ]
    },
    options: {
      ...defaults
    }
  });
}

/**
 * Render Assignment Charts
 */
function renderAssignmentCharts() {
  if (!currentState.assignmentAnalytics) return;

  renderDifficultyVsTimeChart();
  renderAssignmentStatusChart();
}

/**
 * Render Difficulty vs Time Scatter Plot
 */
function renderDifficultyVsTimeChart() {
  const ctx = document.getElementById("difficultyVsTimeChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  const { sessionsByAssignment } = currentState.assignmentAnalytics;
  if (!sessionsByAssignment || sessionsByAssignment.length === 0) return;

  const data = sessionsByAssignment
    .filter(s => s.difficulty && s.hours)
    .map(s => ({
      x: s.difficulty,
      y: s.hours
    }));

  // Destroy existing chart
  if (charts.difficultyVsTime) {
    charts.difficultyVsTime.destroy();
  }

  charts.difficultyVsTime = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Assignments",
          data,
          backgroundColor: `${colors.primary}60`,
          borderColor: colors.primary,
          borderWidth: 1,
          pointRadius: 5
        }
      ]
    },
    options: {
      ...defaults,
      scales: {
        x: {
          ...defaults.scales.x,
          title: {
            display: true,
            text: "Difficulty Rating (1-5)",
            color: colors.textColor
          },
          min: 0,
          max: 5
        },
        y: {
          ...defaults.scales.y,
          title: {
            display: true,
            text: "Hours Spent",
            color: colors.textColor
          }
        }
      }
    }
  });
}

/**
 * Render Assignment Status Chart
 */
function renderAssignmentStatusChart() {
  const ctx = document.getElementById("assignmentStatusChart");
  if (!ctx) return;

  const colors = getChartColors(currentState.isDarkMode);
  const defaults = getChartDefaults(currentState.isDarkMode);

  const { assignments } = currentState.assignmentAnalytics;
  if (!assignments || assignments.length === 0) return;

  // Count by status
  const statusCount = {};
  assignments.forEach(a => {
    statusCount[a.status] = (statusCount[a.status] || 0) + a.count;
  });

  const labels = Object.keys(statusCount);
  const data = Object.values(statusCount);

  // Destroy existing chart
  if (charts.assignmentStatus) {
    charts.assignmentStatus.destroy();
  }

  charts.assignmentStatus = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      datasets: [
        {
          data,
          backgroundColor: [colors.secondary, colors.tertiary, colors.danger],
          borderColor: colors.backgroundColor,
          borderWidth: 2
        }
      ]
    },
    options: {
      ...defaults,
      plugins: {
        ...defaults.plugins,
        legend: {
          ...defaults.plugins.legend,
          position: "bottom"
        }
      }
    }
  });
}

/**
 * Load course-specific analytics
 */
async function loadCourseAnalytics(courseId) {
  try {
    const courseData = await api.analytics.getCourseAnalytics(courseId);
    renderCourseAnalyticsUI(courseData);
  } catch (error) {
    console.error("Error loading course analytics:", error);
    const container = document.getElementById("courseAnalyticsContainer");
    if (container) {
      container.innerHTML = `
        <div class="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 shadow-sm p-5">
          <p class="text-red-800 dark:text-red-200">Error loading course data: ${error.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Render course analytics UI
 */
function renderCourseAnalyticsUI(courseData) {
  const container = document.getElementById("courseAnalyticsContainer");
  if (!container) return;

  const { courseName, grade, assignments, studyTime } = courseData;

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-2xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Course Grade</div>
        <div class="text-3xl font-bold text-slate-900 dark:text-slate-200">${grade ? `${grade}%` : "N/A"}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Study Time</div>
        <div class="text-3xl font-bold text-slate-900 dark:text-slate-200">${studyTime.totalHours}h</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${studyTime.sessionCount} sessions</div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <div class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Assignments</div>
        <div class="text-3xl font-bold text-slate-900 dark:text-slate-200">${assignments.length}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="rounded-2xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-200">Assignments List</h4>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${assignments.map(a => `
            <div class="p-3 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
              <div class="font-medium text-slate-900 dark:text-slate-200 text-sm">${a.title}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Status: <span class="font-semibold">${a.status}</span> |
                Due: ${a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "N/A"}
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 shadow-sm p-5">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-200">Course Summary</h4>
        <div class="space-y-3 text-sm">
          <div>
            <span class="text-slate-600 dark:text-slate-400">Course:</span>
            <span class="ml-2 font-medium text-slate-900 dark:text-slate-200">${courseName}</span>
          </div>
          <div>
            <span class="text-slate-600 dark:text-slate-400">Avg Session:</span>
            <span class="ml-2 font-medium text-slate-900 dark:text-slate-200">${studyTime.avgSessionDuration || "N/A"}</span>
          </div>
          <div>
            <span class="text-slate-600 dark:text-slate-400">Total Time:</span>
            <span class="ml-2 font-medium text-slate-900 dark:text-slate-200">${studyTime.totalHours} hours</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Listen to theme changes
 */
function listenToThemeChanges() {
  window.addEventListener("storage", (e) => {
    if (e.key === "theme") {
      currentState.isDarkMode = e.newValue === "dark";
      // Re-render all charts with new colors
      redrawAllCharts();
    }
  });

  // Also watch for class changes on html element
  const observer = new MutationObserver(() => {
    const newIsDarkMode = document.documentElement.classList.contains("dark");
    if (newIsDarkMode !== currentState.isDarkMode) {
      currentState.isDarkMode = newIsDarkMode;
      redrawAllCharts();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
}

/**
 * Redraw all charts with new theme colors
 */
function redrawAllCharts() {
  renderStudyTimeTrendChart();
  renderTimeByCoursChart();
  renderCompletionRateChart();
  renderWeeklyDistributionChart();
  renderDailyStudyChart();
  renderAssignmentCharts();
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);

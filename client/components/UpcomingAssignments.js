import { api } from "../js/apiClient.js";
import { openAssignmentDetailsModal } from "./AssignmentDetailsModal.js";

function $(id) {
  return document.getElementById(id);
}

// Format date to readable string
function formatDueDate(date) {
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Due Today';
  } else if (diffDays === 1) {
    return 'Due Tomorrow';
  } else if (diffDays > 1 && diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

// Get urgency indicator class based on days remaining
function getUrgencyClass(date) {
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
  } else if (diffDays <= 3) {
    return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
  } else {
    return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  }
}

// Extract course code and number from course name
function extractCourseInfo(courseName) {
  if (!courseName) return { code: 'UNKN', number: '' };
  
  const parts = courseName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      code: parts[0],      // e.g., "CSCI"
      number: parts[1]     // e.g., "490"
    };
  }
  return { code: parts[0] || 'UNKN', number: '' };
}

export function mountUpcomingAssignments({ containerId = "upcomingAssignmentsContainer" } = {}) {
  const container = $(containerId);
  if (!container) return { reload: () => {} };

  let allAssignments = [];
  let courseColors = {};

  function renderAssignmentBox(assignment) {
    const urgencyClass = getUrgencyClass(assignment.dueDate);
    const formattedDate = formatDueDate(assignment.dueDate);
    const courseColor = courseColors[String(assignment.courseId)] || '#4F46E5';
    const gradeDisplay = assignment.gradeFormatted && assignment.gradeMax
      ? `${assignment.gradeFormatted} / ${assignment.gradeMax}${assignment.gradePercent ? ` (${assignment.gradePercent})` : ''}`
      : '—';

    const box = document.createElement('div');
    box.className = 'flex items-center gap-4 rounded-xl border-2 p-4 transition-all hover:shadow-md cursor-pointer';
    box.style.borderColor = courseColor;
    box.style.background = `${courseColor}15`;

    box.innerHTML = `
      <!-- Color indicator -->
      <div class="flex-shrink-0">
        <div class="w-3 h-16 rounded-full" style="background-color: ${courseColor};"></div>
      </div>

      <!-- Assignment content -->
      <div class="flex-1 min-w-0">
        <!-- Course code and number -->
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                style="background-color: ${courseColor}; color: white;">
            ${assignment.courseCode} ${assignment.courseNumber}
          </span>
        </div>

        <!-- Assignment title -->
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 truncate mb-2">
          ${assignment.title}
        </h3>

        <!-- Due date and Grade badges on same line -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${urgencyClass}">
            📅 ${formattedDate}
          </span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-neutral-700 border border-slate-300 dark:border-neutral-600">
            📊 ${gradeDisplay}
          </span>
        </div>
      </div>

      <!-- Arrow icon -->
      <div class="flex-shrink-0">
        <svg class="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    `;
    
    // Add click handler to open assignment details modal
    box.addEventListener('click', () => {
      // Prepare data for modal
      const modalData = {
        id: assignment.id,  // Pass full ID (e.g., "assign:123") for proper star status check
        type: assignment.type,
        title: assignment.title,
        courseName: assignment.courseName,
        dueAt: Math.floor(assignment.dueDate.getTime() / 1000), // Convert to Unix timestamp
        gradeFormatted: assignment.gradeFormatted ?? null,
        gradeMax: assignment.gradeMax ?? null,
        gradePercent: assignment.gradePercent ?? null,
        instructorComments: assignment.instructorComments ?? null
      };

      // Open modal with callback to reload on changes
      openAssignmentDetailsModal(modalData, () => {
        reload(); // Reload upcoming assignments after modal closes
      });
    });
    
    return box;
  }

  function renderUpcomingAssignments() {
    // Filter and sort assignments
    const now = new Date();
    const upcomingAssignments = allAssignments
      .filter(a => !a.isCompleted && a.dueDate >= now)
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, 3); // Only take top 3

    container.innerHTML = '';

    if (upcomingAssignments.length === 0) {
      container.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-8 text-center">
          <div class="text-4xl mb-3">🎉</div>
          <h3 class="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">All Caught Up!</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">No upcoming assignments at the moment.</p>
        </div>
      `;
      return;
    }

    // Create a flex container for the boxes
    const boxContainer = document.createElement('div');
    boxContainer.className = 'flex flex-col gap-4';
    
    upcomingAssignments.forEach(assignment => {
      const box = renderAssignmentBox(assignment);
      boxContainer.appendChild(box);
    });
    
    container.appendChild(boxContainer);
  }

  async function reload() {
    try {
      // Fetch work data and preferences
      const [workRes, prefsRes, coursesRes] = await Promise.allSettled([
        api.work(),
        api.prefs.get(),
        api.courses()
      ]);

      const workData = workRes.status === "fulfilled" ? workRes.value : null;
      const prefsData = prefsRes.status === "fulfilled" ? prefsRes.value : null;
      const coursesData = coursesRes.status === "fulfilled" ? coursesRes.value : null;

      // Build course map for names
      const courseMap = {};
      if (coursesData && coursesData.courses) {
        coursesData.courses.forEach(course => {
          courseMap[course.id] = course.name || course.shortname || `Course ${course.id}`;
        });
      }

      // Get course colors
      courseColors = (prefsData && prefsData.prefs && prefsData.prefs.calendar && prefsData.prefs.calendar.courseColors) || {};

      // Process assignments from work data
      allAssignments = [];
      if (workData && workData.courses) {
        workData.courses.forEach(courseData => {
          const courseName = courseMap[courseData.courseId] || `Course ${courseData.courseId}`;
          const courseInfo = extractCourseInfo(courseName);

          // Process assignments
          (courseData.assignments || []).forEach(assignment => {
            if (assignment.dueAt) {
              allAssignments.push({
                id: `assign:${assignment.id}`,
                courseId: courseData.courseId,
                courseCode: courseInfo.code,
                courseNumber: courseInfo.number,
                courseName: courseName,
                title: assignment.name,
                dueDate: new Date(assignment.dueAt * 1000),
                isCompleted: false,
                type: 'assignment',
                gradeFormatted: assignment.gradeFormatted ?? null,
                gradeMax: assignment.gradeMax ?? null,
                gradePercent: assignment.gradePercent ?? null,
                instructorComments: assignment.instructorComments ?? null
              });
            }
          });

          // Process quizzes
          (courseData.quizzes || []).forEach(quiz => {
            if (quiz.dueAt) {
              allAssignments.push({
                id: `quiz:${quiz.id}`,
                courseId: courseData.courseId,
                courseCode: courseInfo.code,
                courseNumber: courseInfo.number,
                courseName: courseName,
                title: quiz.name,
                dueDate: new Date(quiz.dueAt * 1000),
                isCompleted: false,
                type: 'quiz',
                gradeFormatted: quiz.gradeFormatted ?? null,
                gradeMax: quiz.gradeMax ?? null,
                gradePercent: quiz.gradePercent ?? null,
                instructorComments: quiz.instructorComments ?? null
              });
            }
          });
        });
      }

      renderUpcomingAssignments();
    } catch (e) {
      console.error('Error loading upcoming assignments:', e);
      container.innerHTML = `
        <div class="rounded-xl border border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-600 dark:text-red-400">
          ${e.message}
        </div>
      `;
    }
  }

  reload();
  return { reload };
}

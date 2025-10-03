import { api } from "../js/apiClient.js";
import { openStudyBlockModal } from "./StudyBlockModal.js";

function $(id) { return document.getElementById(id); }

let currentAssignmentData = null;
let onCloseCallback = null;

/**
 * Ensure the assignment details modal exists in the DOM
 */
function ensureAssignmentDetailsModalDOM() {
  if ($("assignmentDetailsModal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="assignmentDetailsModal" class="fixed inset-0 z-50 hidden">
      <div id="adModalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">Assignment Details</h3>
            <button id="adClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <div class="px-6 py-6 space-y-6">
            <!-- Assignment Title -->
            <div>
              <div class="text-sm font-medium text-slate-500 mb-1">Assignment</div>
              <div id="adTitle" class="text-lg font-semibold text-slate-900"></div>
            </div>

            <!-- Assignment Stats Grid -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Type</div>
                <div id="adType" class="text-sm font-semibold text-slate-900">—</div>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Due Date</div>
                <div id="adDueDate" class="text-sm font-semibold text-slate-900">—</div>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Course</div>
                <div id="adCourse" class="text-sm font-semibold text-slate-900">—</div>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Study Blocks</div>
                <div id="adStudyBlockCount" class="text-sm font-semibold text-slate-900">—</div>
              </div>
            </div>

            <!-- Existing Study Blocks -->
            <div id="adExistingStudyBlocks" class="hidden">
              <div class="text-sm font-medium text-slate-900 mb-2">Scheduled Study Time</div>
              <div id="adStudyBlocksList" class="space-y-2 max-h-40 overflow-y-auto">
                <!-- Study blocks will be populated here -->
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                id="adCancel"
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                id="adScheduleStudyTime"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                📅 Schedule Study Time
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  // Attach event listeners
  const modal = $("assignmentDetailsModal");
  const backdrop = $("adModalBackdrop");
  const closeBtn = $("adClose");
  const cancelBtn = $("adCancel");
  const scheduleBtn = $("adScheduleStudyTime");

  backdrop?.addEventListener("click", closeAssignmentDetailsModal);
  closeBtn?.addEventListener("click", closeAssignmentDetailsModal);
  cancelBtn?.addEventListener("click", closeAssignmentDetailsModal);
  scheduleBtn?.addEventListener("click", handleScheduleStudyTime);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeAssignmentDetailsModal();
    }
  });
}

/**
 * Handle the "Schedule Study Time" button click
 */
function handleScheduleStudyTime() {
  console.log("[AssignmentDetailsModal] Schedule Study Time clicked", currentAssignmentData);

  if (!currentAssignmentData) {
    console.error("[AssignmentDetailsModal] No assignment data available");
    return;
  }

  // Save assignment data and callback before closing (closing sets them to null)
  const assignmentData = currentAssignmentData;
  const callback = onCloseCallback;

  // Close this modal
  closeAssignmentDetailsModal();

  // Small delay to ensure modal is closed before opening new one
  setTimeout(() => {
    console.log("[AssignmentDetailsModal] Opening StudyBlockModal with data:", assignmentData);
    // Open the study block modal
    openStudyBlockModal(assignmentData, () => {
      // After study block is created, call the callback if provided
      if (typeof callback === "function") {
        callback();
      }
    });
  }, 100);
}

/**
 * Open the assignment details modal for an assignment
 * @param {Object} assignmentData - Assignment data with id, title, type, etc.
 * @param {Function} callback - Called after modal is closed or study block is created
 */
export async function openAssignmentDetailsModal(assignmentData, callback) {
  ensureAssignmentDetailsModalDOM();

  currentAssignmentData = assignmentData;
  onCloseCallback = callback;

  const modal = $("assignmentDetailsModal");
  const titleEl = $("adTitle");
  const typeEl = $("adType");
  const dueDateEl = $("adDueDate");
  const courseEl = $("adCourse");
  const studyBlockCountEl = $("adStudyBlockCount");
  const existingStudyBlocksSection = $("adExistingStudyBlocks");
  const studyBlocksList = $("adStudyBlocksList");

  if (!modal) return;

  // Set assignment title
  if (titleEl) {
    titleEl.textContent = assignmentData.title || "Unknown Assignment";
  }

  // Set assignment type
  if (typeEl) {
    const typeMap = {
      'assign': 'Assignment',
      'quiz': 'Quiz',
      'exam': 'Exam',
      'discussion': 'Discussion'
    };
    typeEl.textContent = typeMap[assignmentData.type] || assignmentData.type || "Assignment";
  }

  // Set due date and time
  if (dueDateEl && assignmentData.start) {
    const dueDate = new Date(assignmentData.start);
    const dateStr = dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = dueDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    dueDateEl.textContent = `${dateStr} • ${timeStr}`;
  }

  // Set course name
  if (courseEl) {
    courseEl.textContent = assignmentData.courseName || "—";
  }

  // Fetch existing study blocks for this assignment
  try {
    const { events: studyBlocks } = await api.studyBlocks.getForAssignment(assignmentData.id);

    if (studyBlockCountEl) {
      studyBlockCountEl.textContent = studyBlocks?.length || 0;
    }

    // Show existing study blocks if any
    if (studyBlocks && studyBlocks.length > 0) {
      existingStudyBlocksSection?.classList.remove("hidden");

      if (studyBlocksList) {
        studyBlocksList.innerHTML = studyBlocks.map(sb => {
          const startDate = new Date(sb.start_time);
          const endDate = sb.end_time ? new Date(sb.end_time) : null;

          return `
            <div class="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
              <div class="w-3 h-3 rounded-full" style="background-color: ${sb.color || '#4F46E5'}"></div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900">${sb.title || 'Study Session'}</div>
                <div class="text-xs text-slate-500">
                  ${startDate.toLocaleDateString()} • ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}${endDate ? ' - ' + endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    } else {
      existingStudyBlocksSection?.classList.add("hidden");
      if (studyBlockCountEl) {
        studyBlockCountEl.textContent = "None";
      }
    }
  } catch (error) {
    console.error('Error loading study blocks for assignment:', error);
    if (studyBlockCountEl) {
      studyBlockCountEl.textContent = "—";
    }
  }

  // Show modal
  modal.classList.remove("hidden");
}

/**
 * Close the assignment details modal
 */
export function closeAssignmentDetailsModal() {
  const modal = $("assignmentDetailsModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  currentAssignmentData = null;
  onCloseCallback = null;
}

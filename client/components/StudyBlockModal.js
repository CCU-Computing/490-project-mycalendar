import { api } from "../js/apiClient.js";

function $(id) { return document.getElementById(id); }

let currentAssignmentData = null;
let onSaveCallback = null;

/**
 * Ensure the study block modal exists in the DOM
 */
function ensureStudyBlockModalDOM() {
  if ($("studyBlockModal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="studyBlockModal" class="fixed inset-0 z-[60] hidden">
      <div id="sbModalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">Schedule Study Time</h3>
            <button id="sbClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <form id="studyBlockForm" class="px-6 py-6">
            <div class="mb-4">
              <div class="text-sm font-medium text-slate-900 mb-2">Assignment:</div>
              <div id="sbAssignmentTitle" class="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"></div>
            </div>

            <div class="mb-4">
              <label for="sbDate" class="block text-sm font-medium text-slate-900 mb-2">Date</label>
              <input
                type="date"
                id="sbDate"
                required
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label for="sbStartTime" class="block text-sm font-medium text-slate-900 mb-2">Start Time</label>
                <input
                  type="time"
                  id="sbStartTime"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label for="sbEndTime" class="block text-sm font-medium text-slate-900 mb-2">End Time</label>
                <input
                  type="time"
                  id="sbEndTime"
                  required
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div class="mb-6">
              <label for="sbColor" class="block text-sm font-medium text-slate-900 mb-2">Color</label>
              <div class="flex items-center gap-3">
                <input
                  type="color"
                  id="sbColor"
                  value="#4F46E5"
                  class="h-10 w-20 rounded-lg border border-slate-300 cursor-pointer"
                />
                <span class="text-sm text-slate-600">Choose a color for this study block</span>
              </div>
            </div>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                id="sbCancel"
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                Save Study Block
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  // Attach event listeners
  const modal = $("studyBlockModal");
  const backdrop = $("sbModalBackdrop");
  const closeBtn = $("sbClose");
  const cancelBtn = $("sbCancel");
  const form = $("studyBlockForm");

  backdrop?.addEventListener("click", closeStudyBlockModal);
  closeBtn?.addEventListener("click", closeStudyBlockModal);
  cancelBtn?.addEventListener("click", closeStudyBlockModal);
  form?.addEventListener("submit", handleFormSubmit);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeStudyBlockModal();
    }
  });
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!currentAssignmentData) return;

  const date = $("sbDate").value;
  const startTime = $("sbStartTime").value;
  const endTime = $("sbEndTime").value;
  const color = $("sbColor").value;

  // Validate end time is after start time
  if (startTime >= endTime) {
    alert("End time must be after start time");
    return;
  }

  // Combine date and time into ISO datetime strings
  const startDateTime = `${date}T${startTime}:00`;
  const endDateTime = `${date}T${endTime}:00`;

  const payload = {
    moodleAssignmentId: currentAssignmentData.id,
    title: `Study: ${currentAssignmentData.title}`,
    description: `Study session for ${currentAssignmentData.title}`,
    eventType: "study_block",
    startTime: startDateTime,
    endTime: endDateTime,
    color: color,
    allDay: false
  };

  try {
    const result = await api.studyBlocks.create(payload);

    if (result.ok) {
      closeStudyBlockModal();

      // Call the onSave callback if provided (for calendar refresh)
      if (typeof onSaveCallback === "function") {
        onSaveCallback(result.event);
      }

      // Show success notification
      showNotification("success", "Study block created successfully!");
    }
  } catch (error) {
    console.error("Error creating study block:", error);
    showNotification("error", "Failed to create study block. Please try again.");
  }
}

/**
 * Open the study block modal for an assignment
 * @param {Object} assignmentData - Assignment data with id and title
 * @param {Function} callback - Called after successful save
 */
export function openStudyBlockModal(assignmentData, callback) {
  console.log("[StudyBlockModal] Opening modal for assignment:", assignmentData);

  ensureStudyBlockModalDOM();

  currentAssignmentData = assignmentData;
  onSaveCallback = callback;

  const modal = $("studyBlockModal");
  const titleEl = $("sbAssignmentTitle");
  const dateInput = $("sbDate");
  const startTimeInput = $("sbStartTime");
  const endTimeInput = $("sbEndTime");

  if (!modal) {
    console.error("[StudyBlockModal] Modal element not found!");
    return;
  }

  // Set assignment title
  if (titleEl) {
    titleEl.textContent = assignmentData.title || "Unknown Assignment";
  }

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  // Set default times (e.g., 2 hours from now)
  const now = new Date();
  const startHour = now.getHours() + 1;
  const endHour = startHour + 2;

  startTimeInput.value = `${String(startHour).padStart(2, '0')}:00`;
  endTimeInput.value = `${String(endHour).padStart(2, '0')}:00`;

  // Show modal
  modal.classList.remove("hidden");
  console.log("[StudyBlockModal] Modal opened successfully");
}

/**
 * Close the study block modal
 */
export function closeStudyBlockModal() {
  const modal = $("studyBlockModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  currentAssignmentData = null;
  onSaveCallback = null;

  // Reset form
  const form = $("studyBlockForm");
  if (form) {
    form.reset();
  }
}

/**
 * Show a notification message
 */
function showNotification(type, message) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#48bb78' : '#f56565'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

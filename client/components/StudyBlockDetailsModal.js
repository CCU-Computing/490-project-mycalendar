import { api } from "../js/apiClient.js";

function $(id) { return document.getElementById(id); }

let currentStudyBlock = null;
let onCloseCallback = null;

/**
 * Ensure the study block details modal exists in the DOM
 */
function ensureStudyBlockDetailsModalDOM() {
  if ($("studyBlockDetailsModal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="studyBlockDetailsModal" class="fixed inset-0 z-[60] hidden">
      <div id="sbdModalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">Study Block Details</h3>
            <button id="sbdClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <div class="px-6 py-6 space-y-6">
            <!-- Study Block Title -->
            <div>
              <div class="text-sm font-medium text-slate-500 mb-1">Study Session</div>
              <div id="sbdTitle" class="text-lg font-semibold text-slate-900"></div>
            </div>

            <!-- Study Block Details Grid -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Date</div>
                <div id="sbdDate" class="text-sm font-semibold text-slate-900">—</div>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Time</div>
                <div id="sbdTime" class="text-sm font-semibold text-slate-900">—</div>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Duration</div>
                <div id="sbdDuration" class="text-sm font-semibold text-slate-900">—</div>
              </div>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Color</div>
                <div class="flex items-center gap-2">
                  <div id="sbdColorBox" class="w-6 h-6 rounded border border-slate-300"></div>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div id="sbdDescriptionSection" class="hidden">
              <div class="text-sm font-medium text-slate-900 mb-2">Description</div>
              <div id="sbdDescription" class="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"></div>
            </div>

            <!-- Actions -->
            <div class="flex justify-between gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                id="sbdDelete"
                class="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition"
              >
                🗑️ Delete
              </button>
              <div class="flex gap-3">
                <button
                  type="button"
                  id="sbdClose2"
                  class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  // Attach event listeners
  const modal = $("studyBlockDetailsModal");
  const backdrop = $("sbdModalBackdrop");
  const closeBtn = $("sbdClose");
  const closeBtn2 = $("sbdClose2");
  const deleteBtn = $("sbdDelete");

  backdrop?.addEventListener("click", closeStudyBlockDetailsModal);
  closeBtn?.addEventListener("click", closeStudyBlockDetailsModal);
  closeBtn2?.addEventListener("click", closeStudyBlockDetailsModal);
  deleteBtn?.addEventListener("click", handleDeleteStudyBlock);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeStudyBlockDetailsModal();
    }
  });
}

/**
 * Handle delete study block
 */
async function handleDeleteStudyBlock() {
  if (!currentStudyBlock) return;

  if (!confirm("Are you sure you want to delete this study block?")) {
    return;
  }

  try {
    await api.studyBlocks.delete(currentStudyBlock.id);

    closeStudyBlockDetailsModal();

    // Call the callback if provided (for calendar refresh)
    if (typeof onCloseCallback === "function") {
      onCloseCallback();
    }

    showNotification("success", "Study block deleted successfully!");
  } catch (error) {
    console.error("Error deleting study block:", error);
    showNotification("error", "Failed to delete study block. Please try again.");
  }
}

/**
 * Open the study block details modal
 * @param {Object} studyBlockData - Study block data with id, title, start, end, etc.
 * @param {Function} callback - Called after modal is closed or study block is deleted
 */
export function openStudyBlockDetailsModal(studyBlockData, callback) {
  ensureStudyBlockDetailsModalDOM();

  currentStudyBlock = studyBlockData;
  onCloseCallback = callback;

  const modal = $("studyBlockDetailsModal");
  const titleEl = $("sbdTitle");
  const dateEl = $("sbdDate");
  const timeEl = $("sbdTime");
  const durationEl = $("sbdDuration");
  const colorBoxEl = $("sbdColorBox");
  const descriptionEl = $("sbdDescription");
  const descriptionSection = $("sbdDescriptionSection");

  if (!modal) return;

  // Set study block title
  if (titleEl) {
    titleEl.textContent = studyBlockData.title || "Study Session";
  }

  // Set date
  if (dateEl && studyBlockData.start) {
    const startDate = new Date(studyBlockData.start);
    dateEl.textContent = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Set time
  if (timeEl && studyBlockData.start) {
    const startDate = new Date(studyBlockData.start);
    const endDate = studyBlockData.end ? new Date(studyBlockData.end) : null;

    const startTimeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (endDate) {
      const endTimeStr = endDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      timeEl.textContent = `${startTimeStr} - ${endTimeStr}`;
    } else {
      timeEl.textContent = startTimeStr;
    }
  }

  // Set duration
  if (durationEl && studyBlockData.start && studyBlockData.end) {
    const startDate = new Date(studyBlockData.start);
    const endDate = new Date(studyBlockData.end);
    const durationMs = endDate - startDate;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      durationEl.textContent = `${hours}h ${minutes}m`;
    } else {
      durationEl.textContent = `${minutes}m`;
    }
  } else {
    durationEl.textContent = "—";
  }

  // Set color
  if (colorBoxEl) {
    const color = studyBlockData.color || '#4F46E5';
    colorBoxEl.style.backgroundColor = color;
  }

  // Set description if available
  const description = studyBlockData.extendedProps?.description || studyBlockData.description;
  if (description && descriptionEl && descriptionSection) {
    descriptionEl.textContent = description;
    descriptionSection.classList.remove("hidden");
  } else if (descriptionSection) {
    descriptionSection.classList.add("hidden");
  }

  // Show modal
  modal.classList.remove("hidden");
}

/**
 * Close the study block details modal
 */
export function closeStudyBlockDetailsModal() {
  const modal = $("studyBlockDetailsModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  currentStudyBlock = null;
  onCloseCallback = null;
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

// Add CSS animations if not already present
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
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
}

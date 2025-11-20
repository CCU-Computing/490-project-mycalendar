import { api } from "../js/apiClient.js";
import toastNotification from "./ToastNotification.js";

function $(id) { return document.getElementById(id); }

let currentEventData = null;
let onCloseCallback = null;

/**
 * Ensure the personal event viewing modal exists in the DOM
 */
function ensurePersonalEventViewingModalDOM() {
  if ($("personalEventViewingModal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="personalEventViewingModal" class="fixed inset-0 z-50 hidden">
      <div id="peModalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-neutral-600 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Personal Event</h3>
            <div class="flex items-center gap-2">
              <div id="peColorIndicator" class="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-neutral-600" title="Event color"></div>
              <button id="peClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-600">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Modal Content -->
          <div class="px-6 py-6 space-y-6">
            <!-- Event Title -->
            <div>
              <div class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Title</div>
              <div id="peTitle" class="text-lg font-semibold text-slate-900 dark:text-slate-200"></div>
            </div>

            <!-- Event Info Grid -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 border border-slate-200 dark:border-neutral-600">
                <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Date</div>
                <div id="peDate" class="text-sm font-semibold text-slate-900 dark:text-slate-200">—</div>
              </div>
              <div class="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 border border-slate-200 dark:border-neutral-600">
                <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Time</div>
                <div id="peTime" class="text-sm font-semibold text-slate-900 dark:text-slate-200">—</div>
              </div>
              <div class="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 border border-slate-200 dark:border-neutral-600">
                <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Duration</div>
                <div id="peDuration" class="text-sm font-semibold text-slate-900 dark:text-slate-200">—</div>
              </div>
              <div class="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 border border-slate-200 dark:border-neutral-600">
                <div class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Type</div>
                <div class="text-sm font-semibold text-slate-900 dark:text-slate-200">Personal</div>
              </div>
            </div>

            <!-- Description Section -->
            <div id="peDescriptionSection" class="hidden">
              <div class="text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">Description</div>
              <div class="bg-slate-50 dark:bg-neutral-800 rounded-lg p-4 border border-slate-200 dark:border-neutral-600">
                <div id="peDescription" class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                  <!-- Description will be populated here -->
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-between gap-3 pt-4 border-t border-slate-200 dark:border-neutral-600">
              <button
                type="button"
                id="peDelete"
                class="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 dark:bg-red-100 border border-red-200 dark:border-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-200 transition"
              >
                🗑️ Delete
              </button>
              <button
                type="button"
                id="peCancel"
                class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-600 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  // Attach event listeners
  const modal = $("personalEventViewingModal");
  const backdrop = $("peModalBackdrop");
  const closeBtn = $("peClose");
  const cancelBtn = $("peCancel");
  const deleteBtn = $("peDelete");

  backdrop?.addEventListener("click", closePersonalEventViewingModal);
  closeBtn?.addEventListener("click", closePersonalEventViewingModal);
  cancelBtn?.addEventListener("click", closePersonalEventViewingModal);
  deleteBtn?.addEventListener("click", handleDeleteEvent);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closePersonalEventViewingModal();
    }
  });
}

/**
 * Handle delete event
 */
async function handleDeleteEvent() {
  if (!currentEventData) {
    console.error("[PersonalEventViewingModal] No event data available");
    return;
  }

  const eventTitle = currentEventData.title || "this event";
  const confirmed = confirm(`Are you sure you want to delete "${eventTitle}"?`);

  if (!confirmed) {
    return; // User cancelled
  }

  try {
    const eventId = currentEventData.extendedProps?.eventId || currentEventData.id;

    // Delete the event via API
    await api.studyBlocks.delete(eventId);

    toastNotification("Personal event deleted successfully", "success");

    // Close the modal
    closePersonalEventViewingModal();

    // Call callback to refresh parent component
    if (typeof onCloseCallback === "function") {
      onCloseCallback();
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    toastNotification("An error occurred while deleting the event", "error");
  }
}

/**
 * Calculate duration between two dates
 */
function calculateDuration(start, end) {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate - startDate;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins} min`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `${days}d`;
  }
}

/**
 * Open the personal event viewing modal
 * @param {Object} eventData - Event data with id, title, start, end, color, description, allDay, extendedProps
 * @param {Function} callback - Called after modal is closed or event is deleted
 */
export async function openPersonalEventViewingModal(eventData, callback) {
  ensurePersonalEventViewingModalDOM();

  currentEventData = eventData;
  onCloseCallback = callback;

  const modal = $("personalEventViewingModal");
  const titleEl = $("peTitle");
  const dateEl = $("peDate");
  const timeEl = $("peTime");
  const durationEl = $("peDuration");
  const descriptionSection = $("peDescriptionSection");
  const descriptionEl = $("peDescription");
  const colorIndicator = $("peColorIndicator");

  if (!modal) return;

  // Set event title
  if (titleEl) {
    titleEl.textContent = eventData.title || "Unnamed Event";
  }

  // Set color indicator
  if (colorIndicator && eventData.color) {
    colorIndicator.style.backgroundColor = eventData.color;
  }

  // Set date
  if (dateEl && eventData.start) {
    const startDate = new Date(eventData.start);
    const dateStr = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    dateEl.textContent = dateStr;
  }

  // Set time
  if (timeEl && eventData.start) {
    if (eventData.allDay) {
      timeEl.textContent = "All Day";
    } else {
      const startDate = new Date(eventData.start);
      const endDate = eventData.end ? new Date(eventData.end) : null;

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
  }

  // Set duration (only for non-all-day events)
  if (durationEl && !eventData.allDay && eventData.start && eventData.end) {
    const duration = calculateDuration(eventData.start, eventData.end);
    durationEl.textContent = duration || "—";
  } else if (durationEl && eventData.allDay) {
    durationEl.textContent = "All Day";
  }

  // Set description if available
  if (eventData.description) {
    descriptionSection?.classList.remove("hidden");
    if (descriptionEl) {
      descriptionEl.textContent = eventData.description;
    }
  } else {
    descriptionSection?.classList.add("hidden");
  }

  // Show modal
  modal.classList.remove("hidden");
}

/**
 * Close the personal event viewing modal
 */
export function closePersonalEventViewingModal() {
  const modal = $("personalEventViewingModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  currentEventData = null;
  onCloseCallback = null;
}

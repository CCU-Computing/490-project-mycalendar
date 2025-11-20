import { api } from "../js/apiClient.js";
import ToastNotification from "./ToastNotification.js";

function $(id) { return document.getElementById(id); }

let onSaveCallback = null;

// Preset colors for quick selection
const COLOR_PRESETS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Gray', value: '#6b7280' }
];

/**
 * Ensure the personal event modal exists in the DOM
 */
function ensurePersonalEventModalDOM() {
  if ($("personalEventModal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="personalEventModal" class="fixed inset-0 z-[60] hidden">
      <div id="peModalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-neutral-600 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-200">Add Personal Event</h3>
            <button id="peClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-600 dark:hover:text-slate-200">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <form id="personalEventForm" class="px-6 py-6">
            <!-- Event Title -->
            <div class="mb-4">
              <label for="peTitle" class="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                Event Title <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="peTitle"
                required
                placeholder="e.g., Doctor Appointment, Birthday Party"
                class="w-full rounded-lg border border-slate-300 dark:border-neutral-600 px-3 py-2 text-sm dark:bg-neutral-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <!-- Description -->
            <div class="mb-4">
              <label for="peDescription" class="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                Description
              </label>
              <textarea
                id="peDescription"
                rows="3"
                placeholder="Optional details about this event..."
                class="w-full rounded-lg border border-slate-300 dark:border-neutral-600 px-3 py-2 text-sm dark:bg-neutral-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              ></textarea>
            </div>

            <!-- All-Day Toggle -->
            <div class="mb-4 flex items-center">
              <input
                type="checkbox"
                id="peAllDay"
                class="h-4 w-4 rounded border-slate-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label for="peAllDay" class="ml-2 text-sm font-medium text-slate-900 dark:text-slate-200">
                All-day event
              </label>
            </div>

            <!-- Date -->
            <div class="mb-4">
              <label for="peDate" class="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                Date <span class="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="peDate"
                required
                class="w-full rounded-lg border border-slate-300 dark:border-neutral-600 px-3 py-2 text-sm dark:bg-neutral-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <!-- Time Range (hidden when all-day is checked) -->
            <div id="peTimeRange" class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label for="peStartTime" class="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                  Start Time <span class="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="peStartTime"
                  required
                  class="w-full rounded-lg border border-slate-300 dark:border-neutral-600 px-3 py-2 text-sm dark:bg-neutral-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label for="peEndTime" class="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                  End Time <span class="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="peEndTime"
                  required
                  class="w-full rounded-lg border border-slate-300 dark:border-neutral-600 px-3 py-2 text-sm dark:bg-neutral-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <!-- Color Picker -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                Event Color
              </label>

              <!-- Color input -->
              <input
                type="color"
                id="peColor"
                value="#10b981"
                class="h-10 w-20 rounded-lg border border-slate-300 dark:border-neutral-600 cursor-pointer mb-3"
              />

              <!-- Preset colors -->
              <div class="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick Picks:</div>
              <div id="peColorPresets" class="grid grid-cols-8 gap-2">
                ${COLOR_PRESETS.map(preset => `
                  <button
                    type="button"
                    data-color="${preset.value}"
                    title="${preset.name}"
                    class="h-8 w-8 rounded-full border-2 border-transparent hover:border-slate-400 dark:hover:border-slate-500 transition-all"
                    style="background-color: ${preset.value}"
                  ></button>
                `).join('')}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-3">
              <button
                type="button"
                id="peCancel"
                class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-600 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                Save Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  // Attach event listeners
  const modal = $("personalEventModal");
  const backdrop = $("peModalBackdrop");
  const closeBtn = $("peClose");
  const cancelBtn = $("peCancel");
  const form = $("personalEventForm");
  const allDayCheckbox = $("peAllDay");
  const timeRange = $("peTimeRange");
  const colorInput = $("peColor");
  const colorPresets = $("peColorPresets");

  backdrop?.addEventListener("click", closePersonalEventModal);
  closeBtn?.addEventListener("click", closePersonalEventModal);
  cancelBtn?.addEventListener("click", closePersonalEventModal);
  form?.addEventListener("submit", handleFormSubmit);

  // Toggle time range visibility based on all-day checkbox
  allDayCheckbox?.addEventListener("change", (e) => {
    if (e.target.checked) {
      timeRange.style.display = 'none';
      $("peStartTime").removeAttribute("required");
      $("peEndTime").removeAttribute("required");
    } else {
      timeRange.style.display = 'grid';
      $("peStartTime").setAttribute("required", "required");
      $("peEndTime").setAttribute("required", "required");
    }
  });

  // Color preset button clicks
  colorPresets?.addEventListener("click", (e) => {
    const button = e.target.closest('[data-color]');
    if (button) {
      const color = button.getAttribute('data-color');
      colorInput.value = color;
    }
  });

  // Escape key to close
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closePersonalEventModal();
    }
  });
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const title = $("peTitle").value.trim();
  const description = $("peDescription").value.trim();
  const date = $("peDate").value;
  const startTime = $("peStartTime").value;
  const endTime = $("peEndTime").value;
  const color = $("peColor").value;
  const allDay = $("peAllDay").checked;

  // Validate title
  if (!title) {
    ToastNotification("Event title is required", "error");
    return;
  }

  // Validate date
  if (!date) {
    ToastNotification("Event date is required", "error");
    return;
  }

  // Validate times if not all-day
  if (!allDay) {
    if (!startTime || !endTime) {
      ToastNotification("Start and end times are required", "error");
      return;
    }

    // Validate end time is after start time
    if (startTime >= endTime) {
      ToastNotification("End time must be after start time", "error");
      return;
    }
  }

  // Build datetime strings
  const startDateTime = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
  const endDateTime = allDay ? null : `${date}T${endTime}:00`;

  const payload = {
    title: title,
    description: description || null,
    courseId: null,  // Personal events have no course
    eventType: "personal",
    startTime: startDateTime,
    endTime: endDateTime,
    allDay: allDay,
    color: color,
    moodleAssignmentId: null  // Personal events not linked to assignments
  };

  try {
    const result = await api.studyBlocks.create(payload);

    if (result.ok) {
      closePersonalEventModal();

      // Call the onSave callback if provided (for calendar refresh)
      if (typeof onSaveCallback === "function") {
        onSaveCallback(result.event);
      }

      // Show success notification
      ToastNotification("Personal event created successfully", "success");
    }
  } catch (error) {
    console.error("Error creating personal event:", error);
    ToastNotification("Failed to create event. Please try again.", "error");
  }
}

/**
 * Open the personal event modal
 * @param {Object} options - Configuration options
 * @param {Function} options.onSave - Callback after successful save
 */
export function openPersonalEventModal({ onSave } = {}) {
  console.log("[PersonalEventModal] Opening modal");

  ensurePersonalEventModalDOM();

  onSaveCallback = onSave;

  const modal = $("personalEventModal");
  const dateInput = $("peDate");
  const startTimeInput = $("peStartTime");
  const endTimeInput = $("peEndTime");
  const allDayCheckbox = $("peAllDay");
  const timeRange = $("peTimeRange");

  if (!modal) {
    console.error("[PersonalEventModal] Modal element not found!");
    return;
  }

  // Reset all-day checkbox and show time range
  allDayCheckbox.checked = false;
  timeRange.style.display = 'grid';
  $("peStartTime").setAttribute("required", "required");
  $("peEndTime").setAttribute("required", "required");

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  // Set default times (current hour + 1, current hour + 2)
  const now = new Date();
  const startHour = now.getHours() + 1;
  const endHour = startHour + 1;

  startTimeInput.value = `${String(startHour).padStart(2, '0')}:00`;
  endTimeInput.value = `${String(endHour).padStart(2, '0')}:00`;

  // Show modal
  modal.classList.remove("hidden");
  console.log("[PersonalEventModal] Modal opened successfully");
}

/**
 * Close the personal event modal
 */
export function closePersonalEventModal() {
  const modal = $("personalEventModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  onSaveCallback = null;

  // Reset form
  const form = $("personalEventForm");
  if (form) {
    form.reset();
  }
}
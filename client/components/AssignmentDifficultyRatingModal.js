import { api } from "../js/apiClient.js";

function $(id) {
  return document.getElementById(id);
}

let currentAssignmentData = null;
let onSaveCallback = null;

/**
 * Ensure the assignment difficulty rating modal exists in the DOM
 */
function ensureAssignmentDifficultyRatingModalDOM() {
  if ($("assignmentDifficultyRatingModal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="assignmentDifficultyRatingModal" class="fixed inset-0 z-[60] hidden">
      <div id="adrModalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">Rate Assignment Difficulty</h3>
            <button id="adrClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Content -->
          <form id="difficultyRatingForm" class="px-6 py-6">
            <!-- Assignment Name -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-900 mb-2">Assignment</label>
              <div id="adrAssignmentName" class="text-base font-semibold text-slate-900 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200"></div>
            </div>

            <!-- Class Name -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-slate-900 mb-2">Class</label>
              <div id="adrClassName" class="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200"></div>
            </div>

            <!-- Difficulty Rating Dropdown -->
            <div class="mb-6">
              <label for="adrDifficultySelect" class="block text-sm font-medium text-slate-900 mb-2">
                Difficulty Rating
                <span class="text-xs text-slate-500 ml-1">(1 = Easy, 10 = Very Difficult)</span>
              </label>
              <select
                id="adrDifficultySelect"
                required
                class="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="" disabled selected>Select difficulty level...</option>
                <option value="1">1 - Very Easy</option>
                <option value="2">2 - Easy</option>
                <option value="3">3 - Fairly Easy</option>
                <option value="4">4 - Below Average</option>
                <option value="5">5 - Average</option>
                <option value="6">6 - Above Average</option>
                <option value="7">7 - Moderately Difficult</option>
                <option value="8">8 - Difficult</option>
                <option value="9">9 - Very Difficult</option>
                <option value="10">10 - Extremely Difficult</option>
              </select>
            </div>

            <!-- Visual Indicator -->
            <div class="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div class="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span>😊 Easy</span>
                <span>😐 Average</span>
                <span>😰 Difficult</span>
              </div>
              <div class="w-full bg-slate-200 rounded-full h-2">
                <div id="adrDifficultyBar" class="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
              </div>
              <div id="adrDifficultyLabel" class="text-center text-sm font-medium text-slate-700 mt-2">
                Select a rating above
              </div>
            </div>

            <!-- Optional Notes -->
            <div class="mb-6">
              <label for="adrNotes" class="block text-sm font-medium text-slate-900 mb-2">
                Notes (Optional)
                <span class="text-xs text-slate-500 ml-1">Additional comments about the difficulty</span>
              </label>
              <textarea
                id="adrNotes"
                rows="3"
                placeholder="E.g., lots of reading required, complex concepts..."
                class="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              ></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                id="adrCancel"
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                Save Rating
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  // Attach event listeners
  const modal = $("assignmentDifficultyRatingModal");
  const backdrop = $("adrModalBackdrop");
  const closeBtn = $("adrClose");
  const cancelBtn = $("adrCancel");
  const form = $("difficultyRatingForm");
  const difficultySelect = $("adrDifficultySelect");

  backdrop?.addEventListener("click", closeAssignmentDifficultyRatingModal);
  closeBtn?.addEventListener("click", closeAssignmentDifficultyRatingModal);
  cancelBtn?.addEventListener("click", closeAssignmentDifficultyRatingModal);
  form?.addEventListener("submit", handleFormSubmit);
  
  // Update visual indicator when difficulty changes
  difficultySelect?.addEventListener("change", updateDifficultyIndicator);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeAssignmentDifficultyRatingModal();
    }
  });
}

/**
 * Update the visual difficulty indicator
 */
function updateDifficultyIndicator() {
  const select = $("adrDifficultySelect");
  const bar = $("adrDifficultyBar");
  const label = $("adrDifficultyLabel");

  if (!select || !bar || !label) return;

  const value = parseInt(select.value);
  
  if (isNaN(value)) {
    bar.style.width = "0%";
    label.textContent = "Select a rating above";
    return;
  }

  // Update bar width (0-100%)
  bar.style.width = `${value * 10}%`;

  // Update label with descriptive text
  const labels = {
    1: "😊 Very Easy",
    2: "🙂 Easy",
    3: "😀 Fairly Easy",
    4: "😌 Below Average",
    5: "😐 Average",
    6: "😑 Above Average",
    7: "😕 Moderately Difficult",
    8: "😟 Difficult",
    9: "😰 Very Difficult",
    10: "😱 Extremely Difficult"
  };

  label.textContent = labels[value] || "Unknown";
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!currentAssignmentData) {
    console.error("[AssignmentDifficultyRatingModal] No assignment data available");
    return;
  }

  const difficulty = parseInt($("adrDifficultySelect").value);
  const notes = $("adrNotes").value.trim();

  if (isNaN(difficulty) || difficulty < 1 || difficulty > 10) {
    showNotification("error", "Please select a valid difficulty rating (1-10)");
    return;
  }

  const payload = {
    assignmentId: currentAssignmentData.id,
    difficulty: difficulty,
    notes: notes || null
  };

  try {
    // TODO: Replace with actual API endpoint when implemented
    console.log("[AssignmentDifficultyRatingModal] Saving difficulty rating:", payload);
    
    // Simulated API call - replace with actual endpoint
    // const result = await api.assignmentDifficulty.save(payload);
    
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
    const result = { ok: true };

    if (result.ok) {
      closeAssignmentDifficultyRatingModal();

      // Call the onSave callback if provided
      if (typeof onSaveCallback === "function") {
        onSaveCallback(payload);
      }

      showNotification("success", "Difficulty rating saved successfully!");
    } else {
      showNotification("error", "Failed to save difficulty rating");
    }
  } catch (error) {
    console.error("Error saving difficulty rating:", error);
    showNotification("error", "Failed to save difficulty rating. Please try again.");
  }
}

/**
 * Open the assignment difficulty rating modal
 * @param {Object} assignmentData - Assignment data with id, title, courseName
 * @param {Function} callback - Called after successful save
 */
export function openAssignmentDifficultyRatingModal(assignmentData, callback) {
  console.log("[AssignmentDifficultyRatingModal] Opening modal for:", assignmentData);

  ensureAssignmentDifficultyRatingModalDOM();

  currentAssignmentData = assignmentData;
  onSaveCallback = callback;

  const modal = $("assignmentDifficultyRatingModal");
  const assignmentNameEl = $("adrAssignmentName");
  const classNameEl = $("adrClassName");
  const difficultySelect = $("adrDifficultySelect");
  const notesEl = $("adrNotes");

  if (!modal) {
    console.error("[AssignmentDifficultyRatingModal] Modal element not found!");
    return;
  }

  // Set assignment name
  if (assignmentNameEl) {
    assignmentNameEl.textContent = assignmentData.title || "Unknown Assignment";
  }

  // Set class name
  if (classNameEl) {
    classNameEl.textContent = assignmentData.courseName || "Unknown Class";
  }

  // Reset form
  if (difficultySelect) {
    difficultySelect.value = "";
  }
  
  if (notesEl) {
    notesEl.value = "";
  }

  // Reset visual indicator
  updateDifficultyIndicator();

  // Show modal
  modal.classList.remove("hidden");
  console.log("[AssignmentDifficultyRatingModal] Modal opened successfully");
}

/**
 * Close the assignment difficulty rating modal
 */
export function closeAssignmentDifficultyRatingModal() {
  const modal = $("assignmentDifficultyRatingModal");
  if (modal) {
    modal.classList.add("hidden");
  }

  currentAssignmentData = null;
  onSaveCallback = null;

  // Reset form
  const form = $("difficultyRatingForm");
  if (form) {
    form.reset();
  }

  // Reset visual indicator
  updateDifficultyIndicator();
}

/**
 * Show a notification message
 */
function showNotification(type, message) {
  const notification = document.createElement("div");
  const bgColor = type === "success" ? "bg-green-600" : "bg-red-600";
  
  notification.className = `fixed top-4 right-4 px-6 py-4 rounded-lg ${bgColor} text-white shadow-xl z-[70] transition-all`;
  notification.style.animation = "slideIn 0.3s ease";
  
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="text-xl">
        ${type === "success" ? "✓" : "✕"}
      </div>
      <div>
        <div class="font-semibold">${type === "success" ? "Success!" : "Error"}</div>
        <div class="text-sm">${message}</div>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations if not already present
if (!document.getElementById("adrModalStyles")) {
  const style = document.createElement("style");
  style.id = "adrModalStyles";
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

import { api } from "../js/apiClient.js";

function $(id) { return document.getElementById(id); }

let timerInterval = null;
let remainingSeconds = 0;
let isPaused = false;
let currentAssignmentId = null;
let persistentTimerBar = null;

function ensureTimerDOM() {
  if ($("timerModal")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="fixed inset-0 z-50 hidden" id="timerModal">
      <div class="absolute inset-0 bg-black bg-opacity-50" id="timerBackdrop"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">Countdown Timer</h3>
            <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" id="timerClose">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
              </svg>
            </button>
          </div>
          <div class="px-6 py-8 space-y-6">
            <div class="text-center">
              <div class="text-sm font-medium text-slate-500 mb-2" id="timerAssignmentName">Assignment</div>
              <div class="text-6xl font-bold text-slate-900 font-mono tracking-tight" id="timerDisplay">00:00:00</div>
              <div class="text-sm text-slate-500 mt-2" id="timerDueDate"></div>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div class="h-full bg-indigo-600 rounded-full transition-all duration-1000" id="timerProgress" style="width: 100%"></div>
            </div>
            <div class="flex gap-3">
              <button class="flex-1 px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition" id="timerStartPause">
                Start
              </button>
              <button class="flex-1 px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition" id="timerReset">
                Reset
              </button>
            </div>
            <div class="hidden bg-amber-50 border border-amber-200 rounded-lg p-4" id="timerWarning">
              <div class="flex items-start gap-3">
                <svg class="h-5 w-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <div>
                  <div class="text-sm font-medium text-amber-900">Time Running Out</div>
                  <div class="text-xs text-amber-700 mt-1">Less than 1 hour remaining until due date</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);

  const modal = $("timerModal");
  const backdrop = $("timerBackdrop");
  const closeBtn = $("timerClose");
  const startPauseBtn = $("timerStartPause");
  const resetBtn = $("timerReset");

  backdrop?.addEventListener("click", closeTimer);
  closeBtn?.addEventListener("click", closeTimer);
  startPauseBtn?.addEventListener("click", toggleTimer);
  resetBtn?.addEventListener("click", resetTimer);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeTimer();
    }
  });
}

function ensurePersistentTimerBarDOM() {
  if ($("persistentTimerBar")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="fixed top-0 left-0 right-0 z-40 hidden" id="persistentTimerBar">
      <div class="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-3 shadow-lg">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg class="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <div class="text-xs font-medium opacity-90">URGENT</div>
              <div class="text-sm font-semibold" id="persistentTimerAssignment">Assignment Name</div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-2xl font-bold font-mono" id="persistentTimerDisplay">00:00:00</div>
            <button class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition" id="persistentTimerClose">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);

  const closeBtn = $("persistentTimerClose");
  closeBtn?.addEventListener("click", hidePersistentTimerBar);
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const display = $("timerDisplay");
  const progress = $("timerProgress");
  const warning = $("timerWarning");
  
  if (display) {
    display.textContent = formatTime(remainingSeconds);
  }

  if (progress && currentAssignmentId) {
    const total = getTotalSecondsForAssignment(currentAssignmentId);
    const percentage = total > 0 ? (remainingSeconds / total) * 100 : 0;
    progress.style.width = percentage + '%';
    
    if (percentage < 25) {
      progress.classList.remove('bg-indigo-600');
      progress.classList.add('bg-red-600');
    } else if (percentage < 50) {
      progress.classList.remove('bg-indigo-600', 'bg-red-600');
      progress.classList.add('bg-amber-600');
    } else {
      progress.classList.remove('bg-red-600', 'bg-amber-600');
      progress.classList.add('bg-indigo-600');
    }
  }

  if (warning) {
    if (remainingSeconds < 3600 && remainingSeconds > 0) {
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }
  }

  if (persistentTimerBar && !persistentTimerBar.classList.contains('hidden')) {
    const persistentDisplay = $("persistentTimerDisplay");
    if (persistentDisplay) {
      persistentDisplay.textContent = formatTime(remainingSeconds);
    }
  }
}

function getTotalSecondsForAssignment(assignmentId) {
  return 86400;
}

function startTimer() {
  if (timerInterval) return;
  
  isPaused = false;
  const startPauseBtn = $("timerStartPause");
  if (startPauseBtn) {
    startPauseBtn.textContent = 'Pause';
  }

  timerInterval = setInterval(() => {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      updateTimerDisplay();

      if (remainingSeconds === 0) {
        stopTimer();
        showTimerCompleteNotification();
      }
    }
  }, 1000);
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  isPaused = true;
  const startPauseBtn = $("timerStartPause");
  if (startPauseBtn) {
    startPauseBtn.textContent = 'Resume';
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  isPaused = false;
  const startPauseBtn = $("timerStartPause");
  if (startPauseBtn) {
    startPauseBtn.textContent = 'Start';
  }
}

function toggleTimer() {
  if (remainingSeconds === 0) return;
  
  if (timerInterval) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  stopTimer();
  if (currentAssignmentId) {
    remainingSeconds = getTotalSecondsForAssignment(currentAssignmentId);
    updateTimerDisplay();
  }
}

function showTimerCompleteNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Timer Complete!', {
      body: 'Your countdown timer has finished.',
      icon: '/favicon.ico'
    });
  }

  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 px-6 py-4 rounded-lg bg-green-600 text-white shadow-lg z-50 transition-opacity';
  notification.innerHTML = `
    <div class="flex items-center gap-3">
      <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
      </svg>
      <div>
        <div class="font-semibold">Timer Complete!</div>
        <div class="text-sm opacity-90">Time to submit your assignment</div>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

function showPersistentTimerBar(assignmentData) {
  ensurePersistentTimerBarDOM();
  persistentTimerBar = $("persistentTimerBar");
  
  if (!persistentTimerBar) return;

  const assignmentName = $("persistentTimerAssignment");
  if (assignmentName) {
    assignmentName.textContent = assignmentData.title || 'Assignment';
  }

  persistentTimerBar.classList.remove('hidden');
  updateTimerDisplay();

  if (!timerInterval) {
    startTimer();
  }
}

function hidePersistentTimerBar() {
  if (persistentTimerBar) {
    persistentTimerBar.classList.add('hidden');
  }
}

export function openTimer(assignmentData, callback) {
  ensureTimerDOM();
  ensurePersistentTimerBarDOM();

  currentAssignmentId = assignmentData.id;
  
  const dueDate = new Date(assignmentData.start || assignmentData.duedate * 1000);
  const now = new Date();
  const secondsUntilDue = Math.floor((dueDate - now) / 1000);
  
  remainingSeconds = Math.max(0, secondsUntilDue);

  const modal = $("timerModal");
  const assignmentName = $("timerAssignmentName");
  const dueDateEl = $("timerDueDate");

  if (assignmentName) {
    assignmentName.textContent = assignmentData.title || 'Assignment';
  }

  if (dueDateEl) {
    dueDateEl.textContent = 'Due: ' + dueDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  updateTimerDisplay();

  const fourHours = 4 * 60 * 60;
  if (remainingSeconds > 0 && remainingSeconds <= fourHours) {
    showPersistentTimerBar(assignmentData);
  }

  if (modal) {
    modal.classList.remove('hidden');
  }

  if (callback) {
    callback();
  }
}

export function closeTimer() {
  const modal = $("timerModal");
  if (modal) {
    modal.classList.add('hidden');
  }
  stopTimer();
}

export function initTimerForAssignment(assignmentData) {
  const dueDate = new Date(assignmentData.start || assignmentData.duedate * 1000);
  const now = new Date();
  const secondsUntilDue = Math.floor((dueDate - now) / 1000);
  const fourHours = 4 * 60 * 60;

  if (secondsUntilDue > 0 && secondsUntilDue <= fourHours) {
    ensurePersistentTimerBarDOM();
    currentAssignmentId = assignmentData.id;
    remainingSeconds = secondsUntilDue;
    showPersistentTimerBar(assignmentData);
  }
}

export function checkAllAssignmentsForPersistentTimer(assignments) {
  if (!assignments || assignments.length === 0) return;

  const now = new Date();
  const fourHours = 4 * 60 * 60 * 1000;

  const urgentAssignment = assignments
    .filter(a => {
      const dueDate = new Date(a.start || a.duedate * 1000);
      const diff = dueDate - now;
      return diff > 0 && diff <= fourHours;
    })
    .sort((a, b) => {
      const dateA = new Date(a.start || a.duedate * 1000);
      const dateB = new Date(b.start || b.duedate * 1000);
      return dateA - dateB;
    })[0];

  if (urgentAssignment) {
    initTimerForAssignment(urgentAssignment);
  }
}

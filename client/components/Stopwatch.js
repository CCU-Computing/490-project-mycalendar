function $(id) { return document.getElementById(id); }

let stopwatchInterval = null;
let elapsedSeconds = 0;
let isRunning = false;
let lapTimes = [];

function ensureStopwatchDOM() {
  if ($("stopwatchModal")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="fixed inset-0 z-50 hidden" id="stopwatchModal">
      <div class="absolute inset-0 bg-black bg-opacity-50" id="stopwatchBackdrop"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h3 class="text-lg font-semibold text-slate-900">Stopwatch</h3>
            <button class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" id="stopwatchClose">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
              </svg>
            </button>
          </div>
          <div class="px-6 py-8 space-y-6">
            <div class="text-center">
              <div class="text-6xl font-bold text-slate-900 font-mono tracking-tight" id="stopwatchDisplay">00:00:00</div>
              <div class="text-sm text-slate-500 mt-2">Track your study time</div>
            </div>
            <div class="flex gap-3">
              <button class="flex-1 px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition" id="stopwatchStartStop">
                Start
              </button>
              <button class="px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition" id="stopwatchLap">
                Lap
              </button>
              <button class="px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition" id="stopwatchReset">
                Reset
              </button>
            </div>
            <div class="border-t border-slate-200 pt-4" id="stopwatchLapsContainer">
              <div class="text-sm font-medium text-slate-700 mb-2">Lap Times</div>
              <div class="max-h-48 overflow-y-auto space-y-1" id="stopwatchLapsList">
                <div class="text-sm text-slate-500 text-center py-4">No laps recorded</div>
              </div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div class="flex items-center justify-between text-sm">
                <span class="text-slate-600">Total Study Time</span>
                <span class="font-semibold text-slate-900" id="stopwatchTotalTime">00:00:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);

  const modal = $("stopwatchModal");
  const backdrop = $("stopwatchBackdrop");
  const closeBtn = $("stopwatchClose");
  const startStopBtn = $("stopwatchStartStop");
  const lapBtn = $("stopwatchLap");
  const resetBtn = $("stopwatchReset");

  backdrop?.addEventListener("click", closeStopwatch);
  closeBtn?.addEventListener("click", closeStopwatch);
  startStopBtn?.addEventListener("click", toggleStopwatch);
  lapBtn?.addEventListener("click", recordLap);
  resetBtn?.addEventListener("click", resetStopwatch);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeStopwatch();
    }
  });
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateStopwatchDisplay() {
  const display = $("stopwatchDisplay");
  const totalTime = $("stopwatchTotalTime");
  
  if (display) {
    display.textContent = formatTime(elapsedSeconds);
  }

  if (totalTime) {
    totalTime.textContent = formatTime(elapsedSeconds);
  }
}

function startStopwatch() {
  if (stopwatchInterval) return;
  
  isRunning = true;
  const startStopBtn = $("stopwatchStartStop");
  if (startStopBtn) {
    startStopBtn.textContent = 'Stop';
    startStopBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    startStopBtn.classList.add('bg-red-600', 'hover:bg-red-700');
  }

  stopwatchInterval = setInterval(() => {
    elapsedSeconds++;
    updateStopwatchDisplay();
  }, 1000);
}

function stopStopwatch() {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }
  
  isRunning = false;
  const startStopBtn = $("stopwatchStartStop");
  if (startStopBtn) {
    startStopBtn.textContent = 'Start';
    startStopBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
    startStopBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
  }
}

function toggleStopwatch() {
  if (isRunning) {
    stopStopwatch();
  } else {
    startStopwatch();
  }
}

function recordLap() {
  if (elapsedSeconds === 0) return;
  
  lapTimes.push(elapsedSeconds);
  renderLaps();
}

function renderLaps() {
  const lapsList = $("stopwatchLapsList");
  if (!lapsList) return;

  if (lapTimes.length === 0) {
    lapsList.innerHTML = '<div class="text-sm text-slate-500 text-center py-4">No laps recorded</div>';
    return;
  }

  lapsList.innerHTML = lapTimes
    .map((time, index) => {
      const lapNumber = lapTimes.length - index;
      const previousTime = index > 0 ? lapTimes[lapTimes.length - index - 1] : 0;
      const lapDuration = time - previousTime;
      
      return `
        <div class="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 transition">
          <span class="text-sm font-medium text-slate-700">Lap ${lapNumber}</span>
          <div class="flex items-center gap-4">
            <span class="text-xs text-slate-500">${formatTime(lapDuration)}</span>
            <span class="text-sm font-semibold text-slate-900">${formatTime(time)}</span>
          </div>
        </div>
      `;
    })
    .reverse()
    .join('');
}

function resetStopwatch() {
  if (isRunning) {
    const confirmed = confirm('Stop and reset the stopwatch?');
    if (!confirmed) return;
  }

  stopStopwatch();
  elapsedSeconds = 0;
  lapTimes = [];
  updateStopwatchDisplay();
  renderLaps();
}

export function openStopwatch(callback) {
  ensureStopwatchDOM();

  const modal = $("stopwatchModal");
  
  updateStopwatchDisplay();
  renderLaps();

  if (modal) {
    modal.classList.remove('hidden');
  }

  if (callback) {
    callback();
  }
}

export function closeStopwatch() {
  const modal = $("stopwatchModal");
  
  if (isRunning) {
    const confirmed = confirm('Stopwatch is running. Close anyway?');
    if (!confirmed) return;
  }

  if (modal) {
    modal.classList.add('hidden');
  }
  
  stopStopwatch();
}

export function getStopwatchData() {
  return {
    elapsedSeconds,
    isRunning,
    lapTimes: [...lapTimes],
    totalTime: formatTime(elapsedSeconds)
  };
}

export function saveStopwatchSession(assignmentId) {
  const sessionData = {
    assignmentId,
    duration: elapsedSeconds,
    lapTimes: [...lapTimes],
    timestamp: new Date().toISOString()
  };

  return sessionData;
}

// Minimal Calendar component wrapper for FullCalendar (CDN global)
// Usage example (in a page script):
// import { mountCalendar } from "../components/Calendar.js";
// const cal = mountCalendar({ containerId: "calendar" });
// cal.reload();

import { openAssignmentDetailsModal } from "./AssignmentDetailsModal.js";
import { openStudyBlockDetailsModal } from "./StudyBlockDetailsModal.js";

function getElement(containerId) {
  if (!containerId) return null;
  try { return document.getElementById(containerId); } catch (_) { return null; }
}

// Holiday data for US holidays
const holidays = [
  // 2024 Holidays
  { date: '2024-01-01', title: 'New Year\'s Day', color: '#dc3545' },
  { date: '2024-01-15', title: 'Martin Luther King Jr. Day', color: '#6f42c1' },
  { date: '2024-02-19', title: 'Presidents\' Day', color: '#6f42c1' },
  { date: '2024-03-31', title: 'Easter Sunday', color: '#fd7e14' },
  { date: '2024-05-27', title: 'Memorial Day', color: '#dc3545' },
  { date: '2024-06-19', title: 'Juneteenth', color: '#198754' },
  { date: '2024-07-04', title: 'Independence Day', color: '#dc3545' },
  { date: '2024-09-02', title: 'Labor Day', color: '#6f42c1' },
  { date: '2024-10-14', title: 'Columbus Day', color: '#6f42c1' },
  { date: '2024-10-31', title: 'Halloween', color: '#fd7e14' },
  { date: '2024-11-11', title: 'Veterans Day', color: '#dc3545' },
  { date: '2024-11-28', title: 'Thanksgiving', color: '#fd7e14' },
  { date: '2024-12-25', title: 'Christmas Day', color: '#198754' },
  
  // 2025 Holidays
  { date: '2025-01-01', title: 'New Year\'s Day', color: '#dc3545' },
  { date: '2025-01-20', title: 'Martin Luther King Jr. Day', color: '#6f42c1' },
  { date: '2025-02-17', title: 'Presidents\' Day', color: '#6f42c1' },
  { date: '2025-04-20', title: 'Easter Sunday', color: '#fd7e14' },
  { date: '2025-05-26', title: 'Memorial Day', color: '#dc3545' },
  { date: '2025-06-19', title: 'Juneteenth', color: '#198754' },
  { date: '2025-07-04', title: 'Independence Day', color: '#dc3545' },
  { date: '2025-09-01', title: 'Labor Day', color: '#6f42c1' },
  { date: '2025-10-13', title: 'Columbus Day', color: '#6f42c1' },
  { date: '2025-10-31', title: 'Halloween', color: '#fd7e14' },
  { date: '2025-11-11', title: 'Veterans Day', color: '#dc3545' },
  { date: '2025-11-27', title: 'Thanksgiving', color: '#fd7e14' },
  { date: '2025-12-25', title: 'Christmas Day', color: '#198754' },
];

export function mountCalendar({
  containerId = "calendar",
  initialView = "dayGridMonth",
  // Optional hooks to be implemented by feature owners later
  fetchEvents,          // async () => [{ id, title, start, ... }]
  prefsEnabled = false, // when true, implement prefs-based coloring in the future
  options = {},         // additional FullCalendar options
  onEventClick = null,  // optional custom event click handler
} = {}) {
  const el = getElement(containerId);
  if (!el) {
    console.warn(`[Calendar] Container not found: #${containerId}`);
    return {
      reload() {},
      updateOptions() {},
      destroy() {},
      getInstance() { return null; },
    };
  }

  if (!window || !window.FullCalendar) {
    console.warn("[Calendar] FullCalendar global not found. Ensure CDN is loaded on the page.");
    return {
      reload() {},
      updateOptions() {},
      destroy() {},
      getInstance() { return null; },
    };
  }

  // Prepare holiday events
  const holidayEvents = holidays.map(holiday => ({
    id: `holiday-${holiday.date}`,
    title: `🎉 ${holiday.title}`,
    start: holiday.date,
    allDay: true,
    color: holiday.color,
    classNames: ['holiday-event'],
    editable: false,
    extendedProps: {
      type: 'holiday',
      description: `Federal Holiday: ${holiday.title}`
    }
  }));

  const baseOptions = {
    initialView,
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
    },
    events: holidayEvents, // Start with holidays
    nowIndicator: true, // Show current time line
    now: new Date(), // Current date/time
    slotMinTime: "00:00:00", // Show full 24 hours
    slotMaxTime: "24:00:00", // Show full 24 hours
    allDaySlot: true, // Show all-day events slot
    
    // Event rendering
    eventDidMount: function(info) {
      // Add tooltips to holiday events
      if (info.event.extendedProps.type === 'holiday') {
        info.el.setAttribute('title', info.event.extendedProps.description);
      }

      // Add click cursor for assignment and study block events
      if (info.event.extendedProps.type === 'assign' ||
          info.event.extendedProps.type === 'quiz' ||
          info.event.extendedProps.type === 'study_block') {
        info.el.style.cursor = 'pointer';
      }
    },

    // Event click handler
    eventClick: function(info) {
      const eventType = info.event.extendedProps.type;

      // Holiday click - show alert
      if (eventType === 'holiday') {
        alert(`${info.event.title}\n\n${info.event.extendedProps.description}`);
        return;
      }

      // Assignment/Quiz click - open assignment details modal
      if (eventType === 'assign' || eventType === 'quiz') {
        const assignmentData = {
          id: info.event.id,
          title: info.event.title,
          type: eventType,
          start: info.event.start,
          courseName: info.event.extendedProps?.courseName || null
        };

        // Call custom handler if provided, otherwise use default
        if (typeof onEventClick === 'function') {
          onEventClick(assignmentData, calendar);
        } else {
          openAssignmentDetailsModal(assignmentData, () => {
            // Reload calendar after creating study block
            reload();
          });
        }
        return;
      }

      // Study block click - open study block details modal
      if (eventType === 'study_block') {
        const studyBlockData = {
          id: info.event.id,
          title: info.event.title,
          start: info.event.start,
          end: info.event.end,
          color: info.event.backgroundColor || info.event.color,
          extendedProps: info.event.extendedProps
        };

        openStudyBlockDetailsModal(studyBlockData, () => {
          // Reload calendar after deleting study block
          reload();
        });
        return;
      }
    },
    
    // Custom view rendering for time indicator
    viewDidMount: function(view) {
      // Add custom time indicator with timestamp for supported views
      addRealTimeIndicator(view.el, view.view.type);
    },
    
    // Custom styling
    eventClassNames: function(arg) {
      if (arg.event.extendedProps.type === 'holiday') {
        return ['holiday-event-custom'];
      }
      return [];
    }
  };

  const calendar = new window.FullCalendar.Calendar(el, { ...baseOptions, ...options });

  // Add custom styles for holidays and time indicator
  addCustomStyles();

  calendar.render();

  async function reload() {
    if (typeof fetchEvents === "function") {
      try {
        const userEvents = await fetchEvents();
        calendar.removeAllEvents();
        // Always include holidays, then add user events
        calendar.addEventSource(holidayEvents);
        calendar.addEventSource(userEvents || []);
      } catch (e) {
        console.error("[Calendar] Failed to reload events:", e);
      }
    } else {
      // If no fetchEvents function, ensure holidays are still loaded
      calendar.removeAllEvents();
      calendar.addEventSource(holidayEvents);
    }
  }

  function updateOptions(partial = {}) {
    try {
      Object.entries(partial).forEach(([k, v]) => {
        // Setters for dynamic options can vary; this is a simple merge & rerender pattern
        calendar.setOption(k, v);
      });
    } catch (e) {
      console.error("[Calendar] Failed to update options:", e);
    }
  }

  function destroy() {
    // Clean up time update interval
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
    }
    try { calendar.destroy(); } catch (_) {}
  }

  // Real-time updates for the current time indicator
  function startRealTimeUpdates() {
    // Update every minute
    timeUpdateInterval = setInterval(() => {
      calendar.setOption('now', new Date());
      updateTimeDisplay();
    }, 60000); // Update every minute

    // Initial update
    updateTimeDisplay();
  }

  function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Update any existing time displays
    const existingTimeDisplay = document.querySelector('.current-time-display');
    if (existingTimeDisplay) {
      existingTimeDisplay.textContent = timeString;
    }
  }

  return {
    reload,
    updateOptions,
    destroy,
    getInstance() { return calendar; },
  };
}

// Add real-time indicator with timestamp for supported views
function addRealTimeIndicator(calendarEl, viewType) {
  // Remove any existing custom time indicators
  const existingIndicators = calendarEl.querySelectorAll('.custom-time-indicator');
  existingIndicators.forEach(el => el.remove());

  // Only add time indicator for week and day views (timeGrid views)
  if (viewType.includes('timeGrid')) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Create time indicator element
    const timeIndicator = document.createElement('div');
    timeIndicator.className = 'custom-time-indicator';
    timeIndicator.innerHTML = `
      <div class="current-time-display">${timeString}</div>
    `;
    
    // Position it in the calendar header area
    const headerRight = calendarEl.querySelector('.fc-header-toolbar .fc-toolbar-chunk:last-child');
    if (headerRight) {
      headerRight.appendChild(timeIndicator);
    }
  }
}

// Add custom CSS styles for holidays and time indicator
function addCustomStyles() {
  if (document.getElementById('calendar-custom-styles')) return;

  const style = document.createElement('style');
  style.id = 'calendar-custom-styles';
  style.textContent = `
    /* Holiday event styling */
    .holiday-event-custom {
      border-radius: 6px !important;
      font-weight: 600 !important;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.3) !important;
    }
    
    .holiday-event {
      opacity: 0.9 !important;
      font-size: 12px !important;
    }
    
    /* Enhanced now indicator line - the red time line */
    .fc-now-indicator-line {
      border-top: 3px solid #e74c3c !important;
      opacity: 0.9 !important;
      box-shadow: 0 1px 3px rgba(231, 76, 60, 0.3) !important;
      z-index: 10 !important;
    }
    
    .fc-now-indicator-arrow {
      border-top-color: #e74c3c !important;
      border-bottom-color: #e74c3c !important;
      border-width: 6px !important;
    }
    
    /* Custom time display in header */
    .custom-time-indicator {
      display: flex;
      align-items: center;
      margin-left: 15px;
    }
    
    .current-time-display {
      background: #e74c3c;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      min-width: 80px;
      text-align: center;
      position: relative;
    }
    
    .current-time-display::before {
      content: '🕐';
      margin-right: 5px;
    }
    
    /* Enhanced calendar appearance */
    .fc-day-today {
      background-color: rgba(52, 152, 219, 0.1) !important;
    }
    
    .fc-event {
      border-radius: 4px !important;
      /* COURSE TYPE STYLE TEST */
      border-width: 3px !important;
    }
    
    /* Holiday specific gradient styling */
    .fc-event[style*="#dc3545"] {
      background: linear-gradient(135deg, #dc3545, #c82333) !important;
      border-color: #bd2130 !important;
    }
    
    .fc-event[style*="#198754"] {
      background: linear-gradient(135deg, #198754, #157347) !important;
      border-color: #146c43 !important;
    }
    
    .fc-event[style*="#fd7e14"] {
      background: linear-gradient(135deg, #fd7e14, #e8650e) !important;
      border-color: #d85c0d !important;
    }
    
    .fc-event[style*="#6f42c1"] {
      background: linear-gradient(135deg, #6f42c1, #593ba0) !important;
      border-color: #523589 !important;
    }
    
    /* Responsive time display */
    @media (max-width: 768px) {
      .current-time-display {
        font-size: 13px;
        padding: 4px 8px;
        min-width: 65px;
      }
      
      .custom-time-indicator {
        margin-left: 8px;
      }
    }
    
    /* Enhanced month view for holidays */
    .fc-daygrid-event {
      margin: 1px !important;
      border-radius: 3px !important;
    }
    
    /* Smooth transitions */
    .fc-event, .fc-now-indicator-line, .current-time-display {
      transition: all 0.3s ease !important;
    }
    
    /* Hover effects for holidays */
    .fc-event.holiday-event-custom:hover {
      transform: scale(1.02) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
      cursor: pointer !important;
    }
    
    /* Make sure the now indicator shows above events */
    .fc-timegrid-now-indicator-line {
      border-color: #e74c3c !important;
      border-width: 2px !important;
      opacity: 1 !important;
    }
  `;
  
  document.head.appendChild(style);
}

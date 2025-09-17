// Minimal Calendar component wrapper for FullCalendar (CDN global)
// Usage example (in a page script):
// import { mountCalendar } from "../components/Calendar.js";
// const cal = mountCalendar({ containerId: "calendar" });
// cal.reload();

function getElement(containerId) {
  if (!containerId) return null;
  try { return document.getElementById(containerId); } catch (_) { return null; }
}

export function mountCalendar({
  containerId = "calendar",
  initialView = "dayGridMonth",
  // Optional hooks to be implemented by feature owners later
  fetchEvents,          // async () => [{ id, title, start, ... }]
  prefsEnabled = false, // when true, implement prefs-based coloring in the future
  options = {},         // additional FullCalendar options
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

  const baseOptions = {
    initialView,
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,listWeek",
    },
    events: [],
  };

  const calendar = new window.FullCalendar.Calendar(el, { ...baseOptions, ...options });
  calendar.render();

  // As a user I want to be able to add a new assignment/ event to my calendar
  var eventForm = document.getElementById('eventForm');
  eventForm.addEventListener('submit', function(e) {
      e.preventDefault(); // Prevent the form from submitting normally

      // Get form values
      var title = document.getElementById('eventTitle').value;
      var start = document.getElementById('eventStart').value;
      var end = document.getElementById('eventEnd').value;

      // Add the new event to the calendar
      calendar.addEvent({
          title: title,
          start: start,
          end: end || null // Use null if no end date is provided
      });

      // Clear the form fields
      eventForm.reset();
  });

  async function reload() {
    if (typeof fetchEvents === "function") {
      try {
        const events = await fetchEvents();
        calendar.removeAllEvents();
        calendar.addEventSource(events || []);
      } catch (e) {
        console.error("[Calendar] Failed to reload events:", e);
      }
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
    try { calendar.destroy(); } catch (_) {}
  }

  return {
    reload,
    updateOptions,
    destroy,
    getInstance() { return calendar; },
  };
}
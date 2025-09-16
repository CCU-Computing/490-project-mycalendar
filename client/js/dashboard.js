import { mountClassList } from "../components/ClassList.js";
import { mountCalendar } from "../components/Calendar.js";
import { api } from "./apiClient.js";

(function () {
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");

  if (!userName) {
    // dashboard.html is in /pages, so go to login in the same folder
    window.location.href = "./login.html";
    return;
  }

  if (userChip) {
    userChip.textContent = "Hi, " + userName;
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountClassList({ containerId: "semesterClasses" });

    const calendar = mountCalendar({
      containerId: "calendar",
      initialView: "dayGridMonth",
      prefsEnabled: true,
      fetchEvents: async () => {
        // this is where you would hook to /api/calendar to build out the calendar
        // Get calendar events
        const response = await fetch('/api/calendar');
        const { events } = await response.json();
        
        // Convert to calendar format
        const calendarEvents = await Promise.all(events.map(async event => ({
          groupId: event.courseId,
          id: event.id,
          title: event.title,
          start: new Date(event.dueAt * 1000),
          color: await getCourseColor(event.courseId, event.id)
        })));

        // Return value to fetchEvents
        return calendarEvents;
      },
    });

    // Pass courseId, assignmentId
    async function getCourseColor(cId, aId) {
      // Default color
      let defaultColor = '#4F46E5';

      // Get course color from Database (JSON)
      const response = await fetch('/api/prefs');
      const { prefs } = await response.json();
      const courseColors = prefs?.calendar?.courseColors || {};

      // TODO: Look into event overrides

      // const eventOverrides = prefs?.calendar?.eventOverrides || {};

      // Object.keys(eventOverrides).forEach(event => {
      //   if (event === aId) {
      //     console.log(Object.values(event))
      //   }
      // })

      // Return color value
      return courseColors[String(cId)] || defaultColor; 

      // Keep for future use
      // eventCourse.backgroundColor = courseColors[String(courseId)] || defaultColor;
      // event.borderColor = event.backgroundColor;
    }

    // Once all events are fetched reload calendar
    calendar.reload();

    document.getElementById("refreshCalendar")?.addEventListener("click", () => {
      calendar.reload();
    });
  });
})();
// add more here for user stories related to the dashboard, like the calendar, mini action task items, etc. create branches for them, so we can do the code reviews and eventually merge all.
// remember, this is just beginner demo stuff, once we move on to using the actual endpoints, the js will operate differently
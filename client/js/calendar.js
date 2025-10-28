import { mountClassList } from "../components/ClassList.js";
import { mountCalendar } from "../components/Calendar.js";
import { api } from "./apiClient.js";

(function () {

  // get document elements
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");
  const calendarContainer = document.getElementById("calendar");
  const calendarRefreshBtn = document.getElementById("calendarRefreshBtn");
  const calendarAddEventBtn = document.getElementById("calendarAddEventBtn"); // <- functionality needs to be added

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

    // array to hold events, courses, and assignment types
    let allEvents = [];
    let allCourses = [];
    let assignmentTypes = [];

    // objects to hold color preferences
    let courseColors = {};
    let typeColors = {};

    // add loading state classes
    addLoadingStates()

    // calendar setup and options
    const calendar = mountCalendar({
      containerId: "calendar",
      initialView: "dayGridMonth",
      prefsEnabled: true,
      fetchEvents: async () => {

        // get events, courses, and colors
        await getEvents()
        await getCourses()
        await getColors();

        // get study blocks from custom events
        let studyBlocks = [];
        try {
          const { events: studyBlockEvents } = await api.studyBlocks.getAll();
          studyBlocks = (studyBlockEvents || []).map(sb => {
            const startDate = new Date(sb.start_time);
            const endDate = sb.end_time ? new Date(sb.end_time) : null;

            // For custom events: border = custom color set on creation, background = "custom" type color
            const borderColor = sb.color || '#4F46E5'; // custom color from creation
            const baseCustomTypeColor = typeColors['custom'] || '#8b5cf6'; // "custom" assignment type color
            const backgroundColor = baseCustomTypeColor + '66'; // Add alpha channel (40% opacity)

            return {
              id: sb.id,
              title: sb.title,
              start: startDate.toISOString(),
              end: endDate ? endDate.toISOString() : null,
              allDay: false,
              backgroundColor: backgroundColor,
              borderColor: borderColor,
              extendedProps: {
                type: 'study_block',
                assignmentId: sb.moodle_assignment_id,
                description: sb.description
              }
            };
          });
        } catch (e) {
          console.error('Error loading study blocks:', e);
        }

        // iterate over every moodle event and convert the date
        const moodleEvents = allEvents.map(ev => {
          // Find the course name for this event
          const course = allCourses.find(c => c.id === ev.courseId);

          // Get colors: border = course color, background = type color
          const borderColor = courseColors[ev.courseId] || '#6366f1'; // default indigo
          const baseTypeColor = typeColors[ev.type] || '#8b5cf6'; // default purple

          // Make type color slightly transparent for background
          const backgroundColor = baseTypeColor + '66'; // Add alpha channel (40% opacity)

          return {
            ...ev,
            start: new Date(ev.dueAt * 1000),
            allDay: true,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            extendedProps: {
              type: ev.type || 'assign',
              courseName: course?.name || 'Unknown Course',
              courseId: ev.courseId
            }
          };
        });

        // combine moodle events and study blocks
        return [...moodleEvents, ...studyBlocks];
      },
    });

    // load calendar events immediately
    calendar.reload().then(() => removeLoadingStates());

    // get colors from prefs for calendar events
    async function getColors() {
      try {
        const { prefs } = await api.prefs.get();

        // get assignment type colors and course colors from prefs
        typeColors = prefs.calendar.assignmentTypeColors || {};
        courseColors = prefs.calendar.courseColors || {};
      } catch (e) {
        console.error('Error loading color preferences:', e);
        // Use empty objects as fallback
        typeColors = {};
        courseColors = {};
      }
    }

    // get events function
    async function getEvents() {

      // get events
      const { events } = await api.calendar();

      // update all events
      allEvents = events;
    }

    // get courses function
    async function getCourses() {

      // get courses
      const { courses } = await api.courses();

      // update all courses
      allCourses = courses;
    }

    // event listener for refreshing calendar
    calendarRefreshBtn.addEventListener("click", () => {

      // get calendar instance
      const calendarInstance = calendar.getInstance();

      // remove all data from calendar <- may need to be corrected
      calendarInstance.removeAllEvents();

      // add loading states
      addLoadingStates();
      
      // reload calendar
      calendar.reload().then(() => removeLoadingStates());
    });

    // function for adding loading states
    function addLoadingStates() {

      // add loading states
      calendarContainer.classList.add("animate-pulse", "cursor-progress");
      calendarRefreshBtn.classList.add("animate-pulse", "cursor-progress");
      calendarAddEventBtn.classList.add("animate-pulse", "cursor-progress");

      // disable buttons
      calendarRefreshBtn.disabled = true;
      calendarAddEventBtn.disabled = true;
    }

    // function for removing loading states
    function removeLoadingStates() {

      // remove loading states
      calendarContainer.classList.remove("animate-pulse", "cursor-progress");
      calendarRefreshBtn.classList.remove("animate-pulse", "cursor-progress");
      calendarAddEventBtn.classList.remove("animate-pulse", "cursor-progress");

      // enable buttons
      calendarRefreshBtn.disabled = false;
      calendarAddEventBtn.disabled = false;
    }
  });
})();
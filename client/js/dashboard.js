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

    // array to hold all events, courses, colors
    let allEvents = [];
    let allCourses = [];
    let allColors = {};

    // get filter by course select element
    const filterByCourseSelect = document.getElementById("filterByCourseSelect");

    // calendar setup and options
    const calendar = mountCalendar({
      containerId: "calendar",
      initialView: "dayGridMonth",
      prefsEnabled: true,
      fetchEvents: async () => {

        // get events and courses
        await getEventsAndCourses();

        // get colors
        await getColors();

        // get study blocks from custom events
        let studyBlocks = [];
        try {
          const { events: studyBlockEvents } = await api.studyBlocks.getAll();
          studyBlocks = (studyBlockEvents || []).map(sb => {
            const startDate = new Date(sb.start_time);
            const endDate = sb.end_time ? new Date(sb.end_time) : null;

            return {
              id: sb.id,
              title: sb.title,
              start: startDate.toISOString(),
              end: endDate ? endDate.toISOString() : null,
              allDay: false,
              color: sb.color || '#4F46E5',
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
          // Based on current course set color course/type
          const courseColor = allColors[ev.courseId];
          const typeColor = allColors[ev.type];

          return {
            ...ev,
            start: new Date(ev.dueAt * 1000),
            allDay: true,
            color: typeColor,
            borderColor: courseColor,
            extendedProps: {
              type: ev.type || 'assign',
              courseName: course?.name || 'Unknown Course'
            }
          };
        });

        // combine moodle events and study blocks
        return [...moodleEvents, ...studyBlocks];
      },
    });

    // load calendar events immediately
    calendar.reload();

    // get events and courses function with filter by course select creation 
    async function getEventsAndCourses() {

      // get events and courses
      const { events } = await api.calendar();
      const { courses } = await api.courses();

      // update all events and courses
      allEvents = events;
      allCourses = courses;

      // create all courses option
      const allCoursesOption = document.createElement("option");
      allCoursesOption.value = "allCourses";
      allCoursesOption.textContent = "All Courses";
      filterByCourseSelect.appendChild(allCoursesOption);

      // iterate through all courses
      allCourses.forEach(course => {

        // create course option
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name;
        filterByCourseSelect.appendChild(option);
      });
    }

    // Get colors 
    async function getColors() {
      // Get Colors
      const { prefs } = await api.prefs.get();
      const courseColors = prefs.calendar.courseColors;
      const typeColors = prefs.calendar.assignmentTypeColors;

      // Course/Type
      allColors = {...courseColors, ...typeColors};
  
    }

    // event listener for refreshing calendar
    document.getElementById("refreshCalendar").addEventListener("click", () => {

      // reset filter by course select to all courses option
      filterByCourseSelect.value = "allCourses";

      // remove all options
      filterByCourseSelect.options.length = 0;

      // reload calendar
      calendar.reload();
    });

    // event listener for filter by courses
    document.getElementById("filterByCourseSelect").addEventListener("change", async () => {

      // get calendar instance
      const calendarInstance = calendar.getInstance();

      // get the dropdown value
      const filterByCourseSelectValue = filterByCourseSelect.value;

      // remove all events from calendar
      calendarInstance.removeAllEvents();

      // get study blocks
      let studyBlocks = [];
      try {
        const { events: studyBlockEvents } = await api.studyBlocks.getAll();
        studyBlocks = studyBlockEvents || [];
      } catch (e) {
        console.error('Error loading study blocks for filter:', e);
      }

      // iterate through all moodle events
      allEvents.forEach(ev => {

        // determine if current event matches the filter or if all courses is selected
        if (ev.courseId == Number(filterByCourseSelectValue) || filterByCourseSelectValue == "allCourses") {

          // Find the course name for this event
          const course = allCourses.find(c => c.id === ev.courseId);

          // add event to calendar
          calendarInstance.addEvent({
            ...ev,
            start: new Date(ev.dueAt * 1000),
            allDay: true,
            extendedProps: {
              type: ev.type || 'assign',
              courseName: course?.name || 'Unknown Course'
            }
          });
        }
      });

      // add study blocks (always show all study blocks for now, or filter by course if needed)
      studyBlocks.forEach(sb => {
        const startDate = new Date(sb.start_time);
        const endDate = sb.end_time ? new Date(sb.end_time) : null;

        calendarInstance.addEvent({
          id: sb.id,
          title: sb.title,
          start: startDate.toISOString(),
          end: endDate ? endDate.toISOString() : null,
          allDay: false,
          color: sb.color || '#4F46E5',
          extendedProps: {
            type: 'study_block',
            assignmentId: sb.moodle_assignment_id,
            description: sb.description
          }
        });
      });
    })
  });
})();
// add more here for user stories related to the dashboard, like the calendar, mini action task items, etc. create branches for them, so we can do the code reviews and eventually merge all.
// remember, this is just beginner demo stuff, once we move on to using the actual endpoints, the js will operate differently
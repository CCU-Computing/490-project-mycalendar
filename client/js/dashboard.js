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

    // array to hold all events and courses
    let allEvents = [];
    let allCourses = [];
    let allColors = [];
    
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

        // iterate over every event and convert the date
        return allEvents.map(ev => ({
          ...ev,
          start: new Date(ev.dueAt * 1000),
          allDay: true,
          color: allColors[ev.courseId] || "#170ce9",
          extendedProps: {
            type: ev.type,
            description: ev.title
          }
        }));
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

    // get course colors for events
    async function getColors() {
      // get colors
      const { prefs } = await api.colors();
      
      // update all colors
      allColors = prefs.calendar.courseColors;
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
    document.getElementById("filterByCourseSelect").addEventListener("change", () => {

      // get calendar instance
      const calendarInstance = calendar.getInstance();

      // get the dropdown value
      const filterByCourseSelectValue = filterByCourseSelect.value;

      // remove all events from calendar
      calendarInstance.removeAllEvents();

      // iterate through all events
      allEvents.forEach(ev => {

        // determine if current event matches the filter or if all courses is selected
        if (ev.courseId == Number(filterByCourseSelectValue) || filterByCourseSelectValue == "allCourses") {

          // add event to calendar
          calendarInstance.addEvent({
            ...ev,
            start: new Date(ev.dueAt * 1000),
            allDay: true,
            color: allColors[ev.courseId] || "#170ce9"
          });
        }
      });
    })
  });
})();
// add more here for user stories related to the dashboard, like the calendar, mini action task items, etc. create branches for them, so we can do the code reviews and eventually merge all.
// remember, this is just beginner demo stuff, once we move on to using the actual endpoints, the js will operate differently
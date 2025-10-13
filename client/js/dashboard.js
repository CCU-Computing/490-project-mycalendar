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

    // array to hold events, courses, and assignment types
    let allEvents = [];
    let allCourses = [];
    let assignmentTypes = [];

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

      // get course toggles container
      const courseToggles = document.getElementById("courseToggles");

      // iterate through all courses
      allCourses.forEach(course => {

        // add each course to the container
        courseToggles.insertAdjacentHTML('beforeend',
          `
            <label class="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 transition rounded-lg select-none">
              <span class="pr-2">
                <input type="checkbox" id="${course.id}" class="peer sr-only" checked />
                <span class="[&_path]:fill-none [&_path]:stroke-current
                  peer-checked:[&_path]:fill-current">
                  <svg viewBox="0 0 24 24" class="size-5 text-slate-900" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 16.5v-9Z" />
                  </svg>
                </span>
              </span>
              <span class="truncate">${course.name}</span>
            </label>
          `
        )
      });

      // get assignment type toggles container
      const assignmentTypeToggles = document.getElementById("assignmentTypeToggles");

      // iterate through all events
      allEvents.forEach(ev => {

        // determine if event id is valid
        if (!ev.type) return;

        // determine if type already exists in array
        if (!assignmentTypes.includes(ev.type)) assignmentTypes.push(ev.type);
      })

      // iterate through each assignment type
      assignmentTypes.forEach(type => {

        // add each course to the container
        assignmentTypeToggles.insertAdjacentHTML('beforeend',
          `
            <label class="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 transition rounded-lg select-none">
              <span class="pr-2">
                <input type="checkbox" id="${type}" class="peer sr-only" checked />
                <span class="[&_path]:fill-none [&_path]:stroke-current
                  peer-checked:[&_path]:fill-current">
                  <svg viewBox="0 0 24 24" class="size-5 text-slate-900" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 16.5v-9Z" />
                  </svg>
                </span>
              </span>
              <span class="truncate">${type[0].toUpperCase() + type.slice(1)}</span>
            </label>
          `
        )
      })
    }

    // event listener for course toggle checkbox(es)
    document.getElementById("courseToggles").addEventListener("change", async(e) => {

      // get calendar instance
      const calendarInstance = calendar.getInstance();

      // determine if checkbox is checked
      if (!e.target.checked) {

        // get all calendar events
        const calendarEvents = calendarInstance.getEvents();

        // iterate through all calendar events
        calendarEvents.forEach(ev => {

          // determine if the current calendar event shares the same course id as the checkbox which has been unchecked
          if (ev.extendedProps.courseId === Number(e.target.id)) {

            // remove event from the calendar
            ev.remove();
          }
        })
      } else {

        // iterate through all events array
        allEvents.forEach(ev => {

          // determine if event matches the id in the checkbox which was checked
          if (ev.courseId === Number(e.target.id)) {

            // find the course name for this event
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
        })
      }

      /* will come back to fix this once the assignment type/course filtering is working properly.

      // get study blocks
      let studyBlocks = [];
      try {
        const { events: studyBlockEvents } = await api.studyBlocks.getAll();
        studyBlocks = studyBlockEvents || [];
      } catch (e) {
        console.error('Error loading study blocks for filter:', e);
      }

      console.log(studyBlocks)

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

      */
    })

    // event listener for assignment type toggle checkbox(es)
    document.getElementById("assignmentTypeToggles").addEventListener("change", async(e) => {

      // get calendar instance
      const calendarInstance = calendar.getInstance();

      // determine if checkbox is checked
      if (!e.target.checked) {

        // get all calendar events
        const calendarEvents = calendarInstance.getEvents();

        // iterate through all calendar events
        calendarEvents.forEach(ev => {

          // determine if event assignment type id matches the checkbox id type
          if (ev.extendedProps.type === e.target.id) {

            // remove event from the calendar
            ev.remove();
          }
        })
      } else {

        // iterate through all events array
        allEvents.forEach(ev => {

          // determine if event matches the id in the checkbox which was checked
          if (ev.type === e.target.id) {

            // find the course name for this event
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
        })
      }
    })

    // event listener for refreshing calendar
    document.getElementById("refreshCalendar").addEventListener("click", () => {

      // get course and assignment type toggles element
      const courseToggles = document.getElementById("courseToggles");
      const assignmentTypeToggles = document.getElementById("assignmentTypeToggles");

      // reset data and hide the elements
      courseToggles.innerHTML = '';
      courseToggles.classList.add("hidden");
      assignmentTypeToggles.innerHTML = '';
      assignmentTypeToggles.classList.add("hidden");

      // reload calendar
      calendar.reload();
    });

    // event listener for filter by course(s) toggle 
    document.getElementById("filterByCoursesToggle").addEventListener("click", () => {

      // get course toggles element
      const courseToggles = document.getElementById("courseToggles");

      // determine if dropdown is already open
      if (!courseToggles.classList.contains("hidden")) {

        // hide course toggles element and return
        courseToggles.classList.add("hidden");
        return;
      }

      // unhide course toggles element
      courseToggles.classList.remove("hidden");
    });

    // event listener for filter by assignment type
    document.getElementById("filterByAssignmentTypeToggle").addEventListener("click", () => {

      // get assignment type toggles element
      const assignmentTypeToggles = document.getElementById("assignmentTypeToggles");

      // determine if dropdown is already open
      if (!assignmentTypeToggles.classList.contains("hidden")) {

        // hide assignment type toggles element and return
        assignmentTypeToggles.classList.add("hidden");
        return;
      }

      // unhide assignment type toggles element
      assignmentTypeToggles.classList.remove("hidden");
    });
  });
})();
// add more here for user stories related to the dashboard, like the calendar, mini action task items, etc. create branches for them, so we can do the code reviews and eventually merge all.
// remember, this is just beginner demo stuff, once we move on to using the actual endpoints, the js will operate differently
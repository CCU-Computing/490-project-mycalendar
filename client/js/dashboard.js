import { mountClassList } from "../components/ClassList.js";
import { mountCalendar } from "../components/Calendar.js";
import { mountUpcomingAssignments } from "../components/UpcomingAssignments.js";
import { api } from "./apiClient.js";
import ToastNotification from "../components/ToastNotification.js";
import { openPersonalEventModal } from "../components/PersonalEventModal.js";

(function () {

  // get document elements
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");
  const calendarContainer = document.getElementById("calendar");
  const calendarRefreshBtn = document.getElementById("calendarRefreshBtn");
  const calendarAddEventBtn = document.getElementById("calendarAddEventBtn"); // <- functionality needs to be added
  const courseToggles = document.getElementById("courseToggles");
  const assignmentTypeToggles = document.getElementById("assignmentTypeToggles");
  const filterByCoursesToggle = document.getElementById("filterByCoursesToggle");
  const filterByAssignmentTypeToggle = document.getElementById("filterByAssignmentTypeToggle");

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
    mountUpcomingAssignments({ containerId: "upcomingAssignments" });

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

        // get study blocks and personal events from custom events
        let studyBlocks = [];
        let personalEvents = [];
        try {
          const { events: allCustomEvents } = await api.studyBlocks.getAll();

          // Separate study blocks from personal events
          const studyBlockEvents = (allCustomEvents || []).filter(ev => ev.event_type === 'study_block');
          const personalEventsList = (allCustomEvents || []).filter(ev => ev.event_type === 'personal');

          // Map study blocks
          studyBlocks = studyBlockEvents.map(sb => {
            const startDate = new Date(sb.start_time);
            const endDate = sb.end_time ? new Date(sb.end_time) : null;

            // For study blocks: border = custom color, background = "custom" type color
            const borderColor = sb.color || '#4F46E5';
            const baseCustomTypeColor = typeColors['custom'] || '#8b5cf6';
            const backgroundColor = baseCustomTypeColor + '66';

            return {
              id: `study-${sb.id}`,
              title: sb.title,
              start: startDate.toISOString(),
              end: endDate ? endDate.toISOString() : null,
              allDay: sb.all_day === 1,
              backgroundColor: backgroundColor,
              borderColor: borderColor,
              extendedProps: {
                type: 'study_block',
                assignmentId: sb.moodle_assignment_id,
                description: sb.description,
                eventId: sb.id,  // Real numeric ID for backend operations
                color: sb.color
              }
            };
          });

          // Map personal events
          personalEvents = personalEventsList.map(pe => {
            const startDate = new Date(pe.start_time);
            const endDate = pe.end_time ? new Date(pe.end_time) : null;

            // For personal events: both border and background use custom color
            const borderColor = pe.color || '#10b981';
            const backgroundColor = (pe.color || '#10b981') + '66';

            return {
              id: `personal-${pe.id}`,
              title: pe.title,
              start: startDate.toISOString(),
              end: endDate ? endDate.toISOString() : null,
              allDay: pe.all_day === 1,
              backgroundColor: backgroundColor,
              borderColor: borderColor,
              extendedProps: {
                type: 'personal',
                description: pe.description,
                eventId: pe.id,  // Real numeric ID for backend operations
                color: pe.color
              }
            };
          });
        } catch (e) {
          console.error('Error loading custom events:', e);
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
              courseId: ev.courseId,
              gradeFormatted: ev.gradeFormatted ?? null,
              gradeMax: ev.gradeMax ?? null,
              gradePercent: ev.gradePercent ?? null,
              instructorComments: ev.instructorComments ?? null
            }
          };
        });

        // combine moodle events, study blocks, and personal events
        return [...moodleEvents, ...studyBlocks, ...personalEvents];
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

      // get events with cache-while-revalidate pattern
      // returns cached data immediately, fetches fresh in background
      const { events } = await api.calendar({
        onFresh: (freshData) => {
          // Handle fresh data updates
          if (freshData.events && calendar) {
            console.log('[Dashboard] Fresh calendar data received, updating...');
            // Update the allEvents variable
            allEvents = freshData.events;
            // Refresh calendar if it's already mounted
            if (typeof calendar.refetchEvents === 'function') {
              calendar.refetchEvents();
            }
          }
        }
      });

      // update all events
      allEvents = events;

      // get assignment type toggles container
      const assignmentTypeTogglesContainer = document.getElementById("assignmentTypeToggles");

      // iterate through all events
      allEvents.forEach(ev => {

        // determine if event id is valid
        if (!ev.type) return;

        // determine if type already exists in array
        if (!assignmentTypes.includes(ev.type)) assignmentTypes.push(ev.type);
      })

      // iterate through each assignment type
      assignmentTypes.forEach(type => {

        // update type name if needed (i.e. assign -> assignment) <- better name in client
        let assignmentTypeName = type;

        if (assignmentTypeName === "assign") assignmentTypeName = "assignment"

        // add each assignment type to the container
        assignmentTypeTogglesContainer.insertAdjacentHTML('beforeend',
          `
            <label class="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition rounded-lg select-none cursor-pointer">
              <span class="pr-2">
                <input type="checkbox" id="${type}" class="peer sr-only" checked />
                <span class="[&_path]:fill-none [&_path]:stroke-current
                  peer-checked:[&_path]:fill-current">
                  <svg viewBox="0 0 24 24" class="size-5 text-slate-900 dark:text-slate-200" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 16.5v-9Z" />
                  </svg>
                </span>
              </span>
              <span class="truncate">${assignmentTypeName[0].toUpperCase() + assignmentTypeName.slice(1)}</span>
            </label>
          `
        )
      })
    }

    // get courses function
    async function getCourses() {

      // get courses
      const { courses } = await api.courses();

      // update all courses
      allCourses = courses;

      // iterate through all courses
      allCourses.forEach(course => {

        // add each course to the container
        courseToggles.insertAdjacentHTML('beforeend',
          `
            <label class="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition rounded-lg select-none cursor-pointer">
              <span class="pr-2">
                <input type="checkbox" id="${course.id}" class="peer sr-only" checked />
                <span class="[&_path]:fill-none [&_path]:stroke-current
                  peer-checked:[&_path]:fill-current">
                  <svg viewBox="0 0 24 24" class="size-5 text-slate-900 dark:text-slate-200" aria-hidden="true">
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
    }

    // event listener for course toggle checkbox(es)
    courseToggles.addEventListener("change", async(e) => {

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

            // Get colors: border = course color, background = type color
            const borderColor = courseColors[ev.courseId] || '#6366f1';
            const baseTypeColor = typeColors[ev.type] || '#8b5cf6';
            const backgroundColor = baseTypeColor + '66';

            // add event to calendar
            calendarInstance.addEvent({
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
    assignmentTypeToggles.addEventListener("change", async(e) => {

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

            // Get colors: border = course color, background = type color
            const borderColor = courseColors[ev.courseId] || '#6366f1';
            const baseTypeColor = typeColors[ev.type] || '#8b5cf6';
            const backgroundColor = baseTypeColor + '66';

            // add event to calendar
            calendarInstance.addEvent({
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
            });
          }
        })
      }
    })

    // event listener for refreshing calendar
    calendarRefreshBtn.addEventListener("click", async() => {

      // get calendar instance
      const calendarInstance = calendar.getInstance();

      // remove all data from calendar <- may need to be corrected
      calendarInstance.removeAllEvents();

      // save previous inner html
      const courseTogglesPreviousInnerHTML = courseToggles.innerHTML;
      const assignmentTypeTogglesPreviousInnerHTML = assignmentTypeToggles.innerHTML;

      // try/catch for calendar reload
      try {

        // reset data and hide the elements
        courseToggles.innerHTML = '';
        courseToggles.classList.add("hidden");
        assignmentTypeToggles.innerHTML = '';
        assignmentTypeToggles.classList.add("hidden");

        // reload the calendar
        await calendar.reload();

        // show calendar refresh success toast notification
        ToastNotification("Calendar successfully refreshed", "success");
      } catch (error) {

        // restore inner html
        courseToggles.innerHTML = courseTogglesPreviousInnerHTML;
        assignmentTypeToggles.innerHTML = assignmentTypeTogglesPreviousInnerHTML;
        courseToggles.classList.remove("hidden");
        assignmentTypeToggles.classList.remove("hidden");

        // show calendar refresh success toast notification
        ToastNotification("An error has occurred", "error");
      }
    });

    // event listener for adding calendar event
    calendarAddEventBtn.addEventListener("click", () => {
      openPersonalEventModal({
        onSave: async (newEvent) => {
          // Reload calendar to show new personal event
          await calendar.reload();
          ToastNotification("Personal event added successfully", "success");
        }
      });
    });


    // event listener for filter by course(s) toggle 
    filterByCoursesToggle.addEventListener("click", () => {

      // determine if at least one course exists
      if (allCourses.length === 0) {
        return;
      }

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
    filterByAssignmentTypeToggle.addEventListener("click", () => {

      // determine if at least one assignment type exists
      if (assignmentTypes.length === 0) {
        return;
      }

      // determine if dropdown is already open
      if (!assignmentTypeToggles.classList.contains("hidden")) {

        // hide assignment type toggles element and return
        assignmentTypeToggles.classList.add("hidden");
        return;
      }

      // unhide assignment type toggles element
      assignmentTypeToggles.classList.remove("hidden");
    });

    // function for adding loading states
    function addLoadingStates() {

      // add loading states
      calendarContainer.classList.add("animate-pulse", "cursor-progress");
      calendarRefreshBtn.classList.add("animate-pulse", "cursor-progress");
      calendarAddEventBtn.classList.add("animate-pulse", "cursor-progress");

      filterByAssignmentTypeToggle.classList.add("animate-pulse", "cursor-progress");
      filterByCoursesToggle.classList.add("animate-pulse", "cursor-progress");

      // disable buttons
      calendarRefreshBtn.disabled = true;
      calendarAddEventBtn.disabled = true;

      filterByAssignmentTypeToggle.disabled = true;
      filterByCoursesToggle.disabled = true;
    }

    // function for removing loading states
    function removeLoadingStates() {

      // remove loading states
      calendarContainer.classList.remove("animate-pulse", "cursor-progress");
      calendarRefreshBtn.classList.remove("animate-pulse", "cursor-progress");
      calendarAddEventBtn.classList.remove("animate-pulse", "cursor-progress");

      filterByAssignmentTypeToggle.classList.remove("animate-pulse", "cursor-progress");
      filterByCoursesToggle.classList.remove("animate-pulse", "cursor-progress");

      // enable buttons
      calendarRefreshBtn.disabled = false;
      calendarAddEventBtn.disabled = false;

      filterByAssignmentTypeToggle.disabled = false;
      filterByCoursesToggle.disabled = false;
    }
  });
})();
// add more here for user stories related to the dashboard, like the calendar, mini action task items, etc. create branches for them, so we can do the code reviews and eventually merge all.
// remember, this is just beginner demo stuff, once we move on to using the actual endpoints, the js will operate differently
import { api } from "../js/apiClient.js";
import { courseColorPickers } from "../components/ColorisColorPicker.js";
import { modifyCourseIMG } from "./CourseImgCustomizer.js";

// get document elements
const semesterClasses = document.getElementById("semesterClasses");

function $(id) { return document.getElementById(id); }

function ensureModalDOM() {
  if ($("classModal")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="classModal" class="fixed inset-0 z-50 hidden">
      <div id="modalBackdrop" class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="relative flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-neutral-900 shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-neutral-600 px-6 py-4">
            <h3 id="mTitle" class="text-lg font-semibold text-slate-900">Course Details</h3>
            <button id="mClose" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-600">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="px-6 py-6">
            <div class="flex items-start gap-4">
              <img id="mImg" src="" alt="Course image" class="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 bg-slate-100">
              <div class="flex-1 min-w-0">
                <div class="grid grid-rows-2 gap-4 text-sm">
                  <div>
                    <span class="font-medium text-slate-900">Category:</span>
                    <span id="mColorPicker" class="ml-2 text-slate-600">—</span>
                  </div>
                  <div>
                    <span class="font-medium text-slate-900">Category:</span>
                    <span id="mImgURL" class="ml-2 text-slate-600">—</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);
}

export function mountClassCustomizer({ containerId = "semesterClasses" } = {}) {
    ensureModalDOM();

    const container = $(containerId);
    if (!container) return { reload: () => {} };

    let courseList = [];
    let courseColors = {};
    let courseMetadata = {};

    // Modal refs (now guaranteed to exist)
    const modal = $("classModal");
    const mBackdrop = $("modalBackdrop");
    const mClose = $("mClose");
    const mTitle = $("mTitle");
    const mImg = $("mImg");
    const mColorPicker = $("mColorPicker");
    const mImgURL = $("mImgURL");


    function openModal(course) {
      if (!modal) return;
      let mCard = $(course.id);
      let mCardImg = mCard.querySelector("img");
      mTitle.textContent = course.fullname || course.fullnamedisplay || course.name || course.shortname || "Course";
      // Use custom image URL if available, otherwise fall back to Moodle image
      const metadata = courseMetadata[String(course.id)];
      mImg.src = (metadata && metadata.custom_image_url) || course.image || course.courseimage || "";
      mImg.alt = course.shortname || "Course image";
      const color = courseColors[String(course.id)] || "";
      mColorPicker.innerHTML = "";
      mColorPicker.appendChild(courseColorPickers(mCard, course.id, color));
      mColorPicker.addEventListener('change', e => {
        courseColors[String(course.id)] = e.target.value;
      });
      const imgURL = courseMetadata[course.id]?.custom_image_url || null;
      mImgURL.innerHTML = "";
      mImgURL.appendChild(modifyCourseIMG(mCardImg, mImg, course.id, imgURL, (course.image || course.courseimage || "")));
      mImgURL.addEventListener('change', e => {
        courseMetadata[course.id].custom_image_url = e.target.value;
      });
      modal.classList.remove("hidden");
    }
    function closeModal() { modal?.classList.add("hidden"); }
    mBackdrop?.addEventListener("click", closeModal);
    mClose?.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    function renderCourses() {
        if (courseList.length === 0) {
        container.innerHTML = `
            <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-4 text-sm text-slate-500">
            No classes found. Please check your enrollment or try refreshing.
            </div>`;
        return;
        }
        container.innerHTML = "";
        courseList.forEach(function (c) {
        const color = courseColors[String(c.id)] || "";
        const card = document.createElement("button");
        card.type = "button";
        card.id = c.id;
        card.className = [
            "group relative flex items-center gap-3 rounded-xl border-3 border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-3 text-left shadow-sm",
            "hover:shadow-md dark:shadow-neutral-200 hover:border-slate-400 dark:hover:border-neutral-500 transition",
            "cursor-pointer"
        ].join(" ");
        if (color) {
            card.style.borderColor = color;
            card.style.borderWidth = "3px";
        }
        const img = document.createElement("img");
        // Use custom image URL if available, otherwise fall back to Moodle image
        const metadata = courseMetadata[String(c.id)];
        img.src = (metadata && metadata.custom_image_url) || c.image || "";
        img.alt = c.shortname || "Course image";
        img.className = "h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200 bg-slate-100";
        const content = document.createElement("div");
        content.className = "min-w-0 flex-1";
        const title = document.createElement("div");
        title.className = "truncate text-sm font-semibold";
        title.textContent = c.name || "Course";

        content.appendChild(title);
        card.appendChild(img);
        card.appendChild(content);
        card.addEventListener("click", function () { openModal(c); });
        container.appendChild(card);
    });
  }

async function reload() {
  try {
      // add loading state classes
      addLoadingStates()

      const [coursesRes, prefsRes, metadataRes] = await Promise.allSettled([
          api.courses(),
          api.prefs.get(),
          api.courseMetadata.getAll()
      ]);
      const coursesData = coursesRes.status === "fulfilled" ? coursesRes.value : null;
      const prefsData = prefsRes.status === "fulfilled" ? prefsRes.value : null;
      const metadataData = metadataRes.status === "fulfilled" ? metadataRes.value : null;

      courseColors = (prefsData && prefsData.prefs && prefsData.prefs.calendar && prefsData.prefs.calendar.courseColors) || {};

      if (coursesData && coursesData.courses) {
          courseList = coursesData.courses;
      }
      // Build metadata map by course_id
      if (metadataData && metadataData.metadata) {
          courseMetadata = {};
          metadataData.metadata.forEach(meta => {
          courseMetadata[meta.course_id] = meta;
          });
      }

      // Example fallback: if empty, color the first course so storytellers can see it
      if (!courseColors || Object.keys(courseColors).length === 0) {
          if (courseList && courseList.length > 0) {
          const firstId = String(courseList[0].id);
          courseColors = { [firstId]: "#4F46E5" }; // Indigo sample
          }
      }
      renderCourses();
    } catch (e) {
        container.innerHTML = `
        <div class="rounded-xl border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-600">${e.message}</div>`;
    }

    // remove loading state classes
    removeLoadingStates()
  }

  reload();
  return { reload };
}

// function for adding loading states
function addLoadingStates() {

  // add loading states
  semesterClasses.classList.add("animate-pulse", "cursor-progress");
}

// function for removing loading states
function removeLoadingStates() {

  // remove loading states
  semesterClasses.classList.remove("animate-pulse", "cursor-progress");
}
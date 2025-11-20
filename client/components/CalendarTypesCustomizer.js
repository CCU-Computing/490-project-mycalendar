import { api } from "../js/apiClient.js";
import { typeColorPickers } from "../components/ColorisColorPicker.js";

function $(id) { return document.getElementById(id); }

export async function mountCalendarCustomizer({ containerId = "calendarTypes" } = {}) {
    // Get Different Types
    const types = {
    assign : 'Assignments',
    quiz : 'Quizzes',
    // custom : 'Custom Events'
    };

    const container = $(containerId);
    if (!container) return { gatherData: () => {} };

    // add loading state classes
    addLoadingStates();
    
    // API Calls
    const [{ prefs }] = await gatherData();

    // Get Colors 
    const typeColors = prefs.calendar.assignmentTypeColors;


    // Assign Color pickers
    Object.entries(types).map(([type, label]) => {
        // TYPE CARD LAYOUT  
        let typeCard = document.createElement("div");
        typeCard.id = "typeCard";
        typeCard.dataset.courseId = type;
        typeCard.className = `w-1/2 flex justify-between items-center rounded-xl border-[3px] bg-slate-50 dark:bg-neutral-800 p-4 text-sm`;

        let typeName = document.createElement("label");
        typeName.id = "courseName";
        typeName.innerHTML = label;
        typeName.className = "pr-2 text-sm text-slate-500 dark:text-slate-200 mt-1";

        let typeColor = typeColors[type] || "";
        typeCard.style.borderColor = typeColor;

        let colorInput = typeColorPickers(typeCard, type, typeColor);

        typeCard.appendChild(typeName);
        typeCard.appendChild(colorInput);
        container.appendChild(typeCard);
    });

    // remove loading states
    removeLoadingStates();

    return container;
}

// function for adding loading states
function addLoadingStates() {

    // add loading states
    settingsContainer.classList.add("animate-pulse", "cursor-progress");
}

// function for removing loading states
function removeLoadingStates() {

    // remove loading states
    settingsContainer.classList.remove("animate-pulse", "cursor-progress");
}


async function gatherData() {
    // API Calls
    try {
        const [{ prefs }] = await Promise.all([
            api.prefs.get()
        ]);

        return  [{ prefs }];
    } catch (error) {
        console.error(`Calendar Type API Failure: ${error}`);
    }
}
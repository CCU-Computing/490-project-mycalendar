import { api } from "../js/apiClient.js";
import { getUserTheme } from "../js/util/theme-tools.js";

// Set up Coloris with basic colors and theme
function setColoris() {
    // Get Theme for Coloris
    let userTheme = (getUserTheme() ? 'dark' : 'light'); 

    Coloris({
        alpha: false,
        themeMode: userTheme,
        swatches: [
            "#FF0000",
            "#FF9900",
            "#00FF00",
            "#0000FF",
            "#9900FF",
            "#FF00FF"
        ],
    });
}

export function courseColorPickers(mCard, courseId, courseColor) {
    // Get Course Color pickers
    setColoris();

    // NEW COLOR PICKER
    let colorInput = document.createElement("input");
    colorInput.id = "colorInput";
    colorInput.type = "text";
    colorInput.value = courseColor;
    colorInput.setAttribute("data-coloris", "")
    colorInput.className = "w-8 aspect-square rounded-full border-2 border-gray-300 dark:border-neutral-600 appearance-none cursor-pointer color-picker shrink-0";
    colorInput.style.color = "transparent";
    colorInput.style.textShadow = "none";
    colorInput.style.background = courseColor;

    colorInput.addEventListener("input", (e) => {
        mCard.style.borderColor = e.target.value;
        colorInput.style.background = e.target.value;
    });

    // Save when user is done picking
    colorInput.addEventListener("blur", async (e) => {
        const newColor = e.target.value;
        await api.prefs.setCourseColor(courseId, newColor)
    });

    return colorInput;
};


export function typeColorPickers(tCard, type, typeColor) {
    // Get Course Color pickers
    setColoris();

    // NEW COLOR PICKER
    let colorInput = document.createElement("input");
    colorInput.id = "colorInput";
    colorInput.type = "text";
    colorInput.value = typeColor;
    colorInput.setAttribute("data-coloris", "")
    colorInput.className = "w-8 aspect-square rounded-full border-2 border-gray-300 dark:border-neutral-600 appearance-none cursor-pointer color-picker shrink-0";
    colorInput.style.color = "transparent";
    colorInput.style.textShadow = "none";
    colorInput.style.background = typeColor;

    colorInput.addEventListener("input", (e) => {
        colorInput.style.background = e.target.value;
        tCard.style.borderColor = e.target.value;
    });

    // Save when user is done picking
    colorInput.addEventListener("blur", async (e) => {
        const newColor = e.target.value;
        await api.prefs.setAssignmentTypeColor(type, newColor)
    });

    return colorInput;
};
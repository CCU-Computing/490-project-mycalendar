import { getUserTheme } from "../js/util/theme-tools.js"

// Set Light/Dark Mode for website
(function () {
    try {
        // Get the HTML Element (Like a data-... to get Dark)
        const ROOT = document.documentElement;


        // Get IDs
        let lightSwitch = document.getElementById('lightSwitch');
        let lightIcon = document.getElementById('light');
        let darkIcon = document.getElementById('dark');

        // Handle any null values from IDs
        if (!lightSwitch || !lightIcon || !darkIcon) throw "Missing IDs for Theme.";

        // Set Styling for Active/Inactive Mode
        const ACTIVE = "p-2 bg-white dark:bg-neutral-800 border bg-gray-300 dark:border-neutral-600 rounded-full";
        const INACTIVE = "p-2";
        
        // Set Switch based on boolean
        if (getUserTheme()) {
            darkIcon.className = ACTIVE;
            lightIcon.className = INACTIVE;
        } else {
            lightIcon.className = ACTIVE;
            darkIcon.className = INACTIVE;
        }

        // Manual toggle
        lightSwitch.addEventListener('click', () => {
            ROOT.classList.toggle('dark');
            localStorage.setItem(
                'theme',
                ROOT.classList.contains('dark') ? 'dark' : 'light'
            );

            // Update button styling
            if (ROOT.classList.contains('dark')) {
                darkIcon.className = ACTIVE;
                lightIcon.className = INACTIVE;
            } else {
                lightIcon.className = ACTIVE;
                darkIcon.className = INACTIVE;
            }
        });
    }
    catch (e) {
        console.error(e);
    };
})();
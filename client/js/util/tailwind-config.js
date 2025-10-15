// Config File for Tailwindcss
// Needed to create Dark Elements for Tailwind
(function(){
    window.tailwind = {
        config: {
        darkMode: 'class',
            theme:{
                extend: {},
            },
        },
    };

    // Get the HTML Element (Like a data-... to get Dark)
    const ROOT = document.documentElement;

    // Get Theme (From HTML data-... or User's Device Theme)
    let storedTheme = localStorage.getItem('theme');
    let userDefaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Check to see if there is a dark value (true), otherwise its light (false)
    let isDark = storedTheme === 'dark' || (!storedTheme && userDefaultTheme);

    // Handles flashes, prevents FOUC
    if (isDark) {
        ROOT.classList.add('dark');
    } else {
        ROOT.classList.remove('dark');
    }

})();
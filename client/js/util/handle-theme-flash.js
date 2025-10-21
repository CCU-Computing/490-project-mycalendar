// MUST HAPPEN WHEN NEW PAGE IS LOADED

(function() {
    // Get the HTML Element (Like a data-... to get Dark)
    const ROOT = document.documentElement;

    let storedTheme = localStorage.getItem('theme');
    let userDefaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Check to see if there is a dark value (true), otherwise its light (false)
    let isDark = storedTheme === 'dark' || (!storedTheme && userDefaultTheme);

    // Handles flashes, prevents FOUC (Flash of Unstyled Content)
    if (isDark) {
        ROOT.classList.add('dark');
    } else {
        ROOT.classList.remove('dark');
    }
})();
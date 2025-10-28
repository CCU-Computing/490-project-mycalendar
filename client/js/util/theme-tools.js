// Tools to help theme.js

// Get Theme (From HTML data-... or User's Device Theme)
export function getUserTheme() {
    let storedTheme = localStorage.getItem('theme');
    let userDefaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Check to see if there is a dark value (true), otherwise its light (false)
    let isDark = storedTheme === 'dark' || (!storedTheme && userDefaultTheme);

    return isDark;
}
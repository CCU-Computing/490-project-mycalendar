/**
 * Navigation Module
 * Handles dropdown interactions, mobile menu toggle, and active page highlighting
 */

function initializeNav() {
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuIcon = document.getElementById('menuIcon');
  const closeIcon = document.getElementById('closeIcon');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        menuIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
      } else {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
      }
    });

    // Close mobile menu when a link is clicked
    const mobileMenuLinks = mobileMenu.querySelectorAll('a');
    mobileMenuLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
      });
    });
  }

  // Highlight active nav item
  highlightActiveNavItem();
}

function getCurrentPagePath() {
  // Get the current page path from the URL
  let path = window.location.pathname;
  // Normalize the path (remove trailing slashes, etc.)
  path = path.replace(/\/$/, '') || '/';
  return path;
}

function highlightActiveNavItem() {
  const currentPath = getCurrentPagePath();
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    const href = item.getAttribute('href');
    const itemPath = href ? href.replace(/^\//, '') : '';
    const normalizedCurrentPath = currentPath.replace(/^\//, '');

    // Check if this is the current page
    if (itemPath && normalizedCurrentPath.includes(itemPath.replace(/\/.*/, '').split('.')[0])) {
      // Add active styling
      item.classList.add('bg-indigo-50', 'dark:bg-indigo-900/20', 'text-indigo-700', 'dark:text-indigo-300', 'font-semibold');
      item.classList.remove('hover:bg-slate-50', 'dark:hover:bg-neutral-700');
    }
  });
}

// Initialize nav when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNav);
} else {
  initializeNav();
}

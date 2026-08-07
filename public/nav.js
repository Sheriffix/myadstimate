// Nav JS
// Header and footer are now real, static HTML written directly into every
// page by pseo_generator.js / manual_generator.js at build time (see
// utils.js for the single source of truth: HEADER_HTML / FOOTER_HTML).
// This file no longer builds the header/footer in the browser — it only
// wires up the dark mode toggle, since that button now exists in the page
// from the start rather than being injected after the page loads.

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
});

// ========================================
// Theme Management
// ========================================

function initializeTheme() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return; // safety check in case a page has no toggle
  const themeIcon = themeToggle.querySelector(".theme-icon");
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Set initial theme
  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark-mode");
    themeIcon.textContent = "light_mode"; // Sun icon when dark mode is active
  } else {
    themeIcon.textContent = "dark_mode"; // Moon icon when light mode is active
  }

  // Toggle theme on click
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");

    // Update icon based on new theme
    themeIcon.textContent = isDark ? "light_mode" : "dark_mode";

    // Save preference
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

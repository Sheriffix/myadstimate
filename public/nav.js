// Nav JS
document.addEventListener("DOMContentLoaded", () => {
  // All shared/reusable HTML lives here as template strings
  const templates = {
    header: `
      <nav class="container header-content">
          <a id="logo" href="/">
            <div class="logo">
              <span>ad</span>stimate
            </div>
            <p class="tagline">Ad Revenue Estimation</p>
          </a>
          <a id="logo-image" href="/">
            <img src="/adstimate_logo.png" />
          </a>
          <a href="/adsense-rpm-matrix.html" class="navbar link matrix-tool">2026 Revenue Matrix</a>
          <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
              <!-- Default: show dark_mode icon (meaning "switch to dark") when in light mode -->
              <i class="material-icons theme-icon">dark_mode</i>
          </button>
      </nav>
    `,
    footer: `
      <div class="container">
        <nav class="main-nav">
          <ul class="nav-links">
            <li><a href="/index.html" class="nav-link">Home</a></li>
            <li><a href="/about.html" class="nav-link">About</a></li>
            <li><a href="/guide.html" class="nav-link">Calculator Guide</a></li>
            <li><a href="/blog" class="nav-link">Blogs</a></li>
            <li><a href="/terms.html" class="nav-link">Terms</a></li>
            <li><a href="/privacy.html" class="nav-link">Privacy</a></li>
            <li><a href="/contact.html" class="nav-link">Contact</a></li>
          </ul>
        </nav>
        <p class="disclaimer">
                  <strong>Disclaimer:</strong> For educational estimates only. Actual earnings may vary. Not affiliated
                  with Google.
        </p>
        <p class="copyright">&copy; Adstimate.com - All rights reserved.</p>
      </div>
    `,

    navlinks: `
      <ul class="nav-links">
        <li><a href="/" class="nav-link">Home</a></li>
        <li><a href="/guide.html" class="nav-link">Calculator Guide</a></li>
        <li><a href="/about.html" class="nav-link">About</a></li>
        <li><a href="/contact.html" class="nav-link">Contact</a></li>
      </ul>
    `,
  };

  // Insert the templates into the page
  document.getElementById("site-header").innerHTML = templates.header;
  document.getElementById("site-footer").innerHTML = templates.footer;
  // document.getElementById("nav-links").innerHTML = templates.navlinks;
});

// ========================================
// Theme Management
// ========================================

function initializeTheme() {
  const themeToggle = document.getElementById("themeToggle");
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

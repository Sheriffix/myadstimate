/**
 * Deep Link Handler for Main Calculator
 * Standalone file - doesn't modify existing script.js
 * Handles URL parameters from mini calculator widget
 *
 * Usage: Add this script to index.html BEFORE script.js:
 * <script src="/deeplink-handler.js"></script>
 * <script src="/script.js"></script>
 */

(function () {
  "use strict";

  // Wait for DOM and all scripts to be ready
  window.addEventListener("DOMContentLoaded", function () {
    // Give main calculator time to initialize (500ms delay)
    setTimeout(handleDeepLinking, 500);
  });

  function handleDeepLinking() {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const nicheParam = urlParams.get("niche");
    const countryParam = urlParams.get("country");
    const viewsParam = urlParams.get("views");

    // Check if any parameters are present
    if (!nicheParam && !countryParam && !viewsParam) {
      return; // No deep linking needed
    }

    console.log("🔗 Deep linking detected:", {
      niche: nicheParam,
      country: countryParam,
      views: viewsParam,
    });

    // Auto-populate pageviews if provided
    if (viewsParam) {
      const viewsInput = document.getElementById("pageviews");
      const viewsSlider = document.getElementById("pageviewsSlider");

      if (viewsInput) {
        const views = parseInt(viewsParam) || 100000;
        viewsInput.value = views;

        // Trigger input event to update state
        viewsInput.dispatchEvent(new Event("input", { bubbles: true }));

        // Update slider if it exists
        if (viewsSlider) {
          const logValue = Math.log10(views);
          viewsSlider.value = logValue;
        }
      }
    }

    // Auto-populate country if provided
    if (countryParam) {
      const countrySelect = document.getElementById("country");

      if (countrySelect) {
        const options = Array.from(countrySelect.options);
        const matchingOption = options.find(
          (opt) => opt.value.toUpperCase() === countryParam.toUpperCase(),
        );

        if (matchingOption) {
          countrySelect.value = matchingOption.value;

          // Trigger change event to update state
          countrySelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }

    // Auto-populate niche if provided
    if (nicheParam) {
      const nicheSelect = document.getElementById("niche");

      if (nicheSelect) {
        const options = Array.from(nicheSelect.options);

        // Try exact match first
        let matchingOption = options.find(
          (opt) => opt.value.toLowerCase() === nicheParam.toLowerCase(),
        );

        // If no exact match, try partial match
        if (!matchingOption) {
          matchingOption = options.find(
            (opt) =>
              opt.value.toLowerCase().includes(nicheParam.toLowerCase()) ||
              nicheParam.toLowerCase().includes(opt.value.toLowerCase()),
          );
        }

        if (matchingOption) {
          nicheSelect.value = matchingOption.value;

          // Trigger change event to update state
          nicheSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }

    // Ensure auto-calculate mode is active
    // Check if there's an RPM toggle button
    const autoToggleBtn = document.querySelector(
      '.rpm-toggle-btn[data-mode="auto"]',
    );
    if (autoToggleBtn && !autoToggleBtn.classList.contains("active")) {
      autoToggleBtn.click();
    }

    // Alternative: Check for single toggle button (your current setup)
    const rpmToggleBtn = document.querySelector(".rpm-toggle-btn");
    if (rpmToggleBtn && rpmToggleBtn.classList.contains("active")) {
      // It's in manual mode, click to switch to auto
      rpmToggleBtn.click();
    }

    // Wait a bit for all state updates, then scroll to results
    setTimeout(() => {
      const resultsPanel = document.querySelector(".results-panel");
      if (resultsPanel) {
        resultsPanel.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }

      console.log("✓ Calculator pre-filled from mini calculator");

      // Optional: Show a subtle notification
      showDeepLinkNotification();

      // Optional: Clean URL after applying parameters
      // cleanUrlParameters();
    }, 300);
  }

  function showDeepLinkNotification() {
    // Create a subtle notification
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #059669;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = "✓ Calculator pre-filled with your data";

    // Add animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideIn 0.3s ease-out reverse";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function cleanUrlParameters() {
    // Remove URL parameters while preserving history
    if (window.location.search) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }
})();

/* ========================================
   Adstimate - Ad Revenue Calculator
   Main JavaScript File - COMPLETE FIXED VERSION
   WITH QUARTER TOTAL DISPLAY + Q2 AUTO-SELECT
   ======================================== */

// ========================================
// Global State
// ========================================
const state = {
  rpmMode: "auto", // 'auto' or 'manual'
  pageviews: 100000,
  manualRpm: 15.0,
  country: "US",
  niche: "Lifestyle",
  mobilePercent: 60,
  qualityTier: 1, // 0=Basic, 1=Good, 2=Premium
  selectedQuarter: null, // null = no quarter selected
  seasonalityEnabled: false, // Seasonality toggle

  // Loaded datasets
  countryRpm: {},
  nicheMultiplier: {},
  deviceMultiplier: {},
  seasonality: {},
  adBenchmarks: {},
};

// Quality tier multipliers
const qualityMultipliers = {
  0: 0.6, // Basic/New
  1: 1.0, // Good/Established
  2: 1.7, // Premium/High Trust
};

// Quality descriptions
const qualityDescriptions = {
  0: "New site, social traffic, or heavy ads",
  1: "Most established sites",
  2: "Authority sites with high E-E-A-T",
};

// Preset configurations
const presets = {
  "us-finance": {
    country: "US",
    niche: "Finance",
    mobilePercent: 40,
    qualityTier: 1,
    pageviews: 50000,
  },
  "us-tech": {
    country: "US",
    niche: "Technology",
    mobilePercent: 55,
    qualityTier: 1,
    pageviews: 100000,
  },
  "eu-mixed": {
    country: "UK",
    niche: "Lifestyle",
    mobilePercent: 60,
    qualityTier: 1,
    pageviews: 75000,
  },
  "india-gaming": {
    country: "IN",
    niche: "Gaming",
    mobilePercent: 85,
    qualityTier: 0,
    pageviews: 200000,
  },
  "latam-app": {
    country: "BR",
    niche: "Mobile Apps",
    mobilePercent: 90,
    qualityTier: 0,
    pageviews: 150000,
  },
  "global-blog": {
    country: "US",
    niche: "Lifestyle",
    mobilePercent: 65,
    qualityTier: 0,
    pageviews: 30000,
  },
  "premium-site": {
    country: "US",
    niche: "Finance",
    mobilePercent: 35,
    qualityTier: 2,
    pageviews: 250000,
  },
  "social-traffic": {
    country: "IN",
    niche: "Entertainment",
    mobilePercent: 80,
    qualityTier: 0,
    pageviews: 80000,
  },
};

// ========================================
// Initialization
// ========================================
document.addEventListener("DOMContentLoaded", async () => {
  // Load all JSON datasets
  await loadDatasets();

  // Initialize theme
  initializeTheme();

  // Initialize all event listeners
  initializeEventListeners();

  // Set initial values and calculate
  initializeDefaultValues();

  // Perform initial calculation
  calculateAndUpdate();
});

// ========================================
// Load JSON Datasets
// ========================================
async function loadDatasets() {
  try {
    const [countryData, nicheData, deviceData, seasonData, benchmarkData] =
      await Promise.all([
        fetch("/data/country_rpm.json").then((r) => r.json()),
        fetch("/data/niche_multiplier.json").then((r) => r.json()),
        fetch("/data/device_multiplier.json").then((r) => r.json()),
        fetch("/data/seasonality.json").then((r) => r.json()),
        fetch("/data/ad_benchmarks.json").then((r) => r.json()),
      ]);

    state.countryRpm = countryData;
    state.nicheMultiplier = nicheData;
    state.deviceMultiplier = deviceData;
    state.seasonality = seasonData;
    state.adBenchmarks = benchmarkData;

    console.log("✓ All datasets loaded successfully");
  } catch (error) {
    console.error("Error loading datasets:", error);
    alert(
      "Error loading data files. Please ensure all JSON files are in the data/ folder.",
    );
  }
}

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
    themeIcon.textContent = "light_mode";
  } else {
    themeIcon.textContent = "dark_mode";
  }

  // Toggle theme on click
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeIcon.textContent = isDark ? "light_mode" : "dark_mode";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

// ========================================
// Initialize Default Values
// ========================================
function initializeDefaultValues() {
  // Set default pageviews
  document.getElementById("pageviews").value = state.pageviews;
  updatePageviewsSlider(state.pageviews);

  // Set default mobile percent
  document.getElementById("mobileSlider").value = state.mobilePercent;
  updateDeviceSplit();

  // Set default quality tier
  document.getElementById("qualitySlider").value = state.qualityTier;
  updateQualityDescription();

  // Set manual RPM
  document.getElementById("manualRpm").value = state.manualRpm.toFixed(2);

  // Set seasonality toggle to unchecked by default
  const seasonalityToggle = document.getElementById("seasonalityToggle");
  if (seasonalityToggle) {
    seasonalityToggle.checked = false;
    updateSeasonalityUI();
  }
}

// ========================================
// Event Listeners
// ========================================

function initializeEventListeners() {
  // RPM Mode Toggle - Single Button
  const rpmToggleBtn = document.querySelector(".rpm-toggle-btn");
  rpmToggleBtn.addEventListener("click", () => {
    // Toggle between modes
    if (state.rpmMode === "auto") {
      state.rpmMode = "manual";
      rpmToggleBtn.classList.add("active");
    } else {
      state.rpmMode = "auto";
      rpmToggleBtn.classList.remove("active");
    }

    toggleRpmInputs();
    calculateAndUpdate();
  });

  // Pageviews input
  document.getElementById("pageviews").addEventListener("input", (e) => {
    state.pageviews = parseInt(e.target.value) || 1000;
    updatePageviewsSlider(state.pageviews);
    calculateAndUpdate();
  });

  // Pageviews slider (logarithmic)
  document.getElementById("pageviewsSlider").addEventListener("input", (e) => {
    const logValue = parseFloat(e.target.value);
    state.pageviews = Math.round(Math.pow(10, logValue));
    document.getElementById("pageviews").value = state.pageviews;
    calculateAndUpdate();
  });

  // Manual RPM input
  document.getElementById("manualRpm").addEventListener("input", (e) => {
    state.manualRpm = parseFloat(e.target.value) || 0.01;
    calculateAndUpdate();
  });

  // Country selection
  document.getElementById("country").addEventListener("change", (e) => {
    state.country = e.target.value;
    calculateAndUpdate();
  });

  // Niche selection
  document.getElementById("niche").addEventListener("change", (e) => {
    state.niche = e.target.value;
    calculateAndUpdate();
  });

  // Mobile slider
  document.getElementById("mobileSlider").addEventListener("input", (e) => {
    state.mobilePercent = parseInt(e.target.value);
    updateDeviceSplit();
    calculateAndUpdate();
  });

  // Quality slider
  document.getElementById("qualitySlider").addEventListener("input", (e) => {
    state.qualityTier = parseInt(e.target.value);
    updateQualityDescription();
    calculateAndUpdate();
  });

  // Seasonality Toggle Checkbox - WITH Q2 AUTO-SELECT
  const seasonalityToggle = document.getElementById("seasonalityToggle");
  if (seasonalityToggle) {
    seasonalityToggle.addEventListener("change", (e) => {
      state.seasonalityEnabled = e.target.checked;

      if (state.seasonalityEnabled) {
        // AUTO-SELECT Q2 when turning ON
        state.selectedQuarter = "Q2";

        // Update UI to show Q2 as active
        document.querySelectorAll(".season-btn").forEach((btn) => {
          if (btn.dataset.quarter === "Q2") {
            btn.classList.add("active");
          } else {
            btn.classList.remove("active");
          }
        });
      } else {
        // Clear selection when turning OFF
        state.selectedQuarter = null;
        document.querySelectorAll(".season-btn").forEach((btn) => {
          btn.classList.remove("active");
        });
      }

      updateSeasonalityUI();
      calculateAndUpdate();
    });
  }

  // Season buttons
  const seasonBtns = document.querySelectorAll(".season-btn");
  seasonBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Only allow selection if seasonality is enabled
      if (!state.seasonalityEnabled) return;

      seasonBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedQuarter = btn.dataset.quarter;
      calculateAndUpdate();
    });
  });

  // Preset buttons
  const presetBtns = document.querySelectorAll(".preset-btn");
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // Share buttons
  document
    .getElementById("shareTwitter")
    .addEventListener("click", shareOnTwitter);
  document
    .getElementById("shareEmail")
    .addEventListener("click", shareViaEmail);
}

// ========================================
// Update Seasonality UI State
// ========================================
function updateSeasonalityUI() {
  const seasonButtons = document.getElementById("seasonButtons");
  const seasonBtns = document.querySelectorAll(".season-btn");

  if (seasonButtons && seasonBtns.length > 0) {
    if (state.seasonalityEnabled) {
      seasonButtons.style.opacity = "1";
      seasonButtons.style.pointerEvents = "auto";
      seasonBtns.forEach((btn) => (btn.style.cursor = "pointer"));
    } else {
      seasonButtons.style.opacity = "0.5";
      seasonButtons.style.pointerEvents = "none";
      seasonBtns.forEach((btn) => (btn.style.cursor = "not-allowed"));
    }
  }
}

// ========================================
// Toggle RPM Inputs
// ========================================
function toggleRpmInputs() {
  const manualRpmGroup = document.getElementById("manualRpmGroup");
  const autoCalculateInputs = document.getElementById("autoCalculateInputs");

  if (state.rpmMode === "manual") {
    // Hide auto inputs first
    autoCalculateInputs.classList.remove("visible");

    // Show manual inputs after auto inputs fade out
    setTimeout(() => {
      autoCalculateInputs.style.display = "none";
      manualRpmGroup.style.display = "block";
      // Trigger reflow to ensure the display change is applied
      manualRpmGroup.offsetHeight;
      manualRpmGroup.classList.add("visible");
    }, 400);
  } else {
    // Hide manual inputs first
    manualRpmGroup.classList.remove("visible");

    // Show auto inputs after manual inputs fade out
    setTimeout(() => {
      manualRpmGroup.style.display = "none";
      autoCalculateInputs.style.display = "block";
      // Trigger reflow
      autoCalculateInputs.offsetHeight;
      autoCalculateInputs.classList.add("visible");
    }, 400);
  }
}

// ========================================
// Update Pageviews Slider (Logarithmic)
// ========================================
function updatePageviewsSlider(pageviews) {
  const slider = document.getElementById("pageviewsSlider");
  const logValue = Math.log10(pageviews);
  slider.value = logValue;
}

// ========================================
// Update Device Split Display
// ========================================
function updateDeviceSplit() {
  const desktopPercent = 100 - state.mobilePercent;
  document.getElementById("mobilePercent").textContent = state.mobilePercent;
  document.getElementById("desktopPercent").textContent = desktopPercent;
}

// ========================================
// Update Quality Description
// ========================================
function updateQualityDescription() {
  document.getElementById("qualityDescription").textContent =
    qualityDescriptions[state.qualityTier];
}

// ========================================
// Apply Preset Configuration
// ========================================
function applyPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  // Update state
  state.country = preset.country;
  state.niche = preset.niche;
  state.mobilePercent = preset.mobilePercent;
  state.qualityTier = preset.qualityTier;
  state.pageviews = preset.pageviews;

  // Update UI
  document.getElementById("country").value = preset.country;
  document.getElementById("niche").value = preset.niche;
  document.getElementById("mobileSlider").value = preset.mobilePercent;
  document.getElementById("qualitySlider").value = preset.qualityTier;
  document.getElementById("pageviews").value = preset.pageviews;

  updatePageviewsSlider(preset.pageviews);
  updateDeviceSplit();
  updateQualityDescription();

  // Switch to auto-calculate mode if not already
  if (state.rpmMode !== "auto") {
    state.rpmMode = "auto";
    document.querySelectorAll(".rpm-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === "auto");
    });
    toggleRpmInputs();
  }

  // Calculate
  calculateAndUpdate();
}

// ========================================
// Calculate Normalized Seasonality Weights
// ========================================
function getNormalizedSeasonalityWeights() {
  // Sum all multipliers to get the total
  const total = Object.values(state.seasonality).reduce(
    (sum, quarter) => sum + quarter.multiplier,
    0,
  );

  // Calculate normalized weight for each quarter
  const weights = {};
  for (const [quarter, data] of Object.entries(state.seasonality)) {
    weights[quarter] = data.multiplier / total;
  }

  return weights;
}

// ========================================
// Main Calculator Logic - FIXED
// ========================================
function calculateAndUpdate() {
  // Step 1: Calculate base RPM WITHOUT seasonality
  let baseRpm;

  if (state.rpmMode === "manual") {
    baseRpm = state.manualRpm;
  } else {
    baseRpm = calculateAutoRpm();
  }

  // Step 2: Calculate BASE annual revenue (no seasonality applied)
  const monthlyRevenue = (state.pageviews / 1000) * baseRpm;
  const annualRevenue = monthlyRevenue * 12;

  // Step 3: Determine what to display based on seasonality state
  let displayValue = monthlyRevenue; // Default: monthly average
  let displayLabel = "monthly"; // Default label
  let displayAnnual = annualRevenue;
  let displayContext = {
    isSeasonalView: false,
    quarterName: null,
    quarterTotal: null,
    monthlyInQuarter: null,
  };

  if (state.seasonalityEnabled && state.selectedQuarter) {
    // Seasonality is ON and a quarter is selected
    const weights = getNormalizedSeasonalityWeights();
    const quarterRevenue = annualRevenue * weights[state.selectedQuarter];
    const monthlyInQuarter = quarterRevenue / 3;

    // CHANGE: Display quarter TOTAL (not monthly average)
    displayValue = quarterRevenue; // Show full quarter amount
    displayLabel = `${state.selectedQuarter} Total`; // Show "Q2 Total" etc
    displayAnnual = annualRevenue; // Annual stays the same

    displayContext = {
      isSeasonalView: true,
      quarterName: state.selectedQuarter,
      quarterTotal: quarterRevenue,
      monthlyInQuarter: monthlyInQuarter,
    };
  }

  // Step 4: Calculate scenarios based on display value
  const conservative = displayValue * 0.7;
  const average = displayValue * 1.0;
  const optimistic = displayValue * 1.5;

  // Step 5: Update UI with context
  updateResults(
    baseRpm,
    conservative,
    average,
    optimistic,
    displayAnnual,
    displayContext,
    displayLabel,
  );

  // Step 6: Update dynamic tips
  updateDynamicTips();
}

// ========================================
// Calculate Auto RPM - FIXED (NO SEASONALITY)
// ========================================
function calculateAutoRpm() {
  // Get base country RPM
  let baseRpm = state.countryRpm[state.country];

  // Handle "OTHER" country
  if (state.country === "OTHER" || !baseRpm) {
    baseRpm = 8.0; // Default mid-tier RPM
  }

  // Get niche multiplier
  const nicheMultiplier = state.nicheMultiplier[state.niche] || 1.0;

  // Calculate device multiplier (weighted average)
  const mobileMultiplier = state.deviceMultiplier.mobile;
  const desktopMultiplier = state.deviceMultiplier.desktop;
  const mobileWeight = state.mobilePercent / 100;
  const desktopWeight = (100 - state.mobilePercent) / 100;
  const deviceMultiplier =
    mobileWeight * mobileMultiplier + desktopWeight * desktopMultiplier;

  // Get quality tier multiplier
  const qualityMultiplier = qualityMultipliers[state.qualityTier];

  // Calculate final RPM WITHOUT seasonality
  const finalRpm =
    baseRpm * nicheMultiplier * deviceMultiplier * qualityMultiplier;

  return finalRpm;
}

// ========================================
// Update Results Display - FIXED WITH SUBLABEL UPDATE
// ========================================
function updateResults(
  rpm,
  conservative,
  average,
  optimistic,
  annualRevenue,
  context,
  displayLabel,
) {
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatRpm = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Update RPM display
  document.getElementById("calculatedRpm").textContent = formatRpm(rpm);

  // Update context box (if element exists)
  const seasonalContextEl = document.getElementById("seasonalContext");
  if (seasonalContextEl) {
    if (context.isSeasonalView) {
      seasonalContextEl.innerHTML = `
        <div class="seasonal-context-box">
          <strong>${context.quarterName} Breakdown:</strong> 
          Quarter Total: ${formatCurrency(context.quarterTotal)} 
          (${formatCurrency(context.monthlyInQuarter)}/month avg in quarter)
        </div>
      `;
      seasonalContextEl.style.display = "block";
    } else {
      seasonalContextEl.style.display = "none";
    }
  }

  // Update sublabels to show either "monthly" or "Q2 Total" etc
  const sublabels = document.querySelectorAll(".scenario-sublabel");
  sublabels.forEach((sublabel) => {
    sublabel.textContent = displayLabel;
  });

  // Determine annual text
  let conservativeAnnual, averageAnnual, optimisticAnnual;

  if (context.isSeasonalView) {
    // In seasonal view, show the true annual (unchanged)
    conservativeAnnual =
      formatCurrency(annualRevenue * 0.7) +
      "<br><span class='scenario-sublabel'>annually</span>";
    averageAnnual =
      formatCurrency(annualRevenue) +
      "<br><span class='scenario-sublabel'>annually</span>";
    optimisticAnnual =
      formatCurrency(annualRevenue * 1.5) +
      "<br><span class='scenario-sublabel'>annually</span>";
  } else {
    // Normal view: monthly * 12
    conservativeAnnual =
      formatCurrency(conservative * 12) +
      "<br><span class='scenario-sublabel'>annually</span>";
    averageAnnual =
      formatCurrency(average * 12) +
      "<br><span class='scenario-sublabel'>annually</span>";
    optimisticAnnual =
      formatCurrency(optimistic * 12) +
      "<br><span class='scenario-sublabel'>annually</span>";
  }

  // Update conservative scenario
  document.getElementById("conservativeMonthly").innerHTML =
    formatCurrency(conservative);
  document.getElementById("conservativeAnnual").innerHTML = conservativeAnnual;

  // Update average scenario
  document.getElementById("averageMonthly").innerHTML = formatCurrency(average);
  document.getElementById("averageAnnual").innerHTML = averageAnnual;

  // Update optimistic scenario
  document.getElementById("optimisticMonthly").innerHTML =
    formatCurrency(optimistic);
  document.getElementById("optimisticAnnual").innerHTML = optimisticAnnual;
}

// ========================================
// Update Dynamic Tips
// ========================================
function updateDynamicTips() {
  const tips = [];

  // Mobile traffic tip
  if (state.mobilePercent > 70) {
    tips.push(
      "Your mobile traffic is high (>70%) - consider mobile-optimized ad formats like anchor ads and sticky units",
    );
  }

  // Quality tier tip
  if (state.qualityTier === 0) {
    tips.push(
      "You're in the 'Basic' tier - improve content quality, reduce bounce rate, and build authority to boost RPM by 40-170%",
    );
  }

  // Low earning niche tip
  const lowEarningNiches = [
    "Entertainment",
    "Gaming",
    "Music",
    "Movies & TV",
    "Celebrity News",
  ];
  if (lowEarningNiches.includes(state.niche)) {
    tips.push(
      "Finance and Technology niches typically earn 2-3× more per visitor. Consider adding complementary content in higher-paying niches",
    );
  }

  // Low-tier country tip
  const lowTierCountries = ["IN", "ID", "PH", "PK", "BD", "VN", "NG"];
  if (lowTierCountries.includes(state.country)) {
    tips.push(
      "Your primary traffic is from a lower-tier country. Consider creating English content to attract Tier 1 traffic (US, UK, CA, AU)",
    );
  }

  // Seasonality tip
  if (
    state.seasonalityEnabled &&
    (state.selectedQuarter === "Q1" || state.selectedQuarter === "Q3")
  ) {
    tips.push(
      "Q1 and Q3 have lower ad rates. Your earnings could increase 30-50% in Q4 (Oct-Dec) with the same traffic",
    );
  }

  // Always show general tip
  tips.push(
    "Test different ad placements - above-the-fold ads typically perform best. A/B test header vs sidebar vs in-content positions",
  );

  // Update tips list
  const tipsList = document.getElementById("tipsList");
  tipsList.innerHTML = tips.map((tip) => `<li>${tip}</li>`).join("");
}

// ========================================
// Social Share Functions
// ========================================
function shareOnTwitter() {
  const monthlyRevenue = parseFloat(
    document.getElementById("averageMonthly").textContent.replace(/[$,]/g, ""),
  );
  const formattedRevenue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monthlyRevenue);

  const text = `I could earn ${formattedRevenue}/month from ads with my traffic! Calculate yours:`;
  const url = window.location.href;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(url)}&hashtags=AdSense,BlogMonetization`;

  window.open(twitterUrl, "_blank", "width=550,height=420");
}

function shareViaEmail() {
  const monthlyRevenue = parseFloat(
    document.getElementById("averageMonthly").textContent.replace(/[$,]/g, ""),
  );
  const annualRevenue = parseFloat(
    document
      .getElementById("averageAnnual")
      .textContent.replace(/[$,/year]/g, ""),
  );

  const formattedMonthly = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monthlyRevenue);

  const formattedAnnual = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(annualRevenue);

  const subject = "Check out my ad revenue potential!";
  const body =
    `I used Adstimate to estimate my ad revenue potential:\n\n` +
    `Monthly: ${formattedMonthly}\n` +
    `Annual: ${formattedAnnual}\n\n` +
    `Calculate yours at: ${window.location.href}`;

  window.location.href = `mailto:?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

// ========================================
// Utility Functions
// ========================================

// Format large numbers with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Validate numeric input
function validateNumericInput(value, min, max, defaultValue) {
  const num = parseFloat(value);
  if (isNaN(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

// Log current state (for debugging)
function logState() {
  console.log("Current State:", state);
}

// Export for debugging
window.adstimate = {
  state,
  calculateAutoRpm,
  calculateAndUpdate,
  getNormalizedSeasonalityWeights,
  logState,
};

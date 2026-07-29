/**
 * Mini Calculator Widget for pSEO Pages
 * Adapts to niche/country/combo pages automatically
 * Provides quick estimate and deep-links to main calculator
 */

class MiniCalculator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Mini calculator container #${containerId} not found`);
      return;
    }

    // Read page metadata
    this.pageType = this.container.dataset.type; // 'niche', 'country', or 'niche-country'
    this.prefilledNiche = this.container.dataset.niche || null;
    this.prefilledCountry = this.container.dataset.country || null;

    // State
    this.selectedNiche = this.prefilledNiche;
    this.selectedCountry = this.prefilledCountry;
    this.views = "";
    this.estimate = null;

    // Data storage
    this.countryRpm = {};
    this.nicheMultiplier = {};

    // Initialize
    this.init();
  }

  async init() {
    try {
      // Load data files
      await this.loadData();

      // Render widget UI
      this.render();

      // Attach event listeners
      this.attachEventListeners();
    } catch (error) {
      console.error("Mini calculator initialization failed:", error);
      this.container.innerHTML =
        '<p>Calculator unavailable. <a href="/">Try main calculator</a></p>';
    }
  }

  async loadData() {
    try {
      const [countryData, nicheData, countryNamesData] = await Promise.all([
        fetch("/data/country_rpm.json").then((r) => r.json()),
        fetch("/data/niche_multiplier.json").then((r) => r.json()),
        fetch("/data/country_names.json").then((r) => r.json()),
      ]);

      this.countryRpm = countryData;
      this.nicheMultiplier = nicheData;
      this.countryNames = countryNamesData;

      console.log("✓ Mini calculator data loaded");
    } catch (error) {
      console.error("Error loading calculator data:", error);
      throw error;
    }
  }

  render() {
    const title = this.getTitle();
    const inputsHTML = this.getInputsHTML();

    this.container.innerHTML = `
      <div class="mini-calculator-box">
        <h3 class="mini-calc-title">${title}</h3>
        <div class="mini-calc-inputs">
          ${inputsHTML}
          <button class="mini-calc-btn" id="miniCalcBtn">Calculate</button>
        </div>
        <div class="mini-calc-result" id="miniCalcResult" style="display: none;">
          <div class="mini-calc-estimate">
            <span class="estimate-label">Quick Estimate:</span>
            <span class="estimate-value" id="estimateValue">$0</span>
            <span class="estimate-period">/month</span>
          </div>
          <p class="estimate-note">Based on ${this.getEstimateNote()}</p>
          <a href="#" class="mini-calc-full-btn" id="fullBreakdownBtn">
            Get Full Breakdown & Optimization Tips →
          </a>
        </div>
      </div>
    `;
  }

  getTitle() {
    if (this.pageType === "niche-country") {
      return `Calculate ${this.prefilledNiche} Earnings in ${this.getCountryName(this.prefilledCountry)}`;
    } else if (this.pageType === "niche") {
      return `Calculate ${this.prefilledNiche} Earnings Estimate`;
    } else if (this.pageType === "country") {
      return `Calculate ${this.getCountryName(this.prefilledCountry)} Earnings Estimate`;
    }
    return "Quick Earnings Estimate";
  }

  getInputsHTML() {
    let html = "";

    // Show country selector if not prefilled
    if (!this.prefilledCountry) {
      html += `
        <div class="mini-calc-field">
          <label for="miniCountry">Your Country:</label>
          <select id="miniCountry" class="select-field">
            <option value="">Select Country</option>
            ${this.getCountryOptions()}
          </select>
        </div>
      `;
    }

    // Show niche selector if not prefilled
    if (!this.prefilledNiche) {
      html += `
        <div class="mini-calc-field">
          <label for="miniNiche">Your Niche:</label>
          <select id="miniNiche" class="select-field">
            <option value="">Select Niche</option>
            ${this.getNicheOptions()}
          </select>
        </div>
      `;
    }

    // Always show views input
    html += `
      <div class="mini-calc-field">
        <label for="miniViews">Monthly Pageviews:</label>
        <input type="number" id="miniViews" class="input-field" 
               placeholder="e.g., 50000" min="1000" step="1000">
      </div>
    `;

    return html;
  }

  getCountryOptions() {
    const topCountries = [
      "US",
      "CA",
      "UK",
      "AU",
      "DE",
      "FR",
      "IN",
      "BR",
      "MX",
      "NG",
    ];
    return topCountries
      .map(
        (code) =>
          `<option value="${code}">${this.getCountryName(code)}</option>`,
      )
      .join("");
  }

  getNicheOptions() {
    const topNiches = [
      "Finance",
      "Insurance",
      "Legal",
      "Technology",
      "Real Estate",
      "Health & Medical",
      "Business",
      "Education",
      "Lifestyle",
      "Gaming",
    ];
    return topNiches
      .map((niche) => `<option value="${niche}">${niche}</option>`)
      .join("");
  }

  getCountryName(code) {
    return this.countryNames?.[code] || code;
  }

  attachEventListeners() {
    const calcBtn = document.getElementById("miniCalcBtn");
    const viewsInput = document.getElementById("miniViews");
    const countrySelect = document.getElementById("miniCountry");
    const nicheSelect = document.getElementById("miniNiche");

    // Calculate button
    if (calcBtn) {
      calcBtn.addEventListener("click", () => this.calculate());
    }

    // Enter key on views input
    if (viewsInput) {
      viewsInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.calculate();
      });
    }

    // Update selections
    if (countrySelect) {
      countrySelect.addEventListener("change", (e) => {
        this.selectedCountry = e.target.value;
      });
    }

    if (nicheSelect) {
      nicheSelect.addEventListener("change", (e) => {
        this.selectedNiche = e.target.value;
      });
    }
  }

  calculate() {
    // Get views input
    const viewsInput = document.getElementById("miniViews");
    this.views = parseInt(viewsInput.value) || 0;

    // Validate inputs
    if (this.views < 1000) {
      alert("Please enter at least 1,000 monthly pageviews");
      return;
    }

    if (!this.selectedCountry) {
      alert("Please select a country");
      return;
    }

    if (!this.selectedNiche) {
      alert("Please select a niche");
      return;
    }

    // Calculate estimate
    const countryRpm = this.countryRpm[this.selectedCountry] || 8.0;
    const nicheMultiplier = this.nicheMultiplier[this.selectedNiche] || 1.0;
    const estimatedRpm = countryRpm * nicheMultiplier;
    const monthlyRevenue = (this.views / 1000) * estimatedRpm;

    this.estimate = monthlyRevenue;

    // Show result
    this.showResult();

    // Update "Full Breakdown" button URL
    this.updateFullBreakdownLink();
  }

  showResult() {
    const resultDiv = document.getElementById("miniCalcResult");
    const estimateValue = document.getElementById("estimateValue");

    if (resultDiv && estimateValue) {
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(this.estimate);

      estimateValue.textContent = formatted;
      resultDiv.style.display = "block";

      // Smooth scroll to result
      resultDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  getEstimateNote() {
    if (this.pageType === "niche-country") {
      return `${this.prefilledNiche} content in ${this.getCountryName(this.prefilledCountry)}`;
    } else if (this.pageType === "niche") {
      return `${this.prefilledNiche} content in ${this.getCountryName(this.selectedCountry)}`;
    } else if (this.pageType === "country") {
      return `${this.selectedNiche} content in ${this.getCountryName(this.prefilledCountry)}`;
    }
    return "your traffic profile";
  }

  updateFullBreakdownLink() {
    const fullBtn = document.getElementById("fullBreakdownBtn");
    if (!fullBtn) return;

    // Build URL with parameters
    const params = new URLSearchParams({
      niche: this.selectedNiche,
      country: this.selectedCountry,
      views: this.views,
    });

    fullBtn.href = `/?${params.toString()}`;
  }
}

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const miniCalcContainer = document.getElementById("miniCalculator");
  if (miniCalcContainer) {
    new MiniCalculator("miniCalculator");
  }
});

// CSS Styles (add to your stylesheet or inject)
const miniCalcStyles = `
<style>

.mini-calc-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: #111827;
}

.mini-calc-field label {
  display: block;
  font-size: 15px;
  font-weight: 600;
}

.mini-calc-btn {
	padding: 9px 10px;
	background: var(--accent-success);
	color: white;
	border: none;
	border-radius: 6px;
	font-size: 1rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s;
}

.mini-calc-btn:hover {
    background: #05be65;
    box-shadow: 2px 2px 4px #cececece;
}

.mini-calc-result {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e5e7eb;
}

.mini-calc-estimate {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.estimate-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
}

.estimate-value {
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--accent-success);
}

.estimate-period {
  font-size: 1rem;
  color: #6b7280;
}

.estimate-note {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 1rem 0;
}

.mini-calc-full-btn {
  text-align: center;
  text-decoration: underline;
  font-weight: 600;
}

.mini-calc-full-btn:hover {
  color: var(--accent-primary);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mini-calculator-box {
    background: #1f2937;
    border-color: #374151;
  }
  
  .mini-calc-title {
    color: #f9fafb;
  }
  
  .mini-calc-field label {
    color: #d1d5db;
  }

}
</style>
`;

// Inject styles if not already present
if (!document.getElementById("mini-calc-styles")) {
  document.head.insertAdjacentHTML("beforeend", miniCalcStyles);
}

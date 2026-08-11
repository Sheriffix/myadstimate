const fs = require("fs");
const path = require("path");
const {
  toReadableDate,
  seededPick,
  seededShuffle,
  HEADER_HTML,
  FOOTER_HTML,
  buildRelatedArticlesHtml,
} = require("./public/scripts/utils.js"); // From shared utilities

// ============================================================================
// TEMPLATE FILLER
// Takes a template string and a plain object of { PLACEHOLDER_NAME: value }
// pairs, and replaces every {{PLACEHOLDER_NAME}} in the template with its
// value. This replaces long chains of .replace().replace().replace()... —
// now all variables for a page live in one readable object instead.
// ============================================================================

function fillTemplate(template, vars) {
  let html = template;
  for (const key in vars) {
    const pattern = new RegExp(`{{${key}}}`, "g");
    html = html.replace(pattern, vars[key]);
  }
  return html;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = "./public/data";
const BLOG_DIR = "./public/blog";
const TEMPLATES_DIR = "./templates";
const OUTPUT_DIRS = {
  niche: path.join(BLOG_DIR, "niche"),
  country: path.join(BLOG_DIR, "country"),
  nicheCountry: path.join(BLOG_DIR, "niche-country"),
};

// Country code to full name mapping
const COUNTRY_NAMES = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "country_names.json"), "utf8"),
);

// Reverse lookup: full country name → country code
// e.g. "United States" → "US"
const COUNTRY_CODES = {};
for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
  COUNTRY_CODES[name] = code;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getModifiedDate() {
  return getCurrentDate(); // Always returns today's date
}

function getPublishDate() {
  return "2026-03-03"; // Fixed publish date for all pSEO articles
}

function getNicheTier(multiplier) {
  if (multiplier >= 2.0) return "premium";
  if (multiplier >= 1.5) return "high-value";
  if (multiplier >= 1.0) return "mid-tier";
  return "low-tier";
}

function getCountryTier(rpm) {
  if (rpm >= 15) return "tier-1";
  if (rpm >= 8) return "tier-2";
  if (rpm >= 4) return "tier-3";
  return "tier-4";
}

function getNicheTierForIntro(multiplier) {
  if (multiplier >= 2.3) return "tier_1";
  if (multiplier >= 1.6) return "tier_2";
  if (multiplier >= 1.0) return "tier_3";
  return "tier_4";
}

function getCountryTierForIntro(rpm) {
  if (rpm > 18) return "high_rpm";
  if (rpm >= 8) return "medium_rpm";
  return "low_rpm";
}

function getCombinedTierForIntro(multiplier, rpm) {
  const nicheTier =
    multiplier >= 2.3 ? "high" : multiplier >= 1.6 ? "medium" : "low";
  const countryTier = rpm > 18 ? "high" : rpm >= 8 ? "medium" : "low";
  return `${nicheTier}_${countryTier}`;
}

function selectRandomIntro(introsArray, identityText) {
  if (!introsArray || introsArray.length === 0) return null;
  const index = seededPick(identityText, introsArray.length);
  return introsArray[index];
}

// ============================================================================
// SMART WRITE FILE
// ============================================================================
function smartWriteFile(filePath, htmlContent, fallbackPublishDate) {
  const today = getCurrentDate();
  let publishDate = fallbackPublishDate;
  let modifiedDate = today;

  if (fs.existsSync(filePath)) {
    const existingHtml = fs.readFileSync(filePath, "utf8");

    const pubMatch = existingHtml.match(/"datePublished":\s*"([^"]+)"/);
    const modMatch = existingHtml.match(/"dateModified":\s*"([^"]+)"/);

    if (pubMatch) publishDate = pubMatch[1];
    if (modMatch) modifiedDate = modMatch[1];

    // Convert dates to pretty format for masking
    const publishDatePretty = toReadableDate(publishDate);
    const modifiedDatePretty = toReadableDate(modifiedDate);

    // Mask ALL date-related placeholders in the existing file
    let normalizedExisting = existingHtml
      .replace(new RegExp(publishDate, "g"), "{{DATE_MASK}}")
      .replace(new RegExp(modifiedDate, "g"), "{{DATE_MASK}}")
      .replace(new RegExp(publishDatePretty, "g"), "{{DATE_MASK_PRETTY}}")
      .replace(new RegExp(modifiedDatePretty, "g"), "{{DATE_MASK_PRETTY}}");

    // Mask ALL date-related placeholders in the new content
    let normalizedNew = htmlContent
      .replace(/{{PUBLISH_DATE}}/g, "{{DATE_MASK}}")
      .replace(/{{MODIFIED_DATE}}/g, "{{DATE_MASK}}")
      .replace(/{{PUBLISH_DATE_PRETTY}}/g, "{{DATE_MASK_PRETTY}}")
      .replace(/{{MODIFIED_DATE_PRETTY}}/g, "{{DATE_MASK_PRETTY}}");

    if (normalizedExisting === normalizedNew) {
      return false;
    }

    modifiedDate = today;
  }

  const publishDatePretty = toReadableDate(publishDate);
  const modifiedDatePretty = toReadableDate(modifiedDate);

  const finalHtml = htmlContent
    .replace(/{{PUBLISH_DATE}}/g, publishDate)
    .replace(/{{MODIFIED_DATE}}/g, modifiedDate)
    .replace(/{{PUBLISH_DATE_PRETTY}}/g, publishDatePretty)
    .replace(/{{MODIFIED_DATE_PRETTY}}/g, modifiedDatePretty);

  fs.writeFileSync(filePath, finalHtml, "utf8");
  return true;
}

// ============================================================================
// LOAD DATA
// ============================================================================

console.log("📂 Loading data files...");

const adBenchmarks = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "ad_benchmarks.json"), "utf8"),
);
const countryRpm = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "country_rpm.json"), "utf8"),
);
const nicheMultiplier = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "niche_multiplier.json"), "utf8"),
);
const sisterNiches = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "sister_niches.json"), "utf8"),
);

// Load intro variations
const introMap = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "intro_map.json"), "utf8"),
);
const comboPhraseMap = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "combo_phrase_map.json"), "utf8"),
);
const nichePhraseMap = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "niche_phrase_map.json"), "utf8"),
);
const countryPhraseMap = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "country_phrase_map.json"), "utf8"),
);

console.log(
  `✓ Loaded ${Object.keys(adBenchmarks).length} niches from ad_benchmarks`,
);
console.log("✓ Loaded intro variations");
console.log(
  `✓ Loaded ${Object.keys(countryRpm).length} countries from country_rpm`,
);
console.log(
  `✓ Loaded ${Object.keys(nicheMultiplier).length} niches from niche_multiplier`,
);

// ============================================================================
// LOAD SETTINGS
// ============================================================================

console.log("\n⚙️  Loading adstimate-settings.json...");

let settings = {
  generate_pages: { niche: [], country: [], niche_country: [] },
  template_mapping: {},
};
const settingsPath = "./settings/adstimate-settings.json";

if (fs.existsSync(settingsPath)) {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  console.log("✓ Settings loaded");
} else {
  console.error("\n❌ adstimate-settings.json not found.");
  console.error("   This file is required. Generation stopped.\n");
  process.exit(1);
}

// ============================================================================
// VALIDATE & BUILD PAGE LISTS FROM generate_pages
// ============================================================================

console.log("\n📋 Validating generate_pages...");

const gp = settings.generate_pages || {
  niche: [],
  country: [],
  niche_country: [],
};
let generatePagesValid = true;

// Validate niche entries
for (const nicheName of gp.niche || []) {
  if (!adBenchmarks[nicheName]) {
    console.error(`❌ Unknown niche in generate_pages: "${nicheName}"`);
    console.error(`   Check ad_benchmarks.json for the correct name.`);
    generatePagesValid = false;
  }
}

// Validate country entries — must be a full name that exists in country_names.json
for (const countryName of gp.country || []) {
  if (!COUNTRY_CODES[countryName]) {
    console.error(`❌ Unknown country in generate_pages: "${countryName}"`);
    console.error(
      `   Use the full country name as it appears in country_names.json.`,
    );
    generatePagesValid = false;
  }
}

// Validate niche_country entries — each entry is a "Niche|Country Name" string
for (const combo of gp.niche_country || []) {
  if (typeof combo !== "string" || !combo.includes("|")) {
    console.error(
      `❌ Invalid niche_country entry in generate_pages: "${combo}"`,
    );
    console.error(
      `   Format must be "Niche Name|Country Name" e.g. "Finance|United States"`,
    );
    generatePagesValid = false;
    continue;
  }
  const [nicheName, countryName] = combo.split("|");
  if (!adBenchmarks[nicheName]) {
    console.error(
      `❌ Unknown niche in generate_pages niche_country: "${nicheName}"`,
    );
    console.error(`   Check ad_benchmarks.json for the correct name.`);
    generatePagesValid = false;
  }
  if (!COUNTRY_CODES[countryName]) {
    console.error(
      `❌ Unknown country in generate_pages niche_country: "${countryName}"`,
    );
    console.error(
      `   Use the full country name as it appears in country_names.json.`,
    );
    generatePagesValid = false;
  }
}

if (!generatePagesValid) {
  console.error("\nGeneration stopped. Fix the errors above and run again.\n");
  process.exit(1);
}

// Build the working lists the generator will loop over.
// nicheList  → array of niche names e.g. ["Finance", "Technology", ...]
// countryList → array of country codes e.g. ["US", "DE", ...]  (derived from names)
// topCombinations → array of { niche, countryCode } objects
const nicheList = gp.niche || [];
const countryList = (gp.country || []).map((name) => COUNTRY_CODES[name]);
const topCombinations = (gp.niche_country || []).map((combo) => {
  const [niche, countryName] = combo.split("|");
  return { niche, countryCode: COUNTRY_CODES[countryName] };
});

console.log(
  `✓ ${nicheList.length} niches, ${countryList.length} countries, ${topCombinations.length} niche-country combos to generate`,
);

// ============================================================================
// LOAD & VALIDATE TEST TEMPLATES
// ============================================================================

// Determine the page type from a template filename.
// "niche-country" and "combo" both map to the niche-country type.
// "combo" must be checked before "niche" and "country" to avoid false matches.
// "niche-country" must be checked before "niche" for the same reason.
function getTemplateType(templateName) {
  if (templateName.includes("niche-country")) return "niche-country";
  if (templateName.includes("combo")) return "niche-country";
  if (templateName.includes("niche")) return "niche";
  if (templateName.includes("country")) return "country";
  return null;
}

// Make Testkey
function makeTestKey(type, entry) {
  if (type === "niche") return String(entry);
  if (type === "country") return String(COUNTRY_CODES[entry] || entry);
  if (type === "niche-country") {
    const [niche, countryName] = entry.split("|");
    return `${niche}|${COUNTRY_CODES[countryName] || countryName}`;
  }
  return null;
}
// testPageMap: key → templateName
// e.g. { "Finance": "test-niche-template.html", "US": "test-country-template.html", "Finance|US": "low-niche-country-template.html" }
const testPageMap = {};
const testTemplates = {};
let testPagesValid = true;

if (
  settings.template_mapping &&
  Object.keys(settings.template_mapping).length > 0
) {
  console.log("\n🧪 Validating test pages...");

  // Step 1: Detect type of each template from its filename and validate entries
  for (const [templateName, entries] of Object.entries(
    settings.template_mapping,
  )) {
    const type = getTemplateType(templateName);

    if (!type) {
      console.error(
        `❌ Cannot determine type from template filename: "${templateName}"`,
      );
      console.error(
        `   Filename must contain "niche-country", "niche", or "country".`,
      );
      testPagesValid = false;
      continue;
    }

    // Validate each entry matches its type
    for (const entry of entries) {
      if (type === "niche-country") {
        if (typeof entry !== "string" || !entry.includes("|")) {
          console.error(
            `❌ template_mapping "${templateName}": expected "Niche|Country Name" string, got: ${JSON.stringify(entry)}`,
          );
          testPagesValid = false;
          continue;
        }
        const [nicheName, countryName] = entry.split("|");
        if (!adBenchmarks[nicheName]) {
          console.error(
            `❌ template_mapping "${templateName}": unknown niche "${nicheName}"`,
          );
          testPagesValid = false;
        }
        if (!COUNTRY_CODES[countryName]) {
          console.error(
            `❌ template_mapping "${templateName}": unknown country "${countryName}"`,
          );
          testPagesValid = false;
        }
      } else if (type === "niche") {
        if (!adBenchmarks[entry]) {
          console.error(
            `❌ template_mapping "${templateName}": unknown niche "${entry}"`,
          );
          testPagesValid = false;
        }
      } else if (type === "country") {
        if (!COUNTRY_CODES[entry]) {
          console.error(
            `❌ template_mapping "${templateName}": unknown country "${entry}"`,
          );
          console.error(
            `   Use the full country name as it appears in country_names.json.`,
          );
          testPagesValid = false;
        }
      }
    }
  }

  if (!testPagesValid) {
    console.error(
      "\nGeneration stopped. Fix the template_mapping errors above and run again.\n",
    );
    process.exit(1);
  }

  // Step 2: Check for duplicate entries across all templates
  const allTestKeys = [];
  const duplicates = [];

  for (const [templateName, entries] of Object.entries(
    settings.template_mapping,
  )) {
    const type = getTemplateType(templateName);
    for (const entry of entries) {
      const key = makeTestKey(type, entry);
      if (allTestKeys.includes(key)) {
        duplicates.push({ key, template: templateName });
      } else {
        allTestKeys.push(key);
      }
    }
  }

  if (duplicates.length > 0) {
    console.error(
      "\n❌ DUPLICATE TEST ENTRIES DETECTED — fix adstimate-settings.json:\n",
    );
    duplicates.forEach((d) =>
      console.error(`   "${d.key}" (found again under ${d.template})`),
    );
    console.error("\nGeneration stopped. Fix duplicates and run again.\n");
    process.exit(1);
  }

  // Step 3: Check every test entry also exists in generate_pages
  const generateNicheSet = new Set(nicheList);
  const generateCountrySet = new Set(countryList);
  const generateComboSet = new Set(
    topCombinations.map((c) => `${c.niche}|${c.countryCode}`),
  );
  let missingFromGenerate = false;

  for (const [templateName, entries] of Object.entries(
    settings.template_mapping,
  )) {
    const type = getTemplateType(templateName);
    for (const entry of entries) {
      const key = makeTestKey(type, entry);
      let found = false;
      if (type === "niche") found = generateNicheSet.has(entry);
      if (type === "country")
        found = generateCountrySet.has(COUNTRY_CODES[entry]);
      if (type === "niche-country") found = generateComboSet.has(key);
      if (!found) {
        console.error(
          `❌ template_mapping "${templateName}": "${entry}" is not listed in generate_pages`,
        );
        missingFromGenerate = true;
      }
    }
  }

  if (missingFromGenerate) {
    console.error(
      "\nGeneration stopped. Every template_mapping entry must also exist in generate_pages.\n",
    );
    process.exit(1);
  }

  // Step 4: Load all template files
  // Subfolder is derived from the template type — no need to include it in the filename.
  // niche → templates/niche/, country → templates/country/, niche-country → templates/combo/
  const typeToSubfolder = {
    niche: "niche",
    country: "country",
    "niche-country": "combo",
  };
  for (const templateName of Object.keys(settings.template_mapping)) {
    const type = getTemplateType(templateName);
    const subfolder = typeToSubfolder[type] || "";
    const templatePath = path.join(TEMPLATES_DIR, subfolder, templateName);
    if (!fs.existsSync(templatePath)) {
      console.error(`❌ Test template file not found: ${templatePath}`);
      testPagesValid = false;
    } else {
      testTemplates[templateName] = fs.readFileSync(templatePath, "utf8");
      console.log(`✓ Loaded test template: ${templateName}`);
    }
  }

  if (!testPagesValid) {
    console.error(
      "\nGeneration stopped. Fix missing template files and run again.\n",
    );
    process.exit(1);
  }

  // Step 5: Build the testPageMap lookup
  for (const [templateName, entries] of Object.entries(
    settings.template_mapping,
  )) {
    const type = getTemplateType(templateName);
    for (const entry of entries) {
      const key = makeTestKey(type, entry);
      testPageMap[key] = templateName;
    }
  }

  console.log(
    `✓ ${Object.keys(testPageMap).length} test page entries validated`,
  );
}

console.log(
  `✓ Loaded ${Object.keys(sisterNiches).length} sister niche mappings`,
);

// Validate sister_niches.json against the REAL generated niche list.
// This does not stop generation (a broken cross-promotion mapping is not
// worth blocking the whole site over) — it just warns loudly so a typo or
// stale entry doesn't silently ship as a real link that 404s. The actual
// enforcement (never rendering a bad link) happens separately in
// buildNicheCallout() below, regardless of whether this warning is seen.
const nicheSet = new Set(nicheList);
const badSisterEntries = Object.entries(sisterNiches).filter(
  ([niche, sister]) => !nicheSet.has(sister),
);
if (badSisterEntries.length > 0) {
  console.warn(
    `\n⚠️  sister_niches.json has ${badSisterEntries.length} entr${badSisterEntries.length === 1 ? "y" : "ies"} pointing to a niche that isn't in generate_pages.niche:`,
  );
  badSisterEntries.forEach(([niche, sister]) => {
    console.warn(`   - "${niche}" → "${sister}" (no such generated niche)`);
  });
  console.warn(
    `   These callout boxes will be silently skipped on those pages. Fix sister_niches.json to restore them.\n`,
  );
}

console.log("\n📖 Loading manual blog articles from manual-posts.json...");

// Load manual blogs from the single source of truth
const manualPostsRaw = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "manual-posts.json"), "utf8"),
);

// Normalize manual-posts.json fields to match the shape the rest of the
// generator expects: { title, url, type, description, datePublished, dateModified, related }
const manualLinkMap = {};
for (const slug in manualPostsRaw) {
  const post = manualPostsRaw[slug];
  manualLinkMap[slug] = {
    title: post.title,
    url: `/blog/${post.slug}.html`,
    type: post.type,
    tags: post.tags,
    description: post.meta_description,
    datePublished: post.date_published,
    dateModified: post.date_modified,
    related: post.related,
  };
}

// Start linkMap with manual blogs pre-loaded (read-only reference)
const linkMap = { ...manualLinkMap };

console.log(
  `✓ Loaded ${Object.keys(manualLinkMap).length} manual blog articles`,
);

// ==================================================================
// LOAD TEMPLATES
// ==================================================================

console.log("\n📄 Loading templates...");

const nicheTemplate = fs.readFileSync(
  path.join(TEMPLATES_DIR, "niche", "niche-standard.html"),
  "utf8",
);
const countryTemplate = fs.readFileSync(
  path.join(TEMPLATES_DIR, "country", "country-standard.html"),
  "utf8",
);
const nicheCountryTemplate = fs.readFileSync(
  path.join(TEMPLATES_DIR, "combo", "combo-standard.html"),
  "utf8",
);
const nicheCountryIndexTemplate = fs.readFileSync(
  path.join(TEMPLATES_DIR, "index", "combo-index.html"),
  "utf8",
);

console.log("✓ Templates loaded");

// ============================================================================
// PREPARE DATA STRUCTURES
// (nicheList, countryList, topCombinations are built above from generate_pages)
// ============================================================================

// ============================================================================
// HELPER: CALCULATE RELATED ITEMS
// ============================================================================

function getRelatedNiches(currentNiche, count = 3) {
  const current = nicheMultiplier[currentNiche];
  if (!current) return [];

  return nicheList
    .filter((n) => n !== currentNiche && nicheMultiplier[n])
    .map((n) => ({
      niche: n,
      diff: Math.abs(nicheMultiplier[n] - current),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, count)
    .map((item) => item.niche);
}

function getRelatedCountries(currentCountry, count = 3) {
  const current = countryRpm[currentCountry];
  if (!current) return [];

  return countryList
    .filter((c) => c !== currentCountry)
    .map((c) => ({
      country: c,
      diff: Math.abs(countryRpm[c] - current),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, count)
    .map((item) => item.country);
}

function getTopCountriesForNiche(count = 3) {
  return countryList
    .map((c) => ({ code: c, rpm: countryRpm[c] }))
    .sort((a, b) => b.rpm - a.rpm)
    .slice(0, count);
}

function getTopNichesForCountry(count = 3) {
  return nicheList
    .filter((n) => nicheMultiplier[n])
    .map((n) => ({ niche: n, multiplier: nicheMultiplier[n] }))
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, count);
}

// ============================================================================
// HELPER: SMART RELATED LINKS (2+2+2 RULE)
// ============================================================================

function getSmartManualBlogs(articleType, keywords, linkMap) {
  const manualBlogs = Object.keys(linkMap)
    .filter((key) => linkMap[key].type === "manual-blog")
    .map((key) => ({
      slug: key,
      ...linkMap[key],
    }));

  if (manualBlogs.length === 0) return [];

  const scored = manualBlogs.map((blog) => {
    let score = 0;

    if (articleType === "niche" && blog.tags.includes("niche-guide")) {
      score += 10;
    }
    if (articleType === "country" && blog.tags.includes("country-guide")) {
      score += 10;
    }

    keywords.forEach((keyword) => {
      const blogContent = (blog.title + " " + blog.description).toLowerCase();
      if (blogContent.includes(keyword.toLowerCase())) {
        score += 5;
      }
      if (blog.tags.some((tag) => tag.includes(keyword.toLowerCase()))) {
        score += 3;
      }
    });

    if (blog.slug.includes("highest-paying")) score += 2;
    if (blog.slug.includes("how-much-does-adsense-pay")) score += 2;
    if (blog.slug.includes("rpm-by-country")) score += 2;

    return { ...blog, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((blog) => blog.slug);
}

function getOneCountryLink(currentSlug, linkMap) {
  const countryPages = Object.keys(linkMap).filter(
    (key) => linkMap[key].type === "country" && key !== currentSlug,
  );

  if (countryPages.length === 0) return null;
  return countryPages[Math.floor(Math.random() * countryPages.length)];
}

function getOneNicheLink(currentSlug, linkMap) {
  const nichePages = Object.keys(linkMap).filter(
    (key) => linkMap[key].type === "niche" && key !== currentSlug,
  );

  if (nichePages.length === 0) return null;
  return nichePages[Math.floor(Math.random() * nichePages.length)];
}

function getOneNicheCountryLink(
  currentSlug,
  linkMap,
  preferNiche = null,
  preferCountry = null,
) {
  let combos = Object.keys(linkMap).filter(
    (key) => linkMap[key].type === "niche-country" && key !== currentSlug,
  );

  if (combos.length === 0) return null;

  if (preferNiche && preferCountry) {
    const preferred = combos.filter(
      (key) =>
        linkMap[key].niche === preferNiche ||
        linkMap[key].country === preferCountry,
    );
    if (preferred.length > 0) {
      return preferred[Math.floor(Math.random() * preferred.length)];
    }
  }

  return combos[Math.floor(Math.random() * combos.length)];
}

const MANUAL_BLOG_RELATIONSHIPS = {
  // Pillar page - earnings focused
  "how-much-does-adsense-pay": [
    "highest-paying-adsense-niches",
    "adsense-revenue-100k-1m-views",
  ],

  // Beginner journey
  "can-new-websites-make-money-with-adsense": [
    "adsense-approval-checklist-2026",
    "low-value-content-fix",
  ],

  "adsense-approval-checklist-2026": [
    "can-new-websites-make-money-with-adsense",
    "low-value-content-fix",
  ],

  // Revenue & earnings cluster
  "adsense-revenue-100k-1m-views": [
    "how-much-does-adsense-pay",
    "highest-paying-adsense-niches",
  ],

  "highest-paying-adsense-niches": [
    "how-much-does-adsense-pay",
    "adsense-revenue-100k-1m-views",
  ],

  // Geographic revenue
  "adsense-rpm-by-country": [
    "how-much-does-adsense-pay",
    "highest-paying-adsense-niches",
  ],

  // Alternatives & comparison
  "adsense-vs-ezoic-vs-mediavine-2026": [
    "adsense-alternatives-for-small-websites",
    "how-much-does-adsense-pay",
  ],

  "adsense-alternatives-for-small-websites": [
    "adsense-vs-ezoic-vs-mediavine-2026",
    "can-new-websites-make-money-with-adsense",
  ],

  // Technical issues
  "ad-serving-limits": [
    "low-value-content-fix",
    "adsense-approval-checklist-2026",
  ],

  "low-value-content-fix": [
    "adsense-approval-checklist-2026",
    "ad-serving-limits",
  ],
};

/**
 * Get related manual blogs for a given manual blog
 * Uses manual overrides first, falls back to tag-based matching
 */
function getRelatedManualBlogs(currentSlug, currentTags, linkMap, count = 2) {
  // Check for manual overrides first
  if (MANUAL_BLOG_RELATIONSHIPS[currentSlug]) {
    return MANUAL_BLOG_RELATIONSHIPS[currentSlug].slice(0, count);
  }

  // Fallback: tag-based matching
  const manualBlogs = Object.keys(linkMap).filter((key) => {
    const article = linkMap[key];
    return (
      article.type === "manual-blog" &&
      key !== currentSlug &&
      article.tags.some((tag) => currentTags.includes(tag))
    );
  });

  // Shuffle consistently based on this page's own slug (not Math.random()),
  // so the same page always picks the same related guide across runs
  const shuffled = seededShuffle(manualBlogs, currentSlug);
  return shuffled.slice(0, count);
}

/**
 * Get top niche-country combos for a specific country
 * Sorted by niche multiplier (highest earning niches)
 */
function getTopNichesForCountry(countryName, linkMap, count = 3) {
  const combos = Object.keys(linkMap)
    .filter((key) => {
      const article = linkMap[key];
      return (
        article.type === "niche-country" && article.country === countryName
      );
    })
    .map((key) => ({
      slug: key,
      multiplier: linkMap[key].niche
        ? nicheMultiplier[linkMap[key].niche] || 1.0
        : 1.0,
    }))
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, count)
    .map((item) => item.slug);

  // FALLBACK: If no niche-country combos exist for this country,
  // link to the top niche pages instead (sorted by highest multiplier)
  if (combos.length === 0) {
    return Object.keys(linkMap)
      .filter((key) => linkMap[key].type === "niche")
      .map((key) => ({
        slug: key,
        multiplier: nicheMultiplier[linkMap[key].niche] || 1.0,
      }))
      .sort((a, b) => b.multiplier - a.multiplier)
      .slice(0, count)
      .map((item) => item.slug);
  }

  return combos;
}

/**
 * Get top niche-country combos for a specific niche
 * Sorted by calculated RPM (niche multiplier × country RPM)
 */
function getTopCountriesForNiche(nicheName, linkMap, count = 5) {
  const multiplier = nicheMultiplier[nicheName] || 1.0;

  const combos = Object.keys(linkMap)
    .filter((key) => {
      const article = linkMap[key];
      return article.type === "niche-country" && article.niche === nicheName;
    })
    .map((key) => {
      const article = linkMap[key];
      const countryCode = Object.keys(COUNTRY_NAMES).find(
        (code) => COUNTRY_NAMES[code] === article.country,
      );
      const baseRpm = countryCode ? countryRpm[countryCode] : 0;
      const calculatedRpm = baseRpm * multiplier;

      return {
        slug: key,
        rpm: calculatedRpm,
      };
    })
    .sort((a, b) => b.rpm - a.rpm)
    .slice(0, count)
    .map((item) => item.slug);

  // FALLBACK: If no niche-country combos exist for this niche,
  // link to the top country pages instead (sorted by highest RPM)
  if (combos.length === 0) {
    return Object.keys(linkMap)
      .filter((key) => linkMap[key].type === "country")
      .map((key) => {
        const countryCode = Object.keys(COUNTRY_NAMES).find(
          (code) => COUNTRY_NAMES[code] === linkMap[key].country,
        );
        return {
          slug: key,
          rpm: countryCode ? countryRpm[countryCode] : 0,
        };
      })
      .sort((a, b) => b.rpm - a.rpm)
      .slice(0, count)
      .map((item) => item.slug);
  }

  return combos;
}

/**
 * Get related niche-country combos (for niche-country pages)
 * Returns pages that share either the same niche OR same country
 */
function getRelatedNicheCountry(
  currentNiche,
  currentCountry,
  currentSlug,
  linkMap,
  count = 2,
) {
  const combos = Object.keys(linkMap).filter((key) => {
    if (linkMap[key].type !== "niche-country") return false;
    if (key === currentSlug) return false;

    const item = linkMap[key];
    // Must share either niche OR country (but not both, as that would be the same page)
    return (
      (item.niche === currentNiche && item.country !== currentCountry) ||
      (item.country === currentCountry && item.niche !== currentNiche)
    );
  });

  if (combos.length === 0) {
    // Fallback: return any niche-country pages
    const anyCombo = Object.keys(linkMap).filter(
      (key) => linkMap[key].type === "niche-country" && key !== currentSlug,
    );
    return anyCombo.slice(0, count);
  }

  // Shuffle consistently based on this page's own slug
  const shuffled = seededShuffle(combos, currentSlug);
  return shuffled.slice(0, count);
}

// ============================================================================
// COMBO PAGE INTERNAL LINKING
// Builds the "up" links (to both parent hubs, always), "sideways" links
// (to related combo pages), and the "next step" link (to an Editorial Guide,
// never skipped) for one combo page — following the Internal Linking Guide.
// ============================================================================

// Picks one variant from a given phrase-pool object (e.g. comboPhraseMap
// or nichePhraseMap/countryPhraseMap), consistently per page (seeded), and
// fills in the {token} placeholders. Generalized so combo_phrase_map.json,
// niche_phrase_map.json, and country_phrase_map.json can all share one
// selection mechanism.
function buildPhrase(phraseMapObj, poolName, identityText, tokens) {
  const pool = phraseMapObj[poolName];
  if (!pool || pool.length === 0) return "";
  const index = seededPick(identityText, pool.length);
  let text = pool[index];
  for (const key in tokens) {
    text = text.replace(new RegExp(`{${key}}`, "g"), tokens[key]);
  }
  return text;
}

// Thin wrapper kept so existing combo-page call sites don't need to change.
function buildComboPhrase(poolName, identityText, tokens) {
  return buildPhrase(comboPhraseMap, poolName, identityText, tokens);
}

const UP_NICHE_HUB_ANCHORS = [
  (niche) => `All ${niche} rates worldwide in the ${niche} RPM Hub`,
  (niche) => `All ${niche} data in the RPM Matrix`,
];

const UP_COUNTRY_HUB_ANCHORS = [
  (country) =>
    `Compare ${country} rates across every niche in the ${country} RPM Hub`,
  (country) => `See full AdSense rates for ${country}`,
];

function buildComboLinkingVars(
  niche,
  countryName,
  nicheSlug,
  countrySlug,
  currentSlug,
  linkMap,
) {
  // --- UP LINKS: both parents, always. Anchor text rotates per page. ---
  const upNicheAnchorFn =
    UP_NICHE_HUB_ANCHORS[
      seededPick(currentSlug + "-upniche", UP_NICHE_HUB_ANCHORS.length)
    ];
  const upCountryAnchorFn =
    UP_COUNTRY_HUB_ANCHORS[
      seededPick(currentSlug + "-upcountry", UP_COUNTRY_HUB_ANCHORS.length)
    ];
  const upNicheAnchor = upNicheAnchorFn(niche);
  const upCountryAnchor = upCountryAnchorFn(countryName);

  // --- SIDEWAYS LINKS: 2-3 related combos, same niche/diff country OR same country/diff niche ---
  const relatedSlugs = getRelatedNicheCountry(
    niche,
    countryName,
    currentSlug,
    linkMap,
    3,
  );
  const sidewaysItems = relatedSlugs
    .map((relSlug) => {
      const item = linkMap[relSlug];
      if (!item) return "";

      // Only build a link if this combo genuinely shares the niche OR the
      // country with the current page. If it shares neither (the fallback
      // inside getRelatedNicheCountry can return unrelated pages when no
      // real match exists), skip it — an unrelated "sideways" link breaks
      // the Internal Linking Guide's rule and looks wrong to readers too.
      const sameNiche = item.niche === niche;
      const sameCountry = item.country === countryName;
      if (!sameNiche && !sameCountry) return "";

      const anchorText = sameNiche
        ? `How does ${niche} perform in ${item.country} instead?`
        : `See how ${item.niche} compares in ${countryName}`;
      return `<li><a href="${item.url}">${anchorText}</a></li>`;
    })
    .filter(Boolean);
  const sidewaysHtml =
    sidewaysItems.length > 0 ? `<ul>${sidewaysItems.join("")}</ul>` : "";
  const sidewaysCount = sidewaysItems.length;

  // --- NEXT STEP LINK: never skipped. Falls back to the pillar guide if no match found. ---
  const tags = [nicheSlug, countrySlug, "combo-guide"];
  const relatedGuides = getRelatedManualBlogs(currentSlug, tags, linkMap, 1);
  let nextStepUrl = "/blog/how-much-does-adsense-pay";
  let nextStepTitle = "How Much Does AdSense Actually Pay?";
  if (relatedGuides.length > 0 && linkMap[relatedGuides[0]]) {
    nextStepUrl = linkMap[relatedGuides[0]].url;
    nextStepTitle = linkMap[relatedGuides[0]].title;
  }

  return {
    upNicheAnchor,
    upCountryAnchor,
    sidewaysHtml,
    sidewaysCount,
    nextStepUrl,
    nextStepTitle,
  };
}

// ============================================================================
// TOPICAL MESH: MINI-TABLE & CALL-OUT BOX BUILDERS
// ============================================================================

// ============================================================================
// MATRIX DEEP-LINK HELPER
// Builds a URL to the Matrix Tool pre-filtered to a specific niche/country,
// for use whenever a real static combo page doesn't exist yet. Per the
// internal linking guide: hub pages (niche/country) must route to the
// Matrix Tool as a fallback, never to a 404. deeplink_handler.js already
// knows how to read these ?niche=&country= params and pre-fill the
// calculator, so this lands the reader on something useful, not a dead end.
// ============================================================================
function buildMatrixDeepLink(niche, countryName) {
  return `/adsense-rpm-matrix.html?niche=${encodeURIComponent(niche)}&country=${encodeURIComponent(countryName)}`;
}

// ============================================================================
// TOPICAL MESH: MINI-TABLE & CALL-OUT BOX BUILDERS
// ============================================================================

/**
 * TOP COUNTRIES TABLE (niche pages)
 * Ranks ALL countries by RPM for this niche (not just ones with a generated
 * combo page) — the ranking itself should reflect real, complete data.
 * Each row links to the real combo page if one exists, or to a deep-linked
 * Matrix Tool URL if it doesn't — per the internal linking guide, every
 * link must land on a real, working page; a row is never dropped and never
 * points to a URL that 404s.
 *
 * Returns both the table HTML and the individual ranked values (top country,
 * lowest country, etc.) so the calling code can use the same real numbers
 * in prose/FAQ content elsewhere on the page, not just inside the table.
 */
function buildTopCountriesTable(niche, multiplier, avgCountryRpm, linkMap, count) {
  const nicheSlug = createSlug(niche);
  const nicheGlobalAvgRpm = avgCountryRpm * multiplier;

  const ranked = countryList
    .map((code) => {
      const name = COUNTRY_NAMES[code] || code;
      const expectedRpm = countryRpm[code] * multiplier;
      const pctDiff = (
        ((expectedRpm - nicheGlobalAvgRpm) / nicheGlobalAvgRpm) *
        100
      ).toFixed(0);
      return { code, name, expectedRpm, pctDiff };
    })
    .sort((a, b) => b.expectedRpm - a.expectedRpm);

  const topRows = ranked.slice(0, count);
  const lowest = ranked[ranked.length - 1];

  const tableRows = topRows
    .map((c) => {
      const comboSlug = `${nicheSlug}-${createSlug(c.name)}-adsense-rpm`;
      const hasRealPage =
        linkMap[comboSlug] && linkMap[comboSlug].type === "niche-country";
      const href = hasRealPage
        ? `/blog/niche-country/${comboSlug}.html`
        : buildMatrixDeepLink(niche, c.name);
      const diffText =
        c.pctDiff > 0
          ? `+${c.pctDiff}%`
          : c.pctDiff < 0
            ? `${c.pctDiff}%`
            : "avg";
      return `
        <tr>
          <td><a class="c-link" href="${href}">${c.name}</a></td>
          <td>$${c.expectedRpm.toFixed(1)}</td>
          <td>${diffText}</td>
        </tr>`;
    })
    .join("");

  return {
    tableHtml: tableRows,
    topCountryName: topRows[0].name,
    topCountryRpm: topRows[0].expectedRpm,
    topCountryPctDiff: topRows[0].pctDiff,
    topCountryMultiplier: (topRows[0].expectedRpm / nicheGlobalAvgRpm).toFixed(1),
    lowRpm: lowest.expectedRpm,
    nicheGlobalAvgRpm,
  };
}

/**
 * TOP NICHES TABLE (country pages)
 * Mirror of buildTopCountriesTable, ranking the other direction: ranks ALL
 * niches by calculated RPM for this one country (not just niches with a
 * generated combo page). Same fallback rule — real combo page if one
 * exists, deep-linked Matrix Tool if not. A row is never dropped and never
 * points to a URL that 404s.
 */
function buildTopNichesTable(countryCode, countryName, rpm, avgMultiplier, linkMap, count) {
  const countrySlug = createSlug(countryName);
  const countryTypicalRpm = rpm * avgMultiplier;

  const ranked = nicheList
    .filter((n) => nicheMultiplier[n])
    .map((n) => {
      const expectedRpm = rpm * nicheMultiplier[n];
      const pctDiff = (
        ((expectedRpm - countryTypicalRpm) / countryTypicalRpm) *
        100
      ).toFixed(0);
      return { niche: n, expectedRpm, pctDiff, multiplier: nicheMultiplier[n] };
    })
    .sort((a, b) => b.expectedRpm - a.expectedRpm);

  const topRows = ranked.slice(0, count);
  const lowest = ranked[ranked.length - 1];

  const tableRows = topRows
    .map((n) => {
      const nicheSlug = createSlug(n.niche);
      const comboSlug = `${nicheSlug}-${countrySlug}-adsense-rpm`;
      const hasRealPage =
        linkMap[comboSlug] && linkMap[comboSlug].type === "niche-country";
      const href = hasRealPage
        ? `/blog/niche-country/${comboSlug}.html`
        : buildMatrixDeepLink(n.niche, countryName);
      const diffText =
        n.pctDiff > 0
          ? `+${n.pctDiff}%`
          : n.pctDiff < 0
            ? `${n.pctDiff}%`
            : "avg";
      return `
        <tr>
          <td><a class="c-link" href="${href}">${n.niche}</a></td>
          <td>$${n.expectedRpm.toFixed(1)}</td>
          <td>${diffText}</td>
        </tr>`;
    })
    .join("");

  return {
    tableHtml: tableRows,
    topNicheName: topRows[0].niche,
    topNicheRpm: topRows[0].expectedRpm,
    topNichePctDiff: topRows[0].pctDiff,
    topNicheMultiplier: topRows[0].multiplier,
    lowRpm: lowest.expectedRpm,
    countryTypicalRpm,
  };
}

/**
 * NICHE CALL-OUT BOX
 * Promotes the sister niche as a cross-niche pivot.
 */
function buildNicheCallout(niche) {
  const sister = sisterNiches[niche];

  // If no sister niche mapped, OR the mapped sister isn't actually a real
  // generated niche page (see the startup validation warning above), skip
  // the callout gracefully rather than ever link to a page that doesn't
  // exist — this is the actual hard guarantee, independent of whether
  // anyone reads the startup warning.
  if (!sister || !nicheList.includes(sister)) return "";

  const sisterSlug = createSlug(sister);
  const sisterMultiplier = nicheMultiplier[sister] || 1.0;
  const currentMultiplier = nicheMultiplier[niche] || 1.0;

  // Calculate % difference to make the copy accurate
  const pctDiff = (
    ((sisterMultiplier - currentMultiplier) / currentMultiplier) *
    100
  ).toFixed(0);
  const comparisonText =
    sisterMultiplier > currentMultiplier
      ? `often sees ${Math.abs(pctDiff)}% higher CPCs in similar markets`
      : `shares a similar advertiser pool with strong crossover potential`;

  return `
      <div class="mesh-callout-box">
        <h3>Related Vertical:</h3>
        <p>
        While <span>${niche}</span> yields strong volume,
        the <a class="c-link" href="/blog/niche/${sisterSlug}-adsense-rpm.html"><span>${sister}</span></a>
        vertical ${comparisonText}. Worth comparing before finalising your content strategy.
        </p>
      </div>`;
}

/**
 * COUNTRY CALL-OUT BOX
 * Tool hook pointing to the calculator filtered by this country.
 */
function buildCountryCallout(countryName, countryCode) {
  return `
      <div class="mesh-callout-box">
        <h3>Publisher Tool:</h3>
        <p>
        Want to see how all 30 niches perform in <span>${countryName}</span>?
        Use our <a class="c-link" href="/adsense-rpm-matrix.html?country=${countryCode}"><strong>AdSense RPM Matrix</strong></a>
        to sort by highest multiplier and find your best content opportunity.
        </p>
      </div>`;
}

/**
 * COMBO MINI-TABLE
 * Row 1: Better niche (higher multiplier) in same country — upsell
 * Row 2: Same niche in peer country (similar RPM) — lateral
 * Row 3: Parent niche pillar page — upward
 *
 * Fallback for Row 1 & 2: /blog/niche-country/
 */
function buildComboMiniTable(
  niche,
  countryCode,
  countryName,
  multiplier,
  baseRpm,
  currentSlug,
  linkMap,
) {
  const nicheSlug = createSlug(niche);
  const countrySlug = createSlug(countryName);

  // --- ROW 1: Better niche in same country (higher multiplier) ---
  // Find niches with a higher multiplier than current, sorted descending
  const betterNiches = nicheList
    .filter((n) => n !== niche && nicheMultiplier[n] > multiplier)
    .sort((a, b) => nicheMultiplier[b] - nicheMultiplier[a]);

  // Walk the list until we find one whose combo page was actually
  // generated — nicheList and countryList are broader than the ~83-190
  // real combos, so we can't assume betterNiches[0] has a live page.
  let row1Html = "";
  let betterNicheFound = null;
  for (const candidate of betterNiches) {
    const candidateSlug = createSlug(candidate);
    const candidateComboSlug = `${candidateSlug}-${countrySlug}-adsense-rpm`;
    if (
      linkMap[candidateComboSlug] &&
      linkMap[candidateComboSlug].type === "niche-country"
    ) {
      betterNicheFound = { niche: candidate, comboSlug: candidateComboSlug };
      break;
    }
  }

  if (betterNicheFound) {
    const betterRpm = (
      baseRpm * nicheMultiplier[betterNicheFound.niche]
    ).toFixed(1);
    row1Html = `
        <tr>
          <td><a class="c-link" href="/blog/niche-country/${betterNicheFound.comboSlug}.html">${betterNicheFound.niche} in ${countryName}</a></td>
          <td>$${betterRpm}</td>
          <td><a class="c-link" href="/blog/niche-country/${betterNicheFound.comboSlug}.html">Higher Value →</a></td>
        </tr>`;
  } else if (betterNiches.length > 0) {
    // Current niche isn't the highest, but none of the better niches have
    // a generated combo page for this country yet. Deep-link to the Matrix
    // Tool (pre-filtered) instead of dropping the row — matches the same
    // "never dead-end" rule niche/country pages already follow.
    const bestCandidate = betterNiches[0];
    const bestCandidateRpm = (baseRpm * nicheMultiplier[bestCandidate]).toFixed(1);
    const deepLink = buildMatrixDeepLink(bestCandidate, countryName);
    row1Html = `
        <tr>
          <td><a class="c-link" href="${deepLink}">${bestCandidate} in ${countryName}</a></td>
          <td>$${bestCandidateRpm}</td>
          <td><a class="c-link" href="${deepLink}">Check on Matrix →</a></td>
        </tr>`;
  } else {
    // Current niche genuinely IS the highest-multiplier option — no row needed.
    row1Html = "";
  }

  // --- ROW 2: Same niche in peer country (similar base RPM) ---
  // Find country with closest RPM, excluding current country
  const peerCountries = countryList
    .filter((code) => code !== countryCode)
    .map((code) => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      rpm: countryRpm[code],
      diff: Math.abs(countryRpm[code] - baseRpm),
    }))
    .sort((a, b) => a.diff - b.diff);

  let row2Html = "";
  // Try peer countries in order until we find one whose combo article was
  // actually generated (checked against linkMap, not just slug inequality)
  let peerFound = false;
  for (const peer of peerCountries.slice(0, 5)) {
    const peerComboSlug = `${nicheSlug}-${createSlug(peer.name)}-adsense-rpm`;
    const comboExists =
      linkMap[peerComboSlug] && linkMap[peerComboSlug].type === "niche-country";
    if (peerComboSlug !== currentSlug && comboExists) {
      const peerExpectedRpm = (peer.rpm * multiplier).toFixed(1);
      row2Html = `
        <tr>
          <td><a class="c-link" href="/blog/niche-country/${peerComboSlug}.html">${niche} in ${peer.name}</a></td>
          <td>$${peerExpectedRpm}</td>
          <td><a class="c-link" href="/blog/niche-country/${peerComboSlug}.html">Compare Market →</a></td>
        </tr>`;
      peerFound = true;
      break;
    }
  }

  if (!peerFound) {
    // None of the top-5 closest-RPM peer countries have a generated combo
    // page for this niche yet. Deep-link to the Matrix Tool (pre-filtered
    // to the single closest peer) instead of dropping the row.
    const closestPeer = peerCountries[0];
    if (closestPeer) {
      const closestPeerRpm = (closestPeer.rpm * multiplier).toFixed(1);
      const deepLink = buildMatrixDeepLink(niche, closestPeer.name);
      row2Html = `
        <tr>
          <td><a class="c-link" href="${deepLink}">${niche} in ${closestPeer.name}</a></td>
          <td>$${closestPeerRpm}</td>
          <td><a class="c-link" href="${deepLink}">Check on Matrix →</a></td>
        </tr>`;
    } else {
      row2Html = "";
    }
  }

  // --- ROW 3: Parent niche pillar — always exists, no fallback needed ---
  const parentRpm = (
    (Object.values(countryRpm).reduce((a, b) => a + b, 0) /
      Object.values(countryRpm).length) *
    multiplier
  ).toFixed(1);

  const row3Html = `
        <tr>
          <td><a class="c-link" href="/blog/niche/${nicheSlug}-adsense-rpm.html">Global ${niche} Data</a></td>
          <td>$${parentRpm} avg</td>
          <td><a class="c-link" href="/blog/niche/${nicheSlug}-adsense-rpm.html">Niche Overview →</a></td>
        </tr>`;

  return `
      <div class="mesh-mini-table">
        <table>
          <thead>
            <tr>
              <th>Alternative High-Value Data</th>
              <th>RPM</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            ${row1Html}
            ${row2Html}
            ${row3Html}
          </tbody>
        </table>
      </div>`;
}

/**
 * PEER COUNTRIES TABLE
 * Finds the closest-RPM countries to the current one, and shows what this
 * SAME niche would earn there. Links to each peer's country hub page
 * (not a niche-country combo page, since most combos don't exist as a
 * generated page — only ~83 do, so linking straight to a combo could
 * produce a broken link).
 */
function buildPeerCountriesTable(
  niche,
  countryCode,
  baseRpm,
  multiplier,
  count = 4,
) {
  const currentExpectedRpm = baseRpm * multiplier;

  const peers = countryList
    .filter((code) => code !== countryCode)
    .map((code) => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      baseRpm: countryRpm[code],
      diff: Math.abs(countryRpm[code] - baseRpm),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, count);

  return peers
    .map((peer) => {
      const peerExpectedRpm = peer.baseRpm * multiplier;
      const pctDiff = (
        ((peerExpectedRpm - currentExpectedRpm) / currentExpectedRpm) *
        100
      ).toFixed(0);
      const diffText =
        pctDiff > 0
          ? `${pctDiff}% higher`
          : pctDiff < 0
            ? `${Math.abs(pctDiff)}% lower`
            : "about the same";
      const peerSlug = createSlug(peer.name);
      return `
        <tr>
          <td><a href="/blog/country/${peerSlug}-adsense-rpm.html">${peer.name}</a></td>
          <td>$${peerExpectedRpm.toFixed(1)}</td>
          <td>${diffText}</td>
        </tr>`;
    })
    .join("");
}

/**
 * COMBO CALL-OUT BOX
 * Publisher insight linking to the pillar page.
 * Locked in decision: always links to how-much-does-adsense-pay
 */
function buildComboCallout(niche, countryName) {
  const nicheSlug = createSlug(niche);
  const countrySlug = createSlug(countryName);
  return `
  <div class="mesh-callout-box">
            <h3>Publisher Note:</h3>
            <p>
                <a class="c-link" href="/blog/niche/${nicheSlug}-adsense-rpm.html">${niche}</a> traffic in <a
                    class="c-link" href="/blog/country/${countrySlug}-adsense-rpm.html">${countryName}</a>
                is high-value, but competition is fierce. Check our guide on <a class="c-link"
                    href="/blog/how-much-does-adsense-pay.html">How Much AdSense Actually Pays</a> if your traffic is
                under
                10k monthly visitors — it covers realistic expectations at every stage of growth.
            </p>
        </div>`;
}

// ============================================================================
// GENERATE NICHE ARTICLES
// ============================================================================

// ============================================================================
// PRE-PASS: register every combo page in linkMap BEFORE any page is written.
// This lets sideways-link matching see every combo immediately — not just
// ones already processed — since only ~83 combos exist, not all 2,520.
// ============================================================================

topCombinations.forEach((combo) => {
  const { niche, countryCode } = combo;
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const nicheSlug = createSlug(niche);
  const countrySlug = createSlug(countryName);
  const currentSlug = `${nicheSlug}-${countrySlug}-adsense-rpm`;

  linkMap[currentSlug] = {
    title: `${niche} Website AdSense Earnings in ${countryName}`,
    url: `/blog/niche-country/${currentSlug}.html`,
    type: "niche-country",
    niche: niche,
    country: countryName,
    parentNiche: nicheSlug + "-adsense-rpm",
    parentCountry: countrySlug + "-adsense-rpm",
    related: [],
    tags: [nicheSlug, countrySlug, "combo-guide"],
  };
});

// Minimal skeleton entries for niche and country pages too — just enough
// (an existing linkMap key) for Phase 2 below to compute their `.related`
// arrays. Full title/url/tags get filled in when each page is actually
// written further down; that later assignment preserves `.related` rather
// than overwriting it, so nothing computed here gets lost.
nicheList.forEach((niche) => {
  const slug = createSlug(niche) + "-adsense-rpm";
  if (!linkMap[slug]) linkMap[slug] = { related: [] };
});
countryList.forEach((countryCode) => {
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const slug = createSlug(countryName) + "-adsense-rpm";
  if (!linkMap[slug]) linkMap[slug] = { related: [] };
});

// ============================================================================
// POPULATE ALL RELATED LINKS (moved up from "Phase 2")
// This now runs BEFORE any page is written, so each page's own `.related`
// array is already correct by the time its HTML gets generated — needed
// so related-article links can be written as real, static <a href> tags
// instead of being fetched and built later by client-side JavaScript.
// ============================================================================

console.log("\n🔗 Populating related links for all pSEO articles...");

// -------------------------------------------------------------------
// NICHE ARTICLES: 5 niche-country combos
// -------------------------------------------------------------------

nicheList.forEach((niche) => {
  const slug = createSlug(niche) + "-adsense-rpm";
  if (!linkMap[slug]) return;
  const topCombos = getTopCountriesForNiche(niche, linkMap, 5);
  linkMap[slug].related = topCombos;
});

// -------------------------------------------------------------------
// COUNTRY ARTICLES: 3 niche-country combos
// -------------------------------------------------------------------
countryList.forEach((countryCode) => {
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const slug = createSlug(countryName) + "-adsense-rpm";
  if (!linkMap[slug]) return;

  const topCombos = getTopNichesForCountry(countryName, linkMap, 3);
  linkMap[slug].related = topCombos;
});

// -------------------------------------------------------------------
// NICHE-COUNTRY ARTICLES: 1 parent country + 1 parent niche + 2 similar
// -------------------------------------------------------------------
topCombinations.forEach((combo) => {
  const { niche, countryCode } = combo;
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const nicheSlug = createSlug(niche);
  const countrySlug = createSlug(countryName);
  const slug = `${nicheSlug}-${countrySlug}-adsense-rpm`;

  if (!linkMap[slug]) return;

  const related = [];

  // 1. Parent country page
  related.push(countrySlug + "-adsense-rpm");

  // 2. Parent niche page
  related.push(nicheSlug + "-adsense-rpm");

  // 3. Two similar niche-country combos
  const relatedCombos = getRelatedNicheCountry(
    niche,
    countryName,
    slug,
    linkMap,
    2,
  );
  relatedCombos.forEach((c) => related.push(c));

  linkMap[slug].related = related;
});

console.log("✓ All pSEO related links populated");

// ============================================================================
// GENERATE NICHE ARTICLES
// ============================================================================

// ============================================================================
// ACTIVE NICHE TIER HELPER
// Determines which of niche-basic/standard/premium.html is ACTUALLY the
// active template for a given niche (from template_mapping), not the
// separately-computed multiplier-based tier — these could disagree, and
// content depth (table row count, extra analysis paragraphs) needs to
// match whichever template is really being rendered.
// ============================================================================
function getActiveCountryTierName(countryCode) {
  const templateName = testPageMap[countryCode];
  if (!templateName) return "standard"; // matches the default fallback template
  if (templateName.includes("premium")) return "premium";
  if (templateName.includes("basic")) return "basic";
  return "standard";
}

function getActiveNicheTierName(niche) {
  const templateName = testPageMap[niche];
  if (!templateName) return "standard"; // matches the default fallback template
  if (templateName.includes("premium")) return "premium";
  if (templateName.includes("basic")) return "basic";
  return "standard";
}

console.log("\n🔨 Generating niche articles...");

ensureDir(OUTPUT_DIRS.niche);

// Computed once — same baseline for every niche. Matches the precedent
// already used elsewhere in this file (buildComboMiniTable's row3Html).
const avgCountryRpm =
  Object.values(countryRpm).reduce((a, b) => a + b, 0) /
  Object.values(countryRpm).length;

nicheList.forEach((niche, index) => {
  const data = adBenchmarks[niche];
  const multiplier = nicheMultiplier[niche] || 1.0;
  const slug = createSlug(niche);
  const tier = getNicheTier(multiplier);

  // Generate dynamic intro
  const nicheTierIntro = getNicheTierForIntro(multiplier);
  const intros = introMap.niche[nicheTierIntro] || [introMap.niche.fallback];
  let intro = selectRandomIntro(intros, niche);

  intro = intro
    .replace(/{niche}/g, niche)
    .replace(/{rpm_range}/g, data.typical_rpm_range)
    .replace(/{multiplier}/g, multiplier);

  // Performance description
  let perfDesc = "";
  if (multiplier >= 2.0)
    perfDesc = "considered one of the highest-earning niches";
  else if (multiplier >= 1.5) perfDesc = "classified as a high-value niche";
  else if (multiplier >= 1.0) perfDesc = "positioned as a mid-tier niche";
  else perfDesc = "categorized as an entry-level niche";

  // Determine which tier template is actually active for this niche —
  // drives table row count and how much analysis content gets included
  const activeTier = getActiveNicheTierName(niche);
  const tableRowCount = activeTier === "premium" ? 5 : 3;

  // Build the unified top-countries table (real ranking, real links —
  // real combo page if one exists, deep-linked Matrix Tool if not)
  const topCountries = buildTopCountriesTable(
    niche,
    multiplier,
    avgCountryRpm,
    linkMap,
    tableRowCount,
  );

  // Revenue at common traffic levels, using the niche's real global-average
  // RPM (not a fabricated "US" assumption)
  const calculated10k = (topCountries.nicheGlobalAvgRpm * 10).toFixed(2);
  const calculated50k = (topCountries.nicheGlobalAvgRpm * 50).toFixed(2);
  const calculated100k = (topCountries.nicheGlobalAvgRpm * 100).toFixed(2);
  // Same math, but using the REAL top-performing country's RPM instead —
  // replaces the old fabricated "US traffic" multiplier claim
  const calculatedTop10k = (topCountries.topCountryRpm * 10).toFixed(2);

  const calloutBox = buildNicheCallout(niche);

  // Phrase-pool analysis content — standard and premium only (basic stays
  // lean by design). Seeded per-niche so each niche gets a consistent,
  // deterministic variant (not the same sentence on every page).
  const phraseTokens = {
    niche,
    tier,
    multiplier,
    cpc: data.cpc,
    ctr: data.ctr,
  };
  const whyThisNumber =
    activeTier !== "basic"
      ? buildPhrase(nichePhraseMap, "why_this_number", slug + "-why", phraseTokens)
      : "";
  const advertiserDemand =
    activeTier === "premium"
      ? buildPhrase(nichePhraseMap, "advertiser_demand", slug + "-demand", phraseTokens)
      : "";

  // Build the static related-articles HTML from the .related array that
  // was already computed above (before this write loop ran)
  const nicheSlugKey = slug + "-adsense-rpm";
  const relatedArticlesHtml = buildRelatedArticlesHtml(
    linkMap[nicheSlugKey] ? linkMap[nicheSlugKey].related : [],
    linkMap,
  );

  // Use test template if this niche is listed in template_mapping, otherwise use default
  const activeNicheTemplate = testPageMap[niche]
    ? testTemplates[testPageMap[niche]]
    : nicheTemplate;

  // Generate Niche HTML
  const nicheVars = {
    INTRO: intro,
    NICHE_NAME: niche,
    NICHE_SLUG: slug + "-adsense-rpm",
    CTR: data.ctr,
    CPC: data.cpc,
    RPM_RANGE: data.typical_rpm_range,
    MULTIPLIER: multiplier,
    NICHE_TIER: tier,
    PERFORMANCE_DESC: perfDesc,
    ARTICLE_ID: slug + "-adsense-rpm",
    TOP_COUNTRIES_TABLE: topCountries.tableHtml,
    TOP_COUNTRY_NAME: topCountries.topCountryName,
    TOP_COUNTRY_RPM: topCountries.topCountryRpm.toFixed(1),
    PERCENT_DIFF: Math.abs(topCountries.topCountryPctDiff),
    TOP_COUNTRY_MULTIPLIER: topCountries.topCountryMultiplier,
    RPM_LOW: topCountries.lowRpm.toFixed(1),
    CALCULATED_10K: calculated10k,
    CALCULATED_50K: calculated50k,
    CALCULATED_100K: calculated100k,
    CALCULATED_TOP_10K: calculatedTop10k,
    WHY_THIS_NUMBER: whyThisNumber,
    ADVERTISER_DEMAND: advertiserDemand,
    CALLOUT_BOX: calloutBox,
    SITE_HEADER: HEADER_HTML,
    SITE_FOOTER: FOOTER_HTML,
    RELATED_ARTICLES_HTML: relatedArticlesHtml,
  };

  let html = fillTemplate(activeNicheTemplate, nicheVars);

  // Write file
  const filename = `${slug}-adsense-rpm.html`;
  smartWriteFile(
    path.join(OUTPUT_DIRS.niche, filename),
    html,
    getPublishDate(),
  );

  // Add full title/url/tags to link-map — preserve the .related array
  // that was already computed before this loop ran, rather than wiping it
  const priorRelated = linkMap[nicheSlugKey]
    ? linkMap[nicheSlugKey].related
    : [];
  linkMap[nicheSlugKey] = {
    title: `AdSense RPM for ${niche} Websites`,
    url: `/blog/niche/${slug}-adsense-rpm.html`,
    type: "niche",
    niche: niche,
    related: priorRelated,
    tags: [createSlug(niche), tier, "niche-guide"],
  };

  process.stdout.write(
    `\r  Progress: ${index + 1}/${nicheList.length} niche articles`,
  );
});

console.log("\n✓ Niche articles generated");

// ============================================================================
// GENERATE COUNTRY ARTICLES
// ============================================================================

console.log("\n🌍 Generating country articles...");
ensureDir(OUTPUT_DIRS.country);

// Computed once — same baseline for every country, mirroring avgCountryRpm
// used on the niche side. Used as the "typical niche mix" reference point
// so each country's top-niches table can show a meaningful % difference.
const avgNicheMultiplier =
  Object.values(nicheMultiplier).reduce((a, b) => a + b, 0) /
  Object.values(nicheMultiplier).length;

countryList.forEach((countryCode, index) => {
  const rpm = countryRpm[countryCode];
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const slug = createSlug(countryName);
  const tier = getCountryTier(rpm);

  // Generate dynamic intro
  const countryTierIntro = getCountryTierForIntro(rpm);
  const intros = introMap.country[countryTierIntro] || [
    introMap.country.fallback,
  ];
  let intro = selectRandomIntro(intros, countryCode);

  intro = intro.replace(/{country}/g, countryName).replace(/{rpm}/g, rpm);

  // Tier description
  let tierDesc = "";
  if (tier === "tier-1") tierDesc = "top-tier";
  else if (tier === "tier-2") tierDesc = "mid-tier";
  else if (tier === "tier-3") tierDesc = "developing";
  else tierDesc = "emerging";

  // Determine which tier template is actually active for this country —
  // drives table row count and how much analysis content gets included
  const activeTier = getActiveCountryTierName(countryCode);
  const tableRowCount = activeTier === "premium" ? 5 : 3;

  // Build the unified top-niches table (real ranking, real links — real
  // combo page if one exists, deep-linked Matrix Tool if not)
  const topNiches = buildTopNichesTable(
    countryCode,
    countryName,
    rpm,
    avgNicheMultiplier,
    linkMap,
    tableRowCount,
  );

  // Revenue at common traffic levels, using this country's real typical
  // RPM (a country-average niche mix), not a single arbitrary niche
  const calculated10k = (topNiches.countryTypicalRpm * 10).toFixed(2);
  const calculated50k = (topNiches.countryTypicalRpm * 50).toFixed(2);
  const calculated100k = (topNiches.countryTypicalRpm * 100).toFixed(2);
  // Same math, but using the REAL top-performing niche's RPM instead
  const calculatedTop10k = (topNiches.topNicheRpm * 10).toFixed(2);

  const calloutBox = buildCountryCallout(countryName, countryCode);

  // Peer countries table — premium tier only. Reuses the same ranking
  // function combo pages already use (closest base RPM); passing
  // multiplier=1 shows each peer's own raw base RPM, since country pages
  // aren't tied to any one niche. All 56 countries have a real generated
  // page, so — unlike the niche/combo tables — no fallback check is
  // needed here; every peer link is always real.
  const peerCountriesTable =
    activeTier === "premium"
      ? buildPeerCountriesTable(null, countryCode, rpm, 1, 4)
      : "";

  // Phrase-pool analysis content — standard and premium only (basic stays
  // lean by design). Seeded per-country so each country gets a
  // consistent, deterministic variant.
  const phraseTokens = { country: countryName, tier: tierDesc, rpm: rpm };
  const whyThisNumber =
    activeTier !== "basic"
      ? buildPhrase(countryPhraseMap, "why_this_number", slug + "-why", phraseTokens)
      : "";
  const marketStrength =
    activeTier === "premium"
      ? buildPhrase(countryPhraseMap, "market_strength", slug + "-strength", phraseTokens)
      : "";

  // Build the static related-articles HTML from the .related array that
  // was already computed above (before this write loop ran)
  const countrySlugKey = slug + "-adsense-rpm";
  const relatedArticlesHtml = buildRelatedArticlesHtml(
    linkMap[countrySlugKey] ? linkMap[countrySlugKey].related : [],
    linkMap,
  );

  // Use test template if this country is listed in template_mapping, otherwise use default
  const activeCountryTemplate = testPageMap[countryCode]
    ? testTemplates[testPageMap[countryCode]]
    : countryTemplate;

  // Generate Country HTML
  const countryVars = {
    INTRO: intro,
    COUNTRY_NAME: countryName,
    COUNTRY_CODE: countryCode,
    COUNTRY_SLUG: slug + "-adsense-rpm",
    COUNTRY_RPM: rpm,
    COUNTRY_TIER: tier,
    TIER_DESC: tierDesc,
    ARTICLE_ID: slug + "-adsense-rpm",
    TOP_NICHES_TABLE: topNiches.tableHtml,
    TOP_NICHE_NAME: topNiches.topNicheName,
    TOP_NICHE_RPM: topNiches.topNicheRpm.toFixed(1),
    PERCENT_DIFF: Math.abs(topNiches.topNichePctDiff),
    TOP_NICHE_MULTIPLIER: topNiches.topNicheMultiplier,
    RPM_LOW: topNiches.lowRpm.toFixed(1),
    CALCULATED_10K: calculated10k,
    CALCULATED_50K: calculated50k,
    CALCULATED_100K: calculated100k,
    CALCULATED_TOP_10K: calculatedTop10k,
    PEER_COUNTRIES_TABLE: peerCountriesTable,
    WHY_THIS_NUMBER: whyThisNumber,
    MARKET_STRENGTH: marketStrength,
    CALLOUT_BOX: calloutBox,
    SITE_HEADER: HEADER_HTML,
    SITE_FOOTER: FOOTER_HTML,
    RELATED_ARTICLES_HTML: relatedArticlesHtml,
  };

  let html = fillTemplate(activeCountryTemplate, countryVars);

  // Write file
  const filename = `${slug}-adsense-rpm.html`;
  smartWriteFile(
    path.join(OUTPUT_DIRS.country, filename),
    html,
    getPublishDate(),
  );

  // Add full title/url/tags to link-map — preserve the .related array
  // that was already computed before this loop ran, rather than wiping it
  const priorCountryRelated = linkMap[countrySlugKey]
    ? linkMap[countrySlugKey].related
    : [];
  linkMap[countrySlugKey] = {
    title: `AdSense RPM in ${countryName}`,
    url: `/blog/country/${slug}-adsense-rpm.html`,
    type: "country",
    country: countryName,
    related: priorCountryRelated,
    tags: [slug, tier, "country-guide"],
  };

  process.stdout.write(
    `\r  Progress: ${index + 1}/${countryList.length} country articles`,
  );
});

console.log("\n✓ Country articles generated");

// ============================================================================
// GENERATE NICHE-COUNTRY COMBINATION ARTICLES
// ============================================================================

console.log("\n🎯 Generating niche-country combination articles...");
ensureDir(OUTPUT_DIRS.nicheCountry);

// Tracks combo pages with weak sideways linking, reported at the end
const weakSidewaysPages = [];

topCombinations.forEach((combo, index) => {
  const { niche, countryCode } = combo;
  const countryName = COUNTRY_NAMES[countryCode] || countryCode;
  const nicheSlug = createSlug(niche);
  const countrySlug = createSlug(countryName);
  const slug = `${nicheSlug}-${countrySlug}`;

  const nicheData = adBenchmarks[niche];
  const multiplier = nicheMultiplier[niche] || 1.0;
  const baseRpm = countryRpm[countryCode];
  const expectedRpmNum = baseRpm * multiplier;
  const expectedRpm = expectedRpmNum.toFixed(1);

  // Revenue at common traffic levels — RPM is "per 1,000 views", so
  // 10k views = 10x RPM, 50k = 50x, 100k = 100x
  const calculated10k = (expectedRpmNum * 10).toFixed(2);
  const calculated50k = (expectedRpmNum * 50).toFixed(2);
  const calculated100k = (expectedRpmNum * 100).toFixed(2);

  const nicheTier = getNicheTier(multiplier);
  const countryTier = getCountryTier(baseRpm);

  // Generate dynamic intro
  const combinedTier = getCombinedTierForIntro(multiplier, baseRpm);
  const intros = introMap.niche_country[combinedTier] || [
    introMap.niche_country.fallback,
  ];
  let intro = selectRandomIntro(intros, `${niche}|${countryCode}`);

  intro = intro
    .replace(/{niche}/g, niche)
    .replace(/{country}/g, countryName)
    .replace(/{base_rpm}/g, baseRpm)
    .replace(/{multiplier}/g, multiplier)
    .replace(/{expected_rpm}/g, expectedRpm);

  // Current article slug for self-link prevention
  const currentSlug = slug + "-adsense-rpm";

  // Store metadata needed for later related link generation — preserve
  // the .related array already computed before this loop ran (by the
  // pre-pass + related-links step above), rather than wiping it with [].
  const priorComboRelated = linkMap[currentSlug]
    ? linkMap[currentSlug].related
    : [];
  linkMap[currentSlug] = {
    title: `${niche} Website AdSense Earnings in ${countryName}`,
    url: `/blog/niche-country/${currentSlug}.html`,
    type: "niche-country",
    niche: niche,
    country: countryName,
    parentNiche: nicheSlug + "-adsense-rpm",
    parentCountry: countrySlug + "-adsense-rpm",
    related: priorComboRelated,
    tags: [nicheSlug, countrySlug, "combo-guide"],
  };

  // Build mini-table and call-out box
  const miniTable = buildComboMiniTable(
    niche,
    countryCode,
    countryName,
    multiplier,
    baseRpm,
    currentSlug,
    linkMap,
  );
  const calloutBox = buildComboCallout(niche, countryName);
  const peerCountriesTable = buildPeerCountriesTable(
    niche,
    countryCode,
    baseRpm,
    multiplier,
  );

  const phraseTokens = {
    niche,
    country: countryName,
    country_tier: countryTier,
    niche_tier: nicheTier,
    cpc: nicheData.cpc,
    ctr: nicheData.ctr,
    multiplier,
    base_rpm: baseRpm,
    expected_rpm: expectedRpm,
  };
  const whyThisNumber = buildComboPhrase(
    "why_this_number",
    currentSlug + "-why",
    phraseTokens,
  );
  const whatThisNumberBasic = buildComboPhrase(
    "what_this_number_basic",
    currentSlug + "-what",
    phraseTokens,
  );
  const bottomLine = buildComboPhrase(
    "bottom_line",
    currentSlug + "-bottom",
    phraseTokens,
  );
  const linkingVars = buildComboLinkingVars(
    niche,
    countryName,
    nicheSlug,
    countrySlug,
    currentSlug,
    linkMap,
  );

  // Build the static related-articles HTML from the .related array that
  // was already computed above (before this write loop ran)
  const relatedArticlesHtml = buildRelatedArticlesHtml(
    linkMap[currentSlug].related,
    linkMap,
  );

  if (linkingVars.sidewaysCount < 2) {
    weakSidewaysPages.push({
      slug: currentSlug,
      count: linkingVars.sidewaysCount,
    });
  }

  // Use test template if this combo is listed in template_mapping, otherwise use default
  const comboKey = `${niche}|${countryCode}`;
  const activeNicheCountryTemplate = testPageMap[comboKey]
    ? testTemplates[testPageMap[comboKey]]
    : nicheCountryTemplate;

  // Generate Combo HTML
  const comboVars = {
    INTRO: intro,
    NICHE_NAME: niche,
    COUNTRY_NAME: countryName,
    COUNTRY_CODE: countryCode,
    NICHE_SLUG: nicheSlug,
    COUNTRY_SLUG: countrySlug,
    COMBINED_SLUG: currentSlug,
    CTR: nicheData.ctr,
    CPC: nicheData.cpc,
    BASE_RPM: baseRpm,
    MULTIPLIER: multiplier,
    EXPECTED_RPM: expectedRpm,
    NICHE_TIER: nicheTier,
    COUNTRY_TIER: countryTier,
    ARTICLE_ID: currentSlug,
    MINI_TABLE: miniTable,
    CALLOUT_BOX: calloutBox,
    UP_NICHE_HUB_ANCHOR: linkingVars.upNicheAnchor,
    UP_COUNTRY_HUB_ANCHOR: linkingVars.upCountryAnchor,
    SIDEWAYS_LINKS_HTML: linkingVars.sidewaysHtml,
    NEXT_STEP_URL: linkingVars.nextStepUrl,
    NEXT_STEP_TITLE: linkingVars.nextStepTitle,
    PEER_COUNTRIES_TABLE: peerCountriesTable,
    CALCULATED_10K: calculated10k,
    CALCULATED_50K: calculated50k,
    CALCULATED_100K: calculated100k,
    WHY_THIS_NUMBER: whyThisNumber,
    WHAT_THIS_NUMBER_BASIC: whatThisNumberBasic,
    BOTTOM_LINE: bottomLine,
    SITE_HEADER: HEADER_HTML,
    SITE_FOOTER: FOOTER_HTML,
    RELATED_ARTICLES_HTML: relatedArticlesHtml,
  };

  let html = fillTemplate(activeNicheCountryTemplate, comboVars);

  // Write file
  const filename = `${slug}-adsense-rpm.html`;
  smartWriteFile(
    path.join(OUTPUT_DIRS.nicheCountry, filename),
    html,
    getPublishDate(),
  );

  process.stdout.write(
    `\r  Progress: ${index + 1}/${topCombinations.length} combination articles`,
  );
});

console.log("\n✓ Niche-country articles generated");

if (weakSidewaysPages.length > 0) {
  console.log(
    `\n⚠️  Pages with weak sideways linking (fewer than 2 related combos):`,
  );
  weakSidewaysPages.forEach((p) => {
    console.log(
      `   - ${p.slug}.html (${p.count} related combo${p.count === 1 ? "" : "s"} found)`,
    );
  });
  console.log(
    `   → Adding another combo sharing the same niche or country would strengthen these.`,
  );
}

// ============================================================================
// GENERATE NICHE-COUNTRY INDEX PAGE
// ============================================================================

function generateIndexPage(topCombinations) {
  console.log("\n📄 Generating niche-country index page...");

  // Prepare data array for JavaScript
  const dataArray = topCombinations.map((combo, index) => {
    const countryName = COUNTRY_NAMES[combo.countryCode] || combo.countryCode;
    const nicheSlug = createSlug(combo.niche);
    const countrySlug = createSlug(countryName);
    const multiplier = nicheMultiplier[combo.niche] || 1.0;
    const baseRpm = countryRpm[combo.countryCode];
    const expectedRpm = (baseRpm * multiplier).toFixed(2);

    return {
      rank: index + 1,
      niche: combo.niche,
      nicheSlug: nicheSlug,
      country: countryName,
      countrySlug: countrySlug,
      baseRpm: baseRpm.toFixed(2),
      multiplier: multiplier,
      expectedRpm: expectedRpm,
    };
  });

  // Convert to JSON string for embedding in template
  const dataArrayJS = JSON.stringify(dataArray, null, 12);

  // Replace placeholders in template.
  // This page always regenerates fresh on every run (it isn't run through
  // smartWriteFile's "only bump date if content changed" logic), so
  // "today" is the correct value for its displayed Updated date.
  let html = nicheCountryIndexTemplate
    .replace(
      /{{\s*MODIFIED_DATE_PRETTY\s*}}/g,
      toReadableDate(getCurrentDate()),
    )
    .replace(/{{\s*DATA_ARRAY\s*}}/g, dataArrayJS)
    .replace(/{{\s*SITE_HEADER\s*}}/g, HEADER_HTML)
    .replace(/{{\s*SITE_FOOTER\s*}}/g, FOOTER_HTML);

  // Write file
  fs.writeFileSync(path.join(OUTPUT_DIRS.nicheCountry, "index.html"), html);

  console.log("✓ Niche-country index page generated");
}

// Call the function
generateIndexPage(topCombinations);

// ============================================================================
// MANUAL BLOG RELATED LINKS
// ============================================================================

// Manual blog related links are managed in manual-posts.json
// The generator does not touch them - edit that file directly to update them
console.log("\n📖 Manual blog related links are managed in manual-posts.json");

console.log("\n💾 Saving link-map.json...");

// Save only pSEO articles — exclude manual blogs (they live in manual-posts.json)
const pseoOnlyMap = {};
for (const key in linkMap) {
  if (linkMap[key].type !== "manual-blog") {
    pseoOnlyMap[key] = linkMap[key];
  }
}

fs.writeFileSync(
  path.join(DATA_DIR, "link-map.json"),
  JSON.stringify(pseoOnlyMap, null, 2),
);
console.log("✓ link-map.json saved (pSEO articles only)");

// ============================================================================
// GENERATE BLOG INDEX SCHEMA
// ============================================================================

console.log("\n📝 Updating blog index schema...");

// Build sorted list of manual blog articles (newest first)
// manualLinkMap is already normalized so field names are consistent
const manualPosts = Object.values(manualLinkMap).sort(
  (a, b) => new Date(b.datePublished) - new Date(a.datePublished),
);

// Build the full @graph schema object
const blogSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://adstimate.com/blog/#webpage",
      url: "https://adstimate.com/blog/",
      headline:
        "AdSense Monetization Blog: RPM Benchmarks & Publisher Guides (2026)",
      description:
        "Expert tips, RPM benchmarks, and guides on how to maximize your Google AdSense earnings in 2026.",
      publisher: {
        "@type": "Organization",
        name: "Adstimate",
        logo: {
          "@type": "ImageObject",
          url: "https://adstimate.com/adstimate_logo.png",
        },
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://adstimate.com/blog/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "How much does Google AdSense pay per 1,000 views in 2026?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AdSense RPM in 2026 ranges from $1 to $60+ depending on your niche and audience geography. Finance and legal niches in Tier 1 countries like the US and Iceland achieve the highest rates.",
          },
        },
        {
          "@type": "Question",
          name: "Which niche pays the most on AdSense in 2026?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Finance remains the highest-paying AdSense niche in 2026, with a 3.0x multiplier and typical RPM ranges of $30-$60 for Tier 1 traffic.",
          },
        },
      ],
    },
    {
      "@type": "Blog",
      name: "Adstimate Blog",
      url: "https://adstimate.com/blog/",
      blogPost: manualPosts.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        url: `https://adstimate.com${post.url}`,
        datePublished: post.datePublished,
        dateModified: post.dateModified,
        description: post.description,
      })),
    },
  ],
};

// Build the replacement block
const schemaBlock = `<!-- BLOG-SCHEMA-START -->
  <script type="application/ld+json">
  ${JSON.stringify(blogSchema, null, 2)}
  <\/script>
  <!-- BLOG-SCHEMA-END -->`;

// Read blog/index.html
const blogIndexPath = path.join(BLOG_DIR, "index.html");

if (fs.existsSync(blogIndexPath)) {
  let blogIndexHtml = fs.readFileSync(blogIndexPath, "utf8");

  // Replace everything between the markers
  const schemaRegex =
    /<!-- BLOG-SCHEMA-START -->[\s\S]*?<!-- BLOG-SCHEMA-END -->/;

  if (schemaRegex.test(blogIndexHtml)) {
    blogIndexHtml = blogIndexHtml.replace(schemaRegex, schemaBlock);
    fs.writeFileSync(blogIndexPath, blogIndexHtml, "utf8");
    console.log("✓ blog/index.html schema updated");
  } else {
    console.warn(
      "⚠️  BLOG-SCHEMA markers not found in blog/index.html — skipping",
    );
  }
} else {
  console.warn("⚠️  blog/index.html not found — skipping schema update");
}

// ===============================================
// SUMMARY
// ===============================================

console.log("\n" + "=".repeat(60));
console.log("✅ GENERATION COMPLETE!");
console.log("=".repeat(60));
console.log(`📊 Total articles generated: ${Object.keys(linkMap).length}`);
console.log(`   - Manual blogs: ${Object.keys(manualLinkMap).length}`);
console.log(`   - Niche articles: ${nicheList.length}`);
console.log(`   - Country articles: ${countryList.length}`);
console.log(`   - Niche-country articles: ${topCombinations.length}`);
console.log(`\n📁 Output locations:`);
console.log(`   - ${OUTPUT_DIRS.niche}`);
console.log(`   - ${OUTPUT_DIRS.country}`);
console.log(`   - ${OUTPUT_DIRS.nicheCountry}`);
console.log(`   - ${path.join(DATA_DIR, "link-map.json")}`);
console.log("\n🔗 Topical Mesh: Mini-tables & Call-out boxes injected");
console.log("   - Niche articles: top 3 country combos + sister niche callout");
console.log(
  "   - Country articles: top 2 niches + peer country + calculator callout",
);
console.log(
  "   - Combo articles: upsell niche + peer country + parent niche + pillar callout",
);
console.log("\n🔗 Related Articles: 2+2+2 rule applied");
console.log("   - Each article has 6 related links:");
console.log("   - 2 from same category (most similar)");
console.log("   - 1 from each other pSEO category");
console.log("   - 2 smart-matched manual blogs");
// Log test pages generated
if (Object.keys(testPageMap).length > 0) {
  console.log(`\n🧪 Test Pages Generated: ${Object.keys(testPageMap).length}`);
  for (const [templateName, entries] of Object.entries(
    settings.template_mapping,
  )) {
    console.log(`\n   Template: ${templateName}`);
    entries.forEach((entry) => {
      if (typeof entry === "string" && entry.includes("|")) {
        const [niche, country] = entry.split("|");
        console.log(`   ✓ ${niche} in ${country}`);
      } else {
        console.log(`   ✓ ${entry}`);
      }
    });
  }
}

console.log("\n🚀 Ready to upload to your server!");
console.log("=".repeat(60) + "\n");
const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION
// ============================================================================

const POSTS_META = "./public/data/manual-posts.json"; // Single source of truth
const FAQS_DATA = "./public/data/faqs.json"; // FAQ data (optional per post)
const DRAFTS_DIR = "./drafts"; // Body content files
const TEMPLATE_FILE = "./templates/manual-posts-template.html"; // Layout wrapper
const OUTPUT_DIR = "./public/blog"; // Final HTML output

// Load settings (for resource hub blocking rules)
const SETTINGS_FILE = "./settings/adstimate-settings.json";
const settings = fs.existsSync(SETTINGS_FILE)
  ? JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"))
  : { resource_hub: { blocked_slugs: [], blocked_tags: [] } };

// ============================================================================
// UTILITY: Convert "2026-03-31" → "March 31, 2026"
// ============================================================================

function toReadableDate(dateStr) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Parse the date parts directly to avoid timezone issues
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

// ============================================================================
// UTILITY: Get today's date as YYYY-MM-DD
// ============================================================================

function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================================
// SMART WRITE FILE
// Compares the newly generated page against the existing file on disk.
// If nothing but the dates would differ, keeps the OLD dateModified.
// If real content changed, bumps dateModified to today.
// Returns true if a file was written, false if it was skipped (unchanged).
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

    const publishDatePretty = toReadableDate(publishDate);
    const modifiedDatePretty = toReadableDate(modifiedDate);

    let normalizedExisting = existingHtml
      .replace(new RegExp(publishDate, "g"), "{{DATE_MASK}}")
      .replace(new RegExp(modifiedDate, "g"), "{{DATE_MASK}}")
      .replace(new RegExp(publishDatePretty, "g"), "{{DATE_MASK_PRETTY}}")
      .replace(new RegExp(modifiedDatePretty, "g"), "{{DATE_MASK_PRETTY}}");

    let normalizedNew = htmlContent
      .replace(/{{DATE-PUBLISHED}}/g, "{{DATE_MASK}}")
      .replace(/{{DATE-MODIFIED}}/g, "{{DATE_MASK}}")
      .replace(/{{DATE-PUBLISHED-READABLE}}/g, "{{DATE_MASK_PRETTY}}")
      .replace(/{{DATE-MODIFIED-READABLE}}/g, "{{DATE_MASK_PRETTY}}");

    if (normalizedExisting === normalizedNew) {
      return false;
    }

    modifiedDate = today;
  }

  const publishDatePretty = toReadableDate(publishDate);
  const modifiedDatePretty = toReadableDate(modifiedDate);

  const finalHtml = htmlContent
    .replace(/{{DATE-PUBLISHED}}/g, publishDate)
    .replace(/{{DATE-MODIFIED}}/g, modifiedDate)
    .replace(/{{DATE-PUBLISHED-READABLE}}/g, publishDatePretty)
    .replace(/{{DATE-MODIFIED-READABLE}}/g, modifiedDatePretty);

  fs.writeFileSync(filePath, finalHtml, "utf8");
  return true;
}


// ============================================================================
// UTILITY: Ensure output directory exists
// ============================================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// UTILITY: Build FAQ HTML block and JSON-LD schema for a given slug
// Returns an object: { html: string, schema: string }
// Both are empty strings if the slug has no FAQs in faqs.json
// ============================================================================

function buildFaqBlock(slug, faqsData) {
  // Look up this post's slug in faqs.json
  const faqs = faqsData[slug];

  // If no FAQs exist for this post, return empty strings
  // The tokens will simply render as nothing in the template
  if (!faqs || faqs.length === 0) {
    return { html: "", schema: "" };
  }

  // -----------------------------------------------------------------------
  // Build the visible HTML section
  // A simple open list — no accordion, no JavaScript needed
  // -----------------------------------------------------------------------

  const faqItems = faqs
    .map(
      (faq) => `
      <div class="faq-item">
        <h3 class="faq-question">${faq.question}</h3>
        <p class="faq-answer">${faq.answer}</p>
      </div>`,
    )
    .join("\n");

  const html = `
  <section class="faq-section" id="faqs-anchor">
    <h2 class="faq-heading" style="margin-bottom: 1.5rem;">Frequently Asked Questions</h2>
    ${faqItems}
  </section>`;

  // -----------------------------------------------------------------------
  // Build the JSON-LD FAQ schema block
  // This is what Google reads to show FAQs in search results
  // It is a completely separate <script> block from the BlogPosting schema
  // -----------------------------------------------------------------------

  // Build the mainEntity array for the schema
  const schemaEntities = faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  }));

  const schemaObject = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: schemaEntities,
  };

  const schema = `
  <script type="application/ld+json">
  ${JSON.stringify(schemaObject, null, 2)}
  <\/script>`;

  return { html, schema };
}

// ============================================================================
// BUILD RESOURCE HUB HTML
// ============================================================================

function buildResourceHub(currentSlug, posts, hubSettings) {
  const blockedSlugs = hubSettings.blocked_slugs || [];
  const blockedTags = hubSettings.blocked_tags || [];

  // Helper: check if a post should be excluded
  function isBlocked(slug, post) {
    if (slug === currentSlug) return true; // never link to self
    if (blockedSlugs.includes(slug)) return true; // blocked by slug
    if (post.tags && post.tags.some((t) => blockedTags.includes(t)))
      return true; // blocked by tag
    return false;
  }

  // Separate pillar posts from regular posts
  const pillarPosts = [];
  const regularPosts = [];

  for (const [slug, post] of Object.entries(posts)) {
    if (isBlocked(slug, post)) continue;
    if (post.type === "pillar-blog") {
      pillarPosts.push({ slug, post });
    } else {
      regularPosts.push({ slug, post });
    }
  }

  // Group regular posts by their first tag
  // Each tag becomes one category column
  const tagGroups = {}; // { tagName: [ { slug, post }, ... ] }

  for (const { slug, post } of regularPosts) {
    const firstTag = post.tags && post.tags[0] ? post.tags[0] : "general";
    if (!tagGroups[firstTag]) tagGroups[firstTag] = [];
    tagGroups[firstTag].push({ slug, post });
  }

  // ── Build HTML ──────────────────────────────────────────────────

  let html = `<section id="resource-hub" class="resource-library anchor-target">
  <div class="container">
    <h2 style="text-align: center; margin-bottom: 2rem;">Adstimate Resource Library</h2>
    <div class="library-grid">`;

  // Pillar Posts column — always first
  if (pillarPosts.length > 0) {
    html += `
      <div class="library-cat">
        <h4>Pillar Posts</h4>
        <ul>`;
    for (const { slug, post } of pillarPosts) {
      html += `
          <li><a href="/blog/${slug}.html">${post.related_title}</a></li>`;
    }
    html += `
        </ul>
      </div>`;
  }

  // Tag category columns
  for (const [tag, items] of Object.entries(tagGroups)) {
    html += `
      <div class="library-cat">
        <h4>${tag}</h4>
        <ul>`;
    for (const { slug, post } of items) {
      html += `
          <li><a href="/blog/${slug}.html">${post.related_title}</a></li>`;
    }
    html += `
        </ul>
      </div>`;
  }

  html += `
    </div>
    <p style="text-align: center; margin-top: 2rem;">
      <a href="/blog/" class="c-link">Browse All Articles →</a>
    </p>
  </div>
</section>`;

  return html;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

function generate() {
  console.log("=".repeat(60));
  console.log("  Manual Post Generator");
  console.log("=".repeat(60));

  // --- Load files ---

  if (!fs.existsSync(POSTS_META)) {
    console.error(`\n❌ Cannot find: ${POSTS_META}`);
    console.error("   Make sure manual-posts.json is in the /data/ folder.\n");
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_FILE)) {
    console.error(`\n❌ Cannot find: ${TEMPLATE_FILE}`);
    console.error(
      "   Make sure manual-posts-template.html is in /templates/.\n",
    );
    process.exit(1);
  }

  // Load faqs.json — this is optional
  // If the file does not exist, we use an empty object
  // This means all posts simply render with no FAQ section
  let faqsData = {};
  if (fs.existsSync(FAQS_DATA)) {
    faqsData = JSON.parse(fs.readFileSync(FAQS_DATA, "utf8"));
    console.log(
      `✓ faqs.json loaded (${Object.keys(faqsData).length} posts with FAQs)`,
    );
  } else {
    console.log(
      "ℹ️  No faqs.json found in /data/ — all posts will generate without FAQs",
    );
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_META, "utf8"));
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");

  ensureDir(OUTPUT_DIR);

  const slugs = Object.keys(posts);
  let generated = 0;
  let unchanged = 0;
  let skipped = 0;
  const skippedList = [];

  console.log(`\n📋 Found ${slugs.length} posts in manual-posts.json\n`);

  // --- Process each post ---

  slugs.forEach((slug) => {
    const post = posts[slug];
    const draftPath = path.join(DRAFTS_DIR, `${slug}.html`);

    // Check draft file exists
    if (!fs.existsSync(draftPath)) {
      console.warn(
        `  ⚠️  Skipping "${slug}" — draft file not found: ${draftPath}`,
      );
      skipped++;
      skippedList.push(slug);
      return;
    }

    // Read body content
    const bodyContent = fs.readFileSync(draftPath, "utf8");


    // -----------------------------------------------------------------------
    // TITLE DISPLAY
    // Use title_display for the <h1> if it exists in manual-posts.json
    // Fall back to the plain title if title_display is not set
    // The plain title is always used for <title> tag and meta tags
    // -----------------------------------------------------------------------
    const titleDisplay = post.title_display ? post.title_display : post.title;

    // -----------------------------------------------------------------------
    // FAQ BLOCK
    // Look up this slug in faqs.json
    // Returns { html, schema } — both are empty strings if no FAQs found
    // -----------------------------------------------------------------------
    const { html: faqHtml, schema: faqSchema } = buildFaqBlock(slug, faqsData);

    // Handle optional subtitle — remove the line entirely if empty
    let html = template;
    if (!post.subtitle || post.subtitle.trim() === "") {
      html = html.replace(`<p class="subtitle">{{SUBTITLE}}</p>`, "");
    } else {
      html = html.replace(/{{SUBTITLE}}/g, post.subtitle);
    }

    // Replace all placeholders
    // Note: the 4 date tokens ({{DATE-PUBLISHED}}, {{DATE-MODIFIED}}, etc.)
    // are deliberately NOT filled in here — smartWriteFile() fills them
    // in below, after deciding whether dateModified should stay the same
    // or bump to today.
    html = html
      .replace(/{{TITLE}}/g, post.title)
      .replace(/{{TITLE_DISPLAY}}/g, titleDisplay)
      .replace(/{{META-DESC}}/g, post.meta_description)
      .replace(/{{SLUG}}/g, post.slug)
      .replace(/{{BLOG-CONTENT}}/g, bodyContent)
      .replace(
        /{{RESOURCE-HUB}}/g,
        buildResourceHub(post.slug, posts, settings.resource_hub || {}),
      )
      .replace(/{{FAQ_SECTION}}/g, faqHtml)
      .replace(/{{FAQ_SCHEMA}}/g, faqSchema);

    // Write output file — smartWriteFile compares against the existing
    // file and decides whether dateModified should change
    const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
    const wasWritten = smartWriteFile(outputPath, html, post.date_published);

    // Log whether this post had FAQs or not — helpful for debugging
    const hasFaqs = faqsData[slug] && faqsData[slug].length > 0;
    if (wasWritten) {
      console.log(`  ✓ ${slug}.html${hasFaqs ? " [FAQs ✓]" : ""}`);
      generated++;
    } else {
      console.log(`  • ${slug}.html [unchanged, dateModified kept]`);
      unchanged++;
    }
  });

  // --- Summary ---

  console.log("\n" + "=".repeat(60));
  console.log(
    `✅ Done! ${generated} pages generated, ${unchanged} unchanged → /${OUTPUT_DIR}/`,
  );

  if (skipped > 0) {
    console.log(`\n⚠️  ${skipped} post(s) skipped (no draft file found):`);
    skippedList.forEach((s) => console.log(`   - ${s}.html`));
    console.log(`\n   Add the missing files to /${DRAFTS_DIR}/ and run again.`);
  }

  console.log("=".repeat(60) + "\n");
}

// ============================================================================
// RUN
// ============================================================================

generate();

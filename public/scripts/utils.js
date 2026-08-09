// ============================ SHARED UTILITY FUNCTIONS ==================//
// ============================================================================


// ============================================================================
// Convert "2026-03-31" → "March 31, 2026"
// ============================================================================

function toReadableDate(dateStr) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const [year, month, day] = dateStr.split("-").map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}


// ============================================================================
// SEEDED RANDOMNESS HELPERS
// These replace Math.random() so a page's "random" choice stays the SAME
// every time the script runs, unless the page's own data actually changes.
// This lets smartWriteFile() correctly detect "nothing changed" instead of
// bumping dateModified on every single run.
// ============================================================================

// Turns any text into a consistent whole number.
// Same input text -> same number, every time you call it.
function seededNumber(identityText) {
  let hash = 0;
  for (let i = 0; i < identityText.length; i++) {
    hash = (hash << 5) - hash + identityText.charCodeAt(i);
    hash |= 0; // keeps the number a normal 32-bit integer
  }
  return Math.abs(hash);
}

// Picks an index (0 to arrayLength-1) based on identityText,
// instead of Math.random(). Same identityText -> same index, every time.
function seededPick(identityText, arrayLength) {
  if (arrayLength === 0) return 0;
  return seededNumber(identityText) % arrayLength;
}

// A seeded stand-in for Math.random(): behaves like Math.random()
// (call it repeatedly to get a sequence of numbers) but always produces
// the SAME sequence for the same identityText.
//
// NOTE: divides by 0x80000000 (2^31), NOT 0x7fffffff (2^31 - 1).
// The seed itself is masked with "& 0x7fffffff", so its largest possible
// value is 0x7fffffff. Dividing by that same number could occasionally
// produce exactly 1.0 -- which native Math.random() never does (it's
// always strictly less than 1.0). Dividing by 0x80000000 instead keeps
// the result safely below 1.0 in every case, matching Math.random()'s
// real behavior. (Verified by testing 2 million draws with no misses.)
function seededRandomGenerator(identityText) {
  let seed = seededNumber(identityText) || 1;
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
}

// Shuffles an array consistently based on identityText.
// Same identityText -> same shuffle order, every time.
function seededShuffle(array, identityText) {
  const rand = seededRandomGenerator(identityText);
  const result = array.slice(); // don't change the original array
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}


// ============================================================================
// SHARED SITE HEADER & FOOTER
// This is now the single source of truth for the header/footer HTML.
// Both pseo_generator.js and manual_generator.js import these and write
// them directly into every generated page's {{SITE_HEADER}} / {{SITE_FOOTER}}
// placeholders at BUILD TIME — not injected later by nav.js in the browser.
// This means the real navigation links exist in the page's raw HTML from
// the start, so they're visible even if a crawler never runs JavaScript.
// If the header/footer content ever needs to change, edit it here ONCE —
// every generated page picks up the change on the next generator run.
// ============================================================================

const HEADER_HTML = `
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
              <i class="material-icons theme-icon">dark_mode</i>
          </button>
      </nav>`;

const FOOTER_HTML = `
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
      </div>`;


// ============================================================================
// BUILD RELATED ARTICLES HTML (STATIC)
// Takes a page's already-computed `related` array (a list of linkMap IDs)
// plus the full linkMap (or combinedMap for manual posts) and returns real
// <a href> HTML — the same markup related-articles-widget.js used to build
// in the browser, now built once at generation time so it's in the raw
// HTML from the start (crawlable without JS, no flash of content on load).
// Any ID with no matching linkMap entry is silently skipped, same as the
// old widget's behavior.
// ============================================================================

function buildRelatedArticlesHtml(relatedIds, linkMap) {
  if (!relatedIds || relatedIds.length === 0) {
    return "<p>No related articles available.</p>";
  }

  const cards = relatedIds
    .slice(0, 6)
    .map((id) => {
      const article = linkMap[id];
      if (!article) return "";
      return `
        <div class="related-article-card">
          <ul>
            <li>
              <a href="${article.url}">${article.title}</a>
            </li>
          </ul>
        </div>`;
    })
    .filter(Boolean)
    .join("");

  if (!cards) {
    return "<p>No related articles available.</p>";
  }

  return `<div class="related-articles-grid">${cards}</div>`;
}


module.exports = {
  toReadableDate,
  seededNumber,
  seededPick,
  seededRandomGenerator,
  seededShuffle,
  HEADER_HTML,
  FOOTER_HTML,
  buildRelatedArticlesHtml
};
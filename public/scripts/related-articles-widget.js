/**
 * Related Articles Widget
 * Loads and displays related articles from:
 *   - /data/link-map.json      (pSEO articles)
 *   - /data/manual-posts.json  (manual blog articles)
 *
 * Usage: loadRelatedArticles('article-id'); or loadRelatedArticles(); (auto-detect)
 */
async function loadRelatedArticles(currentArticleId) {
  const container = document.getElementById("related-articles-container");
  if (!container) {
    console.warn("Related articles container not found");
    return;
  }

  try {
    // Show loading state
    container.innerHTML =
      '<p class="loading-text">Loading related articles...</p>';

    // Fetch both data sources in parallel
    const [pseoResponse, manualResponse] = await Promise.all([
      fetch("/data/link-map.json"),
      fetch("/data/manual-posts.json"),
    ]);

    if (!pseoResponse.ok) {
      throw new Error(`link-map.json error: ${pseoResponse.status}`);
    }
    if (!manualResponse.ok) {
      throw new Error(`manual-posts.json error: ${manualResponse.status}`);
    }

    const pseoMap   = await pseoResponse.json();
    const manualMap = await manualResponse.json();

    // Normalize manual posts to match the shape the widget expects:
    // { title, url, type } — using related_title if available, else title
    const normalizedManual = {};
    for (const slug in manualMap) {
      const post = manualMap[slug];
      normalizedManual[slug] = {
        title: post.related_title || post.title,  // prefer related_title for display
        url:   `/blog/${post.slug}.html`,
        type:  post.type,
      };
    }

    // Merge into one lookup map — pSEO entries first, manual entries second
    // If a slug exists in both (unlikely), manual wins
    const combinedMap = { ...pseoMap, ...normalizedManual };

    // Also keep the full manual map available for current article lookup
    // (we need the full related array, not just display fields)
    const fullManualMap = manualMap;

    // Auto-detect article ID if not provided
    if (!currentArticleId) {
      currentArticleId = autoDetectArticleId(combinedMap);
      if (!currentArticleId) {
        console.warn("Could not auto-detect article ID");
        container.innerHTML = "<p>No related articles found.</p>";
        return;
      }
    }

    // Get current article data — check full manual map first, then combined
    // (manual-posts.json has the full related array)
    let currentArticle = fullManualMap[currentArticleId] || combinedMap[currentArticleId];

    if (!currentArticle) {
      console.warn(`Article "${currentArticleId}" not found`);
      container.innerHTML = "<p>No related articles found.</p>";
      return;
    }

    // Get related article IDs (limit to 6)
    const relatedIds = currentArticle.related
      ? currentArticle.related.slice(0, 6)
      : [];

    if (relatedIds.length === 0) {
      container.innerHTML = "<p>No related articles available.</p>";
      return;
    }

    // Build HTML for related articles
    let html = '<div class="related-articles-grid">';

    for (let id of relatedIds) {
      const article = combinedMap[id];
      if (!article) {
        console.warn(`Related article "${id}" not found in either data source`);
        continue;
      }

      html += `
        <div class="related-article-card">
          <ul>
            <li>
              <a href="${article.url}">${article.title}</a>
            </li>
          </ul>
        </div>
      `;
    }

    html += "</div>";

    // Inject into page
    container.innerHTML = html;

  } catch (error) {
    console.error("Error loading related articles:", error);
    container.innerHTML =
      "<p>Unable to load related articles. Please refresh the page.</p>";
  }
}

/**
 * Auto-detect the current article ID based on the URL path
 * Works for both manual blogs and pSEO articles
 */
function autoDetectArticleId(combinedMap) {
  const currentPath = window.location.pathname;

  // Extract slug from filename
  // e.g. /blog/ad-serving-limits.html       → ad-serving-limits
  // e.g. /blog/niche/finance-adsense-rpm.html → finance-adsense-rpm
  const filename = currentPath.split("/").pop();
  const slug     = filename.replace(".html", "");

  // Direct slug match
  if (combinedMap[slug]) {
    return slug;
  }

  // Fallback: match by URL
  for (let id in combinedMap) {
    if (combinedMap[id].url === currentPath) {
      return id;
    }
  }

  console.warn("Auto-detect failed. Current path:", currentPath);
  console.warn("Extracted slug:", slug);
  return null;
}

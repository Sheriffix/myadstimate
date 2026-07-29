const fs = require("fs");
const path = require("path");

// ============================================
// CONFIGURATION - Edit these before running
// ============================================

const config = {
  // Your domain (no trailing slash)
  domain: "https://adstimate.com",

  // Source folder ('.' = current folder where script runs)
  sourceFolder: ".",

  // Folders to ignore
  ignoreFolders: ["node_modules", ".git", "data", "img", "scripts"],

  // Files to ignore
  ignoreFiles: ["404.html"],

  // File extensions to include
  includeExtensions: [".html", ".htm"],

  // Remove extension from URLs? (false = keep .html)
  removeExtension: false,

  // Priority settings
  priorities: {
    enabled: false, // set to true to use overrides
    overrides: {
      "/": 1.0,
      "/index": 1.0,
      "/blog": 0.8,
      "/about": 0.6,
    },
  },

  // Change frequency settings
  changefreq: {
    enabled: false, // set to true to use overrides
    overrides: {
      "/": "daily",
      "/blog": "daily",
      "/about": "monthly",
    },
  },

  // Show summary report
  showSummary: true,
};

// ============================================
// MAIN SCRIPT - Don't edit below this line
// ============================================

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function shouldIgnoreFolder(folderName) {
  return config.ignoreFolders.includes(folderName);
}

function shouldIgnoreFile(fileName) {
  return config.ignoreFiles.includes(fileName);
}

function shouldIncludeFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return config.includeExtensions.includes(ext);
}

function getPagePriority(url) {
  if (!config.priorities.enabled) return null;
  return config.priorities.overrides[url] || 0.5;
}

function getPageChangefreq(url) {
  if (!config.changefreq.enabled) return null;
  return config.changefreq.overrides[url] || "weekly";
}

function scanDirectory(dir, baseDir = "", folderCounts = {}) {
  const results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (shouldIgnoreFolder(item)) continue;

      const subResults = scanDirectory(
        fullPath,
        path.join(baseDir, item),
        folderCounts,
      );
      results.push(...subResults);
    } else if (stat.isFile()) {
      if (shouldIgnoreFile(item)) continue;
      if (!shouldIncludeFile(item)) continue;

      // Build URL
      let urlPath = path.join(baseDir, path.basename(item, path.extname(item)));

      // Normalize path
      urlPath = urlPath.replace(/\\/g, "/");
      if (!urlPath.startsWith("/")) urlPath = "/" + urlPath;

      // Handle index.html
      let url = urlPath;
      if (urlPath.endsWith("/index")) {
        url = urlPath.replace(/\/index$/, "/");
      }

      // Add or remove extension
      if (config.removeExtension) {
        // Already removed above
      } else {
        // Add back the extension for non-index files
        if (!url.endsWith("/")) {
          url = url + path.extname(item);
        }
      }

      // Get last modified date
      const lastmod = stat.mtime.toISOString();

      // Track folder counts
      const folderKey = baseDir || "/";
      folderCounts[folderKey] = (folderCounts[folderKey] || 0) + 1;

      results.push({
        url: config.domain + url,
        lastmod: lastmod,
        path: url,
      });
    }
  }

  return results;
}

function generateSitemap(pages) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of pages) {
    xml += "  <url>\n";
    xml += `    <loc>${page.url}</loc>\n`;
    xml += `    <lastmod>${page.lastmod}</lastmod>\n`;

    const priority = getPagePriority(page.path);
    if (priority !== null) {
      xml += `    <priority>${priority}</priority>\n`;
    }

    const changefreq = getPageChangefreq(page.path);
    if (changefreq !== null) {
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
    }

    xml += "  </url>\n";
  }

  xml += "</urlset>";
  return xml;
}

function printSummary(pages, folderCounts, filename) {
  console.log("\n📊 SITEMAP GENERATION SUMMARY");
  console.log("================================");
  console.log(`📍 Location: ${process.cwd()}`);
  console.log(`📁 Source: ${config.sourceFolder}`);
  console.log(`🌐 Domain: ${config.domain}`);
  console.log(`📄 Pages found: ${pages.length}`);
  console.log(`🗑️  Ignored folders: ${config.ignoreFolders.join(", ")}`);
  console.log(`🚫 Ignored files: ${config.ignoreFiles.join(", ")}`);
  console.log(`📝 Extensions: ${config.includeExtensions.join(", ")}`);
  console.log(
    `🔗 URLs: ${config.removeExtension ? "without" : "with"} .html extension`,
  );
  console.log(
    `⭐ Priorities: ${config.priorities.enabled ? "enabled" : "disabled"}`,
  );
  console.log(
    `🔄 Changefreq: ${config.changefreq.enabled ? "enabled" : "disabled"}`,
  );
  console.log("\n📂 Pages by folder:");

  // Sort folders
  const sortedFolders = Object.keys(folderCounts).sort();
  for (const folder of sortedFolders) {
    const displayFolder = folder || "/";
    const count = folderCounts[folder];
    const padding = " ".repeat(Math.max(0, 18 - displayFolder.length));
    console.log(`   ${displayFolder}${padding} ${count} pages`);
  }

  console.log(`\n📄 New sitemap: ${filename}`);
  console.log(`✅ Generation complete! ${pages.length} URLs added.\n`);
}

// ============================================
// RUN THE SCRIPT
// ============================================

try {
  const sourcePath = path.resolve(process.cwd(), config.sourceFolder);

  if (!fs.existsSync(sourcePath)) {
    console.error(
      `❌ Error: Source folder "${config.sourceFolder}" not found!`,
    );
    process.exit(1);
  }

  const folderCounts = {};
  const pages = scanDirectory(sourcePath, "", folderCounts);

  // Sort pages alphabetically by URL
  pages.sort((a, b) => a.url.localeCompare(b.url));

  const xml = generateSitemap(pages);
  const timestamp = getTimestamp();
  const filename = `sitemap_${timestamp}.xml`;
  const outputPath = path.join(process.cwd(), filename);

  fs.writeFileSync(outputPath, xml, "utf8");

  if (config.showSummary) {
    printSummary(pages, folderCounts, filename);
  }
} catch (error) {
  console.error("❌ Error generating sitemap:", error.message);
  process.exit(1);
}

const { URL } = require("url");
const axios = require("axios");
const { validateSourceUrl } = require("./ingestion-policy");

const REQUEST_TIMEOUT_MS = Number(process.env.LEGAL_AGENT_DISCOVERY_TIMEOUT_MS || 10000);
const MAX_DISCOVERED_LINKS = Number(process.env.LEGAL_AGENT_MAX_DISCOVERED_LINKS || 5000);

function toAbsoluteUrl(baseUrl, href) {
  try {
    const url = new URL(href, baseUrl);
    const checked = validateSourceUrl(url.toString());
    return checked.valid ? checked.url.toString() : null;
  } catch {
    return null;
  }
}

function sameOrigin(baseUrl, candidateUrl) {
  try {
    return new URL(baseUrl).origin === new URL(candidateUrl).origin;
  } catch {
    return false;
  }
}

function extractLinks(baseUrl, html, limit = MAX_DISCOVERED_LINKS) {
  const links = new Set();
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(String(html || ""))) && links.size < limit) {
    const absolute = toAbsoluteUrl(baseUrl, match[1]);
    if (!absolute || !sameOrigin(baseUrl, absolute)) continue;
    if (/\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|mp4|mp3|zip)(\?|$)/i.test(absolute)) continue;
    links.add(absolute);
  }
  return [...links];
}

function extractSitemapUrls(xml, limit = MAX_DISCOVERED_LINKS) {
  const urls = new Set();
  const regex = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(String(xml || ""))) && urls.size < limit) {
    const candidate = match[1].trim();
    try {
      const checked = validateSourceUrl(candidate);
      if (checked.valid) urls.add(checked.url.toString());
    } catch {}
  }
  return [...urls];
}

async function fetchText(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 0,
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 300,
    headers: { Accept: "text/xml,application/xml,text/html;q=0.9,*/*;q=0.1" }
  });
  return String(response.data || "");
}

async function discoverSourceUrls(source, options = {}) {
  const maxLinks = Math.max(10, Math.min(MAX_DISCOVERED_LINKS, Number(options.maxLinks) || MAX_DISCOVERED_LINKS));
  const discovered = new Set();
  const failures = [];

  const sitemapCandidates = [
    `${source.url.replace(/\/$/, "")}/sitemap.xml`,
    `${source.url.replace(/\/$/, "")}/sitemap_index.xml`,
    `${source.url.replace(/\/$/, "")}/wp-sitemap.xml`
  ];

  for (const sitemapUrl of sitemapCandidates) {
    try {
      const checked = validateSourceUrl(sitemapUrl);
      if (!checked.valid) continue;
      const xml = await fetchText(checked.url.toString());
      for (const url of extractSitemapUrls(xml, maxLinks)) {
        if (sameOrigin(source.url, url)) discovered.add(url);
        if (discovered.size >= maxLinks) break;
      }
    } catch (error) {
      failures.push({ url: sitemapUrl, error: error.message });
    }
    if (discovered.size >= maxLinks) break;
  }

  try {
    const html = await fetchText(source.url);
    for (const url of extractLinks(source.url, html, maxLinks)) {
      discovered.add(url);
      if (discovered.size >= maxLinks) break;
    }
  } catch (error) {
    failures.push({ url: source.url, error: error.message });
  }

  return {
    urls: [...discovered].slice(0, maxLinks),
    failures
  };
}

module.exports = {
  toAbsoluteUrl,
  sameOrigin,
  extractLinks,
  extractSitemapUrls,
  discoverSourceUrls
};

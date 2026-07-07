/* Scan all Airtable Sources and store their 10 latest content items */

const BASE_ID    = 'app59olgEI4U7pf1G';
const AT_SOURCES = `https://api.airtable.com/v0/${BASE_ID}/Sources`;

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function extractRecentLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const results = [];

  for (const m of html.matchAll(/<a[^>]+href="([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].trim();
    const rawTitle = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!rawTitle || rawTitle.length < 5) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (
        resolved.hostname === base.hostname &&
        resolved.pathname !== base.pathname &&
        resolved.pathname !== '/' &&
        !resolved.search &&
        !/\.(jpg|jpeg|png|gif|pdf|svg|webp|zip|css|js)$/i.test(resolved.pathname) &&
        !seen.has(resolved.href)
      ) {
        seen.add(resolved.href);
        results.push({ title: rawTitle.slice(0, 150), url: resolved.href });
      }
    } catch { /* invalid URL */ }
  }

  return results.slice(0, 3);
}

function extractArticleExcerpt(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 900).trim();
}

async function fetchExcerpt(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentFactory/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const excerpt = extractArticleExcerpt(html);
    return excerpt.length >= 100 ? excerpt : null;
  } catch {
    return null;
  }
}

async function scanSource(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentFactory/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const rawLinks = extractRecentLinks(html, url);
  const anchorCount = (html.match(/<a[^>]+href=/gi) || []).length;

  const links = await Promise.all(rawLinks.map(async l => {
    const excerpt = await fetchExcerpt(l.url);
    return excerpt ? { ...l, excerpt } : l;
  }));

  return { links, htmlLength: html.length, anchorCount };
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const dryRun = req.query?.dryRun === '1' || req.body?.dryRun === true;

  try {
    const atRes = await fetch(`${AT_SOURCES}?pageSize=100`, { headers: atHeaders() });
    if (!atRes.ok) throw new Error(`Airtable fetch failed: ${atRes.status}`);
    const atData = await atRes.json();
    const records = atData.records || [];

    const withUrl = records.filter(r => r.fields.url);
    const results = { updated: 0, skipped: 0, errors: [], diagnostic: [] };

    await Promise.all(withUrl.map(async record => {
      const url = record.fields.url;
      const nom = record.fields.Nom || '';
      try {
        const { links, htmlLength, anchorCount } = await scanSource(url);
        const linksExtracted = links.length;

        let reason = null;
        if (linksExtracted === 0) {
          reason = anchorCount === 0
            ? 'aucune balise <a> — probable rendu JS'
            : `${anchorCount} liens présents mais filtrés`;
        }

        results.diagnostic.push({
          nom, url, htmlLength, anchorCountInPage: anchorCount, linksExtracted, reason,
        });

        if (linksExtracted === 0) {
          results.skipped++;
          return;
        }

        if (dryRun) {
          results.updated++;
          return;
        }

        const content = links
          .map(l => l.excerpt
            ? `${l.title} — ${l.url}\nExtrait : ${l.excerpt}`
            : `${l.title} — ${l.url}`)
          .join('\n');

        const patchRes = await fetch(`${AT_SOURCES}/${record.id}`, {
          method:  'PATCH',
          headers: atHeaders(),
          body:    JSON.stringify({ fields: { 'Derniers contenus': content } }),
        });
        if (!patchRes.ok) {
          const patchData = await patchRes.json();
          throw new Error(patchData.error?.message || `Airtable patch ${patchRes.status}`);
        }
        results.updated++;
      } catch (e) {
        results.errors.push({ url, error: e.message });
        results.skipped++;
      }
    }));

    return res.status(200).json({ success: true, total: withUrl.length, ...results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

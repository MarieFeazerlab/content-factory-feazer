/* One-time setup: creates Airtable tables and populates default sources */

const BASE_ID   = 'app59olgEI4U7pf1G';
const META_BASE = `https://api.airtable.com/v0/meta/bases/${BASE_ID}`;
const DATA_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

const DEFAULT_SOURCES = [
  { Nom: 'Think with Google',   URL: 'https://www.thinkwithgoogle.com',                                  Pilier: 'P1' },
  { Nom: 'McKinsey',            URL: 'https://www.mckinsey.com/capabilities/growth-marketing-and-sales',  Pilier: 'P1' },
  { Nom: 'Nielsen',             URL: 'https://www.nielsen.com/insights',                                  Pilier: 'P1' },
  { Nom: 'Kantar',              URL: 'https://www.kantar.com/inspiration',                                Pilier: 'P1' },
  { Nom: 'Gartner',             URL: 'https://www.gartner.com/en/marketing',                              Pilier: 'P1' },
  { Nom: 'WARC',                URL: 'https://www.warc.com',                                              Pilier: 'P1' },
  { Nom: 'Statista',            URL: 'https://www.statista.com',                                          Pilier: 'P1' },
  { Nom: 'Ads by Alvin',        URL: 'https://www.adsbyalvin.com/articles',                               Pilier: 'P1' },
  { Nom: 'Alvin Ding Substack', URL: 'https://alvinding.substack.com/feed',                               Pilier: 'P2' },
  { Nom: 'eMarketer',           URL: 'https://www.emarketer.com',                                         Pilier: 'P2' },
  { Nom: 'The Drum',            URL: 'https://www.thedrum.com',                                           Pilier: 'P2' },
  { Nom: 'Superside',           URL: 'https://www.superside.com/blog',                                    Pilier: 'P2' },
  { Nom: 'Mintoiro',            URL: 'https://www.mintoiro.com/blog',                                     Pilier: 'P2' },
  { Nom: 'Brand New',           URL: 'https://www.underconsideration.com/brandnew',                       Pilier: 'P3' },
  { Nom: "It's Nice That",      URL: 'https://www.itsnicethat.com',                                       Pilier: 'P3' },
  { Nom: 'Dezeen',              URL: 'https://www.dezeen.com/design',                                     Pilier: 'P3' },
  { Nom: 'Fast Company Design', URL: 'https://www.fastcompany.com/design',                                Pilier: 'P3' },
];

const TABLE_SCHEMAS = [
  {
    name: 'Sources',
    fields: [
      { name: 'Nom',       type: 'singleLineText' },
      { name: 'URL',       type: 'url' },
      { name: 'Catégorie', type: 'singleLineText' },
      { name: 'Notes',     type: 'multilineText' },
    ],
  },
];

async function tableExists(name) {
  const res  = await fetch(`${META_BASE}/tables`, { headers: atHeaders() });
  const data = await res.json();
  return (data.tables || []).some(t => t.name === name);
}

async function createTable(schema) {
  const res = await fetch(`${META_BASE}/tables`, {
    method:  'POST',
    headers: atHeaders(),
    body:    JSON.stringify(schema),
  });
  return res.json();
}

async function populateSources() {
  const checkRes  = await fetch(
    `${DATA_BASE}/${encodeURIComponent('Sources')}?pageSize=1`,
    { headers: atHeaders() }
  );
  const checkData = await checkRes.json();
  if ((checkData.records || []).length > 0) {
    return { skipped: true, message: 'Sources already populated' };
  }

  const results = [];
  for (const src of DEFAULT_SOURCES) {
    const r = await fetch(`${DATA_BASE}/${encodeURIComponent('Sources')}`, {
      method:  'POST',
      headers: atHeaders(),
      body:    JSON.stringify({ fields: { ...src, 'Catégorie': 'Sources' } }),
    });
    results.push(await r.json());
  }
  return { created: results.length };
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action } = req.body || {};
    const results    = {};

    if (!action || action === 'tables') {
      for (const schema of TABLE_SCHEMAS) {
        const exists = await tableExists(schema.name).catch(() => false);
        if (!exists) {
          const r = await createTable(schema);
          results[schema.name] = r.error ? `Error: ${r.error.message}` : 'created';
        } else {
          results[schema.name] = 'already exists';
        }
      }
    }

    if (!action || action === 'sources') {
      results.sources = await populateSources();
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

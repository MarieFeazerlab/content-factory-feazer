/* One-time setup: creates Airtable tables and populates default sources */

const BASE_ID   = 'app59olgEI4U7pf1G';
const META_BASE = `https://api.airtable.com/v0/meta/bases/${BASE_ID}`;
const DATA_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

const DEFAULT_SOURCES = [
  { Nom: 'Think with Google',   url: 'https://www.thinkwithgoogle.com',                                  Pilier: 'P1' },
  { Nom: 'McKinsey',            url: 'https://www.mckinsey.com/capabilities/growth-marketing-and-sales',  Pilier: 'P1' },
  { Nom: 'Nielsen',             url: 'https://www.nielsen.com/insights',                                  Pilier: 'P1' },
  { Nom: 'Kantar',              url: 'https://www.kantar.com/inspiration',                                Pilier: 'P1' },
  { Nom: 'Gartner',             url: 'https://www.gartner.com/en/marketing',                              Pilier: 'P1' },
  { Nom: 'WARC',                url: 'https://www.warc.com',                                              Pilier: 'P1' },
  { Nom: 'Statista',            url: 'https://www.statista.com',                                          Pilier: 'P1' },
  { Nom: 'Ads by Alvin',        url: 'https://www.adsbyalvin.com/articles',                               Pilier: 'P1' },
  { Nom: 'Alvin Ding Substack', url: 'https://alvinding.substack.com/feed',                               Pilier: 'P2' },
  { Nom: 'eMarketer',           url: 'https://www.emarketer.com',                                         Pilier: 'P2' },
  { Nom: 'The Drum',            url: 'https://www.thedrum.com',                                           Pilier: 'P2' },
  { Nom: 'Superside',           url: 'https://www.superside.com/blog',                                    Pilier: 'P2' },
  { Nom: 'Mintoiro',            url: 'https://www.mintoiro.com/blog',                                     Pilier: 'P2' },
  { Nom: 'Brand New',           url: 'https://www.underconsideration.com/brandnew',                       Pilier: 'P3' },
  { Nom: "It's Nice That",      url: 'https://www.itsnicethat.com',                                       Pilier: 'P3' },
  { Nom: 'Dezeen',              url: 'https://www.dezeen.com/design',                                     Pilier: 'P3' },
  { Nom: 'Fast Company Design',          url: 'https://www.fastcompany.com/design',                                                                    Pilier: 'P3' },
  { Nom: 'Blog du Modérateur IA Design', url: 'https://www.blogdumoderateur.com/72-pourcent-designers-ia-generative/',                             Pilier: 'P4' },
  { Nom: 'Adobe Firefly France',         url: 'https://www.adobe.com/fr/products/firefly/discover/ai-in-creative-industries-france.htm',           Pilier: 'P4' },
  { Nom: 'HubSpot IA Stats',             url: 'https://www.hubspot.fr/statistiques-intelligence-artificielle',                                     Pilier: 'P4' },
  { Nom: 'BCG GenAI CMO',                url: 'https://www.bcg.com/press/20june2025-ia-generative-cmo-investment-trend',                           Pilier: 'P4' },
  { Nom: 'Osmova IA Graphistes',         url: 'https://osmova.com/ia-va-t-elle-remplacer-les-graphistes/',                                         Pilier: 'P4' },
  { Nom: 'Webmarketing-com IA Canva',    url: 'https://www.webmarketing-com.com/etude-ia-generative-marketing-digital-96-marketeurs-virage',       Pilier: 'P4' },
];

const TABLE_SCHEMAS = [
  {
    name: 'Sources',
    fields: [
      { name: 'Nom',       type: 'singleLineText' },
      { name: 'url',       type: 'url' },
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

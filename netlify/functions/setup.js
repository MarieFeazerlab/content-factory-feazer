/* One-time setup: creates Airtable tables and populates default sources */

const BASE_ID   = 'app59olgEI4U7pf1G';
const META_BASE = `https://api.airtable.com/v0/meta/bases/${BASE_ID}`;
const DATA_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

const DEFAULT_SOURCES = [
  { Nom: 'Think with Google',   URL: 'https://www.thinkwithgoogle.com',                                 Pilier: 'P1' },
  { Nom: 'McKinsey',            URL: 'https://www.mckinsey.com/capabilities/growth-marketing-and-sales', Pilier: 'P1' },
  { Nom: 'Nielsen',             URL: 'https://www.nielsen.com/insights',                                 Pilier: 'P1' },
  { Nom: 'Kantar',              URL: 'https://www.kantar.com/inspiration',                               Pilier: 'P1' },
  { Nom: 'Gartner',             URL: 'https://www.gartner.com/en/marketing',                             Pilier: 'P1' },
  { Nom: 'WARC',                URL: 'https://www.warc.com',                                             Pilier: 'P1' },
  { Nom: 'Statista',            URL: 'https://www.statista.com',                                         Pilier: 'P1' },
  { Nom: 'Ads by Alvin',        URL: 'https://www.adsbyalvin.com/articles',                              Pilier: 'P1' },
  { Nom: 'Alvin Ding Substack', URL: 'https://alvinding.substack.com/feed',                              Pilier: 'P2' },
  { Nom: 'eMarketer',           URL: 'https://www.emarketer.com',                                        Pilier: 'P2' },
  { Nom: 'The Drum',            URL: 'https://www.thedrum.com',                                          Pilier: 'P2' },
  { Nom: 'Superside',           URL: 'https://www.superside.com/blog',                                   Pilier: 'P2' },
  { Nom: 'Mintoiro',            URL: 'https://www.mintoiro.com/blog',                                    Pilier: 'P2' },
  { Nom: 'Brand New',           URL: 'https://www.underconsideration.com/brandnew',                      Pilier: 'P3' },
  { Nom: "It's Nice That",      URL: 'https://www.itsnicethat.com',                                      Pilier: 'P3' },
  { Nom: 'Dezeen',              URL: 'https://www.dezeen.com/design',                                    Pilier: 'P3' },
  { Nom: 'Fast Company Design', URL: 'https://www.fastcompany.com/design',                               Pilier: 'P3' },
];

const TABLE_SCHEMAS = [
  {
    name: 'Sources',
    fields: [
      { name: 'Nom',    type: 'singleLineText' },
      { name: 'URL',    type: 'url' },
      { name: 'Pilier', type: 'singleSelect', options: { choices: [{ name: 'P1' }, { name: 'P2' }, { name: 'P3' }] } },
      { name: 'Type',   type: 'singleSelect', options: { choices: [{ name: 'url' }, { name: 'call' }, { name: 'repurposing' }] } },
      { name: 'Actif',  type: 'checkbox',     options: { color: 'greenBright', icon: 'check' } },
    ],
  },
  {
    name: 'Calls',
    fields: [
      { name: 'Nom',                type: 'singleLineText' },
      { name: 'Date',               type: 'date',     options: { dateFormat: { name: 'iso' } } },
      { name: 'Contenu brut',       type: 'multilineText' },
      { name: 'Insights extraits',  type: 'multilineText' },
    ],
  },
  {
    name: 'Repurposing',
    fields: [
      { name: 'URL',             type: 'url' },
      { name: 'Titre',           type: 'singleLineText' },
      { name: 'Angles extraits', type: 'multilineText' },
      { name: 'Date',            type: 'date', options: { dateFormat: { name: 'iso' } } },
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
  // Check if sources already exist
  const checkRes = await fetch(
    `${DATA_BASE}/${encodeURIComponent('Sources')}?pageSize=1`,
    { headers: atHeaders() }
  );
  const checkData = await checkRes.json();
  if ((checkData.records || []).length > 0) {
    return { skipped: true, message: 'Sources already populated' };
  }

  const results = [];
  for (const src of DEFAULT_SOURCES) {
    const res = await fetch(`${DATA_BASE}/${encodeURIComponent('Sources')}`, {
      method:  'POST',
      headers: atHeaders(),
      body:    JSON.stringify({ fields: { ...src, Type: 'url', Actif: true } }),
    });
    results.push(await res.json());
  }
  return { created: results.length };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { action } = JSON.parse(event.body || '{}');
    const results    = {};

    if (!action || action === 'tables') {
      // Create missing tables
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
      const sourcesRes = await populateSources();
      results.sources = sourcesRes;
    }

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ success: true, results }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message }),
    };
  }
};

/* Generate week ideas — direct Anthropic API via fetch */

const BASE_ID  = 'app59olgEI4U7pf1G';
const TABLE_ID = 'tblqdCcogbkp8RZhJ';
const AT_BASE  = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

const PILIER_LABEL = {
  P1: 'P1 — Autorité',
  P2: 'P2 — Démonstration',
  P3: 'P3 — Culture / Différenciation',
  P4: 'P4 — IA for Creative',
};

const PILIER_DESC = {
  P1: "Autorité — Feazer comme référence sur la production visuelle et créative pour les équipes marketing 200-5000 salariés. Données, benchmarks et études sur : l'impact business du motion design, les tendances visuelles, la production créative, le branding visuel, le contenu visuel sur les réseaux sociaux. L'angle : les directions marketing sous-estiment ce que la créa visuelle leur coûte quand elle est mal organisée. PÉRIMÈTRE STRICT : uniquement design, créa, production visuelle, branding, contenu visuel. Hors scope : SEO, emailing, stratégie digitale générale, paid media.",
  P2: "Démonstration — Preuves concrètes que Feazer délivre sur un service spécifique : motion design, illustration, graphic design, identité visuelle, production vidéo, etc. OBLIGATION : chaque post est centré sur UN service Feazer précis, avec un bénéfice mesurable ou un chiffre concret lié à ce service. Sources : feazer.com/services et feazer.com/cas-clients. L'angle : on ne dit pas qu'on est bons, on montre le résultat précis d'un service précis pour un type de client précis. Aucun post générique sur Feazer.",
  P3: "Culture / Différenciation — Feazer est une solution de creative ops qui se plugge aux équipes marketing existantes et aux studios de design internes sans les remplacer. Chef de projet dédié, continuité, réactivité. L'angle : Feazer complète l'équipe interne, il ne la substitue pas.",
  P4: "IA for Creative — L'IA comme accélérateur maîtrisé pour les équipes créa et marketing de grandes entreprises. Vitesse, gains concrets, outils — mais aussi ce qui ne s'automatise pas et comment l'intégrer sans perdre le contrôle. L'angle : on teste, on maîtrise, on a un point de vue assumé.",
};

const PILIER_CATEGORIES = {
  P1: ['Marketing / Data FR', 'Marketing / Data Global'],
  P2: ['Terrain / RDV clients', 'Feazer'],
  P3: ['Créa / Design', 'Feazer'],
  P4: ['IA for Creative'],
};

const PILIER_SOURCE_INSTRUCTIONS = {
  P1: "Utilise UNIQUEMENT les données chiffrées et études des sources Marketing. N'utilise PAS les verbatims clients.",
  P2: "Utilise le contenu de feazer.com/services et feazer.com/cas-clients fourni ci-dessous. Pour chaque idée : 1) Identifie UN service Feazer spécifique (motion design, illustration, graphic design, identité visuelle, etc.) 2) Cite un bénéfice mesurable ou chiffre lié à ce service 3) Ancre dans une situation client réelle ou un cas concret issu des cas clients. STRICTEMENT INTERDIT : posts génériques sur Feazer sans service clairement identifié.",
  P3: "Utilise UNIQUEMENT les tendances créa et design des sources Créa/Design. N'utilise PAS les verbatims clients.",
  P4: "Utilise UNIQUEMENT les données et études IA des sources 'IA for Creative'. Ancre chaque idée dans un cas d'usage concret pour les créatifs ou équipes marketing.",
};

// 3-week rotation — P4 fixe sur Vendredi, P1/P2/P3 tournent par paires sur Lundi+Mercredi
const WEEK_ROTATION = [
  ['P1', 'P2', 'P4'],  // semaine 1 — Lundi=P1, Mercredi=P2, Vendredi=P4
  ['P1', 'P3', 'P4'],  // semaine 2 — Lundi=P1, Mercredi=P3, Vendredi=P4
  ['P2', 'P3', 'P4'],  // semaine 3 — Lundi=P2, Mercredi=P3, Vendredi=P4
];

function getISOWeekNumber(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function getWeekPiliers(semaine) {
  const weekNum = getISOWeekNumber(semaine);
  return WEEK_ROTATION[(weekNum - 1) % 3];
}

async function fetchFeazerContent() {
  const urls = [
    'https://feazer.com/services',
    'https://feazer.com/cas-clients',
  ];
  const results = await Promise.allSettled(
    urls.map(async url => {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentFactory/1.0)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const html = await r.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-zA-Z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
      return `=== ${url} ===\n${text}`;
    })
  );
  const content = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .join('\n\n');
  return content || null;
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
    const key = process.env.ANTHROPIC_KEY;
    console.log('[generate] ANTHROPIC_KEY:', key ? `${key.slice(0, 10)}… (${key.length} chars)` : 'UNDEFINED');

    const { pilier, pilierLabel, semaine, profil, profilLabel, jour } = req.body || {};
    console.log('[generate] profil reçu:', profil, '| profilLabel reçu:', profilLabel);

    if (!pilier || !semaine) throw new Error('pilier and semaine required');

    const activePiliers = getWeekPiliers(semaine);
    if (!activePiliers.includes(pilier)) {
      console.warn(`[generate] Pilier ${pilier} hors rotation pour la semaine ${semaine} (actifs: ${activePiliers.join(', ')})`);
    }

    // For P2 only: fetch feazer.com/services and feazer.com/cas-clients to ground posts in real services
    let feazerWebContent = null;
    if (pilier === 'P2') {
      try {
        feazerWebContent = await fetchFeazerContent();
        console.log('[generate] Feazer web content fetched, length:', feazerWebContent?.length ?? 0);
      } catch (e) {
        console.warn('[generate] Feazer web content fetch failed:', e.message);
      }
    }

    // Fetch sources from Airtable, filtered by the categories relevant to this pilier
    let sourcesList = '- Aucune source configurée, base-toi sur tes connaissances générales du marketing et du branding.';
    try {
      const cats = PILIER_CATEGORIES[pilier] || [];
      const orClauses = cats.map(c => `{Catégorie}='${c}'`).join(',');
      const formula = cats.length > 1 ? `OR(${orClauses})` : orClauses;
      const params = new URLSearchParams({ filterByFormula: formula, pageSize: '100' });
      const atSrcRes = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/Sources?${params}`,
        { headers: atHeaders() }
      );
      if (atSrcRes.ok) {
        const atSrcData = await atSrcRes.json();
        const srcRecords = atSrcData.records || [];
        if (srcRecords.length > 0) {
          const lines = srcRecords.flatMap(r => {
            if (r.fields.url) {
              return [`- ${r.fields.Nom || r.fields.url}: ${r.fields.url}`];
            }
            if (r.fields.Notes) {
              return r.fields.Notes
                .split('\n')
                .map(v => v.trim())
                .filter(Boolean)
                .map(v => `- Verbatim client : "${v}"`);
            }
            return [];
          });
          if (lines.length > 0) sourcesList = lines.join('\n');
        }
      }
    } catch (srcErr) {
      console.warn('[generate] Sources fetch failed, using fallback:', srcErr.message);
    }

    const prompt = `Tu es stratège de contenu LinkedIn senior pour Feazer, une agence créative et marketing française de référence.

PROFIL DE PUBLICATION : ${profilLabel} (${profil})
PILIER : ${pilier} — ${PILIER_DESC[pilier] || pilierLabel}
JOUR DE PUBLICATION : ${jour}
SEMAINE : ${semaine}

${feazerWebContent ? `CONTENU FEAZER.COM — pages services et cas clients (extrait live) :
${feazerWebContent}

RÈGLE P2 OBLIGATOIRE : choisis un service Feazer précis identifié dans ce contenu (ex. motion design, illustration, graphic design…). Chaque idée doit cibler un service différent. Aucune idée générique "Feazer fait de la créa".

` : ''}SOURCES À CONSULTER POUR T'INSPIRER :
${sourcesList}

INSTRUCTION D'UTILISATION DES SOURCES :
${PILIER_SOURCE_INSTRUCTIONS[pilier]}

En t'appuyant sur ces sources et sur l'actualité du secteur, génère exactement 10 idées de posts LinkedIn distinctes, pertinentes et actionnables pour ce pilier.

VOIX ÉDITORIALE — PAGE ENTREPRISE FEAZER :
Voix de marque, pas voix personnelle : jamais de "je", ni de "nous on pense que". Ton direct, assertif, factuel — Feazer parle comme un expert qui n'a pas besoin de se vendre. Phrases courtes, prose sobre, pas de listes à puces systématiques. Le "vous" s'adresse toujours au responsable marketing/communication, jamais à un grand public. Les titres parlent de situations concrètes vécues par les équipes marketing, pas de concepts généraux. Ton PAGE OK : "Vos pics de créa ne suivent pas le calendrier." / "Votre directeur doit valider." Ton À ÉVITER : "J'ai appris que..." / "On a découvert..." / "Notre équipe pense..."

RÈGLES ABSOLUES — à respecter sans exception :
1. MOTS INTERDITS : révolutionnaire, game-changer, incroyable, vraiment, booster, friction, chaos, scale
2. CONSTRUCTIONS INTERDITES : "ce n'est pas X c'est Y", "pas parce que X mais parce que Y", et toute variante
3. AUCUN tiret cadratin dans les titres ou hooks
4. Pas de triptyques parfaits ni de structures trop lisses
5. Hook (max 15 mots) : créer une tension ou curiosité sans dévoiler la conclusion
6. Corps : au moins un exemple concret ou chiffre réel
7. Conclusion : point de vue assumé ou question qui invite à réagir — jamais générique
8. Chaque idée doit être distincte et apporter une valeur différente
9. Sources citées doivent être cohérentes avec la liste fournie

Réponds UNIQUEMENT avec du JSON valide, sans texte autour, sans markdown, sans \`\`\` :
{"idees":[{"titre":"Sujet complet du post (max 80 caractères)","hook":"Première phrase d'accroche (max 15 mots)","format":"Texte long","source":"Nom de la source inspirante","url":"URL directe de l'article ou page source (null si indisponible)","angle":"Angle unique de ce post en une phrase"}]}

Formats autorisés : "Texte long", "Carrousel", "Image+texte", "Vidéo"
Génère exactement 10 idées variées dans les formats.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    const anthropicData = await anthropicRes.json();
    if (!anthropicRes.ok) {
      console.error('[generate] Anthropic error:', anthropicRes.status, JSON.stringify(anthropicData, null, 2));
      throw new Error(anthropicData.error?.message || `Anthropic error ${anthropicRes.status}`);
    }

    const responseText = anthropicData.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    let ideas;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*"idees"[\s\S]*\}/);
      ideas = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      throw new Error('Impossible de parser la réponse JSON de Claude.');
    }

    const idees = ideas.idees || [];
    if (idees.length === 0) throw new Error('Aucune idée générée.');

    // Save to Airtable + collect recordIds
    const savedIdees = await Promise.all(idees.map(async idee => {
      const fields = {
        'Titre / idée':        idee.titre || '',
        Pilier:                PILIER_LABEL[pilier] || pilier,
        Format:                idee.format || 'Texte long',
        Source:                idee.source || '',
        Statut:                'Brouillon',
        'Mode de publication': profilLabel,
        'Hook suggéré':        idee.hook || '',
        'Date de publication': semaine,
        ...(idee.url ? { url_source: idee.url } : {}),
      };

      console.log('[generate] Airtable payload:', JSON.stringify({ fields }, null, 2));
      const atRes  = await fetch(AT_BASE, {
        method:  'POST',
        headers: atHeaders(),
        body:    JSON.stringify({ fields }),
      });
      const atData = await atRes.json();
      if (!atRes.ok) {
        console.error('[generate] Airtable save error:', atRes.status, JSON.stringify(atData));
        throw new Error(atData.error?.message || `Airtable error ${atRes.status}`);
      }
      return { ...idee, recordId: atData.id };
    }));

    return res.status(200).json({ success: true, idees: savedIdees });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* Analyze call transcripts or URLs for content angles */

import Anthropic from '@anthropic-ai/sdk';

const BASE_ID = 'app59olgEI4U7pf1G';
const AT_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

const atHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { type, content, url, nom } = req.body || {};
    if (!type) throw new Error('type required (call | repurposing)');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });

    // ── CALL ANALYSIS ──────────────────────────────
    if (type === 'call') {
      if (!content) throw new Error('content required for call analysis');

      const prompt = `Analyse cette transcription ou note de call client et extrait les insights clés.

CONTENU DU CALL :
${content.slice(0, 12000)}

Identifie et structure les insights selon ces catégories :
- Problématique : douleur ou défi exprimé par le client
- Opportunité : besoin non comblé ou ouverture identifiée
- Objection : frein, doute ou résistance
- Différenciation : point fort valorisé ou attendu par le client
- Action : prochaine étape ou décision à prendre

Pour chaque insight, indique aussi quel pilier LinkedIn il pourrait nourrir (P1=Autorité, P2=Démonstration, P3=Culture).

Réponds UNIQUEMENT en JSON valide sans markdown :
{"insights":[{"categorie":"Problématique","contenu":"L'insight en une phrase directe","potentiel_contenu":"Peut inspirer un post sur : ...","pilier":"P2"}]}

Génère entre 5 et 10 insights distincts.`;

      const response = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      });

      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      let insights;
      try {
        const m = text.match(/\{[\s\S]*"insights"[\s\S]*\}/);
        insights = JSON.parse(m ? m[0] : text);
      } catch {
        throw new Error('Erreur de parsing des insights');
      }

      const today = new Date().toISOString().slice(0, 10);
      await fetch(`${AT_BASE}/${encodeURIComponent('Calls')}`, {
        method:  'POST',
        headers: atHeaders(),
        body: JSON.stringify({
          fields: {
            Nom:                 nom || `Call du ${today}`,
            Date:                today,
            'Contenu brut':      content.slice(0, 20000),
            'Insights extraits': JSON.stringify(insights),
          },
        }),
      });

      return res.status(200).json({ success: true, insights: insights.insights || [] });
    }

    // ── REPURPOSING ANALYSIS ───────────────────────
    if (type === 'repurposing') {
      if (!url) throw new Error('url required for repurposing analysis');

      try {
        const response = await client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 3000,
          tools:      [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          messages:   [{
            role:    'user',
            content: `Analyse le contenu de cette URL et extrait des angles pour des posts LinkedIn : ${url}

Identifie le titre/sujet principal, puis génère 6 à 8 angles de posts distincts.
Pour chaque angle : l'angle (description), un hook suggéré (max 15 mots), le format recommandé, et le pilier (P1=Autorité, P2=Démonstration, P3=Culture).

RÈGLES : pas de mots interdits (révolutionnaire, game-changer, incroyable, vraiment, booster, chaos, scale), pas de tiret cadratin.

Réponds UNIQUEMENT en JSON valide sans markdown :
{"titre":"Titre ou sujet du contenu","angles":[{"angle":"Description de l'angle","hook":"Hook court max 15 mots","format":"Texte long","pilier":"P1"}]}`,
          }],
        });
        const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        let angles;
        try {
          const m = text.match(/\{[\s\S]*"titre"[\s\S]*"angles"[\s\S]*\}/);
          angles = JSON.parse(m ? m[0] : text);
        } catch {
          throw new Error('Erreur de parsing des angles');
        }

        const today = new Date().toISOString().slice(0, 10);
        await fetch(`${AT_BASE}/${encodeURIComponent('Repurposing')}`, {
          method:  'POST',
          headers: atHeaders(),
          body: JSON.stringify({
            fields: {
              URL:               url,
              Titre:             angles.titre || url,
              'Angles extraits': JSON.stringify(angles),
              Date:              today,
            },
          }),
        });

        return res.status(200).json({ success: true, angles: angles.angles || [], titre: angles.titre });
      } catch {
        const response = await client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 2000,
          messages:   [{
            role: 'user',
            content: `Pour l'URL suivante : ${url}

Même si tu ne peux pas accéder au contenu directement, génère des angles de posts LinkedIn plausibles basés sur le domaine/sujet que l'URL semble indiquer.

Réponds en JSON : {"titre":"Titre supposé","angles":[{"angle":"...","hook":"...","format":"Texte long","pilier":"P1"}]}`,
          }],
        });
        const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        let angles;
        try {
          const m = text.match(/\{[\s\S]*"angles"[\s\S]*\}/);
          angles = JSON.parse(m ? m[0] : text);
        } catch {
          angles = { titre: url, angles: [] };
        }

        const today = new Date().toISOString().slice(0, 10);
        await fetch(`${AT_BASE}/${encodeURIComponent('Repurposing')}`, {
          method:  'POST',
          headers: atHeaders(),
          body: JSON.stringify({
            fields: {
              URL:               url,
              Titre:             angles.titre || url,
              'Angles extraits': JSON.stringify(angles),
              Date:              today,
            },
          }),
        });

        return res.status(200).json({ success: true, angles: angles.angles || [], titre: angles.titre });
      }
    }

    throw new Error(`Unknown type: ${type}`);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

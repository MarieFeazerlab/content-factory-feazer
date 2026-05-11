/* Generate week ideas using Anthropic + web_search */

const Anthropic = require('@anthropic-ai/sdk');

const BASE_ID   = 'app59olgEI4U7pf1G';
const TABLE     = 'Calendrier éditorial';
const AT_BASE   = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

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

const PILIER_DESC = {
  P1: 'Autorité — positionnement expert, données sectorielles, benchmarks, tendances marché',
  P2: 'Démonstration — cas pratiques, méthodes de travail, retours d\'expérience, preuves concrètes',
  P3: 'Culture / Différenciation — vision de l\'agence, valeurs, coulisses créatives, inspirations',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { pilier, pilierLabel, semaine, profil, profilLabel, jour, sources = [] } = JSON.parse(event.body || '{}');

    if (!pilier || !semaine) throw new Error('pilier and semaine required');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });

    const sourcesList = sources.length > 0
      ? sources.map(s => `- ${s.nom}: ${s.url}`).join('\n')
      : '- Aucune source configurée, base-toi sur tes connaissances générales du marketing et du branding.';

    const prompt = `Tu es stratège de contenu LinkedIn senior pour Feazer, une agence créative et marketing française de référence.

PROFIL DE PUBLICATION : ${profilLabel} (${profil})
PILIER : ${pilier} — ${PILIER_DESC[pilier] || pilierLabel}
JOUR DE PUBLICATION : ${jour}
SEMAINE : ${semaine}

SOURCES À CONSULTER POUR T'INSPIRER :
${sourcesList}

En t'appuyant sur des recherches récentes depuis ces sources et sur l'actualité du secteur, génère exactement 10 idées de posts LinkedIn distinctes, pertinentes et actionnables pour ce pilier.

RÈGLES ABSOLUES — à respecter sans exception :
1. JAMAIS de formule "Ce n'est pas X, c'est Y" ou toute variante
2. AUCUN tiret cadratin (—) dans les titres ou hooks
3. MOTS INTERDITS : révolutionnaire, game-changer, incroyable, vraiment, booster, chaos, scale
4. Ton humain et direct, ancré dans des données chiffrées réelles et récentes
5. Hooks courts (maximum 15 mots), créant une tension ou curiosité immédiate
6. Chaque idée doit être distincte et apporter une valeur différente
7. Sources citées doivent être cohérentes avec la liste fournie

Réponds UNIQUEMENT avec du JSON valide, sans texte autour, sans markdown, sans \`\`\` :
{"idees":[{"titre":"Sujet complet du post (max 80 caractères)","hook":"Première phrase d'accroche (max 15 mots)","format":"Texte long","source":"Nom de la source inspirante","angle":"Angle unique de ce post en une phrase"}]}

Formats autorisés : "Texte long", "Carrousel", "Image+texte", "Vidéo"
Génère exactement 10 idées variées dans les formats.`;

    let responseText = '';
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: prompt }],
      });
      responseText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
    } catch {
      // Fallback without web_search if tool not available
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      responseText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
    }

    // Extract JSON from response
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
        Titre:                idee.titre || '',
        Pilier:               pilier,
        Format:               idee.format || 'Texte long',
        Source:               idee.source || '',
        Statut:               'Brouillon',
        'Mode de publication': profilLabel,
        Hook:                 idee.hook || '',
        'Date de publication': semaine,
        Jour:                 jour,
      };

      try {
        const res = await fetch(AT_BASE, {
          method:  'POST',
          headers: atHeaders(),
          body:    JSON.stringify({ fields }),
        });
        const data = await res.json();
        return { ...idee, recordId: data.id };
      } catch {
        return { ...idee, recordId: `local_${Math.random().toString(36).slice(2)}` };
      }
    }));

    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ success: true, idees: savedIdees }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers:    CORS,
      body:       JSON.stringify({ error: err.message }),
    };
  }
};

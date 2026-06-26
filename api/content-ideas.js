/* Generate long-format content ideas */

const BASE_ID   = 'app59olgEI4U7pf1G';
const TABLE_ID  = 'tblNG2nqEbLtXZlRM';
const AT_BASE   = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

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
    const { secteurs, problemes, objectifs, formats, contexte, mois } = req.body || {};
    if (!mois) throw new Error('mois required');

    const prompt = `Tu es stratège de contenu pour Feazer, une creative ops externalisée pour les équipes marketing de moyennes et grandes entreprises (200-5000 salariés). Feazer produit des visuels, motion design, illustrations, identités visuelles en 1 à 3 jours avec des chefs de projet dédiés.

PARAMÈTRES DU MOIS :
- Secteurs cibles : ${secteurs || 'tous secteurs'}
- Problèmes clients : ${problemes || 'non précisés'}
- Objectifs : ${objectifs || 'non précisés'}
- Formats disponibles : Article, Ebook, Checklist, Infographie, Étude de cas — choisis le format le plus adapté à l'objectif de chaque idée. Un ebook pour du lead gen, une checklist pour du nurturing, un article pour du SEO, etc.
- Contexte : ${contexte || 'aucun'}

Génère 5 idées de contenus longs formats. Chaque idée doit partir d'un problème terrain réel — une situation que vit une équipe marketing concrètement, pas un concept générique. Le titre doit sonner comme quelque chose qu'un directeur marketing dirait en réunion, pas comme un titre de présentation PowerPoint. Évite les formulations type 'Comment X', 'Pourquoi Y', 'Les N raisons de Z'. Préfère une formulation directe, ancrée dans une réalité opérationnelle.

Réponds UNIQUEMENT en JSON valide :
{"idees":[{"titre":"Titre du contenu — formulé comme une observation terrain, pas un titre de blog générique","format":"Article|Ebook|Checklist|Infographie|Étude de cas","secteur":"secteur cible","objectif":"Lead gen|Nurturing|SEO|Notoriété","angle":"L'angle unique en une phrase","probleme":"Le problème client adressé en une phrase"}]}`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    if (!anthropicRes.ok) throw new Error(anthropicData.error?.message || `Anthropic error ${anthropicRes.status}`);

    const responseText = anthropicData.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    let ideas;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*"idees"[\s\S]*\}/);
      ideas = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      throw new Error('Impossible de parser la réponse JSON de Claude.');
    }

    const idees = ideas.idees || [];
    if (idees.length === 0) throw new Error('Aucune idée générée.');

    const savedIdees = await Promise.all(idees.map(async idee => {
      const fields = {
        Titre:              idee.titre   || '',
        Format:             idee.format  || 'Article',
        'Secteur cible':    idee.secteur || '',
        'Problème adressé': idee.probleme || '',
        Objectif:           idee.objectif || '',
        Statut:             'Idée',
        Mois:               mois,
        Angle:              idee.angle || '',
      };
      const atRes  = await fetch(AT_BASE, {
        method:  'POST',
        headers: atHeaders(),
        body:    JSON.stringify({ fields }),
      });
      const atData = await atRes.json();
      if (!atRes.ok) throw new Error(atData.error?.message || `Airtable error ${atRes.status}`);
      return { ...idee, recordId: atData.id };
    }));

    return res.status(200).json({ success: true, idees: savedIdees });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

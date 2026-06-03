/* Generate production brief + decline long-format content to LinkedIn posts */

const BASE_ID          = 'app59olgEI4U7pf1G';
const CONTENUS_TABLE   = 'tblNG2nqEbLtXZlRM';
const CALENDAR_TABLE   = 'tblqdCcogbkp8RZhJ';
const AT_CONTENUS      = `https://api.airtable.com/v0/${BASE_ID}/${CONTENUS_TABLE}`;
const AT_CALENDAR      = `https://api.airtable.com/v0/${BASE_ID}/${CALENDAR_TABLE}`;

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
    const { action, recordId, titre, format, secteur, probleme, objectif, angle, brief } = req.body || {};
    if (!recordId) throw new Error('recordId required');

    // ── DECLINE: generate LinkedIn post ideas from the content ────────────
    if (action === 'decline') {
      const prompt = `Tu es stratège de contenu LinkedIn pour Feazer, agence creative ops française.

CONTENU SOURCE :
- Titre : ${titre}
- Format : ${format}
- Secteur cible : ${secteur}
- Problème adressé : ${probleme}
- Objectif : ${objectif}
- Angle : ${angle}
${brief ? `- Extrait du brief : ${brief.slice(0, 800)}` : ''}

Génère 3 idées de posts LinkedIn qui déclinent ce contenu. Chaque post doit reprendre un angle différent et être autonome (lisible sans avoir lu le contenu source).

Réponds UNIQUEMENT en JSON valide :
{"posts":[{"titre":"Titre du post LinkedIn (max 80 chars)","hook":"Première phrase d'accroche (max 15 mots)","format":"Texte long|Carrousel|Image+texte","angle":"Angle de ce post en une phrase"}]}`;

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         process.env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });

      const anthropicData = await anthropicRes.json();
      if (!anthropicRes.ok) throw new Error(anthropicData.error?.message || `Anthropic error ${anthropicRes.status}`);

      const responseText = anthropicData.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      let postsData;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*"posts"[\s\S]*\}/);
        postsData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        throw new Error('Impossible de parser la réponse de Claude.');
      }

      const posts = postsData.posts || [];

      // Target date = next Monday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      const targetDate = nextMonday.toISOString().split('T')[0];

      const savedPosts = await Promise.all(posts.map(async post => {
        const fields = {
          'Titre / idée':        post.titre || '',
          Format:                post.format || 'Texte long',
          'Hook suggéré':        post.hook || '',
          Statut:                'Brouillon',
          'Date de publication': targetDate,
          'Contenu source':      titre,
        };
        const atRes  = await fetch(AT_CALENDAR, {
          method:  'POST',
          headers: atHeaders(),
          body:    JSON.stringify({ fields }),
        });
        const atData = await atRes.json();
        if (!atRes.ok) throw new Error(atData.error?.message || `Airtable error ${atRes.status}`);
        return { ...post, recordId: atData.id };
      }));

      // Update contenu status
      await fetch(`${AT_CONTENUS}/${recordId}`, {
        method:  'PATCH',
        headers: atHeaders(),
        body:    JSON.stringify({ fields: { Statut: 'Décliné en posts' } }),
      });

      return res.status(200).json({ success: true, posts: savedPosts, count: savedPosts.length });
    }

    // ── BRIEF: generate production brief ─────────────────────────────────
    if (!titre) throw new Error('titre required');

    const prompt = `Tu es stratège de contenu pour Feazer.

CONTENU À BRIEFER :
- Titre : ${titre}
- Format : ${format}
- Secteur cible : ${secteur}
- Problème adressé : ${probleme}
- Objectif : ${objectif}
- Angle : ${angle}

Génère un brief de production détaillé pour ce contenu. Inclus :
1. Objectif précis du contenu
2. Audience cible (profil, niveau de maturité)
3. Structure suggérée (parties/sections)
4. Messages clés à faire passer
5. Données ou exemples à chercher
6. CTA recommandé
7. Mots-clés SEO si pertinent

Réponds en texte structuré, pas en JSON.`;

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

    const briefText = anthropicData.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    await fetch(`${AT_CONTENUS}/${recordId}`, {
      method:  'PATCH',
      headers: atHeaders(),
      body:    JSON.stringify({ fields: { 'Brief généré': briefText, Statut: 'Brief généré' } }),
    });

    return res.status(200).json({ success: true, brief: briefText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* Write a full LinkedIn post from an idea */

import Anthropic from '@anthropic-ai/sdk';

const PROFILE_CONTEXT = {
  feazer: 'la page entreprise de Feazer (agence créative et marketing, ton institutionnel mais humain, nous)',
  marie:  'Marie, fondatrice de Feazer (ton personnel, expert, direct, je)',
  maxime: 'Maxime, directeur créatif de Feazer (ton créatif, opinionné, je)',
};

const FORMAT_INSTRUCTIONS = {
  'Texte long':  'Post narratif et structuré, 1200–1800 caractères. Paragraphes courts (1-3 lignes). Pas de bullet points au début. Fin forte avec une question ou prise de position.',
  'Carrousel':   'Script de carrousel LinkedIn en 6 à 8 slides. Format : "Slide X : [Titre court]\\n[Contenu bullet]". Slide 1 = hook accrocheur. Slide finale = CTA ou question.',
  'Image+texte': "Légende courte et percutante, 300–500 caractères. Contexte de l'image suggéré en première ligne entre [crochets]. Puis le texte.",
  'Vidéo':       'Script de vidéo LinkedIn. Durée cible : 60–90 secondes. Format : "INTRO (5s) :", "DÉVELOPPEMENT :", "CONCLUSION (10s) :". Ton direct, parlé.',
};

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const {
      titre, hook, pilier, pilierLabel, format,
      source, profil, profilLabel,
    } = req.body || {};

    if (!titre) throw new Error('titre required');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });

    const profileCtx        = PROFILE_CONTEXT[profil] || PROFILE_CONTEXT.feazer;
    const formatInstructions = FORMAT_INSTRUCTIONS[format] || FORMAT_INSTRUCTIONS['Texte long'];

    const prompt = `Tu rédiges un post LinkedIn pour ${profileCtx}.

SUJET : ${titre}
${hook ? `HOOK (utilise-le comme première phrase) : ${hook}` : ''}
PILIER : ${pilier} — ${pilierLabel}
FORMAT : ${format}
SOURCE D'INSPIRATION : ${source || 'Expertise interne'}

INSTRUCTIONS DE FORMAT :
${formatInstructions}

RÈGLES ABSOLUES :
- Commence par le hook fourni (ou crée-en un percutant si non fourni, max 15 mots)
- JAMAIS "Ce n'est pas X, c'est Y"
- Aucun tiret cadratin (—)
- Mots interdits : révolutionnaire, game-changer, incroyable, vraiment, booster, chaos, scale
- Pas de hashtags génériques (pas #marketing #LinkedIn #business)
- Maximum 3 hashtags très ciblés, à la fin uniquement
- Données chiffrées quand pertinent (sourcées ou plausibles)
- Fin forte : question ouverte, statistique marquante, ou prise de position tranchée
- Ton adapté au profil : ${profileCtx}

Écris le post directement, sans introduction ni explication autour.`;

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    });

    const post = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ success: true, post });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

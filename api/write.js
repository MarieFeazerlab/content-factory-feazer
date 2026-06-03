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
${hook ? `HOOK (utilise-le comme première phrase, mot pour mot) : ${hook}` : ''}
PILIER : ${pilier} — ${pilierLabel}
FORMAT : ${format}
SOURCE D'INSPIRATION : ${source || 'Expertise interne'}

INSTRUCTIONS DE FORMAT :
${formatInstructions}

VOIX ET STYLE — LIS ATTENTIVEMENT :
Le registre visé : statements courts, imagés, ancrés dans du concret. Une phrase qui claque, puis on déroule simplement. Pas de métaphores filées sur 3 paragraphes.

EXEMPLES DE TOURNURES QUI FONCTIONNENT :
- "Votre IA doit aussi transpirer."
- "Votre équipe créa court. Pas parce qu'elle manque de talent. Parce qu'elle manque de bande passante."
- "Briefs qui disent tout sauf ce qui compte vraiment."
- "La différence tient souvent à une décision prise avant le premier pixel."

EXEMPLES DE TOURNURES À ÉVITER :
- "Cela peut enrichir. Cela peut diluer." (symétrie trop lissée)
- "Pas d'improvisation. Pas de 'on verra'." (structure en miroir artificielle)
- "C'est là que le vrai travail commence." (conclusion bateau)
- "Dans un monde où..." (intro IA classique)
- Toute construction en triptyque parfait

RÈGLES ABSOLUES :
1. Commence par le hook fourni mot pour mot
2. JAMAIS "Ce n'est pas X, c'est Y" ni aucune variante
3. Aucun tiret cadratin
4. Mots interdits : révolutionnaire, game-changer, incroyable, vraiment, booster, chaos, scale, honnêtement, friction
5. Pas de hashtags génériques (#marketing #LinkedIn #business)
6. Maximum 3 hashtags très ciblés, à la fin uniquement
7. JAMAIS de chiffre inventé — si pas de donnée réelle, formule sans chiffre
8. Fin forte : question ouverte ou prise de position tranchée — jamais une conclusion molle
9. Phrases courtes. Une idée par phrase. Pas de subordonnées en cascade.
10. Zéro structure en miroir, zéro parallélisme artificiel

Le post est en français. Toujours.

Écris le post directement, sans introduction ni explication.`;

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

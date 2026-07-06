import { createServerFn } from "@tanstack/react-start";
import { runChat } from "./ai-chat.server";
import { DEFAULT_ALEX_MODEL } from "./alex-models";

const BASE_PROMPT = `Tu es Alex IA, un assistant IA généraliste, amical et polyvalent (similaire à Gemini ou ChatGPT).
Tu peux discuter de tous les sujets : culture générale, écriture, code, idées, conseils du quotidien, traductions, brainstorming, etc.
Tu n'es PAS spécialisé en cybersécurité — tu es une IA générale et conversationnelle.
Réponds en français par défaut, sois clair, naturel et utile. Utilise du markdown quand c'est pertinent (listes, gras, code).`;

// "Gems" — assistants personnalisés (personas spécialisés)
const PERSONAS: Record<string, string> = {
  general: "",
  code: `\n\nTu agis en tant que **Coach de programmation**. Aide à écrire, comprendre, déboguer et optimiser du code. Donne des exemples clairs avec des blocs de code, explique le raisonnement et propose les bonnes pratiques.`,
  writer: `\n\nTu agis en tant que **Relecteur & rédacteur**. Améliore le style, la grammaire, la clarté et le ton des textes. Propose des reformulations, corrige les fautes et explique brièvement tes choix.`,
  travel: `\n\nTu agis en tant que **Guide de voyage**. Propose des itinéraires, des conseils pratiques, des bons plans, des suggestions culturelles et logistiques adaptés au profil de l'utilisateur.`,
  chef: `\n\nTu agis en tant que **Chef cuisinier**. Propose des recettes détaillées, des substitutions d'ingrédients, des techniques et des idées de menus adaptés aux contraintes (temps, régime, budget).`,
  tutor: `\n\nTu agis en tant que **Tuteur pédagogue**. Explique les concepts pas à pas, du plus simple au plus complexe, avec des analogies et des exemples. Vérifie la compréhension et propose des exercices.`,
  agent: `\n\n---\n\n# MODE AGENTIQUE ACTIVÉ\n\nTu deviens un **agent autonome**. Tu ne te contentes plus de répondre : tu planifies, raisonnes et agis méthodiquement pour accomplir une mission. Structure systématiquement ton fonctionnement selon le cadre suivant :\n\n## 1. RÔLE & IDENTITÉ\nAdopte le rôle d'expert le plus pertinent pour la demande (analyste, ingénieur, stratège, chercheur…). Ton ton est professionnel, concis et analytique. Tu connais tes compétences et tes limites.\n\n## 2. MISSION\nReformule clairement l'objectif principal à atteindre avant toute action, afin d'orienter ton travail de façon autonome.\n\n## 3. RAISONNEMENT (ReAct / Chain of Thought)\nPour chaque étape, déroule explicitement ce cycle :\n- **🧠 Pensée** : analyse ce qui est demandé et ce qu'il faut faire ensuite.\n- **⚙️ Action** : choisis et décris l'outil ou l'étape la plus appropriée.\n- **👁️ Observation** : interprète le résultat (réel ou simulé) et ajuste ta stratégie.\nRépète ce cycle jusqu'à atteindre la mission.\n\n## 4. OUTILS DISPONIBLES (simulés)\nTu peux mobiliser, en le déclarant, ces outils virtuels : **Recherche_Web** (vérifier des faits — précise que tu n'as pas d'accès direct au web et signale ce qui doit être vérifié), **Calculatrice** (calculs complexes), **Analyse_Code** (inspecter du code), **Planificateur** (découper une tâche en sous-tâches). Indique toujours quel outil tu utilises et pourquoi.\n\n## 5. MÉMOIRE & CONTEXTE\nGarde en mémoire les éléments déjà traités dans la session pour éviter les doublons. Ne conserve pas de données sensibles au-delà du nécessaire.\n\n## 6. GARDE-FOUS (Guardrails)\nNe prends jamais de décision critique ou irréversible sans demander une **confirmation humaine (Human-in-the-loop)**. En cas de doute, liste explicitement tes incertitudes plutôt que d'inventer.\n\n## 7. FORMAT DE SORTIE\nLivre ton travail en Markdown clair, avec quand c'est utile : un **Résumé exécutif**, le détail des cycles Pensée/Action/Observation, puis une **liste de recommandations ou de prochaines étapes**.`,
};

const DEEP_RESEARCH_PROMPT = `\n\nMode **Recherche approfondie** activé. Produis un rapport structuré, complet et nuancé sur le sujet demandé, organisé en sections claires avec des titres (##), des sous-points et une synthèse finale. Couvre les différents angles, les avantages/inconvénients et les points de vigilance. Base-toi sur tes connaissances et précise honnêtement quand une information mérite d'être vérifiée auprès de sources à jour (tu n'as pas d'accès en direct au web).`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export const chatWithAlex = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[]; persona?: string; deepResearch?: boolean; model?: string }) => {
    if (!Array.isArray(data?.messages)) throw new Error("Messages invalides.");
    const persona = typeof data.persona === "string" && data.persona in PERSONAS ? data.persona : "general";
    const model = typeof data.model === "string" && data.model ? data.model : DEFAULT_ALEX_MODEL;
    return { messages: data.messages, persona, deepResearch: Boolean(data.deepResearch), model };
  })
  .handler(async ({ data }) => {
    const systemPrompt =
      BASE_PROMPT + (PERSONAS[data.persona] ?? "") + (data.deepResearch ? DEEP_RESEARCH_PROMPT : "");

    const content = await runChat(data.model, [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ]);
    return { content };
  });

export const generateAlexImage = createServerFn({ method: "POST" })
  .inputValidator((data: { prompt: string }) => {
    if (!data?.prompt || typeof data.prompt !== "string") throw new Error("Prompt invalide.");
    if (data.prompt.length > 2000) throw new Error("Prompt trop long.");
    return { prompt: data.prompt.trim() };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquante.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        prompt: data.prompt,
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes. Réessaie dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) {
      console.error("Image gen error:", res.status, await res.text());
      throw new Error("Erreur de génération d'image.");
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = json.data?.[0];
    let imageUrl: string | null = null;
    if (item?.b64_json) imageUrl = `data:image/png;base64,${item.b64_json}`;
    else if (item?.url) imageUrl = item.url;
    if (!imageUrl) throw new Error("Aucune image reçue.");
    return { imageUrl };
  });

// Analyse / résumé de fichiers volumineux (texte extrait côté client)
export const analyzeAlexFile = createServerFn({ method: "POST" })
  .inputValidator((data: { fileName: string; content: string; instruction?: string }) => {
    if (!data?.content || typeof data.content !== "string") throw new Error("Contenu de fichier invalide.");
    const fileName = typeof data.fileName === "string" ? data.fileName.slice(0, 200) : "document";
    // Limite de sécurité : ~120k caractères
    const content = data.content.slice(0, 120000);
    const instruction =
      typeof data.instruction === "string" && data.instruction.trim()
        ? data.instruction.trim().slice(0, 2000)
        : "Résume ce document de façon structurée et dégage les points clés.";
    return { fileName, content, instruction };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquante.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              BASE_PROMPT +
              `\n\nTu analyses un document fourni par l'utilisateur. Sois précis, structuré (titres, listes) et fidèle au contenu. Ne complète jamais avec des informations absentes du document.`,
          },
          {
            role: "user",
            content: `Fichier : « ${data.fileName} »\n\nConsigne : ${data.instruction}\n\n--- DÉBUT DU DOCUMENT ---\n${data.content}\n--- FIN DU DOCUMENT ---`,
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes. Réessaie dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) {
      console.error("File analysis error:", res.status, await res.text());
      throw new Error("Erreur d'analyse du fichier.");
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { content: json.choices?.[0]?.message?.content ?? "" };
  });

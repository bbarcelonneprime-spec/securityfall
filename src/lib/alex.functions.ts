import { createServerFn } from "@tanstack/react-start";

const ALEX_SYSTEM_PROMPT = `Tu es Alex IA, un assistant IA généraliste, amical et polyvalent (similaire à Gemini ou ChatGPT).
Tu peux discuter de tous les sujets : culture générale, écriture, code, idées, conseils du quotidien, traductions, brainstorming, etc.
Tu n'es PAS spécialisé en cybersécurité — tu es une IA générale et conversationnelle.
Réponds en français par défaut, sois clair, naturel et utile. Utilise du markdown quand c'est pertinent (listes, gras, code).`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export const chatWithAlex = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[] }) => {
    if (!Array.isArray(data?.messages)) throw new Error("Messages invalides.");
    return { messages: data.messages };
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
          { role: "system", content: ALEX_SYSTEM_PROMPT },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes. Réessaie dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) {
      console.error("Alex AI error:", res.status, await res.text());
      throw new Error("Erreur du service Alex IA.");
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { content: json.choices?.[0]?.message?.content ?? "" };
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

import { createServerFn } from "@tanstack/react-start";

const CHATBOT_SYSTEM_PROMPT = `Tu es un expert en cybersécurité et protection de la vie privée en ligne.
Tu réponds aux questions des utilisateurs de manière claire, pédagogique et rassurante.
Tu peux parler de : sécurité des e-mails, mots de passe, double authentification (2FA), phishing, gestionnaires de mots de passe, sécurité des comptes en ligne, vie privée sur Internet, et bonnes pratiques numériques.
Tu ne demandes jamais de mots de passe ou d'informations sensibles.
Reste concis (max 3-4 paragraphes) et donne des conseils actionnables quand c'est pertinent.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export const chatWithBot = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[] }) => {
    if (!Array.isArray(data?.messages)) {
      throw new Error("Messages invalides.");
    }
    return { messages: data.messages };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquante.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: CHATBOT_SYSTEM_PROMPT },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (res.status === 429) {
      throw new Error("Trop de requêtes. Réessaie dans un instant.");
    }
    if (res.status === 402) {
      throw new Error("Crédits IA épuisés. Ajoute des crédits dans Settings → Workspace → Usage.");
    }
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error:", res.status, txt);
      throw new Error("Erreur du service de chat IA.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });

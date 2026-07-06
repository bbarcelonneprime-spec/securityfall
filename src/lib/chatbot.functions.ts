import { createServerFn } from "@tanstack/react-start";
import { runChat } from "./ai-chat.server";

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
    // Modèle ultra rapide (Groq) avec repli automatique pour des réponses instantanées.
    const content = await runChat("llama-instant", [
      { role: "system", content: CHATBOT_SYSTEM_PROMPT },
      ...data.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ]);
    return { content };
  });

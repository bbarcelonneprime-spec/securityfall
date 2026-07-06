// Assistant de chat côté serveur : route les requêtes vers Groq (rapide) ou
// la passerelle IA de Lovable, avec repli automatique sur Lovable si Groq
// échoue (clé absente, quota, réseau). Fichier *.server.ts : jamais envoyé au
// bundle client.
import { getAlexModel } from "./alex-models";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMsg = { role: ChatRole; content: string };

// Retire les blocs de raisonnement <think>…</think> émis par certains modèles.
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^\s+/, "");
}

async function callGroq(model: string, messages: ChatMsg[]): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY manquante.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    console.error("Groq error:", res.status, await res.text());
    throw new Error(res.status === 429 ? "RATE_LIMIT" : "GROQ_FAIL");
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return stripThink(json.choices?.[0]?.message?.content ?? "");
}

async function callLovable(model: string, messages: ChatMsg[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY manquante.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (res.status === 429) throw new Error("Trop de requêtes. Réessaie dans un instant.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  if (!res.ok) {
    console.error("Lovable AI error:", res.status, await res.text());
    throw new Error("Erreur du service IA.");
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return stripThink(json.choices?.[0]?.message?.content ?? "");
}

// Exécute un chat pour un identifiant de modèle du registre Alex.
export async function runChat(modelId: string, messages: ChatMsg[]): Promise<string> {
  const m = getAlexModel(modelId);
  if (m.provider === "groq") {
    try {
      return await callGroq(m.model, messages);
    } catch (e) {
      // Repli sur Lovable pour garantir une réponse même si Groq est indisponible.
      console.warn("Groq indisponible, repli Lovable:", (e as Error).message);
      return await callLovable("google/gemini-3-flash-preview", messages);
    }
  }
  return await callLovable(m.model, messages);
}

// Assistant de chat côté serveur : route les requêtes vers OpenAI direct,
// Groq (rapide) ou la passerelle IA de Lovable, avec repli automatique en
// cascade. Fichier *.server.ts : jamais envoyé au bundle client.
import { getAlexModel } from "./alex-models";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMsg = { role: ChatRole; content: string };

// Retire les blocs de raisonnement <think>…</think> émis par certains modèles.
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^\s+/, "");
}

export async function callOpenAI(model: string, messages: ChatMsg[], opts?: { temperature?: number }): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY manquante.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: opts?.temperature ?? 0.7 }),
  });
  if (!res.ok) {
    console.error("OpenAI error:", res.status, await res.text().catch(() => ""));
    throw new Error(res.status === 429 ? "RATE_LIMIT" : "OPENAI_FAIL");
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return stripThink(json.choices?.[0]?.message?.content ?? "");
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

// "Alex Base 1" — IA surpuissante : interroge plusieurs modèles en parallèle,
// puis fusionne leurs réponses en UNE réponse finale supérieure.
async function runSuperChat(messages: ChatMsg[]): Promise<string> {
  const drafts = await Promise.allSettled([
    callGroq("openai/gpt-oss-120b", messages),
    callGroq("llama-3.3-70b-versatile", messages),
    callLovable("google/gemini-3-flash-preview", messages),
  ]);

  const good = drafts
    .filter((d): d is PromiseFulfilledResult<string> => d.status === "fulfilled" && Boolean(d.value.trim()))
    .map((d) => d.value.trim());

  if (good.length === 0) return await callLovable("google/gemini-3-flash-preview", messages);
  if (good.length === 1) return good[0];

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const synthMessages: ChatMsg[] = [
    {
      role: "system",
      content:
        "Tu es Alex Base 1, une IA surpuissante qui fusionne les forces de plusieurs modèles. " +
        "On te donne plusieurs réponses candidates à la même question. Analyse-les, garde le meilleur de chacune, " +
        "corrige les erreurs, et produis UNE seule réponse finale, complète, exacte et parfaitement rédigée. " +
        "N'évoque jamais l'existence des réponses candidates ni le processus de fusion. Réponds en français.",
    },
    {
      role: "user",
      content:
        `Question de l'utilisateur :\n${lastUser}\n\n` +
        good.map((g, i) => `### Réponse candidate ${i + 1}\n${g}`).join("\n\n") +
        "\n\nProduis maintenant la meilleure réponse finale unique.",
    },
  ];

  try {
    return await callGroq("openai/gpt-oss-120b", synthMessages);
  } catch {
    try {
      return await callLovable("google/gemini-2.5-pro", synthMessages);
    } catch {
      return good.sort((a, b) => b.length - a.length)[0];
    }
  }
}

// Exécute un chat pour un identifiant de modèle du registre Alex.
export async function runChat(modelId: string, messages: ChatMsg[]): Promise<string> {
  const m = getAlexModel(modelId);
  if (m.provider === "super") {
    return await runSuperChat(messages);
  }
  if (m.provider === "groq") {
    try {
      return await callGroq(m.model, messages);
    } catch (e) {
      console.warn("Groq indisponible, repli Lovable:", (e as Error).message);
      return await callLovable("google/gemini-3-flash-preview", messages);
    }
  }
  return await callLovable(m.model, messages);
}

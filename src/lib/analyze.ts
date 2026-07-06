import { createServerFn } from "@tanstack/react-start";
import { runChat } from "./ai-chat.server";

const SYSTEM_PROMPT = `Tu es un expert en cybersécurité et un analyste de données spécialisé dans la protection de la vie privée en ligne.

Ton rôle est d'analyser l'adresse e-mail fournie par l'utilisateur pour lui donner un diagnostic de sécurité pédagogique et des conseils de prévention.

Quand l'utilisateur te donne une adresse e-mail, suis strictement cette structure de réponse :

1. **Analyse du domaine** : Identifie si le fournisseur (ex: gmail.com, outlook.com, ou un domaine personnalisé) est un service public ou privé, et mentionne son niveau de sécurité général par défaut.

2. **Évaluation des risques génériques** : Explique de manière simple et claire les menaces courantes liées à l'usage de cet e-mail (ex: campagnes de phishing, risques d'usurpation d'identité si le mot de passe est faible).

3. **Plan d'action de sécurité** : Donne 3 conseils personnalisés et immédiats pour sécuriser cette adresse (ex: activation de la double authentification 2FA, utilisation d'un gestionnaire de mots de passe, vérification des appareils connectés).

Règles importantes :
- Ne prétends jamais avoir accès à la boîte mail privée de l'utilisateur ni à ses mots de passe réels.
- Reste professionnel, rassurant et constructif. N'invente pas de fausses alertes de piratage.
- Adopte un ton d'expert en sécurité informatique vulgarisé.
- Formate ta réponse en Markdown clair avec des titres pour chaque section.`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const analyzeEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = String(data?.email ?? "").trim();
    if (!EMAIL_RE.test(email) || email.length > 254) {
      throw new Error("Adresse e-mail invalide.");
    }
    return { email };
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyse cette adresse e-mail : ${data.email}` },
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
      throw new Error("Erreur du service d'analyse IA.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });

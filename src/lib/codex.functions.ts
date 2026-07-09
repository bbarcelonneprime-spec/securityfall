import { createServerFn } from "@tanstack/react-start";
import { runChat } from "./ai-chat.server";

// Codex — moteur de création de jeux 2D. À partir d'un prompt en langage
// naturel, génère un jeu HTML5 complet, autonome et jouable immédiatement.
const CODEX_SYSTEM_PROMPT = `Tu es "Codex", un moteur expert de création de jeux 2D en HTML5.
À partir de la description de l'utilisateur, tu génères UN SEUL fichier HTML complet et autonome implémentant un jeu jouable.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le code HTML, rien d'autre. Pas de texte d'explication, pas de balises markdown, pas de \`\`\`.
- Commence exactement par <!DOCTYPE html> et termine par </html>.
- Tout doit tenir dans ce seul fichier : HTML + CSS (<style>) + JavaScript (<script>). Aucune dépendance externe, aucun CDN, aucune image distante.
- Utilise <canvas> et du JavaScript vanilla. Le canvas doit remplir la fenêtre et s'adapter au redimensionnement.
- Le jeu doit être immédiatement jouable : boucle de jeu (requestAnimationFrame), score, condition de victoire/défaite, écran de démarrage et de "game over" avec possibilité de rejouer.
- Contrôles au CLAVIER (flèches / espace / WASD) ET au TACTILE/SOURIS (clic ou tap) pour fonctionner sur mobile.
- Style visuel soigné, moderne, coloré, avec un fond sombre élégant. Affiche brièvement les instructions à l'écran.
- Code robuste, sans erreur, sans placeholder à compléter. Le jeu doit fonctionner du premier coup.
Génère un jeu complet et fun correspondant précisément à la demande.`;

function extractHtml(raw: string): string {
  let t = raw.trim();
  // Retire d'éventuelles clôtures markdown.
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("<!DOCTYPE");
  const startAlt = start === -1 ? t.toLowerCase().indexOf("<html") : start;
  if (startAlt > 0) t = t.slice(startAlt);
  return t.trim();
}

export const generateGame = createServerFn({ method: "POST" })
  .inputValidator((data: { prompt: string }) => {
    if (!data?.prompt || typeof data.prompt !== "string" || !data.prompt.trim()) {
      throw new Error("Décris le jeu que tu veux créer.");
    }
    if (data.prompt.length > 2000) throw new Error("Description trop longue (2000 caractères max).");
    return { prompt: data.prompt.trim() };
  })
  .handler(async ({ data }) => {
    try {
      // Modèle de raisonnement rapide (Groq GPT-OSS 120B) — bon en génération de code.
      const content = await runChat("gpt-oss-120b", [
        { role: "system", content: CODEX_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Crée ce jeu 2D : ${data.prompt}\n\nRenvoie uniquement le fichier HTML complet.`,
        },
      ]);
      const html = extractHtml(content);
      if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
        return { html: null, error: "La génération n'a pas produit de jeu valide. Réessaie." };
      }
      return { html, error: null };
    } catch (e) {
      console.error("Codex generateGame error:", e);
      return { html: null, error: "Erreur lors de la génération du jeu. Réessaie dans un instant." };
    }
  });

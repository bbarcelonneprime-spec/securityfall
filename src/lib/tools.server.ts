// Aides serveur pour Alex Studio / Marketplace (jamais envoyé au client).
import type { AlexTool, ToolChangelogEntry } from "./tools-catalog";

export type ToolRow = {
  id: string;
  user_id: string;
  author_name: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  system_prompt: string;
  model: string;
  agent_id: string;
  starter: string;
  app_html: string;
  version: string;
  status: string;
  favorite: boolean;
  is_public: boolean;
  installs: number;
  changelog: ToolChangelogEntry[] | null;
  screenshots: string[] | null;
  created_at: string;
  updated_at: string;
};

export const TOOL_SELECT =
  "id, user_id, author_name, name, description, category, emoji, system_prompt, model, agent_id, starter, app_html, version, status, favorite, is_public, installs, changelog, screenshots, created_at, updated_at";

export function toTool(r: ToolRow): AlexTool {
  return {
    id: r.id,
    userId: r.user_id,
    authorName: r.author_name,
    name: r.name,
    description: r.description,
    category: r.category,
    emoji: r.emoji,
    systemPrompt: r.system_prompt,
    model: r.model,
    agentId: r.agent_id ?? "",
    starter: r.starter,
    appHtml: r.app_html ?? "",
    version: r.version ?? "1.0.0",
    status: r.status ?? "draft",
    favorite: Boolean(r.favorite),
    isPublic: r.is_public,
    installs: r.installs,
    changelog: Array.isArray(r.changelog) ? r.changelog : [],
    screenshots: Array.isArray(r.screenshots) ? r.screenshots : [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export function clean(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;
}

export function bumpVersion(version: string): string {
  const parts = version.split(".").map((p) => Number(p) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.slice(0, 3).join(".");
}

export const APP_SYSTEM_PROMPT = `Tu es "Alex Studio", un moteur expert de création d'applications web.
À partir de la description de l'utilisateur, tu génères UN SEUL fichier HTML complet et autonome implémentant l'application demandée.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le code HTML, rien d'autre : pas d'explication, pas de markdown, pas de balises de code.
- Commence exactement par <!DOCTYPE html> et termine par </html>.
- Tout tient dans ce seul fichier : HTML + CSS (<style>) + JavaScript (<script>). Aucune dépendance externe, aucun CDN, aucune image distante.
- Design haut de gamme : glassmorphism, coins arrondis, dégradés subtils, animations fluides, thème sombre élégant, responsive mobile.
- L'application doit être immédiatement fonctionnelle, sans placeholder à compléter, sans erreur JavaScript.
- Persiste les données de l'utilisateur avec localStorage quand c'est pertinent.
- Interface entièrement en français.`;

export const DRAFT_SYSTEM_PROMPT =
  "Tu conçois des outils IA. À partir d'une idée, retourne UNIQUEMENT un objet JSON valide (sans texte autour, sans balises markdown) avec les clés : name (court, français), emoji (1 emoji), description (1 phrase), category (parmi general, writing, code, business, education, creative, productivity, fun), systemPrompt (instructions détaillées et professionnelles pour l'IA, en français, 100-250 mots), starter (une phrase d'accueil que l'outil affiche à l'utilisateur).";

export function extractHtml(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("<!DOCTYPE");
  const startAlt = start === -1 ? t.toLowerCase().indexOf("<html") : start;
  if (startAlt > 0) t = t.slice(startAlt);
  return t.trim();
}

// Alex Studio & Alex Marketplace — création, publication, installation et
// exécution d'outils IA personnalisés (avec application générée en HTML).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runChat } from "./ai-chat.server";
import { callOpenAI } from "./ai-chat.server";
import { DEFAULT_ALEX_MODEL } from "./alex-models";

export type ToolChangelogEntry = { version: string; date: number; note: string };

export type AlexTool = {
  id: string;
  userId: string;
  authorName: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  systemPrompt: string;
  model: string;
  agentId: string;
  starter: string;
  appHtml: string;
  version: string;
  status: string;
  favorite: boolean;
  isPublic: boolean;
  installs: number;
  changelog: ToolChangelogEntry[];
  screenshots: string[];
  createdAt: number;
  updatedAt: number;
  rating?: number;
  ratingCount?: number;
};

export type ToolReview = {
  id: string;
  toolId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: number;
  mine?: boolean;
};

export const TOOL_CATEGORIES = [
  { id: "general", label: "Général" },
  { id: "writing", label: "Écriture" },
  { id: "code", label: "Code" },
  { id: "business", label: "Business" },
  { id: "education", label: "Éducation" },
  { id: "creative", label: "Créatif" },
  { id: "productivity", label: "Productivité" },
  { id: "fun", label: "Fun" },
] as const;

type Row = {
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

const SELECT =
  "id, user_id, author_name, name, description, category, emoji, system_prompt, model, agent_id, starter, app_html, version, status, favorite, is_public, installs, changelog, screenshots, created_at, updated_at";

function toTool(r: Row): AlexTool {
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

function clean(v: unknown, max: number, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;
}

function bump(version: string): string {
  const parts = version.split(".").map((p) => Number(p) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.slice(0, 3).join(".");
}

/* ------------------------------------------------------------------ */
/* Lecture                                                            */
/* ------------------------------------------------------------------ */

// Mes projets (Alex Studio)
export const listMyTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alex_tools")
      .select(SELECT)
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(toTool);
  });

// Outils publiés (Alex Marketplace) + notes moyennes
export const listMarketplaceTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [toolsRes, reviewsRes] = await Promise.all([
      context.supabase
        .from("alex_tools")
        .select(SELECT)
        .eq("is_public", true)
        .order("installs", { ascending: false })
        .limit(300),
      context.supabase.from("alex_reviews").select("tool_id, rating"),
    ]);
    if (toolsRes.error) throw new Error(toolsRes.error.message);

    const agg = new Map<string, { sum: number; n: number }>();
    for (const r of (reviewsRes.data ?? []) as Array<{ tool_id: string; rating: number }>) {
      const cur = agg.get(r.tool_id) ?? { sum: 0, n: 0 };
      cur.sum += r.rating;
      cur.n += 1;
      agg.set(r.tool_id, cur);
    }

    return ((toolsRes.data ?? []) as Row[]).map((r) => {
      const t = toTool(r);
      const a = agg.get(r.id);
      return { ...t, rating: a ? a.sum / a.n : 0, ratingCount: a?.n ?? 0 };
    });
  });

// Mes outils installés (référence vers l'outil publié)
export const listInstalledTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alex_installs")
      .select(`tool_id, installed_version, created_at, alex_tools!inner(${SELECT})`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ tool_id: string; installed_version: string; alex_tools: Row }>).map((r) => ({
      installedVersion: r.installed_version,
      tool: toTool(r.alex_tools),
    }));
  });

export const listToolReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { toolId: string }) => {
    if (!data?.toolId) throw new Error("Outil invalide.");
    return { toolId: data.toolId };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("alex_reviews")
      .select("id, tool_id, user_id, author_name, rating, comment, created_at")
      .eq("tool_id", data.toolId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<{ id: string; tool_id: string; user_id: string; author_name: string; rating: number; comment: string; created_at: string }>).map(
      (r): ToolReview => ({
        id: r.id,
        toolId: r.tool_id,
        authorName: r.author_name,
        rating: r.rating,
        comment: r.comment,
        createdAt: new Date(r.created_at).getTime(),
        mine: r.user_id === context.userId,
      }),
    );
  });

/* ------------------------------------------------------------------ */
/* Écriture                                                           */
/* ------------------------------------------------------------------ */

type SaveInput = {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  emoji?: string;
  systemPrompt?: string;
  model?: string;
  agentId?: string;
  starter?: string;
  appHtml?: string;
  isPublic?: boolean;
  favorite?: boolean;
  status?: string;
  authorName?: string;
  changeNote?: string;
};

export const saveTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveInput) => {
    const name = clean(data?.name, 80);
    if (!name) throw new Error("Donne un nom à ton projet.");
    return {
      id: typeof data.id === "string" && data.id ? data.id : undefined,
      name,
      description: clean(data.description, 400),
      category: clean(data.category, 40, "general"),
      emoji: clean(data.emoji, 8, "✨"),
      systemPrompt: clean(data.systemPrompt, 8000, "Tu es un assistant IA utile."),
      model: clean(data.model, 80, DEFAULT_ALEX_MODEL),
      agentId: clean(data.agentId, 80),
      starter: clean(data.starter, 400),
      appHtml: typeof data.appHtml === "string" ? data.appHtml.slice(0, 400000) : "",
      isPublic: Boolean(data.isPublic),
      favorite: Boolean(data.favorite),
      status: clean(data.status, 20, "draft"),
      authorName: clean(data.authorName, 80, "Anonyme"),
      changeNote: clean(data.changeNote, 200),
    };
  })
  .handler(async ({ data, context }) => {
    let version = "1.0.0";
    let changelog: ToolChangelogEntry[] = [];
    if (data.id) {
      const { data: prev } = await context.supabase
        .from("alex_tools")
        .select("version, changelog")
        .eq("id", data.id)
        .maybeSingle();
      if (prev) {
        version = bump((prev.version as string) ?? "1.0.0");
        changelog = Array.isArray(prev.changelog) ? (prev.changelog as ToolChangelogEntry[]) : [];
      }
    }
    if (data.changeNote) {
      changelog = [{ version, date: Date.now(), note: data.changeNote }, ...changelog].slice(0, 50);
    }

    const payload = {
      user_id: context.userId,
      author_name: data.authorName,
      name: data.name,
      description: data.description,
      category: data.category,
      emoji: data.emoji,
      system_prompt: data.systemPrompt,
      model: data.model,
      agent_id: data.agentId,
      starter: data.starter,
      app_html: data.appHtml,
      is_public: data.isPublic,
      favorite: data.favorite,
      status: data.status,
      version,
      changelog,
      ...(data.id ? { id: data.id } : {}),
    };
    const { data: row, error } = await context.supabase
      .from("alex_tools")
      .upsert(payload, { onConflict: "id" })
      .select(SELECT)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Enregistrement impossible.");
    return toTool(row as Row);
  });

export const toggleToolFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; favorite: boolean }) => {
    if (!data?.id) throw new Error("Outil invalide.");
    return { id: data.id, favorite: Boolean(data.favorite) };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alex_tools").update({ favorite: data.favorite }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; note?: string }) => {
    if (!data?.id) throw new Error("Outil invalide.");
    return { id: data.id, note: clean(data.note, 200, "Publication sur la Marketplace") };
  })
  .handler(async ({ data, context }) => {
    const { data: prev, error: readErr } = await context.supabase
      .from("alex_tools")
      .select("version, changelog")
      .eq("id", data.id)
      .single();
    if (readErr || !prev) throw new Error("Outil introuvable.");
    const version = bump((prev.version as string) ?? "1.0.0");
    const changelog = [
      { version, date: Date.now(), note: data.note },
      ...(Array.isArray(prev.changelog) ? (prev.changelog as ToolChangelogEntry[]) : []),
    ].slice(0, 50);

    const { data: row, error } = await context.supabase
      .from("alex_tools")
      .update({ is_public: true, status: "published", version, changelog })
      .eq("id", data.id)
      .select(SELECT)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Publication impossible.");
    return toTool(row as Row);
  });

export const deleteTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("Outil invalide.");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alex_tools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Installation / désinstallation                                     */
/* ------------------------------------------------------------------ */

export const installTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("Outil invalide.");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("alex_tools")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) throw new Error("Cet outil n'est plus disponible.");
    const tool = toTool(src as Row);

    const { data: existing } = await context.supabase
      .from("alex_installs")
      .select("id, installed_version")
      .eq("tool_id", tool.id)
      .maybeSingle();

    if (existing) {
      if (existing.installed_version === tool.version) {
        return { tool, installedVersion: tool.version, alreadyInstalled: true };
      }
      const { error: upErr } = await context.supabase
        .from("alex_installs")
        .update({ installed_version: tool.version })
        .eq("id", existing.id as string);
      if (upErr) throw new Error(upErr.message);
      return { tool, installedVersion: tool.version, alreadyInstalled: false };
    }

    const { error: insErr } = await context.supabase
      .from("alex_installs")
      .insert({ user_id: context.userId, tool_id: tool.id, installed_version: tool.version });
    if (insErr) throw new Error(insErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("alex_tools").update({ installs: tool.installs + 1 }).eq("id", tool.id);

    return { tool: { ...tool, installs: tool.installs + 1 }, installedVersion: tool.version, alreadyInstalled: false };
  });

export const uninstallTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("Outil invalide.");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alex_installs").delete().eq("tool_id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rateTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { toolId: string; rating: number; comment?: string; authorName?: string }) => {
    if (!data?.toolId) throw new Error("Outil invalide.");
    const rating = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5)));
    return {
      toolId: data.toolId,
      rating,
      comment: clean(data.comment, 1000),
      authorName: clean(data.authorName, 80, "Anonyme"),
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alex_reviews").upsert(
      {
        user_id: context.userId,
        tool_id: data.toolId,
        rating: data.rating,
        comment: data.comment,
        author_name: data.authorName,
      },
      { onConflict: "user_id,tool_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* IA — exécution, génération d'application, assistant de création     */
/* ------------------------------------------------------------------ */

// Exécute un outil (chat guidé par ses instructions)
export const runTool = createServerFn({ method: "POST" })
  .inputValidator((data: { systemPrompt: string; model?: string; messages: { role: "user" | "assistant"; content: string }[] }) => {
    if (!Array.isArray(data?.messages)) throw new Error("Messages invalides.");
    return {
      systemPrompt: clean(data.systemPrompt, 8000, "Tu es un assistant IA utile."),
      model: clean(data.model, 80, DEFAULT_ALEX_MODEL),
      messages: data.messages.slice(-30),
    };
  })
  .handler(async ({ data }) => {
    const content = await runChat(data.model, [
      { role: "system", content: `${data.systemPrompt}\n\nRéponds en français par défaut, en markdown quand c'est pertinent.` },
      ...data.messages,
    ]);
    return { content };
  });

const APP_SYSTEM_PROMPT = `Tu es "Alex Studio", un moteur expert de création d'applications web.
À partir de la description de l'utilisateur, tu génères UN SEUL fichier HTML complet et autonome implémentant l'application demandée.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec le code HTML, rien d'autre : pas d'explication, pas de markdown, pas de \`\`\`.
- Commence exactement par <!DOCTYPE html> et termine par </html>.
- Tout tient dans ce seul fichier : HTML + CSS (<style>) + JavaScript (<script>). Aucune dépendance externe, aucun CDN, aucune image distante.
- Design haut de gamme : glassmorphism, coins arrondis, dégradés subtils, animations fluides, mode sombre élégant, responsive mobile.
- L'application doit être immédiatement fonctionnelle, sans placeholder à compléter, sans erreur JavaScript.
- Persiste les données de l'utilisateur avec localStorage quand c'est pertinent.
- Interface entièrement en français.`;

function extractHtml(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("<!DOCTYPE");
  const startAlt = start === -1 ? t.toLowerCase().indexOf("<html") : start;
  if (startAlt > 0) t = t.slice(startAlt);
  return t.trim();
}

// Construit ou améliore l'application d'un projet Alex Studio.
export const buildToolApp = createServerFn({ method: "POST" })
  .inputValidator((data: { prompt: string; previousHtml?: string; context?: string }) => {
    const prompt = clean(data?.prompt, 4000);
    if (!prompt) throw new Error("Décris ce que tu veux créer.");
    return {
      prompt,
      previousHtml: typeof data.previousHtml === "string" ? data.previousHtml.slice(0, 80000) : "",
      context: clean(data.context, 1000),
    };
  })
  .handler(async ({ data }) => {
    const userContent = data.previousHtml
      ? `Voici l'application HTML actuelle :\n\`\`\`html\n${data.previousHtml}\n\`\`\`\n\nModification demandée : ${data.prompt}\n\nRenvoie le NOUVEAU fichier HTML complet intégrant la modification.`
      : `${data.context ? `Contexte du projet : ${data.context}\n\n` : ""}Crée cette application : ${data.prompt}\n\nRenvoie uniquement le fichier HTML complet.`;

    const messages = [
      { role: "system" as const, content: APP_SYSTEM_PROMPT },
      { role: "user" as const, content: userContent },
    ];

    let raw: string;
    try {
      raw = await callOpenAI("gpt-4o", messages, { temperature: 0.6 });
    } catch (e) {
      console.warn("Alex Studio: OpenAI indisponible, repli Groq:", (e as Error).message);
      raw = await runChat("gpt-oss-120b", messages);
    }
    const html = extractHtml(raw);
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
      return { html: null as string | null, error: "La génération n'a pas produit d'application valide. Reformule ta demande." };
    }
    return { html, error: null as string | null };
  });

// Assistant de création : transforme une idée en configuration d'outil complète
export const draftToolFromIdea = createServerFn({ method: "POST" })
  .inputValidator((data: { idea: string }) => {
    const idea = clean(data?.idea, 1200);
    if (!idea) throw new Error("Décris ton idée d'outil.");
    return { idea };
  })
  .handler(async ({ data }) => {
    const raw = await runChat(DEFAULT_ALEX_MODEL, [
      {
        role: "system",
        content:
          "Tu conçois des outils IA. À partir d'une idée, retourne UNIQUEMENT un objet JSON valide (sans texte autour, sans balises markdown) avec les clés : name (court, français), emoji (1 emoji), description (1 phrase), category (parmi general, writing, code, business, education, creative, productivity, fun), systemPrompt (instructions détaillées et professionnelles pour l'IA, en français, 100-250 mots), starter (une phrase d'accueil que l'outil affiche à l'utilisateur).",
      },
      { role: "user", content: data.idea },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Génération impossible, reformule ton idée.");
    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return {
        name: clean(parsed.name, 80, "Nouvel outil"),
        emoji: clean(parsed.emoji, 8, "✨"),
        description: clean(parsed.description, 400),
        category: clean(parsed.category, 40, "general"),
        systemPrompt: clean(parsed.systemPrompt, 8000, data.idea),
        starter: clean(parsed.starter, 400),
      };
    } catch {
      throw new Error("Génération illisible, réessaie.");
    }
  });

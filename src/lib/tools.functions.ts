// Alex Studio & Alex Marketplace — création, publication, installation et
// exécution d'outils IA personnalisés (avec application générée en HTML).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runChat, callOpenAI } from "./ai-chat.server";
import { DEFAULT_ALEX_MODEL } from "./alex-models";
import type { ToolChangelogEntry, ToolReview } from "./tools-catalog";
import {
  TOOL_SELECT, toTool, clean, bumpVersion, extractHtml, APP_SYSTEM_PROMPT, DRAFT_SYSTEM_PROMPT,
  type ToolRow,
} from "./tools.server";

// Mes projets (Alex Studio)
export const listMyTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alex_tools")
      .select(TOOL_SELECT)
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ToolRow[]).map(toTool);
  });

// Outils publiés (Alex Marketplace) + notes moyennes
export const listMarketplaceTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [toolsRes, reviewsRes] = await Promise.all([
      context.supabase
        .from("alex_tools")
        .select(TOOL_SELECT)
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

    return ((toolsRes.data ?? []) as ToolRow[]).map((r) => {
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
      .select(`tool_id, installed_version, created_at, alex_tools!inner(${TOOL_SELECT})`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Array<{ installed_version: string; alex_tools: ToolRow }>).map((r) => ({
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

export const saveTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
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
    }) => {
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
    },
  )
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
        version = bumpVersion((prev.version as string) ?? "1.0.0");
        changelog = Array.isArray(prev.changelog) ? (prev.changelog as ToolChangelogEntry[]) : [];
      }
    }
    if (data.changeNote) {
      changelog = [{ version, date: Date.now(), note: data.changeNote }, ...changelog].slice(0, 50);
    }

    const { data: row, error } = await context.supabase
      .from("alex_tools")
      .upsert(
        {
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
        },
        { onConflict: "id" },
      )
      .select(TOOL_SELECT)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Enregistrement impossible.");
    return toTool(row as ToolRow);
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
    const version = bumpVersion((prev.version as string) ?? "1.0.0");
    const changelog = [
      { version, date: Date.now(), note: data.note },
      ...(Array.isArray(prev.changelog) ? (prev.changelog as ToolChangelogEntry[]) : []),
    ].slice(0, 50);

    const { data: row, error } = await context.supabase
      .from("alex_tools")
      .update({ is_public: true, status: "published", version, changelog })
      .eq("id", data.id)
      .select(TOOL_SELECT)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Publication impossible.");
    return toTool(row as ToolRow);
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

export const installTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("Outil invalide.");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("alex_tools")
      .select(TOOL_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) throw new Error("Cet outil n'est plus disponible.");
    const tool = toTool(src as ToolRow);

    const { data: existing } = await context.supabase
      .from("alex_installs")
      .select("id, installed_version")
      .eq("tool_id", tool.id)
      .maybeSingle();

    if (existing) {
      const already = (existing.installed_version as string) === tool.version;
      if (!already) {
        const { error: upErr } = await context.supabase
          .from("alex_installs")
          .update({ installed_version: tool.version })
          .eq("id", existing.id as string);
        if (upErr) throw new Error(upErr.message);
      }
      return { tool, installedVersion: tool.version, alreadyInstalled: already };
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
    return {
      toolId: data.toolId,
      rating: Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5))),
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
      ? `Voici l'application HTML actuelle :\n${data.previousHtml}\n\nModification demandée : ${data.prompt}\n\nRenvoie le NOUVEAU fichier HTML complet intégrant la modification.`
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
      { role: "system", content: DRAFT_SYSTEM_PROMPT },
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

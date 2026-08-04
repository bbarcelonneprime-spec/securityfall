// Alex Studio & Alex Marketplace — création, partage et exécution d'outils IA personnalisés.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runChat } from "./ai-chat.server";
import { DEFAULT_ALEX_MODEL } from "./alex-models";

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
  starter: string;
  isPublic: boolean;
  installs: number;
  createdAt: number;
  updatedAt: number;
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
  starter: string;
  is_public: boolean;
  installs: number;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, user_id, author_name, name, description, category, emoji, system_prompt, model, starter, is_public, installs, created_at, updated_at";

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
    starter: r.starter,
    isPublic: r.is_public,
    installs: r.installs,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

function clean(v: unknown, max: number, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;
}

// Mes outils (Alex Studio)
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

// Outils publiés (Alex Marketplace)
export const listMarketplaceTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alex_tools")
      .select(SELECT)
      .eq("is_public", true)
      .order("installs", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(toTool);
  });

type SaveInput = {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  emoji?: string;
  systemPrompt: string;
  model?: string;
  starter?: string;
  isPublic?: boolean;
  authorName?: string;
};

export const saveTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveInput) => {
    const name = clean(data?.name, 80);
    if (!name) throw new Error("Donne un nom à ton outil.");
    const systemPrompt = clean(data?.systemPrompt, 8000);
    if (!systemPrompt) throw new Error("Décris les instructions de ton outil.");
    return {
      id: typeof data.id === "string" && data.id ? data.id : undefined,
      name,
      description: clean(data.description, 400),
      category: clean(data.category, 40, "general"),
      emoji: clean(data.emoji, 8, "✨"),
      systemPrompt,
      model: clean(data.model, 80, DEFAULT_ALEX_MODEL),
      starter: clean(data.starter, 400),
      isPublic: Boolean(data.isPublic),
      authorName: clean(data.authorName, 80, "Anonyme"),
    };
  })
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      author_name: data.authorName,
      name: data.name,
      description: data.description,
      category: data.category,
      emoji: data.emoji,
      system_prompt: data.systemPrompt,
      model: data.model,
      starter: data.starter,
      is_public: data.isPublic,
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

// Installe un outil de la marketplace : copie dans ma bibliothèque + compteur
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
      .eq("is_public", true)
      .single();
    if (error || !src) throw new Error("Cet outil n'est plus disponible.");
    const s = src as Row;

    const { data: row, error: insErr } = await context.supabase
      .from("alex_tools")
      .insert({
        user_id: context.userId,
        author_name: s.author_name,
        name: s.name,
        description: s.description,
        category: s.category,
        emoji: s.emoji,
        system_prompt: s.system_prompt,
        model: s.model,
        starter: s.starter,
        is_public: false,
      })
      .select(SELECT)
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Installation impossible.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("alex_tools")
      .update({ installs: s.installs + 1 })
      .eq("id", s.id);

    return toTool(row as Row);
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

// Persistance des projets Codex (jeux 2D) dans Supabase.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CodexHistoryItem = { role: "user" | "assistant"; content: string; at: number };
export type CodexProject = {
  id: string;
  name: string;
  prompt: string;
  html: string;
  history: CodexHistoryItem[];
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  name: string;
  prompt: string;
  html: string;
  history: CodexHistoryItem[] | null;
  created_at: string;
  updated_at: string;
};

function toProject(r: Row): CodexProject {
  return {
    id: r.id,
    name: r.name,
    prompt: r.prompt,
    html: r.html,
    history: Array.isArray(r.history) ? r.history : [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export const listCodexProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("codex_projects")
      .select("id,name,prompt,html,history,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { projects: (data ?? []).map((r) => toProject(r as unknown as Row)) };
  });

export const saveCodexProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string; name: string; prompt: string; html: string; history: CodexHistoryItem[] }) => {
    if (!data.name || !data.html) throw new Error("Projet invalide.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      name: data.name.slice(0, 200),
      prompt: data.prompt.slice(0, 4000),
      html: data.html,
      history: data.history,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("codex_projects")
        .update(payload)
        .eq("id", data.id)
        .select("id,name,prompt,html,history,created_at,updated_at")
        .single();
      if (error) throw new Error(error.message);
      return { project: toProject(row as unknown as Row) };
    }
    const { data: row, error } = await context.supabase
      .from("codex_projects")
      .insert(payload)
      .select("id,name,prompt,html,history,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { project: toProject(row as unknown as Row) };
  });

export const deleteCodexProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data.id) throw new Error("id manquant");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("codex_projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

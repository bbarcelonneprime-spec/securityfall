// Alex Studio — tableau de bord des projets d'outils IA + éditeur plein écran.
import { useEffect, useMemo, useState } from "react";
import {
  Home, Wand2, Plus, Loader2, Trash2, Globe, Store, Star, Sparkles, X, PenLine, Rocket,
  FileText, CheckCircle2, Clock, BarChart3, Download,
} from "lucide-react";
import StudioEditor from "./studio/StudioEditor";
import { ALEX_MODELS, DEFAULT_ALEX_MODEL } from "@/lib/alex-models";
import { TOOL_CATEGORIES, categoryLabel, type AlexTool } from "@/lib/tools-catalog";

export type ToolDraft = {
  id?: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  systemPrompt?: string;
  starter?: string;
  model?: string;
  agentId?: string;
  appHtml?: string;
  isPublic: boolean;
  favorite?: boolean;
  status?: string;
  changeNote?: string;
};

const EMOJIS = ["✨", "🤖", "📝", "💻", "📊", "🎓", "🎨", "⚡", "🧩", "🔍", "🎬", "🍳"];

type ToniaAgentLite = { id: string; name: string; emoji: string; role: string; model: string; rules?: string };

type Props = {
  onHome: () => void;
  tools: AlexTool[];
  loading: boolean;
  onSave: (draft: ToolDraft) => Promise<AlexTool>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string, favorite: boolean) => Promise<void>;
  onPublish: (id: string) => Promise<void>;
  onInstall: (id: string) => Promise<void>;
  onBuild: (p: { prompt: string; previousHtml: string; context: string }) => Promise<{ html: string | null; error: string | null }>;
  onGoMarketplace: () => void;
};

export default function AlexStudio({
  onHome, tools, loading, onSave, onDelete, onToggleFavorite, onPublish, onInstall, onBuild, onGoMarketplace,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "drafts" | "published" | "favorites">("all");
  const [agents, setAgents] = useState<ToniaAgentLite[]>([]);
  const [form, setForm] = useState({ name: "", description: "", emoji: "✨", category: "general", ai: DEFAULT_ALEX_MODEL });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tonia_agents_v2");
      setAgents(raw ? (JSON.parse(raw) as ToniaAgentLite[]) : []);
    } catch {
      setAgents([]);
    }
  }, []);

  const project = tools.find((t) => t.id === openId) ?? null;

  const filtered = useMemo(() => {
    if (tab === "drafts") return tools.filter((t) => !t.isPublic);
    if (tab === "published") return tools.filter((t) => t.isPublic);
    if (tab === "favorites") return tools.filter((t) => t.favorite);
    return tools;
  }, [tools, tab]);

  const stats = useMemo(
    () => ({
      total: tools.length,
      published: tools.filter((t) => t.isPublic).length,
      drafts: tools.filter((t) => !t.isPublic).length,
      installs: tools.reduce((s, t) => s + t.installs, 0),
    }),
    [tools],
  );

  const create = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const agent = agents.find((a) => a.id === form.ai);
      const created = await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        emoji: form.emoji,
        category: form.category,
        model: agent ? agent.model : form.ai,
        agentId: agent ? agent.id : "",
        systemPrompt: agent
          ? `Tu es « ${agent.name} » : ${agent.role}. ${agent.rules ?? ""}`
          : "Tu es un assistant IA utile intégré à cet outil.",
        starter: "",
        isPublic: false,
        status: "draft",
      });
      setCreating(false);
      setForm({ name: "", description: "", emoji: "✨", category: "general", ai: DEFAULT_ALEX_MODEL });
      setOpenId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40";

  if (project) {
    return (
      <StudioEditor
        project={project}
        onBack={() => setOpenId(null)}
        onBuild={onBuild}
        onSave={async ({ appHtml, changeNote }) => {
          await onSave({
            id: project.id,
            name: project.name,
            description: project.description,
            emoji: project.emoji,
            category: project.category,
            systemPrompt: project.systemPrompt,
            starter: project.starter,
            model: project.model,
            agentId: project.agentId,
            appHtml,
            isPublic: project.isPublic,
            favorite: project.favorite,
            status: project.status,
            changeNote,
          });
        }}
        onPublish={() => onPublish(project.id)}
        onInstall={() => onInstall(project.id)}
        onGoMarketplace={onGoMarketplace}
      />
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onHome} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 backdrop-blur-xl transition hover:bg-white/10" aria-label="Accueil">
          <Home className="h-4 w-4" />
        </button>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg">
          <Wand2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Alex Studio</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">L'atelier officiel d'Alex IA — crée tes outils par la conversation</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onGoMarketplace} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10">
            <Store className="h-3.5 w-3.5" /> Marketplace
          </button>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110">
            <Plus className="h-3.5 w-3.5" /> Nouveau projet
          </button>
        </div>
      </div>

      {/* statistiques */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Projets", value: stats.total, icon: Sparkles },
          { label: "Publiés", value: stats.published, icon: CheckCircle2 },
          { label: "Brouillons", value: stats.drafts, icon: FileText },
          { label: "Installations", value: stats.installs, icon: BarChart3 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400"><s.icon className="h-3.5 w-3.5" /> {s.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</p>}

      {/* onglets */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { id: "all", label: "Mes projets" },
          { id: "drafts", label: "Brouillons" },
          { id: "published", label: "Outils publiés" },
          { id: "favorites", label: "Favoris" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? "border-violet-400/60 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
          <Wand2 className="mx-auto mb-3 h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">Aucun projet ici. Lance ta première création.</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
            <Plus className="h-4 w-4" /> Nouveau projet
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.07]">
              <div className="mb-3 flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-600/30 text-xl">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-white">{t.name}</p>
                  <p className="truncate text-[11px] text-slate-400">v{t.version} · {categoryLabel(t.category)}</p>
                </div>
                <button type="button" onClick={() => void onToggleFavorite(t.id, !t.favorite)} className="rounded-lg p-1 text-slate-500 hover:text-amber-300" aria-label="Favori">
                  <Star className={`h-4 w-4 ${t.favorite ? "fill-amber-300 text-amber-300" : ""}`} />
                </button>
              </div>
              <p className="line-clamp-2 flex-1 text-sm text-slate-300">{t.description || "Sans description"}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" /> {new Date(t.updatedAt).toLocaleDateString("fr-FR")}
                {t.isPublic ? <span className="ml-1 inline-flex items-center gap-1 text-emerald-300"><Globe className="h-3 w-3" /> publié</span> : <span className="ml-1 text-slate-500">brouillon</span>}
              </p>
              <div className="mt-4 flex items-center gap-1.5">
                <button type="button" onClick={() => setOpenId(t.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110">
                  <PenLine className="h-3.5 w-3.5" /> Ouvrir l'éditeur
                </button>
                <button type="button" onClick={() => void onInstall(t.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15" title="Installer dans Alex IA">
                  <Rocket className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([t.appHtml || "<!DOCTYPE html><html><body>Projet vide</body></html>"], { type: "text/html" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${t.name.replace(/\W+/g, "-").toLowerCase()}.html`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15"
                  title="Télécharger"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => void onDelete(t.id)} className="grid h-8 w-8 place-items-center rounded-xl bg-red-500/15 text-red-200 transition hover:bg-red-500/30" title="Supprimer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* fenêtre de création */}
      {creating && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-[#0b0f1c] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-300" />
              <p className="flex-1 text-sm font-semibold text-white">Nouveau projet</p>
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>

            <div>
              <label htmlFor="npName" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nom du projet</label>
              <input id="npName" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80} className={field} placeholder="Générateur de QR Code" />
            </div>

            <div>
              <label htmlFor="npDesc" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</label>
              <input id="npDesc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={400} className={field} placeholder="À quoi sert ton outil ?" />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Logo</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setForm((f) => ({ ...f, emoji: e }))} className={`grid h-9 w-9 place-items-center rounded-xl border text-lg transition ${form.emoji === e ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}>{e}</button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="npCat" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Catégorie</label>
                <select id="npCat" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={field}>
                  {TOOL_CATEGORIES.map((c) => <option key={c.id} value={c.id} className="bg-[#0d1122]">{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="npAi" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">IA à utiliser</label>
                <select id="npAi" value={form.ai} onChange={(e) => setForm((f) => ({ ...f, ai: e.target.value }))} className={field}>
                  <optgroup label="Mes IA (TON IA)">
                    {agents.length === 0 && <option value="" disabled>Aucune IA enregistrée</option>}
                    {agents.map((a) => <option key={a.id} value={a.id} className="bg-[#0d1122]">{a.emoji} {a.name}</option>)}
                  </optgroup>
                  <optgroup label="IA intégrées à Alex IA">
                    {ALEX_MODELS.map((m) => <option key={m.id} value={m.id} className="bg-[#0d1122]">{m.label}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>

            <button type="button" onClick={() => void create()} disabled={saving || !form.name.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer et ouvrir l'éditeur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

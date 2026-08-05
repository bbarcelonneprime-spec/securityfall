// Alex Studio — crée, teste, publie et gère tes propres outils IA (no-code).
import { useEffect, useState } from "react";
import {
  Home, Wand2, Plus, Loader2, Save, Trash2, Globe, Lock, AlertCircle, Sparkles, PlayCircle, X, PenLine,
} from "lucide-react";
import ToolChat, { type ToolMsg } from "./ToolChat";
import { TOOL_CATEGORIES, type AlexTool } from "@/lib/tools.functions";

export type ToolDraft = {
  id?: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  systemPrompt: string;
  starter: string;
  isPublic: boolean;
};

const EMPTY: ToolDraft = {
  name: "",
  emoji: "✨",
  description: "",
  category: "general",
  systemPrompt: "",
  starter: "",
  isPublic: false,
};

const EMOJIS = ["✨", "🤖", "📝", "💻", "📊", "🎓", "🎨", "⚡", "🧩", "🔍", "🎬", "🍳"];

type Props = {
  onHome: () => void;
  tools: AlexTool[];
  loading: boolean;
  onSave: (draft: ToolDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDraftFromIdea: (idea: string) => Promise<Omit<ToolDraft, "isPublic">>;
  onRun: (p: { systemPrompt: string; model?: string; messages: ToolMsg[] }) => Promise<string>;
  onGoMarketplace: () => void;
};

export default function AlexStudio({
  onHome, tools, loading, onSave, onDelete, onDraftFromIdea, onRun, onGoMarketplace,
}: Props) {
  const [draft, setDraft] = useState<ToolDraft>(EMPTY);
  const [idea, setIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<AlexTool | null>(null);

  useEffect(() => setError(null), [draft.name]);

  const set = <K extends keyof ToolDraft>(k: K, v: ToolDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const generate = async () => {
    if (!idea.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await onDraftFromIdea(idea.trim());
      setDraft({ ...res, isPublic: draft.isPublic, id: draft.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setDraft(EMPTY);
      setIdea("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40";

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 backdrop-blur-xl transition hover:bg-white/10"
          aria-label="Accueil"
        >
          <Home className="h-4 w-4" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg">
          <Wand2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Alex Studio</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">Crée tes propres outils IA sans coder</p>
        </div>
        <button
          type="button"
          onClick={onGoMarketplace}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
        >
          <Globe className="h-3.5 w-3.5" /> Marketplace
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Constructeur */}
        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
          <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-violet-300" /> Décris ton idée, l'IA construit l'outil
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void generate(); }}
                placeholder="Ex : un outil qui transforme mes notes en fiches de révision"
                className={field}
              />
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generating || !idea.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Générer
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="asName" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nom</label>
              <input id="asName" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className={field} />
            </div>
            <div>
              <label htmlFor="asCat" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Catégorie</label>
              <select id="asCat" value={draft.category} onChange={(e) => set("category", e.target.value)} className={field}>
                {TOOL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0d1122]">{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Icône</p>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set("emoji", e)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition ${draft.emoji === e ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="asDesc" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Description</label>
            <input id="asDesc" value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={400} placeholder="À quoi sert ton outil ?" className={field} />
          </div>

          <div>
            <label htmlFor="asPrompt" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions de l'IA</label>
            <textarea
              id="asPrompt"
              value={draft.systemPrompt}
              onChange={(e) => set("systemPrompt", e.target.value)}
              rows={8}
              maxLength={8000}
              placeholder="Tu es un expert en… Ton rôle est de…"
              className={`${field} resize-none font-mono text-[13px] leading-relaxed`}
            />
          </div>

          <div>
            <label htmlFor="asStarter" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Message d'accueil</label>
            <input id="asStarter" value={draft.starter} onChange={(e) => set("starter", e.target.value)} maxLength={400} className={field} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => set("isPublic", !draft.isPublic)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${draft.isPublic ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}
            >
              {draft.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {draft.isPublic ? "Publié sur la marketplace" : "Privé"}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !draft.name.trim() || !draft.systemPrompt.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01] disabled:opacity-50 sm:flex-none"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {draft.id ? "Mettre à jour" : "Créer l'outil"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!draft.name.trim() || !draft.systemPrompt.trim()) return;
                const next = { ...draft, isPublic: true };
                setDraft(next);
                setSaving(true);
                try {
                  await onSave(next);
                  onGoMarketplace();
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || !draft.name.trim() || !draft.systemPrompt.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Globe className="h-4 w-4" /> Publier sur la Marketplace
            </button>
            {(draft.name || draft.systemPrompt) && (
              <button type="button" onClick={() => setDraft(EMPTY)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10">
                Annuler
              </button>
            )}
          </div>

        </section>

        {/* Mes outils */}
        <aside className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Mes outils ({tools.length})</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : tools.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-xs text-slate-400">
              Aucun outil pour l'instant. Crée le premier !
            </p>
          ) : (
            <div className="space-y-2">
              {tools.map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{t.name}</p>
                      <p className="line-clamp-2 text-[11px] text-slate-400">{t.description || "Sans description"}</p>
                    </div>
                    {t.isPublic && <Globe className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button type="button" onClick={() => setTesting(t)} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white transition hover:bg-white/20">
                      <PlayCircle className="h-3 w-3" /> Utiliser
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ id: t.id, name: t.name, emoji: t.emoji, description: t.description, category: t.category, systemPrompt: t.systemPrompt, starter: t.starter, isPublic: t.isPublic })}
                      className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-white/15"
                    >
                      <PenLine className="h-3 w-3" /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(t.id)}
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] text-red-200 transition hover:bg-red-500/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Modale de test */}
      {testing && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setTesting(null)}>
          <div
            className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#11111d] shadow-2xl sm:h-[80vh] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-white">Utiliser l'outil</p>
              <button type="button" onClick={() => setTesting(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/15" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ToolChat
              emoji={testing.emoji}
              name={testing.name}
              subtitle={testing.description}
              starter={testing.starter}
              onSend={(messages) => onRun({ systemPrompt: testing.systemPrompt, model: testing.model, messages })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

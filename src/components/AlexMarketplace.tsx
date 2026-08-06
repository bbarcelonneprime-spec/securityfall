// Alex Marketplace — découvre, installe et utilise les outils IA publiés par la communauté.
import { useMemo, useState } from "react";
import {
  Home, Store, Search, Loader2, Download, PlayCircle, Users, X, Wand2, Check,
} from "lucide-react";
import ToolChat, { type ToolMsg } from "./ToolChat";
import { TOOL_CATEGORIES, categoryLabel, type AlexTool } from "@/lib/tools-catalog";

type Props = {
  onHome: () => void;
  tools: AlexTool[];
  loading: boolean;
  onInstall: (id: string) => Promise<void>;
  onRun: (p: { systemPrompt: string; model?: string; messages: ToolMsg[] }) => Promise<string>;
  onGoStudio: () => void;
};

export default function AlexMarketplace({ onHome, tools, loading, onInstall, onRun, onGoStudio }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [running, setRunning] = useState<AlexTool | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter(
      (t) =>
        (cat === "all" || t.category === cat) &&
        (!q || `${t.name} ${t.description} ${t.authorName}`.toLowerCase().includes(q)),
    );
  }, [tools, query, cat]);

  const install = async (t: AlexTool) => {
    setBusy(t.id);
    try {
      await onInstall(t.id);
      setInstalled((prev) => [...prev, t.id]);
    } finally {
      setBusy(null);
    }
  };

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
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Alex Marketplace</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">Les outils IA créés par la communauté</p>
        </div>
        <button
          type="button"
          onClick={onGoStudio}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
        >
          <Wand2 className="h-3.5 w-3.5" /> Créer un outil
        </button>
      </div>

      {/* Recherche + filtres */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un outil, un créateur…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none backdrop-blur-xl transition focus:border-emerald-400/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ id: "all", label: "Tous" }, ...TOOL_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${cat === c.id ? "border-emerald-400/60 bg-emerald-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des outils…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
          <Store className="mx-auto mb-3 h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-300">Aucun outil publié ne correspond.</p>
          <button
            type="button"
            onClick={onGoStudio}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-105"
          >
            <Wand2 className="h-4 w-4" /> Publie le tien
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-600/30 text-xl">{t.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{t.name}</p>
                  <p className="truncate text-[11px] text-slate-400">par {t.authorName}</p>
                </div>
              </div>
              <p className="line-clamp-3 flex-1 text-sm text-slate-300">{t.description || "Sans description"}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full bg-white/5 px-2 py-0.5 capitalize">
                  {categoryLabel(t.category)}
                </span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {t.installs}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRunning(t)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:scale-[1.02]"
                >
                  <PlayCircle className="h-3.5 w-3.5" /> Utiliser
                </button>
                <button
                  type="button"
                  onClick={() => void install(t)}
                  disabled={busy === t.id || installed.includes(t.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/15 disabled:opacity-60"
                >
                  {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : installed.includes(t.id) ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  {installed.includes(t.id) ? "Installé" : "Installer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {running && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setRunning(null)}>
          <div
            className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#11111d] shadow-2xl sm:h-[80vh] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-white">{running.name}</p>
              <button type="button" onClick={() => setRunning(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/15" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ToolChat
              emoji={running.emoji}
              name={running.name}
              subtitle={`par ${running.authorName}`}
              starter={running.starter}
              onSend={(messages) => onRun({ systemPrompt: running.systemPrompt, model: running.model, messages })}
            />
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-slate-500">Alex Marketplace — © Alex Graph</p>
    </div>
  );
}

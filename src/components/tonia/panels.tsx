// Panneaux secondaires du hub TON IA (API, modèles, images, code, docs, canvas, projets).
import { useState } from "react";
import {
  Check, Plus, Trash2, KeyRound, Cpu, Image as ImageIcon, Code2, FileText,
  Palette, FolderOpen, Loader2, Play, ExternalLink, Sparkles, Wand2, Layers,
} from "lucide-react";
import { MODEL_LIBRARY, PROVIDERS, type ProviderId } from "./types";

const card = "rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl";
const field =
  "w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40";

export function PanelHeader({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">{icon}</span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

/* ---------------- Clés API ---------------- */
export type ApiKeyRecord = { provider: ProviderId; key: string; status: "idle" | "testing" | "ok" | "error" };

export function ApiKeysPanel({
  keys, onSave, onRemove,
}: {
  keys: ApiKeyRecord[];
  onSave: (r: ApiKeyRecord) => void;
  onRemove: (p: ProviderId) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [value, setValue] = useState("");

  const test = (rec: ApiKeyRecord) => {
    onSave({ ...rec, status: "testing" });
    setTimeout(() => onSave({ ...rec, status: rec.key.trim().length >= 12 ? "ok" : "error" }), 700);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PanelHeader
        icon={<KeyRound className="h-5 w-5" />}
        title="Mes clés API"
        subtitle="Connecte tes propres fournisseurs — les clés restent sur cet appareil"
        action={
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Ajouter une clé
          </button>
        }
      />

      {adding && (
        <div className={`${card} mb-4 space-y-3`}>
          <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)} className={field}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id} className="bg-[#0d1122]">{p.label}</option>)}
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={PROVIDERS.find((p) => p.id === provider)?.hint} className={field} />
          <button
            type="button"
            onClick={() => { if (!value.trim()) return; onSave({ provider, key: value.trim(), status: "idle" }); setValue(""); setAdding(false); }}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
          >
            Enregistrer
          </button>
        </div>
      )}

      <div className="space-y-2">
        {PROVIDERS.map((p) => {
          const rec = keys.find((k) => k.provider === p.id);
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{p.label}</p>
                <p className="truncate text-[11px] text-slate-500">{rec ? `••••••••${rec.key.slice(-4)}` : "Non configuré"}</p>
              </div>
              {rec?.status === "ok" && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-200"><Check className="h-3 w-3" /> Connecté</span>}
              {rec?.status === "error" && <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2 py-1 text-[11px] text-red-200">Échec</span>}
              {rec?.status === "testing" && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              {rec && (
                <>
                  <button type="button" onClick={() => test(rec)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10">Tester</button>
                  <button type="button" onClick={() => onRemove(p.id)} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-red-300" aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Bibliothèque de modèles ---------------- */
export function ModelsPanel({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const byProvider = PROVIDERS.map((p) => ({ p, models: MODEL_LIBRARY.filter((m) => m.provider === p.id) })).filter((g) => g.models.length);
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PanelHeader icon={<Cpu className="h-5 w-5" />} title="Bibliothèque de modèles" subtitle="Choisis le moteur qui répondra dans le chat" />
      <div className="space-y-6">
        {byProvider.map(({ p, models }) => (
          <section key={p.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{p.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPick(m.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${current === m.id ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
                >
                  <Layers className="h-4 w-4 shrink-0 text-violet-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{m.label}</p>
                    <p className="truncate text-[11px] text-slate-500">{m.skills.join(" · ")}</p>
                  </div>
                  {current === m.id && <Check className="h-4 w-4 text-violet-300" />}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Studio d'images ---------------- */
export function ImagesPanel({
  images, onGenerate, generating,
}: {
  images: Array<{ id: string; prompt: string; url: string }>;
  onGenerate: (prompt: string) => Promise<void>;
  generating: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const modes = [
    { icon: Wand2, label: "Créer" },
    { icon: Sparkles, label: "Modifier" },
    { icon: ImageIcon, label: "Upscale" },
    { icon: Palette, label: "Remove BG" },
    { icon: Layers, label: "Variations" },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PanelHeader icon={<ImageIcon className="h-5 w-5" />} title="Studio d'images" subtitle="Créer, modifier, upscale, variations et historique" />
      <div className="mb-4 flex flex-wrap gap-2">
        {modes.map((m, i) => (
          <span key={m.label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${i === 0 ? "border-violet-400/50 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-400"}`}>
            <m.icon className="h-3.5 w-3.5" /> {m.label}
          </span>
        ))}
      </div>
      <div className={`${card} mb-6 flex gap-2`}>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Décris l'image à générer…" className={field} />
        <button
          type="button"
          disabled={generating || !prompt.trim()}
          onClick={() => { const p = prompt.trim(); setPrompt(""); void onGenerate(p); }}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Générer
        </button>
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune image encore. Lance ta première génération.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((im) => (
            <figure key={im.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <img src={im.url} alt={im.prompt} loading="lazy" className="aspect-square w-full object-cover" />
              <figcaption className="truncate px-3 py-2 text-[11px] text-slate-400">{im.prompt}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Espace code (aperçu + code) ---------------- */
export function CodeWorkspace({ code, lang }: { code: string; lang: string }) {
  const isWeb = /html|jsx|tsx|svg/i.test(lang) || /<html|<div/i.test(code);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader icon={<Code2 className="h-5 w-5" />} title="Espace code" subtitle="Aperçu en direct + explorateur, comme Cursor ou Lovable" />
      {!code ? (
        <p className="text-sm text-slate-500">Demande du code dans le chat — l'aperçu s'ouvre automatiquement ici.</p>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
          <div className="min-h-[240px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <p className="border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">Aperçu</p>
            {isWeb ? (
              <iframe title="Aperçu" srcDoc={code} sandbox="allow-scripts" className="h-full min-h-[220px] w-full bg-white" />
            ) : (
              <p className="p-4 text-xs text-slate-500">Aperçu non disponible pour « {lang} ».</p>
            )}
          </div>
          <div className="min-h-[240px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a]">
            <p className="border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">Code · {lang}</p>
            <pre className="max-h-[60vh] overflow-auto p-4 text-xs leading-relaxed text-slate-200"><code>{code}</code></pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Documents / Canvas / Projets ---------------- */
export function DocsPanel({ files }: { files: Array<{ id: string; name: string; size: number }> }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PanelHeader icon={<FileText className="h-5 w-5" />} title="Documents" subtitle="Fichiers joints à tes conversations" />
      {files.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun document. Utilise 📎 dans la zone d'écriture.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-[11px] text-slate-500">{Math.round(f.size / 1024)} Ko</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CanvasPanel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
      <PanelHeader icon={<Palette className="h-5 w-5" />} title="Canvas" subtitle="Espace d'écriture libre, éditable à côté du chat" />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Écris, colle ou construis ton document ici…"
        className="min-h-[50vh] flex-1 resize-none rounded-2xl border border-white/10 bg-[#0d1122]/80 p-5 text-sm leading-relaxed text-slate-100 outline-none focus:border-violet-400/40"
      />
    </div>
  );
}

export function ProjectsPanel({
  projects, onCreate, onOpen,
}: {
  projects: Array<{ id: string; name: string; count: number }>;
  onCreate: (name: string) => void;
  onOpen: (id: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PanelHeader icon={<FolderOpen className="h-5 w-5" />} title="Projets" subtitle="Regroupe tes conversations par sujet" />
      <div className={`${card} mb-4 flex gap-2`}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet…" className={field} />
        <button type="button" onClick={() => { if (name.trim()) { onCreate(name.trim()); setName(""); } }} className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15">Créer</button>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun projet pour l'instant.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.07]">
              <FolderOpen className="h-4 w-4 shrink-0 text-violet-300" />
              <span className="min-w-0 flex-1 truncate text-sm text-white">{p.name}</span>
              <span className="text-[11px] text-slate-500">{p.count} conv.</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Alex Studio — éditeur plein écran : barre latérale, chat IA central,
// aperçu live et console. Toutes les modifications passent par la conversation.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, FolderTree, Boxes, Image as ImageIcon, Plug, Database, Store, History, Settings2,
  Send, Loader2, Monitor, Smartphone, RefreshCw, Terminal, ChevronDown, Download, Globe, Rocket,
  Code2, FileCode, Palette, Check, Star, Sparkles,
} from "lucide-react";
import { ALEX_MODELS } from "@/lib/alex-models";
import { categoryLabel, type AlexTool } from "@/lib/tools-catalog";

export type StudioMsg = { id: string; role: "user" | "assistant"; content: string; at: number };
export type LogEntry = { id: string; kind: "info" | "error" | "gen"; text: string; at: number };

type Rail =
  | "explorer" | "components" | "assets" | "api" | "database" | "marketplace" | "history" | "settings";

const RAIL: Array<{ id: Rail; label: string; icon: typeof FolderTree }> = [
  { id: "explorer", label: "Explorateur", icon: FolderTree },
  { id: "components", label: "Composants", icon: Boxes },
  { id: "assets", label: "Assets", icon: ImageIcon },
  { id: "api", label: "API", icon: Plug },
  { id: "database", label: "Base de données", icon: Database },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "history", label: "Historique", icon: History },
  { id: "settings", label: "Paramètres", icon: Settings2 },
];

const COMPONENTS: Array<{ label: string; prompt: string; icon: string }> = [
  { label: "Bouton", prompt: "Ajoute un bouton d'action principal élégant", icon: "🔘" },
  { label: "Carte", prompt: "Ajoute une carte moderne en glassmorphism", icon: "🗂️" },
  { label: "Formulaire", prompt: "Ajoute un formulaire complet avec validation", icon: "📝" },
  { label: "Images", prompt: "Ajoute une galerie d'images responsive", icon: "🖼️" },
  { label: "Audio", prompt: "Ajoute un lecteur audio personnalisé", icon: "🎵" },
  { label: "Vidéo", prompt: "Ajoute un lecteur vidéo intégré", icon: "🎬" },
  { label: "QR Code", prompt: "Ajoute un générateur de QR Code en JavaScript pur", icon: "🔳" },
  { label: "Canvas", prompt: "Ajoute une zone de dessin canvas interactive", icon: "🎨" },
  { label: "Chat", prompt: "Ajoute une interface de chat avec historique", icon: "💬" },
  { label: "Tableaux", prompt: "Ajoute un tableau de données triable et filtrable", icon: "📊" },
  { label: "Calendrier", prompt: "Ajoute un calendrier mensuel interactif", icon: "📅" },
  { label: "Upload", prompt: "Ajoute une zone d'import de fichiers glisser-déposer", icon: "⬆️" },
  { label: "Graphiques", prompt: "Ajoute un graphique animé dessiné en canvas", icon: "📈" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

type Props = {
  project: AlexTool;
  onBack: () => void;
  onBuild: (p: { prompt: string; previousHtml: string; context: string }) => Promise<{ html: string | null; error: string | null }>;
  onSave: (p: { appHtml: string; changeNote: string }) => Promise<void>;
  onPublish: () => Promise<void>;
  onInstall: () => Promise<void>;
  onGoMarketplace: () => void;
};

export default function StudioEditor({ project, onBack, onBuild, onSave, onPublish, onInstall, onGoMarketplace }: Props) {
  const [rail, setRail] = useState<Rail>("explorer");
  const [railOpen, setRailOpen] = useState(true);
  const [html, setHtml] = useState(project.appHtml);
  const [messages, setMessages] = useState<StudioMsg[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: uid(), kind: "info", text: `Projet « ${project.name} » ouvert · v${project.version}`, at: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showCode, setShowCode] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  const log = (kind: LogEntry["kind"], text: string) =>
    setLogs((l) => [...l.slice(-120), { id: uid(), kind, text, at: Date.now() }]);

  const toast = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash(null), 2200);
  };

  const send = async (raw?: string) => {
    const prompt = (raw ?? input).trim();
    if (!prompt || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: uid(), role: "user", content: prompt, at: Date.now() }]);
    setBusy(true);
    log("gen", `Génération en cours : ${prompt.slice(0, 90)}`);
    try {
      const res = await onBuild({
        prompt,
        previousHtml: html,
        context: `${project.name} — ${project.description} (catégorie : ${categoryLabel(project.category)})`,
      });
      if (res.html) {
        setHtml(res.html);
        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", content: "C'est fait ✅ — l'aperçu est à jour. Dis-moi la prochaine amélioration.", at: Date.now() },
        ]);
        log("info", `Application mise à jour (${res.html.length.toLocaleString("fr-FR")} caractères)`);
        await onSave({ appHtml: res.html, changeNote: prompt.slice(0, 180) });
      } else {
        const err = res.error ?? "Génération impossible.";
        setMessages((m) => [...m, { id: uid(), role: "assistant", content: err, at: Date.now() }]);
        log("error", err);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur pendant la génération.";
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: msg, at: Date.now() }]);
      log("error", msg);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([html || "<!DOCTYPE html><html><body>Projet vide</body></html>"], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\W+/g, "-").toLowerCase() || "projet"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    log("info", "Projet exporté en HTML");
  };

  const tree = useMemo(
    () => [
      { group: "Pages", items: ["index.html"], icon: FileCode },
      { group: "Components", items: COMPONENTS.slice(0, 4).map((c) => `${c.label}.block`), icon: Boxes },
      { group: "Styles", items: ["theme.css"], icon: Palette },
      { group: "Assets", items: project.screenshots.length ? project.screenshots.map((_, i) => `capture-${i + 1}.png`) : ["(vide)"], icon: ImageIcon },
      { group: "API", items: ["alex-ia.endpoint"], icon: Plug },
      { group: "Base de données", items: ["localStorage"], icon: Database },
      { group: "Images", items: ["(aucune)"], icon: ImageIcon },
    ],
    [project.screenshots],
  );

  const panelBox = "rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#070a14] text-slate-100">
      {/* ---------- barre supérieure ---------- */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-xl">
        <button type="button" onClick={onBack} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10" aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-base">{project.emoji}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">{project.name}</p>
          <p className="truncate text-[11px] text-slate-500">
            v{project.version} · {categoryLabel(project.category)} · {project.isPublic ? "publié" : "brouillon"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => void onInstall().then(() => toast("Installé dans Alex IA"))} className="hidden items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25 sm:inline-flex">
            <Rocket className="h-3.5 w-3.5" /> Installer dans Alex IA
          </button>
          <button type="button" onClick={() => void onPublish().then(() => toast("Publié sur Alex Marketplace"))} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/25">
            <Globe className="h-3.5 w-3.5" /> Publier
          </button>
          <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10">
            <Download className="h-3.5 w-3.5" /> Télécharger
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- rail + panneau ---------- */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-white/[0.02] py-3">
          {RAIL.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setRail(r.id); setRailOpen(rail === r.id ? !railOpen : true); }}
              title={r.label}
              className={`grid h-9 w-9 place-items-center rounded-xl transition ${rail === r.id && railOpen ? "bg-violet-500/20 text-violet-200" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}
            >
              <r.icon className="h-4 w-4" />
            </button>
          ))}
        </nav>

        {railOpen && (
          <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-white/[0.015] p-3 lg:flex">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {RAIL.find((r) => r.id === rail)?.label}
            </p>

            {rail === "explorer" && (
              <div className="space-y-3">
                {tree.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><g.icon className="h-3.5 w-3.5" /> {g.group}</p>
                    {g.items.map((it) => (
                      <p key={it} className="truncate rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-200">{it}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {rail === "components" && (
              <div className="grid grid-cols-2 gap-2">
                {COMPONENTS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => void send(c.prompt)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5 text-center text-[11px] text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10"
                  >
                    <span className="block text-base">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {rail === "assets" && (
              <div className={panelBox}>
                <p className="text-xs text-slate-400">Les images et médias générés apparaissent ici. Demande par exemple « ajoute une illustration d'en-tête ».</p>
              </div>
            )}

            {rail === "api" && (
              <div className={`${panelBox} space-y-2`}>
                <p className="text-xs text-slate-400">Modèle IA du projet</p>
                <p className="rounded-lg bg-white/5 px-2 py-1.5 text-xs text-slate-200">
                  {ALEX_MODELS.find((m) => m.id === project.model)?.label ?? project.model}
                </p>
                <p className="text-[11px] text-slate-500">Les appels IA de ton outil passent par Alex IA — aucune clé requise.</p>
              </div>
            )}

            {rail === "database" && (
              <div className={panelBox}>
                <p className="text-xs text-slate-400">Ton application enregistre ses données localement (localStorage). Demande « ajoute une base de données » pour structurer le stockage.</p>
              </div>
            )}

            {rail === "marketplace" && (
              <div className={`${panelBox} space-y-2`}>
                <p className="text-xs text-slate-400">Publie ton projet pour toute la communauté.</p>
                <button type="button" onClick={onGoMarketplace} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white">Ouvrir la Marketplace</button>
              </div>
            )}

            {rail === "history" && (
              <div className="space-y-1.5">
                {project.changelog.length === 0 && <p className="text-xs text-slate-500">Aucune version enregistrée.</p>}
                {project.changelog.map((c) => (
                  <div key={`${c.version}-${c.date}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                    <p className="text-[11px] font-semibold text-violet-200">v{c.version}</p>
                    <p className="text-[11px] text-slate-400">{c.note}</p>
                  </div>
                ))}
              </div>
            )}

            {rail === "settings" && (
              <div className={`${panelBox} space-y-2 text-xs text-slate-400`}>
                <p><span className="text-slate-200">Nom :</span> {project.name}</p>
                <p><span className="text-slate-200">Catégorie :</span> {categoryLabel(project.category)}</p>
                <p><span className="text-slate-200">Statut :</span> {project.isPublic ? "publié" : "brouillon"}</p>
                <p><span className="text-slate-200">Installations :</span> {project.installs}</p>
                <p className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-300" /> {project.favorite ? "Favori" : "Non favori"}</p>
              </div>
            )}
          </aside>
        )}

        {/* ---------- chat central ---------- */}
        <section className="flex min-w-0 flex-1 flex-col border-r border-white/10">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="mx-auto max-w-lg py-10 text-center">
                <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600"><Sparkles className="h-6 w-6 text-white" /></span>
                <h2 className="text-lg font-semibold text-white">Décris ton idée, l'IA construit l'outil</h2>
                <p className="mt-1 text-sm text-slate-400">Puis continue la conversation pour l'améliorer.</p>
                <div className="mt-5 grid gap-2 text-left">
                  {[
                    "Crée un générateur de QR Code",
                    "Crée une application météo",
                    "Crée un assistant YouTube",
                    "Crée un logiciel de facturation",
                  ].map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                    <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground" : "text-sm leading-relaxed text-slate-200"}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Construction en cours…</p>}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); void send(); }}
            className="shrink-0 border-t border-white/10 bg-white/[0.02] p-3"
          >
            <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-white/10 bg-[#0d1122]/80 p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                rows={2}
                placeholder="Ajoute un mode sombre, améliore le design, corrige les erreurs…"
                className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white transition hover:brightness-110 disabled:opacity-50" aria-label="Envoyer">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </section>

        {/* ---------- aperçu live ---------- */}
        <section className="hidden w-[40%] min-w-[320px] shrink-0 flex-col md:flex">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-xs font-medium text-slate-300">Aperçu live</p>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => setShowCode((v) => !v)} className={`grid h-7 w-7 place-items-center rounded-lg transition ${showCode ? "bg-violet-500/20 text-violet-200" : "text-slate-400 hover:bg-white/5"}`} aria-label="Code"><Code2 className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setDevice("desktop")} className={`grid h-7 w-7 place-items-center rounded-lg transition ${device === "desktop" ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`} aria-label="Bureau"><Monitor className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setDevice("mobile")} className={`grid h-7 w-7 place-items-center rounded-lg transition ${device === "mobile" ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`} aria-label="Mobile"><Smartphone className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setHtml((h) => h)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5" aria-label="Rafraîchir"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-[#04060d] p-3">
            {showCode ? (
              <pre className="h-full w-full overflow-auto rounded-xl border border-white/10 bg-black/50 p-3 text-[11px] leading-relaxed text-emerald-200">{html || "// aucune application générée"}</pre>
            ) : html ? (
              <iframe
                title="Aperçu"
                srcDoc={html}
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                className={`h-full rounded-xl border border-white/10 bg-white shadow-2xl transition-all ${device === "mobile" ? "w-[390px] max-w-full" : "w-full"}`}
              />
            ) : (
              <p className="max-w-[220px] text-center text-xs text-slate-500">L'aperçu s'affiche ici dès que l'IA a construit ton application.</p>
            )}
          </div>
        </section>
      </div>

      {/* ---------- console ---------- */}
      <div className="shrink-0 border-t border-white/10 bg-[#05070f]">
        <button type="button" onClick={() => setConsoleOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200">
          <Terminal className="h-3.5 w-3.5" /> Console
          <span className="rounded-full bg-white/5 px-1.5">{logs.length}</span>
          {busy && <span className="inline-flex items-center gap-1 text-violet-300"><Loader2 className="h-3 w-3 animate-spin" /> génération en cours</span>}
          <ChevronDown className={`ml-auto h-3.5 w-3.5 transition ${consoleOpen ? "" : "-rotate-90"}`} />
        </button>
        {consoleOpen && (
          <div className="max-h-32 overflow-y-auto px-3 pb-2 font-mono text-[11px] leading-relaxed">
            {logs.map((l) => (
              <p key={l.id} className={l.kind === "error" ? "text-red-300" : l.kind === "gen" ? "text-violet-300" : "text-slate-500"}>
                <span className="text-slate-600">{new Date(l.at).toLocaleTimeString("fr-FR")} </span>
                {l.text}
              </p>
            ))}
          </div>
        )}
      </div>

      {flash && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs text-emerald-100 backdrop-blur-xl">
          <Check className="mr-1 inline h-3.5 w-3.5" /> {flash}
        </div>
      )}
    </div>
  );
}

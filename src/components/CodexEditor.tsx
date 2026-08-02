// Éditeur Codex — studio d'édition de jeu 2D (design "workspace" sombre).
// Colonnes : rail d'icônes · Assistant IA · Éditeur/Console · Aperçu + Propriétés
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, Download, Loader2, Maximize2, Mic, Monitor, Paperclip, Play, RefreshCw, Save, Send,
  Settings, Smartphone, Tablet, Trash2, Wand2, Code2, Eye, MessageSquare, Terminal, FileCode2, Plus,
} from "lucide-react";
import type { CodexProject, CodexHistoryItem } from "@/lib/codex-store.functions";

type Props = {
  project: CodexProject;
  onBack: () => void;
  onGenerate: (prompt: string, previousHtml?: string) => Promise<{ html: string | null; error: string | null }>;
  onSave: (p: CodexProject) => Promise<CodexProject>;
  onDelete: (id: string) => Promise<void>;
  onDescribeFile?: (file: File) => Promise<string>;
};

type Tab = "preview" | "chat" | "code";
type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

export default function CodexEditor({ project, onBack, onGenerate, onSave, onDelete, onDescribeFile }: Props) {
  const [name, setName] = useState(project.name);
  const [html, setHtml] = useState(project.html);
  const [history, setHistory] = useState<CodexHistoryItem[]>(project.history ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [tab, setTab] = useState<Tab>("preview");
  const [centerTab, setCenterTab] = useState<"code" | "console">("code");
  const [device, setDevice] = useState<Device>("desktop");
  const [showChat, setShowChat] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [attaching, setAttaching] = useState(false);
  const [listening, setListening] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Éditeur Codex prêt."]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  function log(msg: string) {
    const t = new Date().toLocaleTimeString("fr-FR");
    setLogs((l) => [...l.slice(-99), `[${t}] ${msg}`]);
  }

  // Autosave debounce
  const dirty = useMemo(
    () => name !== project.name || html !== project.html || history.length !== (project.history?.length ?? 0),
    [name, html, history, project],
  );

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(t);

  }, [name, html, history]);

  async function doSave() {
    try {
      setSaving(true);
      await onSave({ ...project, name, html, history });
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function submitIteration(e: FormEvent) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy) return;
    setError(null);
    setBusy(true);
    const userMsg: CodexHistoryItem = { role: "user", content: prompt, at: Date.now() };
    setHistory((h) => [...h, userMsg]);
    setInput("");
    log("Génération en cours…");
    try {
      const res = await onGenerate(prompt, html);
      if (res.error || !res.html) {
        setError(res.error ?? "Échec.");
        setHistory((h) => [...h, { role: "assistant", content: `❌ ${res.error ?? "Échec."}`, at: Date.now() }]);
        log(`Erreur : ${res.error ?? "échec"}`);
      } else {
        setHtml(res.html);
        setHistory((h) => [...h, { role: "assistant", content: "✅ Jeu mis à jour.", at: Date.now() }]);
        setIframeKey((k) => k + 1);
        log("Jeu mis à jour et relancé.");
      }
    } catch (err) {
      setError((err as Error).message);
      log(`Erreur : ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "jeu"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function fullscreen() {
    const el = iframeRef.current;
    if (!el) return;
    void el.requestFullscreen?.();
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${name}" définitivement ?`)) return;
    await onDelete(project.id);
    onBack();
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!onDescribeFile) {
      setError("Analyse de fichier indisponible.");
      return;
    }
    try {
      setAttaching(true);
      setError(null);
      const desc = await onDescribeFile(file);
      const label = file.type.startsWith("video") ? "Vidéo" : "Image";
      setInput((prev) => `${prev ? prev + "\n\n" : ""}[${label} jointe — ${file.name}]\nInspire-toi de ceci : ${desc}`.slice(0, 4000));
    } catch (err) {
      setError((err as Error).message || "Impossible d'analyser le fichier.");
    } finally {
      setAttaching(false);
    }
  }

  function toggleMic() {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("La saisie vocale n'est pas prise en charge par ce navigateur.");
      return;
    }
    // Session déjà active : on l'arrête proprement (pas de double-start).
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      return;
    }

    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input + " " : "";
    let final = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      final = "";
      for (let i = 0; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t;
        else interim += t;
      }
      setInput((base + (final || interim)).slice(0, 4000));
    };
    rec.onerror = (ev: any) => {
      const err = ev?.error;
      if (err && err !== "no-speech" && err !== "aborted") {
        setError("Micro indisponible : " + err);
      }
      recognitionRef.current = null;
      setListening(false);
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (final) setInput((base + final).slice(0, 4000));
    };

    recognitionRef.current = rec;
    setListening(true);
    setError(null);
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }

  // Nettoyage : coupe le micro si l'éditeur se démonte.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const rail: { id: Tab | "settings"; label: string; icon: typeof Eye }[] = [
    { id: "chat", label: "Chat IA", icon: MessageSquare },
    { id: "code", label: "Éditeur", icon: FileCode2 },
    { id: "preview", label: "Prévisualisation", icon: Eye },
    { id: "settings", label: "Paramètres", icon: Settings },
  ];

  return (
    <div className="relative flex min-h-screen flex-col text-slate-100" style={{ background: "var(--ag-bg, #080b16)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/[0.06] bg-[#0a0e1c]/90 px-2 py-2 backdrop-blur-xl sm:px-4">
        <button onClick={onBack} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full truncate rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-white outline-none focus:border-white/10 focus:bg-white/5 sm:text-base"
            placeholder="Nom du jeu"
          />
          <p className="flex items-center gap-1.5 px-1.5 text-[11px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-amber-400" : dirty ? "bg-slate-500" : "bg-emerald-400"}`} />
            {saving ? "Sauvegarde…" : savedFlag ? "Projet sauvegardé" : dirty ? "Modifications non enregistrées" : "Projet sauvegardé"}
          </p>
        </div>

        {/* Centre : lancer + device */}
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => {
              setIframeKey((k) => k + 1);
              log("Jeu lancé.");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110"
          >
            <Play className="h-3.5 w-3.5" /> Lancer
          </button>
          <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                aria-label={d}
                className={`rounded-md p-1.5 transition ${device === d ? "bg-violet-500/25 text-violet-200" : "text-slate-500 hover:text-slate-200"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => void doSave()} className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white sm:inline-flex" title="Sauvegarder">
            <Save className="h-4 w-4" />
          </button>
          <button onClick={download} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" title="Télécharger">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={fullscreen} className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white sm:inline-flex" title="Plein écran">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={handleDelete} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300" title="Supprimer">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="flex border-b border-white/5 md:hidden">
        {(["preview", "chat", "code"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${tab === t ? "border-b-2 border-violet-400 text-white" : "text-slate-400"}`}
          >
            {t === "preview" ? <Eye className="h-3.5 w-3.5" /> : t === "chat" ? <MessageSquare className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
            {t === "preview" ? "Aperçu" : t === "chat" ? "Chat" : "Code"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-2 p-2 md:overflow-hidden">
        {/* Rail d'icônes */}
        <nav className="hidden w-14 shrink-0 flex-col items-center gap-1 rounded-2xl border border-white/[0.06] bg-[#0d1226]/70 py-3 md:flex">
          {rail.map(({ id, label, icon: Icon }) => {
            const active = id === "chat" ? showChat : id === "code" ? centerTab === "code" : id === "preview";
            return (
              <button
                key={id}
                title={label}
                onClick={() => {
                  if (id === "chat") setShowChat((s) => !s);
                  else if (id === "code") setCenterTab("code");
                  else if (id === "preview") setIframeKey((k) => k + 1);
                  else setCenterTab("console");
                }}
                className={`flex w-11 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-medium transition ${active ? "bg-violet-500/15 text-violet-200" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{label.split(" ")[0]}</span>
              </button>
            );
          })}
        </nav>

        {/* Chat panel */}
        <aside
          className={`w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d1226]/70 md:w-72 lg:w-80 ${tab === "chat" ? "flex" : "hidden"} ${showChat ? "md:flex" : "md:hidden"}`}
        >
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <Wand2 className="h-4 w-4 text-violet-400" /> Assistant IA
            </p>
            <button
              onClick={() => {
                setHistory([]);
                log("Nouveau chat.");
              }}
              title="Nouveau chat"
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-slate-400 transition hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {history.length === 0 && (
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                Bonjour ! Décrivez ce que vous voulez créer ou améliorer dans votre jeu : « ajoute un boss », « rends le fond violet », « plus rapide »…
              </p>
            )}
            {history.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "ml-6 bg-gradient-to-br from-violet-500/90 to-indigo-600/90 text-white" : "mr-4 border border-white/[0.06] bg-white/[0.04] text-slate-200"}`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-4 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Codex retravaille…
              </div>
            )}
          </div>
          <form onSubmit={submitIteration} className="border-t border-white/5 p-2.5">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFilePick} className="hidden" />
            <div className="flex items-end gap-1.5 rounded-2xl border border-white/[0.08] bg-[#11162a]/80 p-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attaching || !onDescribeFile}
                title="Joindre une image ou vidéo"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                title="Dicter vocalement"
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${listening ? "bg-pink-500/20 text-pink-200 animate-pulse" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <Mic className="h-4 w-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitIteration(e as unknown as FormEvent);
                  }
                }}
                rows={2}
                placeholder="Décris ce que tu veux faire…"
                className="min-h-[40px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </form>
        </aside>

        {/* Éditeur / Console */}
        <section
          className={`min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0e1c]/80 ${tab === "code" ? "flex" : "hidden md:flex"}`}
        >
          <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 pt-1.5">
            {(["code", "console"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCenterTab(t)}
                className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition ${centerTab === t ? "border-b-2 border-violet-400 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                {t === "code" ? <Code2 className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
                {t === "code" ? "Éditeur" : "Console"}
              </button>
            ))}
            <div className="ml-auto pb-1.5">
              <button
                onClick={() => {
                  setIframeKey((k) => k + 1);
                  log("Code appliqué.");
                }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
              >
                Appliquer
              </button>
            </div>
          </div>

          {centerTab === "code" ? (
            <>
              <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-200">
                  <FileCode2 className="h-3 w-3" /> index.html
                </span>
                <span className="text-[11px] text-slate-600">{html.split("\n").length} lignes</span>
              </div>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                className="min-h-[40vh] flex-1 resize-none bg-transparent p-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none md:min-h-0"
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2">
                <p className="text-[11px] text-slate-500">Journal du projet</p>
                <button onClick={() => setLogs([])} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10">
                  Vider
                </button>
              </div>
              <div className="min-h-[30vh] flex-1 space-y-1 overflow-y-auto p-3 font-mono text-[11px] text-slate-400">
                {logs.length === 0 ? <p className="text-slate-600">Console vide.</p> : logs.map((l, i) => <p key={i}>{l}</p>)}
              </div>
              <p className="flex items-center gap-1.5 border-t border-white/[0.04] px-3 py-2 text-[11px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Aucun problème détecté
              </p>
            </div>
          )}
        </section>

        {/* Aperçu + Propriétés */}
        <section className={`w-full flex-col gap-2 md:flex md:w-[22rem] lg:w-[26rem] ${tab === "preview" ? "flex" : "hidden md:flex"}`}>
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d1226]/70">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <p className="text-xs font-semibold text-white">Aperçu du jeu</p>
              <button
                onClick={() => setIframeKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 transition hover:bg-white/10"
              >
                <RefreshCw className="h-3 w-3" /> Rejouer
              </button>
            </div>
            <div className="flex flex-1 items-start justify-center overflow-auto bg-black/40 p-2">
              {html ? (
                <iframe
                  key={iframeKey}
                  ref={iframeRef}
                  title={name}
                  srcDoc={html}
                  sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                  style={{ width: DEVICE_WIDTH[device] }}
                  className="h-[45vh] max-w-full rounded-xl border-0 bg-black md:h-full md:min-h-[18rem]"
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-slate-500">
                  <Play className="h-8 w-8 opacity-60" />
                  <p className="text-sm">Aucun jeu chargé.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#0d1226]/70 p-3">
            <p className="mb-2 text-xs font-semibold text-white">Propriétés</p>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="text-slate-500">Nom</span>
                <span className="truncate text-slate-200">{name || "Sans titre"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="text-slate-500">Aperçu</span>
                <span className="text-slate-200">{device === "desktop" ? "Bureau" : device === "tablet" ? "Tablette" : "Mobile"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="text-slate-500">Itérations</span>
                <span className="text-slate-200">{history.filter((h) => h.role === "user").length}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

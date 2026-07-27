// Éditeur Codex — écran d'édition d'un jeu 2D façon Lovable.
// - Aperçu live (iframe rejouable)
// - Chat d'itération (chaque message régénère le jeu à partir du HTML courant)
// - Éditeur de code HTML manuel
// - Actions : télécharger, rejouer, plein écran, renommer, sauvegarder, supprimer, retour
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, Download, Loader2, Maximize2, Mic, Paperclip, Play, RefreshCw, Save, Send, Trash2, Wand2, Code2, Eye, MessageSquare,
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
  const [iframeKey, setIframeKey] = useState(0);
  const [attaching, setAttaching] = useState(false);
  const [listening, setListening] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

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
    try {
      const res = await onGenerate(prompt, html);
      if (res.error || !res.html) {
        setError(res.error ?? "Échec.");
        setHistory((h) => [...h, { role: "assistant", content: `❌ ${res.error ?? "Échec."}`, at: Date.now() }]);
      } else {
        setHtml(res.html);
        setHistory((h) => [...h, { role: "assistant", content: "✅ Jeu mis à jour.", at: Date.now() }]);
        setIframeKey((k) => k + 1);
      }
    } catch (err) {
      setError((err as Error).message);
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
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let final = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t;
        else interim += t;
      }
      setInput((prev) => (prev ? prev + " " : "") + (final || interim));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    setError(null);
    rec.start();
  }

  return (
    <div className="relative flex min-h-screen flex-col text-slate-100" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-[#0b0f1c]/85 px-3 py-2 backdrop-blur-xl sm:px-4">
        <button onClick={onBack} className="rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white" aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-white outline-none focus:border-white/10 focus:bg-white/5 sm:text-base"
          placeholder="Nom du jeu"
        />
        <span className="hidden text-xs text-slate-500 sm:inline">
          {saving ? "Sauvegarde…" : savedFlag ? "Sauvegardé" : dirty ? "Non sauvegardé" : ""}
        </span>
        <button onClick={() => void doSave()} className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 sm:inline-flex" title="Sauvegarder">
          <Save className="h-3.5 w-3.5" /> Sauver
        </button>
        <button onClick={download} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10" title="Télécharger">
          <Download className="h-4 w-4" />
        </button>
        <button onClick={fullscreen} className="hidden rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10 sm:inline-flex" title="Plein écran">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button onClick={handleDelete} className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20" title="Supprimer">
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* Mobile tabs */}
      <div className="flex border-b border-white/5 md:hidden">
        {(["preview", "chat", "code"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${tab === t ? "border-b-2 border-lime-400 text-white" : "text-slate-400"}`}
          >
            {t === "preview" ? <Eye className="h-3.5 w-3.5" /> : t === "chat" ? <MessageSquare className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
            {t === "preview" ? "Aperçu" : t === "chat" ? "Chat" : "Code"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
        {/* Chat panel */}
        <aside className={`flex w-full flex-col border-b border-white/10 bg-[#0e132a]/60 md:w-80 md:border-b-0 md:border-r ${tab === "chat" ? "flex" : "hidden md:flex"}`}>
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <Wand2 className="h-4 w-4 text-lime-400" />
            <p className="text-sm font-semibold">Itérer avec Codex</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 && (
              <p className="rounded-lg bg-white/5 p-3 text-xs text-slate-400">
                Demande une modification : « ajoute un boss », « rends le fond violet », « plus rapide », etc.
              </p>
            )}
            {history.map((m, i) => (
              <div key={i} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-6 bg-lime-500/15 text-lime-100" : "mr-6 bg-white/5 text-slate-200"}`}>
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-6 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Codex retravaille…
              </div>
            )}
          </div>
          <form onSubmit={submitIteration} className="border-t border-white/5 p-3">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFilePick} className="hidden" />
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#11162a]/80 p-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attaching || !onDescribeFile}
                title="Joindre une image ou vidéo"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
              >
                {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                title="Dicter vocalement"
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${listening ? "border-pink-400/40 bg-pink-500/20 text-pink-200 animate-pulse" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
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
                placeholder="Que veux-tu changer ?"
                className="min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1 text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-lime-500 to-emerald-600 text-white disabled:opacity-40"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </form>
        </aside>

        {/* Preview */}
        <section className={`relative flex-1 bg-black/40 ${tab === "preview" ? "flex" : "hidden md:flex"} flex-col`}>
          <div className="flex items-center justify-between border-b border-white/5 bg-black/30 px-3 py-2">
            <p className="text-xs text-slate-400">Aperçu du jeu — clique pour jouer</p>
            <button onClick={() => setIframeKey((k) => k + 1)} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">
              <RefreshCw className="h-3 w-3" /> Rejouer
            </button>
          </div>
          {html ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title={name}
              srcDoc={html}
              sandbox="allow-scripts allow-pointer-lock allow-same-origin"
              className="h-[60vh] w-full flex-1 border-0 bg-black md:h-auto"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-10 text-slate-500">
              <div className="flex flex-col items-center gap-2 text-center">
                <Play className="h-8 w-8 opacity-60" />
                <p className="text-sm">Aucun jeu chargé.</p>
              </div>
            </div>
          )}
        </section>

        {/* Code editor */}
        <section className={`w-full flex-col border-l border-white/10 bg-[#0a0e1c] md:flex md:w-96 ${tab === "code" ? "flex" : "hidden md:flex"}`}>
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Code2 className="h-3.5 w-3.5" /> Code HTML
            </p>
            <button onClick={() => setIframeKey((k) => k + 1)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">
              Appliquer
            </button>
          </div>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            className="min-h-[40vh] flex-1 resize-none bg-transparent p-3 font-mono text-[11px] leading-relaxed text-slate-200 outline-none md:min-h-0"
          />
        </section>
      </div>
    </div>
  );
}

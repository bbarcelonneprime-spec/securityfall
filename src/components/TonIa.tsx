// TON IA — hub universel d'IA : barre latérale, chat plein écran, panneaux
// (modèles, clés API, images, code, documents, canvas, projets) et panneau
// de configuration de l'assistant. Style application de bureau moderne.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Home, MessageSquare, Star, FolderOpen, Image as ImageIcon, FileText, Palette, Code2,
  KeyRound, Bot, Settings2, Plus, Upload, Send, Paperclip, Camera, Mic, Globe, Brain,
  Copy, Pencil, RefreshCw, ArrowRight, Share2, Download, X, Sliders, Eye, Wrench,
  Cpu, Loader2, Store, Check, Trash2,
} from "lucide-react";
import {
  buildPrompt, extractCode, uid, DEFAULT_AGENT, EMOJIS, TONES, MODEL_LIBRARY,
  type ToniaAgent, type ToniaThread, type ToniaMsg, type ProviderId,
} from "./tonia/types";
import {
  ApiKeysPanel, ModelsPanel, ImagesPanel, CodeWorkspace, DocsPanel, CanvasPanel, ProjectsPanel,
  type ApiKeyRecord,
} from "./tonia/panels";
import type { ToolMsg } from "./ToolChat";

type View =
  | "chat" | "favorites" | "projects" | "images" | "documents" | "canvas"
  | "code" | "keys" | "agents" | "settings" | "models";

type Props = {
  onHome: () => void;
  onRun: (p: { systemPrompt: string; messages: ToolMsg[] }) => Promise<string>;
  onPublish?: (p: { name: string; emoji: string; description: string; systemPrompt: string; starter: string }) => Promise<void>;
  onGenerateImage?: (prompt: string) => Promise<{ id: string; prompt: string; url: string }>;
};

const LS = {
  threads: "tonia_threads_v2",
  agents: "tonia_agents_v2",
  keys: "tonia_keys_v2",
  canvas: "tonia_canvas_v2",
  projects: "tonia_projects_v2",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const NAV: Array<{ id: View; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Conversations", icon: MessageSquare },
  { id: "favorites", label: "Favoris", icon: Star },
  { id: "projects", label: "Projets", icon: FolderOpen },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "canvas", label: "Canvas", icon: Palette },
  { id: "code", label: "Code", icon: Code2 },
  { id: "keys", label: "Mes API", icon: KeyRound },
  { id: "agents", label: "Mes IA", icon: Bot },
  { id: "settings", label: "Paramètres", icon: Settings2 },
];

export default function TonIa({ onHome, onRun, onPublish, onGenerateImage }: Props) {
  /* ---------- état persistant ---------- */
  const [agents, setAgents] = useState<ToniaAgent[]>([DEFAULT_AGENT]);
  const [agentId, setAgentId] = useState("default");
  const [threads, setThreads] = useState<ToniaThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [canvas, setCanvas] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [files, setFiles] = useState<Array<{ id: string; name: string; size: number }>>([]);
  const [images, setImages] = useState<Array<{ id: string; prompt: string; url: string }>>([]);

  /* ---------- UI ---------- */
  const [view, setView] = useState<View>("chat");
  const [configOpen, setConfigOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [genImg, setGenImg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [web, setWeb] = useState(false);
  const [vision, setVision] = useState(true);
  const [tools, setTools] = useState(true);
  const [deep, setDeep] = useState(false);
  const [published, setPublished] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setAgents(load(LS.agents, [DEFAULT_AGENT]));
    setThreads(load<ToniaThread[]>(LS.threads, []));
    setKeys(load<ApiKeyRecord[]>(LS.keys, []));
    setCanvas(load(LS.canvas, ""));
    setProjects(load<Array<{ id: string; name: string; count: number }>>(LS.projects, []));
  }, []);

  useEffect(() => { save(LS.agents, agents); }, [agents]);
  useEffect(() => { save(LS.threads, threads); }, [threads]);
  useEffect(() => { save(LS.keys, keys); }, [keys]);
  useEffect(() => { save(LS.canvas, canvas); }, [canvas]);
  useEffect(() => { save(LS.projects, projects); }, [projects]);

  const agent = agents.find((a) => a.id === agentId) ?? agents[0] ?? DEFAULT_AGENT;
  const thread = threads.find((t) => t.id === threadId) ?? null;
  const messages = thread?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  useEffect(() => {
    if (view === "chat") taRef.current?.focus();
  }, [view, threadId]);

  const lastCode = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") {
        const c = extractCode(m.content);
        if (c) return c;
      }
    }
    return null;
  }, [messages]);

  /* ---------- actions ---------- */
  const setAgent = <K extends keyof ToniaAgent>(k: K, v: ToniaAgent[K]) =>
    setAgents((list) => list.map((a) => (a.id === agent.id ? { ...a, [k]: v } : a)));

  const newChat = () => {
    const t: ToniaThread = { id: uid(), title: "Nouvelle conversation", messages: [], favorite: false, updatedAt: Date.now(), agentId: agent.id };
    setThreads((p) => [t, ...p]);
    setThreadId(t.id);
    setView("chat");
    setSidebarOpen(false);
  };

  const patchThread = (id: string, fn: (t: ToniaThread) => ToniaThread) =>
    setThreads((p) => p.map((t) => (t.id === id ? { ...fn(t), updatedAt: Date.now() } : t)));

  const runTurn = async (history: ToniaMsg[], targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const content = await onRun({
        systemPrompt: buildPrompt(agent, { web, vision, tools, deep }),
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      patchThread(targetId, (t) => ({
        ...t,
        messages: [...history, { id: uid(), role: "assistant", content, createdAt: Date.now() }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'IA n'a pas pu répondre.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    let target = thread;
    if (!target) {
      target = { id: uid(), title: text.slice(0, 42), messages: [], favorite: false, updatedAt: Date.now(), agentId: agent.id };
      setThreads((p) => [target as ToniaThread, ...p]);
      setThreadId(target.id);
    }
    const history: ToniaMsg[] = [...target.messages, { id: uid(), role: "user", content: text, createdAt: Date.now() }];
    patchThread(target.id, (t) => ({ ...t, title: t.messages.length ? t.title : text.slice(0, 42), messages: history }));
    setInput("");
    await runTurn(history, target.id);
  };

  const regenerate = async (msgId: string) => {
    if (!thread) return;
    const idx = thread.messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    const history = thread.messages.slice(0, idx);
    patchThread(thread.id, (t) => ({ ...t, messages: history }));
    await runTurn(history, thread.id);
  };

  const continueMsg = async (msgId: string) => {
    if (!thread) return;
    const idx = thread.messages.findIndex((m) => m.id === msgId);
    const history: ToniaMsg[] = [
      ...thread.messages.slice(0, idx + 1),
      { id: uid(), role: "user", content: "Continue exactement où tu t'es arrêté.", createdAt: Date.now() },
    ];
    patchThread(thread.id, (t) => ({ ...t, messages: history }));
    await runTurn(history, thread.id);
  };

  const editMsg = (m: ToniaMsg) => {
    if (!thread) return;
    setInput(m.content);
    const idx = thread.messages.findIndex((x) => x.id === m.id);
    patchThread(thread.id, (t) => ({ ...t, messages: t.messages.slice(0, idx) }));
    taRef.current?.focus();
  };

  const copy = (m: ToniaMsg) => {
    void navigator.clipboard?.writeText(m.content);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 1400);
  };

  const share = async (m: ToniaMsg) => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: { text: string }) => Promise<void> }).share({ text: m.content });
        return;
      } catch { /* annulé */ }
    }
    copy(m);
  };

  const exportThread = () => {
    if (!thread) return;
    const md = thread.messages.map((m) => `## ${m.role === "user" ? "Moi" : agent.name}\n\n${m.content}`).join("\n\n");
    const blob = new Blob([`# ${thread.title}\n\n${md}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${thread.title.replace(/\W+/g, "-").toLowerCase() || "conversation"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const dictate = () => {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; start: () => void };
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("La dictée vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript ?? "";
      setInput((v) => (v ? `${v} ${t}` : t));
    };
    rec.start();
  };

  const attach = (list: FileList | null) => {
    if (!list) return;
    const added = Array.from(list).map((f) => ({ id: uid(), name: f.name, size: f.size }));
    setFiles((p) => [...added, ...p]);
    setInput((v) => `${v ? `${v}\n` : ""}[Fichiers joints : ${added.map((a) => a.name).join(", ")}]`);
  };

  const publish = async () => {
    if (!onPublish) return;
    await onPublish({
      name: agent.name,
      emoji: agent.emoji,
      description: agent.role,
      systemPrompt: buildPrompt(agent, { web, vision, tools, deep }),
      starter: `Salut ! Je suis ${agent.name}. Comment puis-je t'aider ?`,
    });
    setPublished(true);
    setTimeout(() => setPublished(false), 2200);
  };

  const generateImage = async (prompt: string) => {
    if (!onGenerateImage) {
      setError("La génération d'images n'est pas disponible ici.");
      return;
    }
    setGenImg(true);
    try {
      const img = await onGenerateImage(prompt);
      setImages((p) => [img, ...p]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Génération impossible.");
    } finally {
      setGenImg(false);
    }
  };

  /* ---------- styles utilitaires ---------- */
  const field =
    "w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40";
  const toggle = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition ${
      on ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200"
    }`;

  const chatThreads = threads.filter((t) => (view === "favorites" ? t.favorite : true));

  return (
    <div className="relative z-10 flex h-[100dvh] w-full overflow-hidden text-slate-100">
      {/* ================= BARRE LATÉRALE ================= */}
      <aside
        className={`absolute inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <button type="button" onClick={onHome} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" aria-label="Accueil">
            <Home className="h-4 w-4" />
          </button>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm">◆</span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-white">TON IA</p>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-400 lg:hidden" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>

        <nav className="space-y-0.5 px-2 py-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => { setView(n.id); setSidebarOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                view === n.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <n.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>

        {(view === "chat" || view === "favorites") && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 px-2 py-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Historique</p>
            {chatThreads.length === 0 && <p className="px-2 py-3 text-xs text-slate-600">Aucune conversation.</p>}
            {chatThreads.map((t) => (
              <div key={t.id} className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 ${threadId === t.id ? "bg-white/10" : "hover:bg-white/5"}`}>
                <button type="button" onClick={() => { setThreadId(t.id); setView("chat"); setSidebarOpen(false); }} className="min-w-0 flex-1 truncate text-left text-xs text-slate-300">
                  {t.title}
                </button>
                <button type="button" onClick={() => patchThread(t.id, (x) => ({ ...x, favorite: !x.favorite }))} className="rounded p-1 text-slate-500 hover:text-amber-300" aria-label="Favori">
                  <Star className={`h-3.5 w-3.5 ${t.favorite ? "fill-amber-300 text-amber-300" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => { setThreads((p) => p.filter((x) => x.id !== t.id)); if (threadId === t.id) setThreadId(null); }}
                  className="rounded p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-1.5 border-t border-white/10 p-3">
          <button type="button" onClick={newChat} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110">
            <Plus className="h-4 w-4" /> Nouveau chat
          </button>
          <button
            type="button"
            onClick={() => {
              const a: ToniaAgent = { ...DEFAULT_AGENT, id: uid(), name: "Nouvelle IA" };
              setAgents((p) => [...p, a]);
              setAgentId(a.id);
              setConfigOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <Bot className="h-4 w-4" /> Créer une IA
          </button>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            <Upload className="h-4 w-4" /> Importer une IA
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const parsed = JSON.parse(await f.text()) as Partial<ToniaAgent>;
                  const a: ToniaAgent = { ...DEFAULT_AGENT, ...parsed, id: uid() };
                  setAgents((p) => [...p, a]);
                  setAgentId(a.id);
                  setConfigOpen(true);
                } catch {
                  setError("Fichier d'IA invalide.");
                }
              }}
            />
          </label>
        </div>
      </aside>

      {/* ================= COLONNE PRINCIPALE ================= */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---- barre du haut ---- */}
        <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-xl">
          <button type="button" onClick={() => setSidebarOpen(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 lg:hidden" aria-label="Menu">
            <MessageSquare className="h-4 w-4" />
          </button>

          <label htmlFor="topModel" className="sr-only">Modèle</label>
          <select
            id="topModel"
            value={agent.model}
            onChange={(e) => setAgent("model", e.target.value)}
            className="max-w-[190px] rounded-xl border border-white/10 bg-[#0d1122]/80 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-violet-400/40"
          >
            {MODEL_LIBRARY.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#0d1122]">{m.providerLabel} · {m.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
            <Sliders className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="range" min={0} max={1} step={0.1} value={agent.temperature}
              onChange={(e) => setAgent("temperature", Number(e.target.value))}
              className="h-1 w-16 accent-violet-500"
              aria-label="Température"
            />
            <span className="w-6 text-[11px] tabular-nums text-slate-400">{agent.temperature.toFixed(1)}</span>
          </div>

          <button type="button" onClick={() => setWeb((v) => !v)} className={toggle(web)}><Globe className="h-3.5 w-3.5" /> Web</button>
          <button type="button" onClick={() => setVision((v) => !v)} className={toggle(vision)}><Eye className="h-3.5 w-3.5" /> Vision</button>
          <button type="button" onClick={() => setTools((v) => !v)} className={toggle(tools)}><Wrench className="h-3.5 w-3.5" /> Outils</button>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setConfigOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
              <Settings2 className="h-3.5 w-3.5" /> Configurer cette IA
            </button>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm" title={agent.name}>{agent.emoji}</span>
          </div>
        </header>

        {/* ---- contenu ---- */}
        <div key={view} className="min-h-0 flex-1 animate-[view-fade-in_.28s_ease-out] overflow-y-auto p-4 sm:p-6">
          {view === "chat" || view === "favorites" ? (
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
              <div className="flex-1 space-y-6 pb-4">
                {messages.length === 0 && (
                  <div className="grid place-items-center py-16 text-center">
                    <span className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 text-3xl">{agent.emoji}</span>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">{agent.name}</h1>
                    <p className="mt-1 max-w-md text-sm text-slate-400">{agent.role || "Ton hub universel d'IA : connecte tes modèles, discute, code et crée."}</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {["Explique-moi un concept", "Écris du code avec aperçu", "Résume un document", "Génère une image"].map((s) => (
                        <button key={s} type="button" onClick={() => setInput(s)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <article key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                    {m.role === "user" ? (
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                        {m.content}
                        <button type="button" onClick={() => editMsg(m)} className="mt-2 flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"><Pencil className="h-3 w-3" /> Modifier</button>
                      </div>
                    ) : (
                      <div className="group">
                        <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-400"><span>{agent.emoji}</span> {agent.name}</div>
                        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100">{m.content}</div>
                        <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition group-hover:opacity-100">
                          {[
                            { icon: copiedId === m.id ? Check : Copy, label: copiedId === m.id ? "Copié" : "Copier", fn: () => copy(m) },
                            { icon: Pencil, label: "Modifier", fn: () => editMsg(m) },
                            { icon: RefreshCw, label: "Régénérer", fn: () => void regenerate(m.id) },
                            { icon: ArrowRight, label: "Continuer", fn: () => void continueMsg(m.id) },
                            { icon: Share2, label: "Partager", fn: () => void share(m) },
                            { icon: Download, label: "Exporter", fn: exportThread },
                          ].map((a) => (
                            <button key={a.label} type="button" onClick={a.fn} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-400 hover:text-slate-100">
                              <a.icon className="h-3 w-3" /> {a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}

                {loading && (
                  <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> {agent.name} réfléchit…</p>
                )}
                {error && <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>}
                <div ref={endRef} />
              </div>

              {/* ---- zone d'écriture ---- */}
              <form onSubmit={submit} className="sticky bottom-0 rounded-3xl border border-white/10 bg-[#0d1122]/90 p-2.5 backdrop-blur-xl">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                  rows={2}
                  placeholder={`Écris à ${agent.name}…`}
                  className="max-h-52 min-h-[64px] w-full resize-none bg-transparent px-3 py-2 text-[15px] text-slate-100 placeholder-slate-500 outline-none"
                />
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => attach(e.target.files)} />
                  <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => attach(e.target.files)} />
                  <button type="button" onClick={() => fileRef.current?.click()} className={toggle(false)} title="Ajouter un fichier"><Paperclip className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => imgRef.current?.click()} className={toggle(false)} title="Ajouter une image"><Camera className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={dictate} className={toggle(false)} title="Dictée vocale"><Mic className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setWeb((v) => !v)} className={toggle(web)}><Globe className="h-3.5 w-3.5" /> Web</button>
                  <button type="button" onClick={() => setDeep((v) => !v)} className={toggle(deep)}><Brain className="h-3.5 w-3.5" /> Deep Think</button>
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="ml-auto grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white transition hover:brightness-110 disabled:opacity-50"
                    aria-label="Envoyer"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
            </div>
          ) : view === "models" ? (
            <ModelsPanel current={agent.model} onPick={(id) => { setAgent("model", id); setView("chat"); }} />
          ) : view === "keys" ? (
            <ApiKeysPanel
              keys={keys}
              onSave={(r) => setKeys((p) => [...p.filter((k) => k.provider !== r.provider), r])}
              onRemove={(p: ProviderId) => setKeys((k) => k.filter((x) => x.provider !== p))}
            />
          ) : view === "images" ? (
            <ImagesPanel images={images} onGenerate={generateImage} generating={genImg} />
          ) : view === "documents" ? (
            <DocsPanel files={files} />
          ) : view === "canvas" ? (
            <CanvasPanel value={canvas} onChange={setCanvas} />
          ) : view === "code" ? (
            <CodeWorkspace code={lastCode?.code ?? ""} lang={lastCode?.lang ?? "txt"} />
          ) : view === "projects" ? (
            <ProjectsPanel
              projects={projects}
              onCreate={(name) => setProjects((p) => [{ id: uid(), name, count: 0 }, ...p])}
              onOpen={() => setView("chat")}
            />
          ) : view === "agents" ? (
            <div className="mx-auto w-full max-w-3xl">
              <h2 className="mb-4 text-lg font-semibold text-white">Mes IA</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {agents.map((a) => (
                  <div key={a.id} className={`rounded-2xl border px-4 py-3 ${a.id === agent.id ? "border-violet-400/50 bg-violet-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                    <button type="button" onClick={() => { setAgentId(a.id); setView("chat"); }} className="flex w-full items-center gap-3 text-left">
                      <span className="text-xl">{a.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{a.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{a.role}</span>
                      </span>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => { setAgentId(a.id); setConfigOpen(true); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10">Configurer</button>
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(a, null, 2)], { type: "application/json" });
                          const link = document.createElement("a");
                          link.href = URL.createObjectURL(blob);
                          link.download = `${a.name.replace(/\W+/g, "-").toLowerCase()}.json`;
                          link.click();
                          URL.revokeObjectURL(link.href);
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                      >
                        Exporter
                      </button>
                      {agents.length > 1 && (
                        <button type="button" onClick={() => { setAgents((p) => p.filter((x) => x.id !== a.id)); if (agentId === a.id) setAgentId("default"); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-400 hover:text-red-300">Supprimer</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-2xl space-y-4">
              <h2 className="text-lg font-semibold text-white">Paramètres</h2>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <button type="button" onClick={() => setView("models")} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10">
                  <Cpu className="h-4 w-4" /> Bibliothèque de modèles
                </button>
                <button type="button" onClick={() => setView("keys")} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10">
                  <KeyRound className="h-4 w-4" /> Gérer mes clés API
                </button>
                <button type="button" onClick={() => { setThreads([]); setThreadId(null); }} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10">
                  <Trash2 className="h-4 w-4" /> Effacer tout l'historique
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= PANNEAU DE CONFIGURATION ================= */}
      {configOpen && (
        <>
          <button type="button" aria-label="Fermer" onClick={() => setConfigOpen(false)} className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-white/10 bg-[#0a0e1a]/95 backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <Settings2 className="h-4 w-4 text-violet-300" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">Configurer cette IA</p>
              <button type="button" onClick={() => setConfigOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label htmlFor="cfgName" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nom</label>
                <input id="cfgName" value={agent.name} onChange={(e) => setAgent("name", e.target.value)} maxLength={40} className={field} />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Avatar</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => setAgent("emoji", e)} className={`grid h-8 w-8 place-items-center rounded-xl border text-base transition ${agent.emoji === e ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}>{e}</button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="cfgRole" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rôle / mission</label>
                <input id="cfgRole" value={agent.role} onChange={(e) => setAgent("role", e.target.value)} maxLength={160} className={field} />
              </div>

              <div>
                <label htmlFor="cfgPrompt" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Prompt système (règles)</label>
                <textarea id="cfgPrompt" value={agent.rules} onChange={(e) => setAgent("rules", e.target.value)} rows={4} maxLength={2000} placeholder="Toujours répondre en 3 points, jamais de jargon…" className={`${field} resize-none`} />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ton</p>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button key={t} type="button" onClick={() => setAgent("tone", t)} className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${agent.tone === t ? "border-violet-400/60 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="cfgTemp" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Température · {agent.temperature.toFixed(1)}</label>
                <input id="cfgTemp" type="range" min={0} max={1} step={0.1} value={agent.temperature} onChange={(e) => setAgent("temperature", Number(e.target.value))} className="w-full accent-violet-500" />
              </div>

              <div>
                <label htmlFor="cfgModel" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Modèle</label>
                <select id="cfgModel" value={agent.model} onChange={(e) => setAgent("model", e.target.value)} className={field}>
                  {MODEL_LIBRARY.map((m) => <option key={m.id} value={m.id} className="bg-[#0d1122]">{m.providerLabel} · {m.label}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="cfgLang" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Langue</label>
                <select id="cfgLang" value={agent.language} onChange={(e) => setAgent("language", e.target.value)} className={field}>
                  {["Français", "Anglais", "Espagnol", "Allemand", "Italien", "Portugais", "Arabe"].map((l) => <option key={l} value={l} className="bg-[#0d1122]">{l}</option>)}
                </select>
              </div>

              <button type="button" onClick={() => setView("keys")} className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10">
                <KeyRound className="h-4 w-4" /> API du fournisseur
              </button>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAgent("memory", !agent.memory)} className={toggle(agent.memory)}><Brain className="h-3.5 w-3.5" /> Mémoire</button>
                <button type="button" onClick={() => setAgent("allowTools", !agent.allowTools)} className={toggle(agent.allowTools)}><Wrench className="h-3.5 w-3.5" /> Outils autorisés</button>
              </div>

              <div>
                <label htmlFor="cfgKnow" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fichiers de connaissances</label>
                <textarea id="cfgKnow" value={agent.knowledge} onChange={(e) => setAgent("knowledge", e.target.value)} rows={4} maxLength={4000} placeholder="Colle ici le contenu que ton IA doit connaître…" className={`${field} resize-none`} />
              </div>

              <div>
                <label htmlFor="cfgExp" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Expertise</label>
                <textarea id="cfgExp" value={agent.expertise} onChange={(e) => setAgent("expertise", e.target.value)} rows={2} maxLength={600} className={`${field} resize-none`} />
              </div>
            </div>

            {onPublish && (
              <div className="border-t border-white/10 p-3">
                <button type="button" onClick={() => void publish()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                  {published ? <><Check className="h-4 w-4" /> Publié dans Alex Studio</> : <><Store className="h-4 w-4" /> Publier dans Alex Studio</>}
                </button>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

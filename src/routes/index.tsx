import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  ShieldCheck, Mail, Loader2, AlertCircle, Download, MessageCircle, X, Send, Bot, User,
  Sparkles, Plus, Image as ImageIcon, Trash2, MessagesSquare, Search, LibraryBig, Mic, PanelLeft,
  Telescope, Paperclip, Code2, PenLine, Plane, ChefHat, GraduationCap, Gem,
} from "lucide-react";
import { analyzeEmail } from "../lib/analyze";
import { chatWithBot } from "../lib/chatbot.functions";
import { chatWithAlex, generateAlexImage, analyzeAlexFile } from "../lib/alex.functions";
import { extractFileText } from "../lib/extract-file";
import alexLogo from "@/assets/alex-logo.jpg";

type GemDef = { id: string; label: string; icon: typeof Code2; desc: string };
const ALEX_GEMS: GemDef[] = [
  { id: "general", label: "Généraliste", icon: Sparkles, desc: "Assistant polyvalent" },
  { id: "code", label: "Coach de code", icon: Code2, desc: "Aide à programmer" },
  { id: "writer", label: "Relecteur", icon: PenLine, desc: "Améliore tes textes" },
  { id: "travel", label: "Guide de voyage", icon: Plane, desc: "Itinéraires & conseils" },
  { id: "chef", label: "Chef cuisinier", icon: ChefHat, desc: "Recettes & menus" },
  { id: "tutor", label: "Tuteur", icon: GraduationCap, desc: "Explications pas à pas" },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Analyseur de sécurité e-mail" },
      {
        name: "description",
        content:
          "Diagnostic pédagogique de la sécurité de votre adresse e-mail et conseils de prévention par un expert IA.",
      },
    ],
  }),
});

function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: Array<React.ReactNode> = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-3 list-disc space-y-1 pl-6 text-slate-700">
          {listBuffer.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(l) }} />
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-sm">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{3}\s+/.test(line)) {
      flushList();
      out.push(<h3 key={out.length} className="mt-5 text-lg font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{3}\s+/, "")) }} />);
    } else if (/^#{2}\s+/.test(line)) {
      flushList();
      out.push(<h2 key={out.length} className="mt-6 text-xl font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{2}\s+/, "")) }} />);
    } else if (/^#\s+/.test(line)) {
      flushList();
      out.push(<h2 key={out.length} className="mt-6 text-xl font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#\s+/, "")) }} />);
    } else if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(<p key={out.length} className="my-2 leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  }
  flushList();
  return out;
}

type AlexMsg = { role: "user" | "assistant"; content: string; imageUrl?: string };
type AlexConversation = { id: string; title: string; messages: AlexMsg[]; createdAt: number };

const ALEX_STORAGE_KEY = "alex_ia_conversations_v1";

function loadAlexConversations(): AlexConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALEX_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AlexConversation[];
  } catch {
    return [];
  }
}

function saveAlexConversations(convs: AlexConversation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALEX_STORAGE_KEY, JSON.stringify(convs));
  } catch {
    /* ignore */
  }
}

function Index() {
  const analyze = useServerFn(analyzeEmail);
  const chatBotFn = useServerFn(chatWithBot);
  const alexFn = useServerFn(chatWithAlex);
  const alexImageFn = useServerFn(generateAlexImage);
  const alexFileFn = useServerFn(analyzeAlexFile);

  // View toggle
  const [view, setView] = useState<"email" | "alex">("email");

  // Email analyzer state
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cybersecurity chatbot state (existing floating)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Bonjour ! Je suis ton assistant cybersécurité. Pose-moi tes questions sur la sécurité des e-mails, les mots de passe, le phishing ou toute autre question numérique !" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Alex IA state
  const [alexConvs, setAlexConvs] = useState<AlexConversation[]>([]);
  const [alexCurrentId, setAlexCurrentId] = useState<string | null>(null);
  const [alexInput, setAlexInput] = useState("");
  const [alexLoading, setAlexLoading] = useState(false);
  const [alexImageMode, setAlexImageMode] = useState(false);
  const [alexDeepResearch, setAlexDeepResearch] = useState(false);
  const [alexPersona, setAlexPersona] = useState<string>("general");
  const [alexError, setAlexError] = useState<string | null>(null);
  const alexEndRef = useRef<HTMLDivElement>(null);
  const alexFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadAlexConversations();
    setAlexConvs(loaded);
    if (loaded.length > 0) setAlexCurrentId(loaded[0].id);
  }, []);

  useEffect(() => {
    saveAlexConversations(alexConvs);
  }, [alexConvs]);

  const currentConv = alexConvs.find((c) => c.id === alexCurrentId) ?? null;

  const newAlexConversation = () => {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const conv: AlexConversation = {
      id,
      title: "Nouvelle conversation",
      messages: [
        { role: "assistant", content: "Salut ! Je suis **Alex IA**, ton assistant IA généraliste. Je peux discuter de tout, t'aider à écrire, coder, réfléchir… et même générer des images. Comment puis-je t'aider ?" },
      ],
      createdAt: Date.now(),
    };
    setAlexConvs((prev) => [conv, ...prev]);
    setAlexCurrentId(id);
    setAlexError(null);
  };

  const deleteAlexConversation = (id: string) => {
    setAlexConvs((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (alexCurrentId === id) setAlexCurrentId(next[0]?.id ?? null);
      return next;
    });
  };

  const ensureCurrentConv = (): AlexConversation => {
    if (currentConv) return currentConv;
    const id = `conv-${Date.now()}`;
    const conv: AlexConversation = {
      id,
      title: "Nouvelle conversation",
      messages: [],
      createdAt: Date.now(),
    };
    setAlexConvs((prev) => [conv, ...prev]);
    setAlexCurrentId(id);
    return conv;
  };

  const updateConv = (id: string, updater: (c: AlexConversation) => AlexConversation) => {
    setAlexConvs((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const sendAlexMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!alexInput.trim() || alexLoading) return;
    const conv = ensureCurrentConv();
    const userMsg: AlexMsg = { role: "user", content: alexInput.trim() };
    const promptText = alexInput.trim();
    setAlexInput("");
    setAlexError(null);

    const newMessages = [...conv.messages, userMsg];
    updateConv(conv.id, (c) => ({
      ...c,
      messages: newMessages,
      title: c.messages.filter((m) => m.role === "user").length === 0 ? promptText.slice(0, 40) : c.title,
    }));
    setAlexLoading(true);

    try {
      if (alexImageMode) {
        const res = await alexImageFn({ data: { prompt: promptText } });
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: `Voici l'image générée pour : *${promptText}*`, imageUrl: res.imageUrl }],
        }));
      } else {
        const historyForApi = newMessages
          .filter((m) => !m.imageUrl)
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await alexFn({ data: { messages: historyForApi } });
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: res.content }],
        }));
      }
    } catch (err) {
      setAlexError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setAlexLoading(false);
    }
  };

  useEffect(() => {
    alexEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConv?.messages, alexLoading]);

  const sendChatMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await chatBotFn({ data: { messages: newMessages } });
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.content }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur : ${err instanceof Error ? err.message : "Problème de connexion."}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await analyze({ data: { email } });
      setResult(res.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const toggleView = () => {
    setView((v) => {
      const next = v === "email" ? "alex" : "email";
      if (next === "alex" && alexConvs.length === 0) {
        // create first conv lazily
        setTimeout(() => newAlexConversation(), 0);
      }
      return next;
    });
  };

  return (
    <>
      {/* Top-left toggle button */}
      <button
        type="button"
        onClick={toggleView}
        className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        aria-label="Basculer entre Analyseur et Alex IA"
      >
        <Sparkles className="h-4 w-4" />
        {view === "email" ? "Alex IA" : "Analyseur e-mail"}
      </button>

      {view === "email" ? (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
            <header className="mb-10 text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Analyseur de sécurité e-mail
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Obtiens un diagnostic pédagogique et 3 conseils concrets pour sécuriser ton adresse
                e-mail, sans jamais transmettre ton mot de passe.
              </p>
            </header>

            <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-800">
                Ton adresse e-mail
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="prenom.nom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyse…</>) : ("Analyser")}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Aucun mot de passe n'est demandé. Seule l'adresse est analysée pour un diagnostic général.
              </p>
            </form>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {result && (
              <section id="diagnostic-result" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <ShieldCheck className="h-4 w-4" />
                    Diagnostic de sécurité
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exporter en PDF
                  </button>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  Analyse pour <span className="font-medium text-slate-700">{email}</span>
                </p>
                <article className="prose prose-slate max-w-none">{renderMarkdown(result)}</article>
              </section>
            )}

            <footer className="mt-12 text-center text-xs text-slate-400">
              Conseils éducatifs générés par IA. Ne remplace pas un audit de sécurité professionnel.
            </footer>
          </div>

          {/* Cybersecurity floating chatbot (only on email view) */}
          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:scale-105 hover:bg-slate-800"
            aria-label="Ouvrir le chatbot"
          >
            {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 z-50 flex w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[26rem]">
              <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white">
                <Bot className="h-5 w-5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Assistant Cybersécurité</p>
                  <p className="text-xs text-slate-300">Pose tes questions</p>
                </div>
                <button type="button" onClick={() => setChatOpen(false)} className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex max-h-[24rem] flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${msg.role === "assistant" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "assistant" ? "rounded-tl-none bg-white text-slate-800 shadow-sm" : "rounded-tr-none bg-slate-900 text-white"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-2xl rounded-tl-none bg-white px-3.5 py-2.5 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChatMessage} className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3">
                <input
                  type="text"
                  placeholder="Ta question cybersécurité..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Envoyer">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </main>
      ) : (
        /* ============ ALEX IA VIEW (Gemini-style) ============ */
        <main className="relative flex h-screen flex-col overflow-hidden bg-[#0b0f1c] text-slate-100 sm:flex-row">
          {/* Ambient aurora background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-indigo-700/20 blur-[120px]" />
            <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[120px]" />
            <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-blue-700/15 blur-[120px]" />
          </div>

          {/* Sidebar */}
          <aside className="relative z-10 flex w-full flex-col border-b border-white/5 bg-[#11162a]/80 backdrop-blur-xl sm:w-72 sm:border-b-0 sm:border-r">
            <div className="flex items-center gap-2.5 px-5 pb-4 pt-20 sm:pt-6">
              <img src={alexLogo} alt="Alex Graph" className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10" />
              <p className="text-base font-semibold tracking-tight">Alex IA</p>
              <button type="button" className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Réduire">
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>

            <nav className="px-3 pb-2">
              <button
                type="button"
                onClick={newAlexConversation}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5">
                <Search className="h-4 w-4" />
                Search chats
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5">
                <LibraryBig className="h-4 w-4" />
                Library
              </button>
            </nav>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              <p className="px-3 pb-2 pt-3 text-xs font-medium text-slate-500">Recents</p>
              {alexConvs.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-500">Aucune conversation.</p>
              )}
              {alexConvs.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition ${
                    c.id === alexCurrentId ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setAlexCurrentId(c.id)}
                    className="flex flex-1 items-center gap-2 overflow-hidden px-1.5 py-0.5 text-left"
                  >
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAlexConversation(c.id)}
                    className="rounded p-1 text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Chat area */}
          <section className="relative z-10 flex flex-1 flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 pl-20 sm:pl-6">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-slate-200">Alex</span>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-400">2.5 Flash</span>
              </div>
              <button type="button" className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/40 transition hover:scale-[1.02]">
                <Sparkles className="h-4 w-4" />
                Upgrade
              </button>
            </div>

            {/* Messages or hero */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8">
              {(!currentConv || currentConv.messages.length <= 1) ? (
                <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center pb-32 text-center">
                  <img src={alexLogo} alt="Alex Graph" className="mb-6 h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10 shadow-2xl shadow-indigo-900/30" />
                  <h1 className="bg-gradient-to-r from-violet-300 via-white to-indigo-300 bg-clip-text text-4xl font-light tracking-tight text-transparent sm:text-5xl">
                    Your move, friend!
                  </h1>
                  <p className="mt-3 text-sm text-slate-400">Pose une question, génère une image, ou explore une idée.</p>
                </div>
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-5 py-6">
                  {currentConv.messages.map((m, i) => (
                    <div key={i} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${m.role === "assistant" ? "bg-white" : "bg-white/10"}`}>
                        {m.role === "assistant" ? <img src={alexLogo} alt="Alex" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-white" />}
                      </div>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "assistant" ? "rounded-tl-none bg-white/5 text-slate-100 backdrop-blur" : "rounded-tr-none bg-gradient-to-br from-indigo-600 to-violet-600 text-white"}`}>
                        <div className="prose prose-invert prose-sm max-w-none">{renderMarkdownDark(m.content)}</div>
                        {m.imageUrl && (
                          <img src={m.imageUrl} alt="Image générée par Alex IA" className="mt-3 max-w-full rounded-lg border border-white/10" />
                        )}
                      </div>
                    </div>
                  ))}
                  {alexLoading && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white">
                        <img src={alexLogo} alt="Alex" className="h-full w-full object-cover" />
                      </div>
                      <div className="rounded-2xl rounded-tl-none bg-white/5 px-4 py-3 backdrop-blur">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                      </div>
                    </div>
                  )}
                  {alexError && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-2 text-sm text-red-300">
                      {alexError}
                    </div>
                  )}
                  <div ref={alexEndRef} />
                </div>
              )}
            </div>

            {/* Input bar (Gemini-style pill) */}
            <form onSubmit={sendAlexMessage} className="px-4 pb-6 pt-2 sm:px-8">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#1a2138]/90 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl transition focus-within:border-violet-400/40">
                  <button
                    type="button"
                    onClick={() => setAlexImageMode((v) => !v)}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
                      alexImageMode ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/10"
                    }`}
                    aria-label="Mode image"
                    title={alexImageMode ? "Mode image activé" : "Activer le mode image"}
                  >
                    {alexImageMode ? <ImageIcon className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
                  </button>
                  <input
                    type="text"
                    value={alexInput}
                    onChange={(e) => setAlexInput(e.target.value)}
                    placeholder={alexImageMode ? "Décris l'image à générer…" : "Ask Alex"}
                    className="flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                  />
                  <span className="hidden h-2 w-2 rounded-full bg-violet-400 sm:block" />
                  <span className="hidden items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 sm:flex">
                    Flash <span className="text-slate-600">▾</span>
                  </span>
                  <button type="button" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10" aria-label="Micro">
                    <Mic className="h-4 w-4" />
                  </button>
                  {alexInput.trim() && (
                    <button
                      type="submit"
                      disabled={alexLoading}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white transition hover:scale-105 disabled:opacity-50"
                      aria-label="Envoyer"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">Alex IA peut faire des erreurs. Vérifie les informations importantes.</p>
              </div>
            </form>
          </section>
        </main>
      )}
    </>
  );
}

// Markdown renderer with dark theme
function renderMarkdownDark(md: string) {
  const lines = md.split("\n");
  const out: Array<React.ReactNode> = [];
  let listBuffer: string[] = [];
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-900 px-1 py-0.5 text-xs">$1</code>');
  const flushList = () => {
    if (listBuffer.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 list-disc space-y-1 pl-5">
          {listBuffer.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(l) }} />
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      out.push(<p key={out.length} className="my-1 font-semibold" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{1,3}\s+/, "")) }} />);
    } else if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(<p key={out.length} className="my-1" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  }
  flushList();
  return out;
}

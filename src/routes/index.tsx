import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  ShieldCheck, Mail, Loader2, AlertCircle, Download, MessageCircle, X, Send, Bot, User,
  Sparkles, Plus, Image as ImageIcon, Trash2, MessagesSquare, Search, LibraryBig, Mic, PanelLeft,
  Telescope, Paperclip, Code2, PenLine, Plane, ChefHat, GraduationCap, Gem, ArrowRight, Home, BrainCircuit,
  AudioLines, Volume2, Play, MicOff, Square, FileText, Copy, Palette, Check, RotateCcw, Wallpaper, Crown,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { analyzeEmail } from "../lib/analyze";
import { chatWithBot } from "../lib/chatbot.functions";
import { chatWithAlex, generateAlexImage, analyzeAlexFile } from "../lib/alex.functions";
import {
  fetchAlexData, upsertAlexConversation, deleteAlexConversation as deleteAlexConversationFn,
  saveAlexImage, deleteAlexImage as deleteAlexImageFn,
} from "../lib/alex-store.functions";
import { synthesizeVoice, transcribeVoice, VOICE_OPTIONS } from "../lib/voice.functions";
import {
  THEME_PRESETS, applyThemeHue, resetTheme, saveThemeHue, loadThemeHue, hexToOklchHue,
  BACKGROUND_THEMES, applyBackgroundTheme, saveBackgroundTheme, loadBackgroundTheme,
} from "../lib/theme";
import { extractFileText } from "../lib/extract-file";
import { supabase } from "@/integrations/supabase/client";
import LoginScreen from "@/components/LoginScreen";
import UserMenu from "@/components/UserMenu";
import AuroraBackground from "@/components/AuroraBackground";
import alexLogo from "@/assets/alex-logo.jpg";
import alexGraphLogo from "@/assets/alex-graph-logo.jpg";


type GemDef = { id: string; label: string; icon: typeof Code2; desc: string };
const ALEX_GEMS: GemDef[] = [
  { id: "general", label: "Généraliste", icon: Sparkles, desc: "Assistant polyvalent" },
  { id: "code", label: "Coach de code", icon: Code2, desc: "Aide à programmer" },
  { id: "writer", label: "Relecteur", icon: PenLine, desc: "Améliore tes textes" },
  { id: "travel", label: "Guide de voyage", icon: Plane, desc: "Itinéraires & conseils" },
  { id: "chef", label: "Chef cuisinier", icon: ChefHat, desc: "Recettes & menus" },
  { id: "tutor", label: "Tuteur", icon: GraduationCap, desc: "Explications pas à pas" },
  { id: "agent", label: "Agent autonome", icon: BrainCircuit, desc: "IA agentique (ReAct, outils, garde-fous)" },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Alex IA — créé par Alex Graph" },
      {
        name: "description",
        content:
          "Alex IA par Alex Graph : un assistant IA généraliste et un analyseur de sécurité e-mail réunis en un seul endroit.",
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
  const fetchDataFn = useServerFn(fetchAlexData);
  const upsertConvFn = useServerFn(upsertAlexConversation);
  const deleteConvFn = useServerFn(deleteAlexConversationFn);
  const saveImageFn = useServerFn(saveAlexImage);
  const deleteImageFn = useServerFn(deleteAlexImageFn);

  // Auth gate
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // View toggle
  const [view, setView] = useState<"home" | "email" | "alex" | "voice" | "library">("home");

  const signOut = async () => {
    await supabase.auth.signOut();
    setView("home");
  };

  // Voix IA (ElevenLabs) state
  const voiceFn = useServerFn(synthesizeVoice);
  const transcribeFn = useServerFn(transcribeVoice);
  const [voiceMode, setVoiceMode] = useState<"tts" | "stt">("tts");
  const [voiceText, setVoiceText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(VOICE_OPTIONS[0].id);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceAudio, setVoiceAudio] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Speech-to-text state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTargetRef = useRef<"voice" | "alex">("voice");

  // Alex IA voice input state
  const [alexRecording, setAlexRecording] = useState(false);
  const [alexTranscribing, setAlexTranscribing] = useState(false);

  // Custom theme (color palette) state
  const [themeOpen, setThemeOpen] = useState(false);
  const [activeThemeHue, setActiveThemeHue] = useState<number | null>(null);

  // Background theme (animated background) state
  const [activeBgId, setActiveBgId] = useState<string>("antigravity");

  useEffect(() => {
    const hue = loadThemeHue();
    if (hue != null) {
      applyThemeHue(hue);
      setActiveThemeHue(hue);
    }
    const bg = loadBackgroundTheme();
    applyBackgroundTheme(bg);
    setActiveBgId(bg);
  }, []);

  const selectThemeHue = (hue: number | null) => {
    if (hue == null) {
      resetTheme();
      saveThemeHue(null);
      setActiveThemeHue(null);
    } else {
      applyThemeHue(hue);
      saveThemeHue(hue);
      setActiveThemeHue(hue);
    }
  };

  const selectBackground = (id: string) => {
    applyBackgroundTheme(id);
    saveBackgroundTheme(id);
    setActiveBgId(id);
  };

  const handleSynthesize = async (e: FormEvent) => {
    e.preventDefault();
    if (!voiceText.trim() || voiceLoading) return;
    setVoiceError(null);
    setVoiceAudio(null);
    setVoiceLoading(true);
    try {
      const res = await voiceFn({ data: { text: voiceText.trim(), voiceId } });
      if (res.error) {
        setVoiceError(res.error);
        return;
      }
      setVoiceAudio(res.audio);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Erreur de génération vocale.");
    } finally {
      setVoiceLoading(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const beginRecording = async (target: "voice" | "alex") => {
    setVoiceError(null);
    recordTargetRef.current = target;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const isAlex = recordTargetRef.current === "alex";
        if (isAlex) setAlexTranscribing(true);
        else setTranscribing(true);
        try {
          const audio = await blobToBase64(blob);
          const res = await transcribeFn({ data: { audio, mimeType: blob.type } });
          if (res.error) {
            if (isAlex) setAlexError(res.error);
            else setVoiceError(res.error);
            return;
          }
          if (isAlex) {
            setAlexInput((prev) => (prev ? `${prev} ${res.text}` : res.text));
          } else {
            setTranscript((prev) => (prev ? `${prev} ${res.text}` : res.text));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erreur de transcription.";
          if (isAlex) setAlexError(msg);
          else setVoiceError(msg);
        } finally {
          if (isAlex) setAlexTranscribing(false);
          else setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      if (target === "alex") setAlexRecording(true);
      else setRecording(true);
    } catch {
      const msg = "Impossible d'accéder au micro. Autorise l'accès au microphone.";
      if (target === "alex") setAlexError(msg);
      else setVoiceError(msg);
    }
  };

  const startRecording = () => beginRecording("voice");

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const toggleAlexRecording = () => {
    if (alexRecording) {
      mediaRecorderRef.current?.stop();
      setAlexRecording(false);
    } else if (!alexTranscribing) {
      setAlexError(null);
      beginRecording("alex");
    }
  };


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
  const [heroPrompt, setHeroPrompt] = useState("");
  const [alexLoading, setAlexLoading] = useState(false);
  const [alexImageMode, setAlexImageMode] = useState(false);
  const [alexDeepResearch, setAlexDeepResearch] = useState(false);
  const [alexPersona, setAlexPersona] = useState<string>("general");
  const [alexError, setAlexError] = useState<string | null>(null);
  const alexEndRef = useRef<HTMLDivElement>(null);
  const alexFileInputRef = useRef<HTMLInputElement>(null);

  // Bibliothèque d'images générées (synchronisée sur le compte)
  type AlexImage = { id: string; prompt: string; imageUrl: string; createdAt: number };
  const [alexImages, setAlexImages] = useState<AlexImage[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Chargement initial depuis le cloud (conversations + images), avec repli localStorage
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDataFn();
        if (cancelled) return;
        setAlexConvs(data.conversations);
        setAlexImages(data.images);
        if (data.conversations.length > 0) setAlexCurrentId(data.conversations[0].id);
        // Migration unique des conversations locales vers le cloud
        const local = loadAlexConversations();
        if (data.conversations.length === 0 && local.length > 0) {
          setAlexConvs(local);
          setAlexCurrentId(local[0].id);
          for (const c of local) {
            void upsertConvFn({ data: { id: c.id, title: c.title, messages: c.messages, createdAt: c.createdAt } }).catch(() => {});
          }
          saveAlexConversations([]);
        }
      } catch {
        const local = loadAlexConversations();
        if (!cancelled) {
          setAlexConvs(local);
          if (local.length > 0) setAlexCurrentId(local[0].id);
        }
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, fetchDataFn, upsertConvFn]);

  const currentConv = alexConvs.find((c) => c.id === alexCurrentId) ?? null;

  // Sauvegarde cloud automatique (anti-rebond) de la conversation active
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dataLoaded || !currentConv) return;
    const conv = currentConv;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void upsertConvFn({
        data: { id: conv.id, title: conv.title, messages: conv.messages, createdAt: conv.createdAt },
      }).catch(() => {});
    }, 700);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConv?.messages, currentConv?.title, dataLoaded]);

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
    void deleteConvFn({ data: { id } }).catch(() => {});
  };

  const removeAlexImage = (id: string) => {
    setAlexImages((prev) => prev.filter((i) => i.id !== id));
    void deleteImageFn({ data: { id } }).catch(() => {});
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
        let imageUrl = res.imageUrl;
        try {
          const saved = await saveImageFn({ data: { prompt: promptText, dataUrl: res.imageUrl } });
          imageUrl = saved.imageUrl;
          setAlexImages((prev) => [saved, ...prev]);
        } catch { /* la bibliothèque échoue silencieusement, l'image reste affichée */ }
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: `Voici l'image générée pour : *${promptText}*`, imageUrl }],
        }));
      } else {
        const historyForApi = newMessages
          .filter((m) => !m.imageUrl)
          .map((m) => ({ role: m.role, content: m.content }));
        const res = await alexFn({ data: { messages: historyForApi, persona: alexPersona, deepResearch: alexDeepResearch } });
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

  // Lance une conversation Alex IA directement depuis l'accueil (barre de prompt centrale)
  const runAlexPrompt = async (text: string) => {
    const promptText = text.trim();
    if (!promptText || alexLoading) return;
    setView("alex");
    setAlexError(null);
    const conv = ensureCurrentConv();
    const userMsg: AlexMsg = { role: "user", content: promptText };
    const newMessages = [...conv.messages, userMsg];
    updateConv(conv.id, (c) => ({
      ...c,
      messages: newMessages,
      title: c.messages.filter((m) => m.role === "user").length === 0 ? promptText.slice(0, 40) : c.title,
    }));
    setAlexLoading(true);
    try {
      const historyForApi = newMessages
        .filter((m) => !m.imageUrl)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await alexFn({ data: { messages: historyForApi, persona: alexPersona, deepResearch: alexDeepResearch } });
      updateConv(conv.id, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: res.content }],
      }));
    } catch (err) {
      setAlexError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setAlexLoading(false);
    }
  };

  const submitHeroPrompt = (e: FormEvent) => {
    e.preventDefault();
    const text = heroPrompt;
    setHeroPrompt("");
    void runAlexPrompt(text);
  };



  const handleAlexFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file || alexLoading) return;
    if (file.size > 15 * 1024 * 1024) {
      setAlexError("Fichier trop volumineux (max 15 Mo).");
      return;
    }
    const conv = ensureCurrentConv();
    const instruction = alexInput.trim();
    setAlexInput("");
    setAlexError(null);
    setAlexLoading(true);
    updateConv(conv.id, (c) => ({
      ...c,
      messages: [
        ...c.messages,
        { role: "user", content: `📎 **${file.name}**${instruction ? `\n\n${instruction}` : "\n\nAnalyse ce document."}` },
      ],
      title: c.messages.filter((m) => m.role === "user").length === 0 ? file.name.slice(0, 40) : c.title,
    }));
    try {
      const { fileName, content } = await extractFileText(file);
      if (!content.trim()) throw new Error("Aucun texte extractible dans ce fichier.");
      const res = await alexFileFn({ data: { fileName, content, instruction: instruction || undefined } });
      updateConv(conv.id, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: res.content }],
      }));
    } catch (err) {
      setAlexError(err instanceof Error ? err.message : "Erreur lors de l'analyse du fichier.");
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

  const goToEmail = () => setView("email");

  const goToAlex = () => {
    if (alexConvs.length === 0) {
      setTimeout(() => newAlexConversation(), 0);
    }
    setView("alex");
  };

  const goHome = () => setView("home");

  const goToVoice = () => setView("voice");

  const goToLibrary = () => setView("library");

  // Connexion obligatoire pour accéder au site
  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0f1c] text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }
  if (!session) {
    return <LoginScreen />;
  }

  const userName =
    (session.user.user_metadata?.full_name as string | undefined) ||
    (session.user.user_metadata?.name as string | undefined) ||
    session.user.email?.split("@")[0] ||
    "ami";

  // Mode admin : activé automatiquement pour ce compte
  const ADMIN_EMAIL = "bbarcelonneprime@gmail.com";
  const isAdmin = (session.user.email ?? "").toLowerCase() === ADMIN_EMAIL;

  return (
    <>
      {/* User profile menu (top-right) */}
      <UserMenu session={session} onSignOut={signOut} />

      {/* Admin badge — visible uniquement pour le compte administrateur */}
      {isAdmin && (
        <div className="fixed right-16 top-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-500/90 to-yellow-500/90 px-3 py-2 text-xs font-bold text-black shadow-lg backdrop-blur">
          <Crown className="h-3.5 w-3.5" />
          Mode Admin
        </div>
      )}

      {/* Top-left home button (hidden on home view) */}
      {view !== "home" && (
        <button
          type="button"
          onClick={goHome}
          className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
          aria-label="Retour à l'accueil"
        >
          <Home className="h-4 w-4" />
          Accueil
        </button>
      )}

      <div key={view} className="view-transition">
      {view === "home" ? (
        /* ============ HOME / LANDING VIEW ============ */
        <main className="relative flex min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0a0a14)" }}>
          {/* Animated particle background (antigravity) */}
          <AuroraBackground />
          {/* ===== Sidebar (style Lovable) ===== */}
          <aside className="relative z-10 hidden w-64 flex-shrink-0 flex-col border-r border-white/5 bg-[#0c0c16]/90 px-3 py-4 backdrop-blur-xl md:flex">
            <div className="mb-6 flex items-center gap-3 px-2">
              <img src={alexGraphLogo} alt="Alex Graph" className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/10" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">Alex IA</p>
                <p className="text-[11px] text-slate-500">par Alex Graph</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              <button type="button" className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white">
                <Home className="h-4 w-4" /> Accueil
              </button>
              <button type="button" onClick={goToAlex} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Sparkles className="h-4 w-4" /> Alex IA
              </button>
              <button type="button" onClick={goToVoice} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <AudioLines className="h-4 w-4" /> Voix IA
              </button>
              <button type="button" onClick={goToEmail} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <ShieldCheck className="h-4 w-4" /> Sécurité e-mail
              </button>
              <button type="button" onClick={() => setThemeOpen(true)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Palette className="h-4 w-4" /> Thème & couleurs
              </button>
            </nav>

            <div className="my-4 h-px bg-white/5" />

            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Conversations</p>
            <div className="flex flex-col gap-1 overflow-y-auto">
              <button type="button" onClick={goToAlex} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Plus className="h-4 w-4" /> Nouvelle conversation
              </button>
              {alexConvs.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setAlexCurrentId(c.id); goToAlex(); }}
                  className="flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <MessagesSquare className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
              ))}
            </div>

            <div className="mt-auto px-2 pt-4 text-[11px] text-slate-600">© Alex Graph — Alex IA</div>
          </aside>

          {/* ===== Main hero area ===== */}
          <div className="relative z-10 flex min-h-screen flex-1 flex-col overflow-hidden">
            {/* Aurora background : bleu en haut → magenta en bas */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(130% 95% at 50% 118%, rgba(255,45,130,0.85) 0%, rgba(176,38,255,0.55) 24%, rgba(70,90,235,0.45) 46%, rgba(10,10,20,0) 72%)",
                }}
              />
              <div
                className="absolute inset-x-0 top-0 h-1/2"
                style={{ background: "linear-gradient(180deg, rgba(10,10,20,1) 0%, rgba(10,10,20,0) 100%)" }}
              />
            </div>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16">
              {/* Pill banner */}
              <button
                type="button"
                onClick={goToVoice}
                className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-200 backdrop-blur-xl transition hover:bg-black/40"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600">
                  <AudioLines className="h-3.5 w-3.5 text-white" />
                </span>
                Découvre la Voix IA
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>

              <h1 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Quoi de neuf, {userName} ?
              </h1>

              {/* Prompt box central */}
              <form onSubmit={submitHeroPrompt} className="mt-8 w-full max-w-2xl">
                <div className="rounded-3xl border border-white/10 bg-black/40 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl transition focus-within:border-violet-400/40">
                  <textarea
                    value={heroPrompt}
                    onChange={(e) => setHeroPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitHeroPrompt(e as unknown as FormEvent);
                      }
                    }}
                    rows={2}
                    maxLength={4000}
                    placeholder="Demande quelque chose à Alex IA…"
                    className="w-full resize-none bg-transparent px-2 py-1 text-base text-slate-100 placeholder-slate-500 outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={goToAlex} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10" aria-label="Plus d'options">
                        <Plus className="h-5 w-5" />
                      </button>
                      <button type="button" onClick={goToVoice} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10" aria-label="Voix">
                        <Mic className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!heroPrompt.trim() || alexLoading}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Envoyer"
                    >
                      {alexLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </form>

              {/* Tool cards */}
              <div className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={goToAlex}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition hover:scale-[1.02] hover:border-violet-400/40 hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-white">Alex IA</span>
                  <span className="text-xs text-slate-400">Assistant généraliste & images</span>
                </button>

                <button
                  type="button"
                  onClick={goToVoice}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition hover:scale-[1.02] hover:border-fuchsia-400/40 hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-lg">
                    <AudioLines className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-white">Voix IA</span>
                  <span className="text-xs text-slate-400">Texte → voix & voix → texte</span>
                </button>

                <button
                  type="button"
                  onClick={goToEmail}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition hover:scale-[1.02] hover:border-emerald-400/40 hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-white">Sécurité e-mail</span>
                  <span className="text-xs text-slate-400">Diagnostic & prévention</span>
                </button>
              </div>

              {/* Theme customizer trigger */}
              <button
                type="button"
                onClick={() => setThemeOpen(true)}
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-xl transition hover:scale-[1.02] hover:border-violet-400/40 hover:bg-white/10"
              >
                <Palette className="h-4 w-4" />
                Personnaliser le thème
              </button>
            </div>
          </div>

          {/* ===== Theme customizer modal ===== */}
          {themeOpen && (
            <div
              className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
              onClick={() => setThemeOpen(false)}
            >
              <div
                className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#11111d] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Palette className="h-5 w-5 text-violet-400" />
                    Crée ton thème
                  </h2>
                  <button
                    type="button"
                    onClick={() => setThemeOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mb-5 text-sm text-slate-400">
                  Choisis une palette ou ta propre couleur : tout le site s'adapte instantanément.
                </p>

                {/* Presets */}
                <div className="grid grid-cols-4 gap-3">
                  {THEME_PRESETS.map((p) => {
                    const isActive =
                      (p.id === "default" && activeThemeHue == null) ||
                      activeThemeHue === p.hue;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectThemeHue(p.id === "default" ? null : p.hue)}
                        className="group flex flex-col items-center gap-1.5"
                        title={p.label}
                      >
                        <span
                          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ring-2 transition group-hover:scale-105 ${
                            isActive ? "ring-white" : "ring-transparent"
                          }`}
                          style={{ background: p.swatch }}
                        >
                          {isActive && <Check className="h-5 w-5 text-white drop-shadow" />}
                        </span>
                        <span className="text-[10px] text-slate-400">{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom color picker */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="flex items-center justify-between text-sm text-slate-200">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400" />
                      Couleur personnalisée
                    </span>
                    <input
                      type="color"
                      defaultValue="#7c3aed"
                      onChange={(e) => selectThemeHue(hexToOklchHue(e.target.value))}
                      className="h-9 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                      aria-label="Choisir une couleur"
                    />
                  </label>
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                      <span>Teinte</span>
                      <span>{activeThemeHue != null ? `${Math.round(activeThemeHue)}°` : "auto"}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={activeThemeHue ?? 293}
                      onChange={(e) => selectThemeHue(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, oklch(60% 0.2 0), oklch(60% 0.2 60), oklch(60% 0.2 120), oklch(60% 0.2 180), oklch(60% 0.2 240), oklch(60% 0.2 300), oklch(60% 0.2 360))",
                      }}
                    />
                  </div>
                </div>

                {/* Background (animated) themes */}
                <div className="mt-6">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Wallpaper className="h-4 w-4 text-violet-400" />
                    Couleur d'arrière-plan
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {BACKGROUND_THEMES.map((b) => {
                      const isActive = activeBgId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => selectBackground(b.id)}
                          className="group flex flex-col items-center gap-1.5"
                          title={b.label}
                        >
                          <span
                            className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-lg ring-2 transition group-hover:scale-105 ${
                              isActive ? "ring-white" : "ring-transparent"
                            }`}
                            style={{ background: b.swatch }}
                          >
                            {isActive && <Check className="h-5 w-5 text-white drop-shadow" />}
                          </span>
                          <span className="text-[10px] text-slate-400">{b.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>



                <button
                  type="button"
                  onClick={() => selectThemeHue(null)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser le thème par défaut
                </button>
              </div>
            </div>
          )}
        </main>
      ) : view === "email" ? (
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
      ) : view === "voice" ? (
        /* ============ VOIX IA VIEW (ElevenLabs) ============ */
        <main className="relative min-h-screen overflow-hidden px-4 py-16 text-slate-100" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
          {/* Animated particle background (antigravity) */}
          <AuroraBackground />

          <div className="relative z-10 mx-auto w-full max-w-3xl">
            <header className="mb-10 text-center">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600">
                  <AudioLines className="h-3 w-3 text-white" />
                </span>
                Propulsé par ElevenLabs
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Crée un audio <span className="bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text text-transparent">réaliste</span>
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400">
                Transforme ton texte en voix naturelle, ou transcris ta voix en texte — dans plusieurs voix et langues.
              </p>
            </header>


            {/* Mode switch */}
            <div className="mx-auto mb-8 flex max-w-sm items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setVoiceMode("tts")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  voiceMode === "tts" ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow" : "text-slate-300 hover:text-white"
                }`}
              >
                <Volume2 className="h-4 w-4" /> Texte → Voix
              </button>
              <button
                type="button"
                onClick={() => setVoiceMode("stt")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  voiceMode === "stt" ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow" : "text-slate-300 hover:text-white"
                }`}
              >
                <Mic className="h-4 w-4" /> Voix → Texte
              </button>
            </div>

            {voiceError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/50 p-4 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{voiceError}</p>
              </div>
            )}

            {voiceMode === "tts" ? (
              /* Text to speech */
              <form onSubmit={handleSynthesize} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
                <label htmlFor="voiceText" className="mb-2 block text-sm font-medium text-slate-200">
                  Ton texte
                </label>
                <textarea
                  id="voiceText"
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Écris le texte à transformer en voix…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#11162a]/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-fuchsia-400/40"
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-[#11162a]/80 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-fuchsia-400/40"
                  >
                    {VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#11162a]">
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={voiceLoading || !voiceText.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {voiceLoading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Génération…</>) : (<><Play className="h-4 w-4" /> Générer la voix</>)}
                  </button>
                </div>

                {voiceAudio && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-[#11162a]/60 p-4">
                    <audio controls autoPlay src={voiceAudio} className="w-full">
                      Ton navigateur ne supporte pas l'audio.
                    </audio>
                    <a
                      href={voiceAudio}
                      download="voix-ia.mp3"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-fuchsia-300 hover:text-fuchsia-200"
                    >
                      <Download className="h-3.5 w-3.5" /> Télécharger le MP3
                    </a>
                  </div>
                )}
              </form>
            ) : (
              /* Speech to text */
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex flex-col items-center gap-4">
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    disabled={transcribing}
                    className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 disabled:opacity-50 ${
                      recording ? "bg-red-600 animate-pulse" : "bg-gradient-to-br from-fuchsia-500 to-pink-600"
                    }`}
                    aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
                  >
                    {recording ? <Square className="h-7 w-7" /> : transcribing ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-8 w-8" />}
                  </button>
                  <p className="text-sm text-slate-400">
                    {recording
                      ? "Enregistrement… clique pour arrêter."
                      : transcribing
                        ? "Transcription en cours…"
                        : "Clique sur le micro et parle."}
                  </p>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="transcript" className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                      <FileText className="h-4 w-4" /> Transcription
                    </label>
                    {transcript && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(transcript)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-fuchsia-300 hover:text-fuchsia-200"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copier
                      </button>
                    )}
                  </div>
                  <textarea
                    id="transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={6}
                    placeholder="Le texte transcrit apparaîtra ici…"
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#11162a]/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-fuchsia-400/40"
                  />
                  {transcript && (
                    <button
                      type="button"
                      onClick={() => setTranscript("")}
                      className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-200"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="mt-10 text-center text-xs text-slate-500">Propulsé par ElevenLabs — © Alex Graph</p>
          </div>
        </main>
      ) : view === "library" ? (
        /* ============ IMAGE LIBRARY VIEW ============ */
        <main className="relative min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0a0a14)" }}>
          <AuroraBackground />
          <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 pt-24 sm:py-20">
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
                <LibraryBig className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Ma bibliothèque d'images</h1>
                <p className="text-sm text-slate-400">Toutes tes images générées avec Alex IA, synchronisées sur ton compte.</p>
              </div>
            </div>

            {!dataLoaded ? (
              <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
            ) : alexImages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
                <ImageIcon className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                <p className="text-sm text-slate-300">Aucune image pour l'instant.</p>
                <button
                  type="button"
                  onClick={() => { setAlexImageMode(true); goToAlex(); }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-105"
                >
                  <Sparkles className="h-4 w-4" /> Générer une image
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {alexImages.map((img) => (
                  <div key={img.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <img src={img.imageUrl} alt={img.prompt} className="aspect-square w-full object-cover" loading="lazy" />
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 to-transparent p-3 transition group-hover:translate-y-0">
                      <p className="line-clamp-2 text-xs text-slate-200">{img.prompt || "Sans description"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={img.imageUrl}
                          download={`alex-ia-${img.id}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white transition hover:bg-white/20"
                        >
                          <Download className="h-3 w-3" /> Télécharger
                        </a>
                        <button
                          type="button"
                          onClick={() => removeAlexImage(img.id)}
                          className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] text-red-200 transition hover:bg-red-500/40"
                        >
                          <Trash2 className="h-3 w-3" /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      ) : (
        /* ============ ALEX IA VIEW (Gemini-style) ============ */
        <main className="relative flex h-screen flex-col overflow-hidden text-slate-100 sm:flex-row" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
          {/* Ambient animated background (antigravity style) */}
          <AuroraBackground />
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
              <button type="button" onClick={goToLibrary} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5">
                <LibraryBig className="h-4 w-4" />
                Library
              </button>
            </nav>

            {/* Gems — assistants spécialisés */}
            <div className="px-3 pb-1">
              <p className="flex items-center gap-1.5 px-2 pb-1.5 pt-2 text-xs font-medium text-slate-500">
                <Gem className="h-3.5 w-3.5" /> Gems
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {ALEX_GEMS.map((g) => {
                  const GIcon = g.icon;
                  const active = alexPersona === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setAlexPersona(g.id)}
                      title={g.desc}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                        active
                          ? "bg-violet-600/30 text-white ring-1 ring-violet-400/50"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <GIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{g.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

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
                {/* Mode chips */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAlexDeepResearch((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      alexDeepResearch
                        ? "border-violet-400/50 bg-violet-600/30 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                    title="Produit un rapport structuré et approfondi"
                  >
                    <Telescope className="h-3.5 w-3.5" />
                    Recherche approfondie
                  </button>
                  {alexPersona !== "general" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-600/20 px-3 py-1.5 text-xs text-indigo-200">
                      <Gem className="h-3 w-3" />
                      {ALEX_GEMS.find((g) => g.id === alexPersona)?.label}
                    </span>
                  )}
                </div>

                <input
                  ref={alexFileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.markdown,.csv,.json,.log,.tsv,.html,.xml,.rtf,text/*,application/pdf"
                  onChange={handleAlexFile}
                  className="hidden"
                />

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
                  <button
                    type="button"
                    onClick={() => alexFileInputRef.current?.click()}
                    disabled={alexLoading}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                    aria-label="Joindre un fichier"
                    title="Analyser un fichier (PDF, texte…)"
                  >
                    <Paperclip className="h-4 w-4" />
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
                  <button
                    type="button"
                    onClick={toggleAlexRecording}
                    disabled={alexTranscribing}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                      alexRecording
                        ? "animate-pulse bg-red-500 text-white"
                        : "text-slate-300 hover:bg-white/10"
                    }`}
                    aria-label={alexRecording ? "Arrêter l'enregistrement" : "Saisie vocale"}
                    title={alexRecording ? "Arrête de parler pour transcrire" : "Parle au lieu d'écrire"}
                  >
                    {alexTranscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : alexRecording ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
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
                <p className="mt-2 text-center text-xs text-slate-500">
                  {alexRecording
                    ? "🎙️ Enregistrement… clique sur ⏹ pour transcrire."
                    : alexTranscribing
                      ? "Transcription en cours…"
                      : "Alex IA peut faire des erreurs. Vérifie les informations importantes."}
                </p>
              </div>
            </form>
          </section>
        </main>
      )}
      </div>
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

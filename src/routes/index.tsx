import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect, type FormEvent } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck, Mail, Loader2, AlertCircle, Download, MessageCircle, X, Send, Bot, User,
  Sparkles, Plus, Image as ImageIcon, Trash2, MessagesSquare, Search, LibraryBig, Mic, PanelLeft,
  Telescope, Code2, PenLine, Plane, ChefHat, GraduationCap, Gem, ArrowRight, Home, BrainCircuit,
  AudioLines, Volume2, Play, MicOff, Square, FileText, Copy, Palette, Check, RotateCcw, Wallpaper, Crown,
  Scissors, UploadCloud, ChevronDown, Cpu, Zap, QrCode, Headphones, VolumeX, Link2, Gamepad2, Wand2, RefreshCw,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { analyzeEmail } from "../lib/analyze";
import { chatWithBot } from "../lib/chatbot.functions";
import { chatWithAlex, generateAlexImage, analyzeAlexFile, describeAlexImage, describeAlexVideo } from "../lib/alex.functions";
import {
  fetchAlexData, upsertAlexConversation, deleteAlexConversation as deleteAlexConversationFn,
  saveAlexImage, deleteAlexImage as deleteAlexImageFn,
} from "../lib/alex-store.functions";
import { synthesizeVoice, transcribeVoice, VOICE_OPTIONS } from "../lib/voice.functions";
import { removeBackground } from "../lib/background.functions";
import { ALEX_MODELS, DEFAULT_ALEX_MODEL, getAlexModel } from "../lib/alex-models";
import {
  THEME_PRESETS, applyThemeHue, resetTheme, saveThemeHue, loadThemeHue, hexToOklchHue,
  BACKGROUND_THEMES, applyBackgroundTheme, saveBackgroundTheme, loadBackgroundTheme,
} from "../lib/theme";
import { extractFileText } from "../lib/extract-file";
import { generateGame, nameGame } from "../lib/codex.functions";
import { listCodexProjects, saveCodexProject, deleteCodexProject, type CodexProject } from "../lib/codex-store.functions";
import CodexEditor from "@/components/CodexEditor";
import { useVocalChat } from "@/hooks/useVocalChat";
import { supabase } from "@/integrations/supabase/client";
import LoginScreen from "@/components/LoginScreen";
import UserMenu from "@/components/UserMenu";
import AuroraBackground from "@/components/AuroraBackground";
import VoiceOverlay from "@/components/VoiceOverlay";
import alexStarLogoAsset from "@/assets/alex-star-logo.png.asset.json";
const alexLogo = alexStarLogoAsset.url;
const alexGraphLogo = alexStarLogoAsset.url;


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

// Outils affichés sur l'accueil (grille « Catégories populaires »).
type HomeTool = {
  id: string;
  label: string;
  desc: string;
  icon: typeof Code2;
  gradient: string;
  href?: string;
};
const HOME_TOOLS: HomeTool[] = [
  { id: "alex", label: "Alex IA", desc: "Chatbot multimodal, images & recherche", icon: Sparkles, gradient: "from-violet-500 to-indigo-600" },
  { id: "codex", label: "Codex", desc: "Crée des jeux 2D en un prompt", icon: Gamepad2, gradient: "from-lime-500 to-emerald-600" },
  { id: "voice", label: "Voix IA", desc: "Texte → voix et voix → texte", icon: AudioLines, gradient: "from-fuchsia-500 to-pink-600" },
  { id: "email", label: "Sécurité e-mail", desc: "Analyse phishing & arnaques", icon: ShieldCheck, gradient: "from-sky-500 to-cyan-600" },
  { id: "bgremove", label: "Retirer l'arrière-plan", desc: "Détache un sujet en un clic", icon: Scissors, gradient: "from-amber-500 to-orange-600" },
  { id: "qr", label: "QR Code", desc: "Génère et télécharge un QR", icon: QrCode, gradient: "from-slate-500 to-slate-700" },
  { id: "library", label: "Librairie", desc: "Toutes tes images générées", icon: LibraryBig, gradient: "from-teal-500 to-emerald-600" },
  { id: "theme", label: "Thème & couleurs", desc: "Personnalise tout le site", icon: Palette, gradient: "from-rose-500 to-violet-600" },
  { id: "alexapi", label: "Alex API", desc: "Plateforme d'API Alex", icon: Zap, gradient: "from-indigo-500 to-blue-600", href: "https://alex-code-flow.base44.app/" },
  { id: "alexcode", label: "Alex Code", desc: "Génère des apps web", icon: Code2, gradient: "from-purple-500 to-fuchsia-600", href: "https://married-alex-code-flow.base44.app/" },
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

// (le rendu Markdown clair a été remplacé par renderMarkdownDark, thème sombre unifié)

type AlexMsg = { role: "user" | "assistant"; content: string; imageUrl?: string };
type AlexConversation = { id: string; title: string; messages: AlexMsg[]; createdAt: number };

const ALEX_STORAGE_KEY = "alex_ia_conversations_v1";
const ALEX_GREETING =
  "Salut ! Je suis **Alex IA**, ton assistant IA généraliste. Je peux discuter de tout, t'aider à écrire, coder, réfléchir… et même générer des images. Comment puis-je t'aider ?";

function makeConversation(): AlexConversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "Nouvelle conversation",
    messages: [{ role: "assistant", content: ALEX_GREETING }],
    createdAt: Date.now(),
  };
}

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
  const alexImageDescribeFn = useServerFn(describeAlexImage);
  const alexVideoFn = useServerFn(describeAlexVideo);
  const fetchDataFn = useServerFn(fetchAlexData);
  const upsertConvFn = useServerFn(upsertAlexConversation);
  const deleteConvFn = useServerFn(deleteAlexConversationFn);
  const saveImageFn = useServerFn(saveAlexImage);
  const deleteImageFn = useServerFn(deleteAlexImageFn);
  const removeBgFn = useServerFn(removeBackground);

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
  const [view, setView] = useState<"home" | "email" | "alex" | "voice" | "library" | "bgremove" | "qr" | "codex">("home");

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

  // Historique des e-mails analysés (persistant, par appareil)
  type EmailScan = { id: string; email: string; content: string; createdAt: number };
  const EMAIL_HISTORY_KEY = "alex_email_history_v1";
  const [emailHistory, setEmailHistory] = useState<EmailScan[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(EMAIL_HISTORY_KEY);
      if (raw) setEmailHistory(JSON.parse(raw) as EmailScan[]);
    } catch { /* ignore */ }
  }, []);

  const saveEmailScan = (scan: EmailScan) => {
    setEmailHistory((prev) => {
      const next = [scan, ...prev.filter((s) => s.email !== scan.email)].slice(0, 20);
      try { localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const openEmailScan = (scan: EmailScan) => {
    setEmail(scan.email);
    setResult(scan.content);
    setError(null);
  };

  const clearEmailHistory = () => {
    setEmailHistory([]);
    try { localStorage.removeItem(EMAIL_HISTORY_KEY); } catch { /* ignore */ }
  };


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
  const [toolQuery, setToolQuery] = useState("");

  const [alexLoading, setAlexLoading] = useState(false);
  const [alexImageMode, setAlexImageMode] = useState(false);
  const [alexDeepResearch, setAlexDeepResearch] = useState(false);
  const [alexPersona, setAlexPersona] = useState<string>("general");
  const [alexModel, setAlexModel] = useState<string>(DEFAULT_ALEX_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [alexError, setAlexError] = useState<string | null>(null);

  // Chatbot : recherche de conversations + repli latéral (boutons secondaires)
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Chat vocal temps réel (style ChatGPT Voice Mode) — natif navigateur
  const [voiceChatOn, setVoiceChatOn] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const lastSpokenRef = useRef(0);
  const vocal = useVocalChat({
    onTranscript: (text) => {
      void submitAlexText(text);
    },
  });

  // Générateur de QR code (lien → QR)
  const [qrInput, setQrInput] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Codex — générateur de jeux 2D + éditeur façon Lovable
  const [codexPrompt, setCodexPrompt] = useState("");
  const [codexLoading, setCodexLoading] = useState(false);
  const [codexError, setCodexError] = useState<string | null>(null);
  const [codexProjects, setCodexProjects] = useState<CodexProject[]>([]);
  const [activeCodexProject, setActiveCodexProject] = useState<CodexProject | null>(null);
  const [codexLoaded, setCodexLoaded] = useState(false);
  const generateGameFn = useServerFn(generateGame);
  const nameGameFn = useServerFn(nameGame);
  const listCodexFn = useServerFn(listCodexProjects);
  const saveCodexFn = useServerFn(saveCodexProject);
  const deleteCodexFn = useServerFn(deleteCodexProject);

  // Suppression d'arrière-plan (remove.bg)
  const [bgOriginal, setBgOriginal] = useState<string | null>(null);
  const [bgResult, setBgResult] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
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
        setAlexImages(data.images);
        // Migration unique des conversations locales vers le cloud
        const local = loadAlexConversations();
        let saved = data.conversations;
        if (data.conversations.length === 0 && local.length > 0) {
          saved = local;
          for (const c of local) {
            void upsertConvFn({ data: { id: c.id, title: c.title, messages: c.messages, createdAt: c.createdAt } }).catch(() => {});
          }
          saveAlexConversations([]);
        }
        // Comportement Gemini/ChatGPT : une nouvelle conversation démarre
        // uniquement quand l'utilisateur ferme la fenêtre puis revient.
        // Tant que l'onglet reste ouvert (navigation interne, refresh),
        // on ré-ouvre la dernière conversation active via sessionStorage.
        const SESSION_KEY = "alex:activeConvId";
        const activeId = typeof window !== "undefined" ? window.sessionStorage.getItem(SESSION_KEY) : null;
        const existing = activeId ? saved.find((c) => c.id === activeId) : null;
        if (existing) {
          setAlexConvs(saved);
          setAlexCurrentId(existing.id);
        } else {
          const fresh = makeConversation();
          setAlexConvs([fresh, ...saved]);
          setAlexCurrentId(fresh.id);
          if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_KEY, fresh.id);
        }
      } catch {
        const local = loadAlexConversations();
        if (!cancelled) {
          const fresh = makeConversation();
          setAlexConvs([fresh, ...local]);
          setAlexCurrentId(fresh.id);
          if (typeof window !== "undefined") window.sessionStorage.setItem("alex:activeConvId", fresh.id);
        }
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session, fetchDataFn, upsertConvFn]);

  const currentConv = alexConvs.find((c) => c.id === alexCurrentId) ?? null;

  // Mémorise l'ID actif dans sessionStorage pour reprendre la conversation
  // après un rafraîchissement — reset uniquement à la fermeture de la fenêtre.
  useEffect(() => {
    if (typeof window === "undefined" || !alexCurrentId) return;
    window.sessionStorage.setItem("alex:activeConvId", alexCurrentId);
  }, [alexCurrentId]);

  // Sauvegarde cloud automatique (anti-rebond) de la conversation active
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dataLoaded || !currentConv) return;
    const conv = currentConv;
    // N'enregistre pas les conversations vides (sans message utilisateur)
    // pour ne pas encombrer l'historique à chaque visite.
    if (!conv.messages.some((m) => m.role === "user")) return;
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
    const conv = makeConversation();
    setAlexConvs((prev) => [conv, ...prev]);
    setAlexCurrentId(conv.id);
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

  // Envoie un message texte à Alex (partagé par le formulaire et le chat vocal).
  const submitAlexText = async (raw: string) => {
    const promptText = raw.trim();
    if (!promptText || alexLoading) return;
    setView("alex");
    const conv = ensureCurrentConv();
    const userMsg: AlexMsg = { role: "user", content: promptText };
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
        const res = await alexFn({ data: { messages: historyForApi, persona: alexPersona, deepResearch: alexDeepResearch, model: alexModel } });
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

  const sendAlexMessage = (e: FormEvent) => {
    e.preventDefault();
    const text = alexInput.trim();
    if (!text || alexLoading) return;
    setAlexInput("");
    void submitAlexText(text);
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
      const res = await alexFn({ data: { messages: historyForApi, persona: alexPersona, deepResearch: alexDeepResearch, model: alexModel } });
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

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      try {
        const dataUrl = await blobToBase64(file);
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            { role: "user", content: `🎬 **${file.name}**${instruction ? `\n\n${instruction}` : "\n\nAnalyse cette vidéo."}` },
          ],
          title: c.messages.filter((m) => m.role === "user").length === 0 ? file.name.slice(0, 40) : c.title,
        }));
        const res = await alexVideoFn({ data: { dataUrl, mimeType: file.type, instruction: instruction || undefined } });
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: res.content }],
        }));
      } catch (err) {
        setAlexError(err instanceof Error ? err.message : "Erreur lors de l'analyse de la vidéo.");
      } finally {
        setAlexLoading(false);
      }
      return;
    }


    try {
      if (isImage) {
        const dataUrl = await blobToBase64(file);
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            { role: "user", content: instruction || "Analyse cette image.", imageUrl: dataUrl },
          ],
          title: c.messages.filter((m) => m.role === "user").length === 0 ? file.name.slice(0, 40) : c.title,
        }));
        const res = await alexImageDescribeFn({ data: { dataUrl, instruction: instruction || undefined } });
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: res.content }],
        }));
      } else {
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            { role: "user", content: `📎 **${file.name}**${instruction ? `\n\n${instruction}` : "\n\nAnalyse ce document."}` },
          ],
          title: c.messages.filter((m) => m.role === "user").length === 0 ? file.name.slice(0, 40) : c.title,
        }));
        const { fileName, content } = await extractFileText(file);
        if (!content.trim()) throw new Error("Aucun texte extractible dans ce fichier.");
        const res = await alexFileFn({ data: { fileName, content, instruction: instruction || undefined } });
        updateConv(conv.id, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: res.content }],
        }));
      }
    } catch (err) {
      setAlexError(err instanceof Error ? err.message : "Erreur lors de l'analyse du fichier.");
    } finally {
      setAlexLoading(false);
    }
  };


  useEffect(() => {
    alexEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConv?.messages, alexLoading]);

  // Chat vocal : lit automatiquement à voix haute la dernière réponse d'Alex.
  useEffect(() => {
    if (!voiceChatOn || alexLoading) return;
    const msgs = currentConv?.messages ?? [];
    const last = msgs[msgs.length - 1];
    if (last && last.role === "assistant" && msgs.length !== lastSpokenRef.current) {
      lastSpokenRef.current = msgs.length;
      vocal.speak(last.content);
    }
  }, [currentConv?.messages, alexLoading, voiceChatOn, vocal]);

  // Coupe micro et lecture quand on désactive le mode vocal ou quitte le chat.
  useEffect(() => {
    if (!voiceChatOn || view !== "alex") {
      vocal.stopConversation();
    }
  }, [voiceChatOn, view, vocal]);

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
      saveEmailScan({ id: `scan-${Date.now()}`, email: email.trim(), content: res.content, createdAt: Date.now() });
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

  const goToBgRemove = () => setView("bgremove");

  const goToQr = () => setView("qr");

  const goToCodex = () => setView("codex");

  // Charge les projets Codex à l'ouverture de la vue.
  useEffect(() => {
    if (view !== "codex" || codexLoaded || !session) return;
    (async () => {
      try {
        const res = await listCodexFn();
        setCodexProjects(res.projects);
      } catch (e) {
        console.error("Codex list error", e);
      } finally {
        setCodexLoaded(true);
      }
    })();
     
  }, [view, session]);

  // Nouveau jeu : génère puis ouvre directement l'éditeur (façon Lovable).
  const submitCodex = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = codexPrompt.trim();
    if (!prompt || codexLoading) return;
    setCodexError(null);
    setCodexLoading(true);
    try {
      const [res, nameRes] = await Promise.all([
        generateGameFn({ data: { prompt } }),
        nameGameFn({ data: { prompt } }).catch(() => ({ name: "Nouveau jeu" })),
      ]);
      if (res.error || !res.html) {
        setCodexError(res.error ?? "Échec de la génération.");
        return;
      }
      const saved = await saveCodexFn({
        data: {
          name: nameRes.name || "Nouveau jeu",
          prompt,
          html: res.html,
          history: [{ role: "user", content: prompt, at: Date.now() }],
        },
      });
      setCodexProjects((prev) => [saved.project, ...prev]);
      setActiveCodexProject(saved.project);
      setCodexPrompt("");
    } catch {
      setCodexError("Erreur lors de la génération du jeu. Réessaie.");
    } finally {
      setCodexLoading(false);
    }
  };

  const iterateCodex = async (prompt: string, previousHtml?: string) => {
    return await generateGameFn({ data: { prompt, previousHtml } });
  };

  const saveCodexEdits = async (p: CodexProject): Promise<CodexProject> => {
    const res = await saveCodexFn({
      data: { id: p.id, name: p.name, prompt: p.prompt, html: p.html, history: p.history },
    });
    setCodexProjects((prev) => prev.map((x) => (x.id === res.project.id ? res.project : x)));
    setActiveCodexProject(res.project);
    return res.project;
  };

  const removeCodexProject = async (id: string) => {
    await deleteCodexFn({ data: { id } });
    setCodexProjects((prev) => prev.filter((x) => x.id !== id));
    if (activeCodexProject?.id === id) setActiveCodexProject(null);
  };


  // Génère un QR code (image PNG data URL) à partir d'un lien ou d'un texte.
  const generateQr = async (e: FormEvent) => {
    e.preventDefault();
    const value = qrInput.trim();
    if (!value) return;
    setQrError(null);
    setQrLoading(true);
    try {
      const dataUrl = await QRCode.toDataURL(value, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#0b0f1c", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError("Impossible de générer le QR code. Vérifie le lien ou le texte.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBgError("Choisis un fichier image (JPG, PNG…).");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setBgError("Image trop volumineuse (max 12 Mo).");
      return;
    }
    setBgError(null);
    setBgResult(null);
    setBgLoading(true);
    try {
      const dataUrl = await blobToBase64(file);
      setBgOriginal(dataUrl);
      const res = await removeBgFn({ data: { imageBase64: dataUrl } });
      setBgResult(res.imageUrl);
    } catch (err) {
      setBgError(err instanceof Error ? err.message : "Erreur lors du traitement.");
    } finally {
      setBgLoading(false);
    }
  };

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

  // Dans l'éditeur Codex on masque les éléments flottants pour laisser la place à l'outil.
  const inCodexEditor = view === "codex" && !!activeCodexProject;

  return (
    <>
      {/* User profile menu (top-right) */}
      {!inCodexEditor && <UserMenu session={session} onSignOut={signOut} />}

      {/* Admin badge — compact, parfaitement cadré avec le menu utilisateur */}
      {isAdmin && !inCodexEditor && (
        <div
          title="Mode Admin"
          className="group fixed right-[4.5rem] top-4 z-50 flex h-9 items-center justify-center rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-500/90 to-yellow-500/90 px-2 text-[10px] font-bold text-black shadow-md backdrop-blur transition-all duration-300"
        >
          <Crown className="h-3.5 w-3.5" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-[4.5rem] group-hover:pl-1 group-hover:opacity-100">
            Admin
          </span>
        </div>
      )}

      {/* Top-left home button (hidden on home view) — ultra-compact */}
      {view !== "home" && (
        <button
          type="button"
          onClick={goHome}
          className="group fixed left-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
          aria-label="Retour à l'accueil"
        >
          <Home className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          <span className="sr-only">Accueil</span>
        </button>
      )}

      {/* Chat vocal immersif (style ChatGPT Voice Mode) */}
      {voiceChatOn && view === "alex" && vocal.supported && (
        <VoiceOverlay
          status={
            vocal.listening
              ? "listening"
              : alexLoading
                ? "thinking"
                : vocal.speaking
                  ? "speaking"
                  : "idle"
          }
          level={vocal.level}
          lastUser={
            [...(currentConv?.messages ?? [])].reverse().find((m) => m.role === "user")?.content ?? null
          }
          lastAssistant={
            [...(currentConv?.messages ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? null
          }
          voices={vocal.voices}
          voiceURI={vocal.voiceURI}
          onSelectVoice={vocal.setVoiceURI}
          onInterrupt={() => {
            vocal.stopSpeaking();
            vocal.startListening();
          }}
          onClose={() => {
            setVoiceChatOn(false);
            vocal.stopConversation();
          }}
        />
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
              <img src={alexGraphLogo} alt="Alex IA" className="h-9 w-9 rounded-xl object-contain" />
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
              <button type="button" onClick={goToBgRemove} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Scissors className="h-4 w-4" /> Retirer l'arrière-plan
              </button>
              <button type="button" onClick={goToQr} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <QrCode className="h-4 w-4" /> QR Code
              </button>
              <button type="button" onClick={goToCodex} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                <Gamepad2 className="h-4 w-4" /> Codex — Jeux 2D
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
          {/* ===== Main area ===== */}
          <div className="relative z-10 flex min-h-screen flex-1 flex-col overflow-y-auto">
            {/* Top bar : recherche d'outil + thème */}
            <header className="relative z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/5 bg-[#0a0a14]/60 px-4 py-3 pr-24 backdrop-blur-xl sm:px-6 sm:pr-44">
              <div className="relative min-w-0 max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={toolQuery}
                  onChange={(e) => setToolQuery(e.target.value)}
                  placeholder="Rechercher un outil…"
                  className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40 focus:bg-white/[0.07]"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThemeOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Thème & couleurs"
                  title="Thème & couleurs"
                >
                  <Palette className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Aurora background : bleu en haut → magenta en bas */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(130% 95% at 50% 118%, rgba(255,45,130,0.55) 0%, rgba(176,38,255,0.35) 24%, rgba(70,90,235,0.3) 46%, rgba(10,10,20,0) 72%)",
                }}
              />
            </div>

            <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
              {/* ===== Hero banner ===== */}
              <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141033]/90 via-[#0e1030]/80 to-[#0a0a14]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
                <div
                  className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-60 blur-3xl"
                  style={{ background: "radial-gradient(circle, rgba(124,58,237,0.45), rgba(56,189,248,0.25) 60%, transparent 70%)" }}
                />
                <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      Bienvenue sur{" "}
                      <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
                        Alex IA
                      </span>
                    </h1>
                    <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">Votre boîte à outils intelligente.</p>
                    <p className="mt-3 max-w-md text-sm text-slate-400">
                      {userName ? `Content de te revoir, ${userName}. ` : ""}Accède à des outils simples et puissants pour
                      t'accompagner au quotidien.
                    </p>

                    {/* Prompt rapide vers Alex IA */}
                    <form onSubmit={submitHeroPrompt} className="mt-6 flex max-w-lg items-center gap-2 rounded-full border border-white/10 bg-black/40 p-1.5 pl-4 backdrop-blur-xl transition focus-within:border-violet-400/40">
                      <input
                        value={heroPrompt}
                        onChange={(e) => setHeroPrompt(e.target.value)}
                        maxLength={4000}
                        placeholder="Demande quelque chose à Alex IA…"
                        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder-slate-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!heroPrompt.trim() || alexLoading}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-900/40 transition hover:scale-105 disabled:opacity-40"
                        aria-label="Envoyer à Alex IA"
                      >
                        {alexLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      </button>
                    </form>

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={goToAlex}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:scale-[1.03]"
                      >
                        Découvrir les outils
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={goToVoice}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        <AudioLines className="h-4 w-4 text-fuchsia-300" />
                        Voix IA
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="mt-8 grid max-w-lg grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-5">
                      <div className="pr-4">
                        <p className="text-2xl font-bold text-white">10</p>
                        <p className="text-xs text-slate-500">Outils disponibles</p>
                      </div>
                      <div className="px-4">
                        <p className="text-2xl font-bold text-white">5K+</p>
                        <p className="text-xs text-slate-500">Utilisateurs</p>
                      </div>
                      <div className="pl-4">
                        <p className="text-2xl font-bold text-white">99%</p>
                        <p className="text-xs text-slate-500">Satisfaction</p>
                      </div>
                    </div>
                  </div>

                  <img
                    src={alexLogo}
                    alt="Logo Alex IA"
                    width={280}
                    height={280}
                    loading="lazy"
                    decoding="async"
                    className="mx-auto hidden h-56 w-56 object-contain drop-shadow-[0_0_60px_rgba(139,92,246,0.55)] lg:block xl:h-64 xl:w-64"
                  />
                </div>
              </section>

              {/* ===== Catégories populaires ===== */}
              <section className="mt-12">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white sm:text-2xl">Catégories populaires</h2>
                  <span className="mt-2 block h-0.5 w-16 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                </div>

                {(() => {
                  const q = toolQuery.trim().toLowerCase();
                  const filtered = q
                    ? HOME_TOOLS.filter((t) => `${t.label} ${t.desc}`.toLowerCase().includes(q))
                    : HOME_TOOLS;
                  if (filtered.length === 0) {
                    return (
                      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
                        Aucun outil ne correspond à « {toolQuery} ».
                      </p>
                    );
                  }
                  const actions: Record<string, () => void> = {
                    alex: goToAlex,
                    voice: goToVoice,
                    email: goToEmail,
                    bgremove: goToBgRemove,
                    qr: goToQr,
                    codex: goToCodex,
                    library: goToLibrary,
                    theme: () => setThemeOpen(true),
                  };
                  return (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filtered.map((t) => {
                        const TIcon = t.icon;
                        const inner = (
                          <>
                            <span
                              className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${t.gradient} text-white shadow-lg`}
                            >
                              <TIcon className="h-6 w-6" />
                            </span>
                            <span className="block text-base font-semibold text-white">{t.label}</span>
                            <span className="mt-1 block text-sm text-slate-400">{t.desc}</span>
                            <span
                              className={`mt-5 inline-flex h-9 w-9 items-center justify-center self-end rounded-full bg-gradient-to-br ${t.gradient} text-white opacity-80 transition group-hover:opacity-100 group-hover:translate-x-0.5`}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </>
                        );
                        const cls =
                          "group flex flex-col items-start rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-black/40";
                        return t.href ? (
                          <a key={t.id} href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>
                            {inner}
                          </a>
                        ) : (
                          <button key={t.id} type="button" onClick={actions[t.id]} className={cls}>
                            {inner}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>

              <p className="mt-12 text-center text-xs text-slate-600">© Alex Graph — Alex IA</p>
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
        <main className="relative min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0a0a14)" }}>
          <AuroraBackground />
          <div className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:py-20">
            <header className="mb-10 text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="bg-gradient-to-r from-violet-300 via-white to-indigo-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                Analyseur de sécurité e-mail
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Obtiens un diagnostic pédagogique et 3 conseils concrets pour sécuriser ton adresse
                e-mail, sans jamais transmettre ton mot de passe.
              </p>
            </header>

            <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                Ton adresse e-mail
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="prenom.nom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#1a2138]/80 py-2.5 pl-9 pr-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/30 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyse…</>) : ("Analyser")}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Aucun mot de passe n'est demandé. Seule l'adresse est analysée pour un diagnostic général.
              </p>
            </form>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {result && (
              <section id="diagnostic-result" className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                    <ShieldCheck className="h-4 w-4" />
                    Diagnostic de sécurité
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exporter en PDF
                  </button>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  Analyse pour <span className="font-medium text-slate-300">{email}</span>
                </p>
                <article className="prose prose-invert max-w-none">{renderMarkdownDark(result)}</article>
              </section>
            )}

            {emailHistory.length > 0 && (
              <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <MessagesSquare className="h-4 w-4" />
                    Historique des analyses
                  </div>
                  <button
                    type="button"
                    onClick={clearEmailHistory}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Effacer
                  </button>
                </div>
                <ul className="flex flex-col gap-2">
                  {emailHistory.map((scan) => (
                    <li key={scan.id}>
                      <button
                        type="button"
                        onClick={() => openEmailScan(scan)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-[#141a2e]/70 px-4 py-3 text-left transition hover:border-violet-400/30 hover:bg-white/10"
                      >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-200">
                          <Mail className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-100">{scan.email}</span>
                          <span className="block text-xs text-slate-500">
                            {new Date(scan.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="mt-12 text-center text-xs text-slate-500">
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
        /* ============ VOIX IA — STUDIO AUDIO (ElevenLabs) ============ */
        <main className="relative min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
          <AuroraBackground />
          <VoiceStudio
            onHome={goHome}
            onSynthesize={(p) => voiceFn({ data: p })}
            onTranscribe={async (blob) => {
              const audio = await blobToBase64(blob);
              const res = await transcribeFn({ data: { audio, mimeType: blob.type } });
              return { text: res.text, error: res.error };
            }}
          />
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
      ) : view === "bgremove" ? (
        /* ============ RETIRER L'ARRIÈRE-PLAN — STUDIO ============ */
        <main className="relative min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
          <AuroraBackground />
          <BgRemoveStudio
            onHome={goHome}
            onRemove={async (dataUrl) => {
              const res = await removeBgFn({ data: { imageBase64: dataUrl } });
              return res.imageUrl;
            }}
          />
        </main>
      ) : view === "qr" ? (
        /* ============ GÉNÉRATEUR DE QR CODE — STUDIO ============ */
        <main className="relative min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
          <AuroraBackground />
          <QrStudio onHome={goHome} />
        </main>

      ) : view === "codex" ? (
        /* ============ CODEX — DASHBOARD + ÉDITEUR DE JEUX 2D ============ */
        activeCodexProject ? (
          <CodexEditor
            project={activeCodexProject}
            onBack={() => setActiveCodexProject(null)}
            onGenerate={iterateCodex}
            onSave={saveCodexEdits}
            onDelete={removeCodexProject}
            onDescribeFile={async (file) => {
              const dataUrl: string = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result as string);
                r.onerror = () => reject(new Error("Lecture du fichier impossible"));
                r.readAsDataURL(file);
              });
              if (file.type.startsWith("video")) {
                const res = await alexVideoFn({ data: { dataUrl, mimeType: file.type, instruction: "Décris précisément le style visuel, les couleurs, l'ambiance et les mécaniques suggérées par cette vidéo pour inspirer un jeu 2D." } });
                return (res as any).description || (res as any).text || "";
              }
              const res = await alexImageDescribeFn({ data: { dataUrl, instruction: "Décris précisément le style visuel, les couleurs, les personnages et l'ambiance de cette image pour inspirer un jeu 2D." } });
              return (res as any).description || (res as any).text || "";
            }}
          />
        ) : (
        <main className="relative min-h-screen overflow-hidden text-slate-100" style={{ background: "var(--ag-bg, #0b0f1c)" }}>
          <AuroraBackground />
          <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 pt-20 sm:py-14">
            <header className="mb-8 text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-500 to-emerald-600 text-white shadow-lg">
                <Gamepad2 className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Codex — Créateur de jeux 2D</h1>
              <p className="mx-auto mt-3 max-w-lg text-slate-400 text-sm sm:text-base">
                Décris un jeu, Codex le code et t'ouvre l'éditeur pour l'améliorer sans limites.
              </p>
            </header>

            <form onSubmit={submitCodex} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
              <label htmlFor="codexPrompt" className="mb-2 block text-sm font-medium text-slate-200">
                Décris ton jeu
              </label>
              <textarea
                id="codexPrompt"
                value={codexPrompt}
                onChange={(e) => setCodexPrompt(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Ex : un jeu type Geometry Dash où un cube saute par-dessus des piques au rythme, avec un score…"
                className="w-full resize-none rounded-xl border border-white/10 bg-[#11162a]/80 p-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-lime-400/40"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "Geometry Dash : un cube qui saute par-dessus des piques",
                  "Un serpent (Snake) coloré qui grandit",
                  "Flappy Bird avec des tuyaux",
                  "Casse-briques (Breakout) néon",
                  "Un runner infini spatial qui évite des astéroïdes",
                ].map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setCodexPrompt(idea)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-lime-400/40 hover:text-white"
                  >
                    {idea}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={codexLoading || !codexPrompt.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {codexLoading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Création du jeu…</>) : (<><Wand2 className="h-4 w-4" /> Générer et ouvrir l'éditeur</>)}
                </button>
                <p className="text-xs text-slate-500">Le jeu s'ouvrira automatiquement dans l'éditeur.</p>
              </div>
              {codexError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {codexError}
                </div>
              )}
            </form>

            {/* Projets Codex */}
            <section className="mt-10">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-white">Mes jeux</h2>
                <span className="text-xs text-slate-500">{codexProjects.length} projet{codexProjects.length > 1 ? "s" : ""}</span>
              </div>
              {!codexLoaded ? (
                <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
              ) : codexProjects.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                  Aucun jeu pour l'instant. Décris ton premier jeu ci-dessus !
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {codexProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveCodexProject(p)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-lime-400/40 hover:bg-white/10"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-black">
                        <iframe
                          title={p.name}
                          srcDoc={p.html}
                          sandbox="allow-scripts"
                          className="pointer-events-none h-full w-full scale-[0.5] origin-top-left border-0"
                          style={{ width: "200%", height: "200%" }}
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{p.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-10 text-center text-xs text-slate-500">© Alex Graph — Codex, création de jeux 2D</p>
          </div>
        </main>
        )

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
          <aside className={`relative z-10 flex-col border-b border-white/5 bg-[#11162a]/80 backdrop-blur-xl sm:border-b-0 sm:border-r ${sidebarCollapsed ? "hidden" : "flex w-full sm:w-72"}`}>
            <div className="flex items-center gap-2.5 px-5 pb-4 pt-20 sm:pt-6">
              <img src={alexLogo} alt="Alex IA" className="h-9 w-9 rounded-lg object-contain" />
              <p className="text-base font-semibold tracking-tight">Alex IA</p>
              <button type="button" onClick={() => setSidebarCollapsed(true)} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Réduire le panneau">
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
              <button
                type="button"
                onClick={() => setChatSearchOpen((v) => !v)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/5 ${chatSearchOpen ? "text-white" : "text-slate-300"}`}
              >
                <Search className="h-4 w-4" />
                Search chats
              </button>
              {chatSearchOpen && (
                <div className="relative mt-1 px-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    autoFocus
                    type="text"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Rechercher une conversation…"
                    className="w-full rounded-lg border border-white/10 bg-[#0d1122]/80 py-2 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-violet-400/40"
                  />
                </div>
              )}
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
              {(() => {
                const q = chatSearch.trim().toLowerCase();
                const filtered = q ? alexConvs.filter((c) => c.title.toLowerCase().includes(q)) : alexConvs;
                if (alexConvs.length === 0) {
                  return <p className="px-3 py-2 text-xs text-slate-500">Aucune conversation.</p>;
                }
                if (filtered.length === 0) {
                  return <p className="px-3 py-2 text-xs text-slate-500">Aucun résultat pour « {chatSearch} ».</p>;
                }
                return filtered.map((c) => (
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
                ));
              })()}
            </div>
          </aside>

          {/* Bouton de réouverture du panneau (quand replié) */}
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="fixed left-4 top-16 z-30 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#11162a]/90 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-xl transition hover:bg-white/10"
              aria-label="Afficher le panneau"
            >
              <PanelLeft className="h-4 w-4" /> Panneau
            </button>
          )}


          {/* Chat area */}
          <section className="relative z-10 flex flex-1 flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 pl-20 sm:pl-6">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-slate-200">Alex</span>
                {/* Sélecteur de modèle (façon Mammouth IA) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                    title="Changer de modèle IA"
                  >
                    <Cpu className="h-3.5 w-3.5 text-violet-300" />
                    {getAlexModel(alexModel).label}
                    {getAlexModel(alexModel).fast && <Zap className="h-3 w-3 text-amber-300" />}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${modelMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {modelMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                      <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#141a2e] p-1.5 shadow-2xl shadow-black/50">
                        <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Choisis ton modèle IA
                        </p>
                        {ALEX_MODELS.map((m) => {
                          const active = m.id === alexModel;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setAlexModel(m.id); setModelMenuOpen(false); }}
                              className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                                active ? "bg-violet-600/25 ring-1 ring-violet-400/40" : "hover:bg-white/5"
                              }`}
                            >
                              <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${m.fast ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-indigo-500 to-violet-600"} text-white`}>
                                {m.fast ? <Zap className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                                  {m.label}
                                  {active && <Check className="h-3.5 w-3.5 text-violet-300" />}
                                </span>
                                <span className="block text-xs text-slate-400">{m.desc}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages or hero */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8">
              {(!currentConv || currentConv.messages.length <= 1) ? (
                <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center pb-32 text-center">
                  <img src={alexLogo} alt="Alex IA" className="mb-6 h-16 w-16 rounded-2xl object-contain drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]" />
                  <h1 className="bg-gradient-to-r from-violet-300 via-white to-indigo-300 bg-clip-text text-3xl font-light tracking-tight text-transparent sm:text-4xl">
                    Comment puis-je vous aider ?
                  </h1>
                  <p className="mt-3 text-sm text-slate-400">Pose une question, génère une image, ou explore une idée.</p>

                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                    {[
                      { icon: PenLine, label: "Rédiger un texte", prompt: "Aide-moi à rédiger un texte clair et professionnel sur : ", g: "from-violet-500 to-indigo-600" },
                      { icon: Code2, label: "Coder une fonction", prompt: "Écris-moi une fonction qui ", g: "from-sky-500 to-cyan-600" },
                      { icon: ImageIcon, label: "Générer une image", prompt: "Génère une image de ", g: "from-fuchsia-500 to-pink-600" },
                      { icon: GraduationCap, label: "Expliquer simplement", prompt: "Explique-moi simplement : ", g: "from-amber-500 to-orange-600" },
                    ].map((qa) => {
                      const QIcon = qa.icon;
                      return (
                        <button
                          key={qa.label}
                          type="button"
                          onClick={() => setAlexInput(qa.prompt)}
                          className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
                        >
                          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${qa.g} text-white`}>
                            <QIcon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{qa.label}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
                        </button>
                      );
                    })}
                  </div>
                </div>

              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-5 py-6">
                  {currentConv.messages.map((m, i) => (
                    <div key={i} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${m.role === "assistant" ? "bg-violet-500/15" : "bg-white/10"}`}>
                        {m.role === "assistant" ? <img src={alexLogo} alt="Alex" className="h-full w-full object-contain p-1" /> : <User className="h-4 w-4 text-white" />}
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
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-violet-500/15">
                        <img src={alexLogo} alt="Alex" className="h-full w-full object-contain p-1" />
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

                  {/* Chat vocal temps réel (style ChatGPT Voice Mode) */}
                  {vocal.supported && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceChatOn((v) => {
                          const next = !v;
                          if (!next) {
                            vocal.stopConversation();
                          } else {
                            lastSpokenRef.current = currentConv?.messages.length ?? 0;
                            vocal.startConversation();
                          }
                          return next;
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        voiceChatOn
                          ? "border-fuchsia-400/50 bg-fuchsia-600/30 text-white"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                      title="Discute à la voix avec Alex (parle, il te répond à voix haute)"
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      Chat vocal
                    </button>
                  )}
                  {voiceChatOn && vocal.supported && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setVoiceMenuOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                        title="Choisir la voix"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        {vocal.voices.find((v) => v.voiceURI === vocal.voiceURI)?.name?.split(" ")[0] ?? "Voix"}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {voiceMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setVoiceMenuOpen(false)} />
                          <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-60 overflow-y-auto rounded-2xl border border-white/10 bg-[#141a2e] p-1.5 shadow-2xl shadow-black/50">
                            <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Voix de lecture</p>
                            {vocal.voices.length === 0 && (
                              <p className="px-2.5 py-2 text-xs text-slate-400">Aucune voix disponible.</p>
                            )}
                            {vocal.voices.map((v) => (
                              <button
                                key={v.voiceURI}
                                type="button"
                                onClick={() => { vocal.setVoiceURI(v.voiceURI); setVoiceMenuOpen(false); }}
                                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${
                                  v.voiceURI === vocal.voiceURI ? "bg-violet-600/25 text-white ring-1 ring-violet-400/40" : "text-slate-300 hover:bg-white/5"
                                }`}
                              >
                                <span className="truncate">{v.name}</span>
                                <span className="flex-shrink-0 text-[10px] text-slate-500">{v.lang}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {voiceChatOn && vocal.speaking && (
                    <button
                      type="button"
                      onClick={vocal.stopSpeaking}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-600/30"
                    >
                      <VolumeX className="h-3.5 w-3.5" />
                      Couper la voix
                    </button>
                  )}
                </div>


                <input
                  ref={alexFileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.txt,.md,.markdown,.csv,.json,.log,.tsv,.html,.xml,.rtf,text/*,application/pdf"
                  onChange={handleAlexFile}
                  className="hidden"
                />

                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#1a2138]/90 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl transition focus-within:border-violet-400/40">
                  <button
                    type="button"
                    onClick={() => alexFileInputRef.current?.click()}
                    disabled={alexLoading}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                    aria-label="Importer un fichier"
                    title="Importer une image, un PDF ou une vidéo"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlexImageMode((v) => !v)}
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
                      alexImageMode ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/10"
                    }`}
                    aria-label="Mode génération d'image"
                    title={alexImageMode ? "Génération d'image activée" : "Générer une image"}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    value={alexInput}
                    onChange={(e) => setAlexInput(e.target.value)}
                    placeholder={alexImageMode ? "Décris l'image à générer…" : "Ask Alex"}
                    className="flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                  />
                  <span className="hidden h-2 w-2 rounded-full bg-violet-400 sm:block" />
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((v) => !v)}
                    className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/10 sm:flex"
                    title="Changer de modèle IA"
                  >
                    {getAlexModel(alexModel).badge}
                    <ChevronDown className="h-3 w-3 text-slate-500" />
                  </button>
                  {/* Micro chat vocal temps réel (Web Speech API) — visible en mode vocal */}
                  {voiceChatOn && vocal.supported && (
                    <button
                      type="button"
                      onClick={() => (vocal.listening ? vocal.stopListening() : vocal.startListening())}
                      disabled={alexLoading}
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                        vocal.listening
                          ? "animate-pulse bg-fuchsia-500 text-white ring-4 ring-fuchsia-500/30"
                          : "bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white hover:scale-105"
                      }`}
                      aria-label={vocal.listening ? "Arrêter l'écoute" : "Parler à Alex"}
                      title={vocal.listening ? "J'écoute… clique pour arrêter" : "Parle à Alex"}
                    >
                      {vocal.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
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
                    title={alexRecording ? "Arrête de parler pour transcrire" : "Dicter du texte (transcription)"}
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
                  {vocal.listening
                    ? "🎙️ Je t'écoute… parle, puis clique sur ⏹ ou fais une pause."
                    : vocal.speaking
                      ? "🔊 Alex te répond à voix haute…"
                      : voiceChatOn
                        ? "Mode vocal actif — clique sur le micro rose pour parler à Alex."
                        : alexRecording
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

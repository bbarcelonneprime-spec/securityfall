// Voix IA — studio audio (ElevenLabs) : texte → voix et voix → texte.
// Interface large avec sélection de voix, langue, vitesse et ton.
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AudioLines,
  Copy,
  Download,
  FileText,
  Gauge,
  Globe,
  Home,
  Loader2,
  Mic,
  Play,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Wand2,
} from "lucide-react";
import { VOICE_OPTIONS } from "@/lib/voice.functions";

type VoiceMeta = { id: string; name: string; tag: string; accent: string };

const VOICE_META: VoiceMeta[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", tag: "Chaleureux", accent: "from-violet-500 to-fuchsia-500" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", tag: "Douce", accent: "from-pink-500 to-rose-500" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", tag: "Claire", accent: "from-sky-500 to-cyan-500" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", tag: "Élégante", accent: "from-amber-500 to-orange-500" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", tag: "Posé", accent: "from-emerald-500 to-teal-500" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", tag: "Vive", accent: "from-lime-500 to-green-500" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", tag: "Profond", accent: "from-indigo-500 to-blue-600" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", tag: "Naturelle", accent: "from-fuchsia-500 to-purple-600" },
];

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "Anglais" },
  { code: "es", label: "Espagnol" },
  { code: "de", label: "Allemand" },
  { code: "it", label: "Italien" },
  { code: "pt", label: "Portugais" },
  { code: "ar", label: "Arabe" },
];

const TONES = [
  { id: "neutre", label: "Neutre", style: 0.15 },
  { id: "expressif", label: "Expressif", style: 0.55 },
  { id: "dramatique", label: "Dramatique", style: 0.85 },
  { id: "calme", label: "Calme", style: 0.05 },
];

export type SynthResult = { audio: string | null; error: string | null };
export type TranscribeResult = { text: string; error: string | null };

type Props = {
  onHome: () => void;
  onSynthesize: (p: { text: string; voiceId: string; speed: number; style: number }) => Promise<SynthResult>;
  onTranscribe: (blob: Blob) => Promise<TranscribeResult>;
};

export default function VoiceStudio({ onHome, onSynthesize, onTranscribe }: Props) {
  const [mode, setMode] = useState<"tts" | "stt">("tts");
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(VOICE_META[0].id);
  const [lang, setLang] = useState("fr");
  const [speed, setSpeed] = useState(1);
  const [tone, setTone] = useState("expressif");
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recording) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const selectedVoice = VOICE_META.find((v) => v.id === voiceId) ?? VOICE_META[0];
  const selectedTone = TONES.find((t) => t.id === tone) ?? TONES[1];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setError(null);
    setAudio(null);
    setLoading(true);
    try {
      const res = await onSynthesize({ text: text.trim(), voiceId, speed, style: selectedTone.style });
      if (res.error) setError(res.error);
      else setAudio(res.audio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de génération vocale.");
    } finally {
      setLoading(false);
    }
  };

  const startRec = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setTranscribing(true);
        try {
          const res = await onTranscribe(blob);
          if (res.error) setError(res.error);
          else setTranscript((prev) => (prev ? `${prev} ${res.text}` : res.text));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur de transcription.");
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Impossible d'accéder au micro. Autorise l'accès au microphone.");
    }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 backdrop-blur-xl transition hover:bg-white/10"
          aria-label="Accueil"
        >
          <Home className="h-4 w-4" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg">
          <AudioLines className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Voix IA</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">Studio audio réaliste — synthèse et transcription</p>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 backdrop-blur sm:inline-flex">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" /> ElevenLabs
        </span>
      </div>

      {/* Mode switch */}
      <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMode("tts")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${mode === "tts" ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow" : "text-slate-300 hover:text-white"}`}
        >
          <Volume2 className="h-4 w-4" /> Texte → Voix
        </button>
        <button
          type="button"
          onClick={() => setMode("stt")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${mode === "stt" ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow" : "text-slate-300 hover:text-white"}`}
        >
          <Mic className="h-4 w-4" /> Voix → Texte
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {mode === "tts" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Main card */}
          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <label htmlFor="vsText" className="text-sm font-medium text-slate-200">Ton texte</label>
              <span className="text-xs text-slate-500">{text.length}/5000</span>
            </div>
            <textarea
              id="vsText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              maxLength={5000}
              placeholder="Écris ou colle le texte à transformer en voix…"
              className="w-full resize-none rounded-2xl border border-white/10 bg-[#0d1122]/80 px-4 py-3.5 text-sm leading-relaxed text-slate-100 placeholder-slate-500 outline-none transition focus:border-fuchsia-400/40"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Génération…</>) : (<><Play className="h-4 w-4" /> Générer la voix</>)}
              </button>
              {text && (
                <button
                  type="button"
                  onClick={() => { setText(""); setAudio(null); }}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" /> Effacer
                </button>
              )}
            </div>

            {audio && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0d1122]/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${selectedVoice.accent} text-[10px] font-bold text-white`}>
                    {selectedVoice.name[0]}
                  </span>
                  {selectedVoice.name} · {selectedTone.label} · ×{speed.toFixed(2)}
                </div>
                <audio controls autoPlay src={audio} className="w-full">Ton navigateur ne supporte pas l'audio.</audio>
                <a
                  href={audio}
                  download="voix-ia.mp3"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-fuchsia-300 hover:text-fuchsia-200"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger le MP3
                </a>
              </div>
            )}
          </form>

          {/* Options panel */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Wand2 className="h-3.5 w-3.5" /> Voix
              </p>
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                {VOICE_META.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceId(v.id)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${voiceId === v.id ? "border-fuchsia-400/50 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}
                  >
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${v.accent} text-xs font-bold text-white`}>
                      {v.name[0]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-100">{v.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{v.tag}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <label htmlFor="vsLang" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Globe className="h-3.5 w-3.5" /> Langue
              </label>
              <select
                id="vsLang"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-fuchsia-400/40"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#0d1122]">{l.label}</option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-slate-500">Le modèle multilingue détecte aussi la langue du texte.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Vitesse</span>
                <span className="text-slate-300">×{speed.toFixed(2)}</span>
              </p>
              <input
                type="range"
                min={0.7}
                max={1.2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-fuchsia-500"
              />
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Ton</p>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${tone === t.id ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <button
              type="button"
              onClick={recording ? stopRec : startRec}
              disabled={transcribing}
              className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 disabled:opacity-50 ${recording ? "bg-red-600" : "bg-gradient-to-br from-fuchsia-500 to-violet-600"}`}
              aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
            >
              {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
              {recording ? <Square className="h-8 w-8" /> : transcribing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-9 w-9" />}
            </button>
            <p className="text-center text-sm text-slate-400">
              {recording
                ? `Enregistrement… ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
                : transcribing
                  ? "Transcription en cours…"
                  : "Clique sur le micro et parle."}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                <FileText className="h-4 w-4" /> Transcription
              </span>
              <div className="flex items-center gap-3">
                {transcript && (
                  <>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(transcript)} className="inline-flex items-center gap-1 text-xs font-medium text-fuchsia-300 hover:text-fuchsia-200">
                      <Copy className="h-3.5 w-3.5" /> Copier
                    </button>
                    <button type="button" onClick={() => setTranscript("")} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200">
                      <Trash2 className="h-3.5 w-3.5" /> Effacer
                    </button>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={11}
              placeholder="Le texte transcrit apparaîtra ici…"
              className="w-full resize-none rounded-2xl border border-white/10 bg-[#0d1122]/80 px-4 py-3.5 text-sm leading-relaxed text-slate-100 placeholder-slate-500 outline-none transition focus:border-fuchsia-400/40"
            />
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-slate-500">
        {VOICE_OPTIONS.length} voix disponibles · Propulsé par ElevenLabs — © Alex Graph
      </p>
    </div>
  );
}

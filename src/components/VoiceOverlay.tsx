import { Mic, X, Square, Loader2, AudioLines, Settings2 } from "lucide-react";
import { useState } from "react";

type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";

type VoiceOverlayProps = {
  status: VoiceStatus;
  level: number; // 0..1 amplitude micro
  lastUser: string | null;
  lastAssistant: string | null;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  onSelectVoice: (uri: string) => void;
  onInterrupt: () => void; // couper la parole de l'IA / relancer l'écoute
  onClose: () => void;
};

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Prêt à discuter",
  listening: "Je t'écoute…",
  thinking: "Je réfléchis…",
  speaking: "Alex parle…",
};

export default function VoiceOverlay({
  status,
  level,
  lastUser,
  lastAssistant,
  voices,
  voiceURI,
  onSelectVoice,
  onInterrupt,
  onClose,
}: VoiceOverlayProps) {
  const [voiceMenu, setVoiceMenu] = useState(false);

  // Échelle de l'orbe : réagit au niveau micro en écoute, pulse en parole.
  const scale =
    status === "listening"
      ? 1 + level * 0.6
      : status === "speaking"
        ? 1.14
        : status === "thinking"
          ? 1.05
          : 1;

  const ringColor =
    status === "listening"
      ? "from-emerald-400 via-teal-400 to-cyan-500"
      : status === "speaking"
        ? "from-fuchsia-500 via-violet-500 to-indigo-500"
        : status === "thinking"
          ? "from-amber-400 via-orange-400 to-pink-500"
          : "from-slate-400 via-slate-500 to-slate-600";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-[#06060c]/95 px-6 py-10 backdrop-blur-2xl">
      {/* Halos d'arrière-plan animés */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-transparent blur-3xl" />
      </div>

      {/* Barre supérieure */}
      <div className="relative z-10 flex w-full max-w-3xl items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
          <AudioLines className="h-4 w-4 text-fuchsia-400" />
          Chat vocal
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setVoiceMenu((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="Paramètres de voix"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            {voiceMenu && (
              <div className="absolute right-0 top-12 z-20 max-h-72 w-60 overflow-y-auto rounded-2xl border border-white/10 bg-[#11111d] p-2 shadow-2xl">
                <p className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-slate-500">Voix de synthèse</p>
                {voices.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">Aucune voix disponible.</p>}
                {voices.map((v) => (
                  <button
                    key={v.voiceURI}
                    type="button"
                    onClick={() => {
                      onSelectVoice(v.voiceURI);
                      setVoiceMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      v.voiceURI === voiceURI
                        ? "bg-violet-600/25 text-white ring-1 ring-violet-400/40"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                    <span className="ml-2 flex-shrink-0 text-[10px] text-slate-500">{v.lang}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Fermer le chat vocal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Orbe central réactif */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* Anneaux pulsants */}
          <div
            className={`absolute rounded-full bg-gradient-to-br ${ringColor} opacity-20 blur-2xl transition-transform duration-300`}
            style={{ width: 300, height: 300, transform: `scale(${scale})` }}
          />
          {(status === "listening" || status === "speaking") && (
            <>
              <span className={`absolute rounded-full border border-white/10`} style={{ width: 260, height: 260, animation: "voice-ping 2.4s cubic-bezier(0,0,0.2,1) infinite" }} />
              <span className={`absolute rounded-full border border-white/10`} style={{ width: 260, height: 260, animation: "voice-ping 2.4s cubic-bezier(0,0,0.2,1) infinite 1.2s" }} />
            </>
          )}
          {/* Orbe */}
          <div
            className={`relative flex h-52 w-52 items-center justify-center rounded-full bg-gradient-to-br ${ringColor} shadow-2xl transition-transform duration-200`}
            style={{ transform: `scale(${scale})`, animation: status === "speaking" ? "voice-breathe 1.6s ease-in-out infinite" : undefined }}
          >
            <div className="flex h-44 w-44 items-center justify-center rounded-full bg-[#06060c]/70 backdrop-blur-sm">
              {status === "thinking" ? (
                <Loader2 className="h-12 w-12 animate-spin text-white/90" />
              ) : (
                <AudioLines className="h-14 w-14 text-white/90" />
              )}
            </div>
          </div>
        </div>

        <p className="text-lg font-medium text-white">{STATUS_LABEL[status]}</p>

        {/* Dernières répliques */}
        <div className="min-h-[3.5rem] w-full max-w-xl space-y-1 text-center">
          {lastUser && <p className="text-sm text-slate-400">« {lastUser} »</p>}
          {lastAssistant && (
            <p className="line-clamp-3 text-sm text-slate-200">{lastAssistant}</p>
          )}
        </div>
      </div>

      {/* Contrôles bas */}
      <div className="relative z-10 flex w-full max-w-3xl items-center justify-center gap-6">
        {status === "speaking" ? (
          <button
            type="button"
            onClick={onInterrupt}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <Square className="h-4 w-4" /> Interrompre
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm text-slate-300">
            <Mic className="h-4 w-4 text-emerald-400" /> Parle naturellement, je réponds
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:scale-105 hover:bg-red-600"
          aria-label="Terminer"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

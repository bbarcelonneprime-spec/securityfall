// Hook de chat vocal temps réel (style ChatGPT Voice Mode) basé sur les
// API natives du navigateur : SpeechRecognition (voix → texte) et
// speechSynthesis (texte → voix). Aucune clé API, tout côté client.
// Isolé ici pour n'être utilisé que par l'outil Chatbot (Alex IA).
//
// Mode conversation continue : une fois activé, le micro se relance
// automatiquement après chaque réponse parlée de l'IA, et l'utilisateur peut
// interrompre l'IA en parlant (barge-in).
import { useCallback, useEffect, useRef, useState } from "react";

// Types minimaux pour SpeechRecognition (non typé par TS par défaut).
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type UseVocalChatOptions = {
  onTranscript: (text: string) => void;
  lang?: string;
};

export function useVocalChat({ onTranscript, lang = "fr-FR" }: UseVocalChatOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [conversation, setConversation] = useState(false);
  const [level, setLevel] = useState(0); // 0..1 amplitude micro (pour les ondes)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startingRef = useRef(false);
  const retryRef = useRef<number | null>(null);
  const finalRef = useRef("");

  const conversationRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Analyse audio pour visualiser le niveau du micro (ondes réactives).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const SR = getRecognitionCtor();
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    setSupported(Boolean(SR) && Boolean(synth));
    if (!synth) return;

    const loadVoices = () => {
      const v = synth.getVoices();
      if (v.length === 0) return;
      setVoices(v);
      setVoiceURI((prev) => {
        if (prev && v.some((x) => x.voiceURI === prev)) return prev;
        const fr = v.find((x) => x.lang.toLowerCase().startsWith("fr"));
        return (fr ?? v[0]).voiceURI;
      });
    };
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener?.("voiceschanged", loadVoices);
      synth.cancel();
    };
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    if (analyserRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel((prev) => prev * 0.7 + Math.min(1, rms * 3.2) * 0.3);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Micro refusé : on continue sans visualisation.
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // Démarre une session d'écoute (une phrase). En mode conversation, se relance
  // automatiquement via onend. Robuste contre les doubles-start (InvalidStateError),
  // les relances concurrentes et les timers orphelins.
  const startListening = useCallback(() => {
    const SR = getRecognitionCtor();
    if (!SR) return;
    // Une session est déjà active (ou en cours de démarrage) : on ne relance pas.
    if (recognitionRef.current || startingRef.current) return;
    // L'IA parle encore : on réessaie plus tard (un seul timer en vol).
    if (window.speechSynthesis?.speaking) {
      if (retryRef.current == null) {
        retryRef.current = window.setTimeout(() => {
          retryRef.current = null;
          if (conversationRef.current && !window.speechSynthesis?.speaking) startListening();
        }, 300);
      }
      return;
    }

    startingRef.current = true;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    finalRef.current = "";

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      finalRef.current = text;
    };
    rec.onerror = (evt: unknown) => {
      const err = (evt as { error?: string })?.error;
      // "no-speech" / "aborted" sont bénins : on relance simplement en conversation.
      if (err && err !== "no-speech" && err !== "aborted") {
        console.warn("SpeechRecognition error:", err);
      }
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      startingRef.current = false;
      recognitionRef.current = null;
      const t = finalRef.current.trim();
      finalRef.current = "";
      if (t) {
        onTranscriptRef.current(t);
      } else if (conversationRef.current) {
        // Silence : on relance l'écoute après un court délai (évite le busy-loop).
        if (retryRef.current == null) {
          retryRef.current = window.setTimeout(() => {
            retryRef.current = null;
            if (conversationRef.current && !window.speechSynthesis?.speaking && !recognitionRef.current) {
              startListening();
            }
          }, 500);
        }
      }
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
      void startMeter();
    } catch (e) {
      // InvalidStateError si déjà démarré : on ignore proprement.
      console.warn("rec.start failed:", (e as Error).message);
      recognitionRef.current = null;
      startingRef.current = false;
      setListening(false);
    }
  }, [lang, startMeter]);


  const speak = useCallback(
    (text: string) => {
      const synth = window.speechSynthesis;
      if (!synth || !text.trim()) return;
      synth.cancel();
      const clean = text
        .replace(/```[\s\S]*?```/g, " (bloc de code) ")
        .replace(/[#*`_>~]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/\n{2,}/g, ". ")
        .trim();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) u.voice = v;
      u.rate = 1.02;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        // Conversation continue : relance automatiquement l'écoute.
        if (conversationRef.current) {
          window.setTimeout(() => {
            if (conversationRef.current) startListening();
          }, 250);
        }
      };
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    },
    [lang, voiceURI, voices, startListening],
  );

  // Démarre / arrête le mode conversation continue.
  const startConversation = useCallback(() => {
    conversationRef.current = true;
    setConversation(true);
    startListening();
  }, [startListening]);

  const stopConversation = useCallback(() => {
    conversationRef.current = false;
    setConversation(false);
    if (retryRef.current != null) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    startingRef.current = false;
    finalRef.current = "";
    window.speechSynthesis?.cancel();
    setListening(false);
    setSpeaking(false);
    stopMeter();
  }, [stopMeter]);


  useEffect(() => () => stopMeter(), [stopMeter]);

  return {
    supported,
    listening,
    speaking,
    conversation,
    level,
    voices,
    voiceURI,
    setVoiceURI,
    startListening,
    stopListening,
    startConversation,
    stopConversation,
    speak,
    stopSpeaking,
  };
}

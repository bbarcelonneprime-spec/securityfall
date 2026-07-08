// Hook de chat vocal temps réel (style ChatGPT Voice Mode) basé sur les
// API natives du navigateur : SpeechRecognition (voix → texte) et
// speechSynthesis (texte → voix). Aucune clé API, tout côté client.
// Isolé ici pour n'être utilisé que par l'outil Chatbot (Alex IA).
import { useCallback, useEffect, useRef, useState } from "react";

// Types minimaux pour SpeechRecognition (non typé par TS par défaut).
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

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

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = window.speechSynthesis;
      if (!synth || !text.trim()) return;
      synth.cancel();
      // Nettoie le markdown pour une lecture naturelle.
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
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    },
    [lang, voiceURI, voices],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = getRecognitionCtor();
    if (!SR) return;
    // Coupe toute lecture en cours pour éviter que le micro capte la voix de l'IA.
    window.speechSynthesis?.cancel();
    setSpeaking(false);

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
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      const t = finalRef.current.trim();
      if (t) onTranscriptRef.current(t);
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [lang]);

  return {
    supported,
    listening,
    speaking,
    voices,
    voiceURI,
    setVoiceURI,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}

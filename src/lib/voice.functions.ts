import { createServerFn } from "@tanstack/react-start";

// A curated, multilingual-friendly set of ElevenLabs voices.
export const VOICE_OPTIONS = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (chaleureux)" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (douce)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura (claire)" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (élégante)" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (posé)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (vive)" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian (profond)" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice (naturelle)" },
] as const;

const VALID_VOICE_IDS = new Set<string>(VOICE_OPTIONS.map((v) => v.id));

const ELEVENLABS_KEY_HELP =
  "Clé ElevenLabs invalide : colle uniquement ta clé API commençant par sk_ dans le secret ELEVENLABS_API_KEY.";

export const synthesizeVoice = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; voiceId?: string; speed?: number; style?: number; stability?: number }) => {
    if (!data?.text || typeof data.text !== "string" || !data.text.trim()) {
      throw new Error("Texte invalide.");
    }
    if (data.text.length > 5000) throw new Error("Texte trop long (5000 caractères max).");
    const voiceId =
      typeof data.voiceId === "string" && VALID_VOICE_IDS.has(data.voiceId)
        ? data.voiceId
        : "JBFqnCBsd6RMkjVDRZzb";
    const clamp = (v: unknown, min: number, max: number, def: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
    return {
      text: data.text.trim(),
      voiceId,
      speed: clamp(data.speed, 0.7, 1.2, 1),
      style: clamp(data.style, 0, 1, 0.3),
      stability: clamp(data.stability, 0, 1, 0.5),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return { audio: null, error: "ELEVENLABS_API_KEY manquante." };

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: data.stability,
            similarity_boost: 0.75,
            style: data.style,
            use_speaker_boost: true,
            speed: data.speed,
          },
        }),
      },
    );


    if (res.status === 401) return { audio: null, error: ELEVENLABS_KEY_HELP };
    if (res.status === 429) return { audio: null, error: "Trop de requêtes. Réessaie dans un instant." };
    if (!res.ok) {
      console.error("ElevenLabs TTS error:", res.status, await res.text());
      return { audio: null, error: "Erreur de génération vocale." };
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { audio: `data:audio/mpeg;base64,${base64}`, error: null };
  });

// Speech-to-Text via ElevenLabs Scribe.
export const transcribeVoice = createServerFn({ method: "POST" })
  .inputValidator((data: { audio: string; mimeType?: string }) => {
    if (!data?.audio || typeof data.audio !== "string") {
      throw new Error("Audio invalide.");
    }
    // Strip optional data URI prefix.
    const base64 = data.audio.includes(",") ? data.audio.split(",").pop()! : data.audio;
    if (base64.length > 30_000_000) throw new Error("Audio trop volumineux (25 Mo max).");
    const mimeType =
      typeof data.mimeType === "string" && /^audio\//.test(data.mimeType)
        ? data.mimeType
        : "audio/webm";
    return { base64, mimeType };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return { text: "", language: null, error: "ELEVENLABS_API_KEY manquante." };

    const bytes = Buffer.from(data.base64, "base64");
    const ext = data.mimeType.includes("mp4")
      ? "mp4"
      : data.mimeType.includes("mpeg")
        ? "mp3"
        : data.mimeType.includes("wav")
          ? "wav"
          : "webm";

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mimeType }), `audio.${ext}`);
    form.append("model_id", "scribe_v1");
    form.append("tag_audio_events", "false");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (res.status === 401) return { text: "", language: null, error: ELEVENLABS_KEY_HELP };
    if (res.status === 429) return { text: "", language: null, error: "Trop de requêtes. Réessaie dans un instant." };
    if (!res.ok) {
      console.error("ElevenLabs STT error:", res.status, await res.text());
      return { text: "", language: null, error: "Erreur de transcription." };
    }

    const json = (await res.json()) as { text?: string; language_code?: string };
    return { text: json.text?.trim() ?? "", language: json.language_code ?? null, error: null };
  });

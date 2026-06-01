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

export const synthesizeVoice = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; voiceId?: string }) => {
    if (!data?.text || typeof data.text !== "string" || !data.text.trim()) {
      throw new Error("Texte invalide.");
    }
    if (data.text.length > 5000) throw new Error("Texte trop long (5000 caractères max).");
    const voiceId =
      typeof data.voiceId === "string" && VALID_VOICE_IDS.has(data.voiceId)
        ? data.voiceId
        : "JBFqnCBsd6RMkjVDRZzb";
    return { text: data.text.trim(), voiceId };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY manquante.");

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
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (res.status === 401) throw new Error("Clé ElevenLabs invalide.");
    if (res.status === 429) throw new Error("Trop de requêtes. Réessaie dans un instant.");
    if (!res.ok) {
      console.error("ElevenLabs TTS error:", res.status, await res.text());
      throw new Error("Erreur de génération vocale.");
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { audio: `data:audio/mpeg;base64,${base64}` };
  });

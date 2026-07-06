import { createServerFn } from "@tanstack/react-start";

// Suppression d'arrière-plan d'une image via l'API remove.bg.
// Reçoit une image en base64 (data URL ou base64 brut) et renvoie un PNG
// transparent en data URL.
export const removeBackground = createServerFn({ method: "POST" })
  .inputValidator((data: { imageBase64: string }) => {
    if (!data?.imageBase64 || typeof data.imageBase64 !== "string") {
      throw new Error("Image invalide.");
    }
    return { imageBase64: data.imageBase64 };
  })
  .handler(async ({ data }) => {
    const key = process.env.REMOVE_BG_API_KEY;
    if (!key) throw new Error("Clé de suppression d'arrière-plan manquante.");

    const base64 = data.imageBase64.includes(",")
      ? data.imageBase64.split(",")[1]
      : data.imageBase64;

    const form = new FormData();
    form.append("image_file_b64", base64);
    form.append("size", "auto");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": key },
      body: form,
    });

    if (res.status === 402) throw new Error("Crédits de suppression d'arrière-plan épuisés.");
    if (res.status === 429) throw new Error("Trop de requêtes. Réessaie dans un instant.");
    if (res.status === 400) throw new Error("Impossible de traiter cette image. Essaie une autre photo.");
    if (!res.ok) {
      console.error("remove.bg error:", res.status, await res.text());
      throw new Error("Erreur lors de la suppression de l'arrière-plan.");
    }

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    return { imageUrl: `data:image/png;base64,${b64}` };
  });

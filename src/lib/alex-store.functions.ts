import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "alex-images";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 an

type StoredMsg = { role: "user" | "assistant"; content: string; imageUrl?: string };

function imagePath(userId: string, id: string) {
  return `${userId}/${id}.png`;
}

// Récupère toutes les conversations + la bibliothèque d'images de l'utilisateur
export const fetchAlexData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [convRes, imgRes] = await Promise.all([
      supabase
        .from("alex_conversations")
        .select("id, title, messages, created_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("alex_images")
        .select("id, prompt, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (convRes.error) throw new Error(convRes.error.message);
    if (imgRes.error) throw new Error(imgRes.error.message);

    const conversations = (convRes.data ?? []).map((c) => ({
      id: c.id as string,
      title: c.title as string,
      messages: (c.messages as StoredMsg[]) ?? [],
      createdAt: new Date(c.created_at as string).getTime(),
    }));

    // Génère des URLs signées fraîches pour la bibliothèque
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const images = await Promise.all(
      (imgRes.data ?? []).map(async (img) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(imagePath(userId, img.id as string), SIGNED_URL_TTL);
        return {
          id: img.id as string,
          prompt: img.prompt as string,
          imageUrl: signed?.signedUrl ?? "",
          createdAt: new Date(img.created_at as string).getTime(),
        };
      }),
    );

    return { conversations, images: images.filter((i) => i.imageUrl) };
  });

// Enregistre (crée ou met à jour) une conversation
export const upsertAlexConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; title: string; messages: StoredMsg[]; createdAt?: number }) => {
    if (!data?.id || typeof data.id !== "string") throw new Error("Conversation invalide.");
    const messages = Array.isArray(data.messages) ? data.messages.slice(-200) : [];
    return {
      id: data.id.slice(0, 120),
      title: (typeof data.title === "string" ? data.title : "Nouvelle conversation").slice(0, 200),
      messages,
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("alex_conversations").upsert(
      {
        id: data.id,
        user_id: userId,
        title: data.title,
        messages: data.messages,
        created_at: new Date(data.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Supprime une conversation
export const deleteAlexConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id || typeof data.id !== "string") throw new Error("Conversation invalide.");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("alex_conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Sauvegarde une image générée dans la bibliothèque (stockage + base de données)
export const saveAlexImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { prompt: string; dataUrl: string }) => {
    if (!data?.dataUrl || typeof data.dataUrl !== "string" || !data.dataUrl.startsWith("data:image/")) {
      throw new Error("Image invalide.");
    }
    return {
      prompt: (typeof data.prompt === "string" ? data.prompt : "").slice(0, 2000),
      dataUrl: data.dataUrl,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Crée d'abord la ligne pour obtenir un id stable
    const { data: row, error: insertErr } = await supabase
      .from("alex_images")
      .insert({ user_id: userId, prompt: data.prompt, image_url: "pending" })
      .select("id, prompt, created_at")
      .single();
    if (insertErr || !row) throw new Error(insertErr?.message ?? "Échec de l'enregistrement.");

    const id = row.id as string;
    const base64 = data.dataUrl.split(",")[1] ?? "";
    const bytes = Buffer.from(base64, "base64");
    const path = imagePath(userId, id);

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) {
      await supabase.from("alex_images").delete().eq("id", id);
      throw new Error(upErr.message);
    }

    await supabase.from("alex_images").update({ image_url: path }).eq("id", id);

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);

    return {
      id,
      prompt: row.prompt as string,
      imageUrl: signed?.signedUrl ?? data.dataUrl,
      createdAt: new Date(row.created_at as string).getTime(),
    };
  });

// Supprime une image de la bibliothèque
export const deleteAlexImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id || typeof data.id !== "string") throw new Error("Image invalide.");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET).remove([imagePath(userId, data.id)]);
    const { error } = await supabase.from("alex_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

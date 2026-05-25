import { createServerFn } from "@tanstack/react-start";

export type ApiKeyInfo = {
  id?: string;
  name?: string | null;
  status?: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
  workspace_id?: string | null;
  created_by?: { id?: string; type?: string } | null;
  partial_key_hint?: string | null;
};

export type FetchKeyResult =
  | { ok: true; data: ApiKeyInfo }
  | { ok: false; status: number; message: string };

export const fetchApiKey = createServerFn({ method: "POST" })
  .inputValidator((input: { adminKey: string; keyId: string }) => {
    const adminKey = String(input?.adminKey ?? "").trim();
    const keyId = String(input?.keyId ?? "").trim();
    if (!adminKey) throw new Error("Clé admin manquante.");
    if (!keyId) throw new Error("Identifiant de clé manquant.");
    if (adminKey.length > 500 || keyId.length > 200) {
      throw new Error("Entrée trop longue.");
    }
    if (!/^[A-Za-z0-9_\-]+$/.test(keyId)) {
      throw new Error("Identifiant de clé invalide.");
    }
    return { adminKey, keyId };
  })
  .handler(async ({ data }): Promise<FetchKeyResult> => {
    const url = `https://api.anthropic.com/v1/organizations/api_keys/${encodeURIComponent(data.keyId)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "anthropic-version": "2023-06-01",
          "X-Api-Key": data.adminKey,
        },
      });
    } catch (e) {
      console.error("Anthropic fetch failed:", e);
      return { ok: false, status: 0, message: "Impossible de joindre l'API Anthropic." };
    }

    if (!res.ok) {
      let message = `Erreur ${res.status}`;
      if (res.status === 401) message = "Erreur 401 : Clé non autorisée";
      else if (res.status === 403) message = "Erreur 403 : Accès refusé";
      else if (res.status === 404) message = "Erreur 404 : Clé introuvable";
      else if (res.status === 429) message = "Erreur 429 : Trop de requêtes";
      try {
        const txt = await res.text();
        if (txt) console.error("Anthropic error body:", txt);
      } catch {}
      return { ok: false, status: res.status, message };
    }

    const json = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        id: json.id as string | undefined,
        name: (json.name as string) ?? null,
        status: (json.status as string) ?? null,
        created_at: (json.created_at as string) ?? null,
        last_used_at: (json.last_used_at as string) ?? null,
        workspace_id: (json.workspace_id as string) ?? null,
        created_by: (json.created_by as ApiKeyInfo["created_by"]) ?? null,
        partial_key_hint: (json.partial_key_hint as string) ?? null,
      },
    };
  });

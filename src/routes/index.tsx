import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Hash,
  Tag,
  Calendar,
  Clock,
  Building2,
  User,
} from "lucide-react";
import { fetchApiKey, type ApiKeyInfo } from "../lib/analyze";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Clés API Anthropic" },
      {
        name: "description",
        content:
          "Tableau de bord sécurisé pour inspecter les clés API Anthropic via l'API Admin.",
      },
    ],
  }),
});

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").toLowerCase();
  const active = s === "active";
  const inactive = !active && s.length > 0;
  const cls = active
    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
    : inactive
      ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
      : "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30";
  const dot = active ? "bg-emerald-400" : inactive ? "bg-rose-400" : "bg-zinc-400";
  const label = active ? "Actif" : inactive ? "Révoqué / Inactif" : "Inconnu";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-violet-500/30 hover:bg-white/[0.04]">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div
        className={`text-sm text-zinc-100 ${mono ? "font-mono break-all" : ""}`}
      >
        {value || <span className="text-zinc-500">—</span>}
      </div>
    </div>
  );
}

function Dashboard() {
  const fetchKey = useServerFn(fetchApiKey);
  const [adminKey, setAdminKey] = useState("");
  const [keyId, setKeyId] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiKeyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetchKey({ data: { adminKey, keyId } });
      if (res.ok) {
        setResult(res.data);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-fuchsia-700/10 blur-[120px]" />
      </div>

      {/* Topbar */}
      <header className="border-b border-white/5 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold">Anthropic Admin</div>
              <div className="text-[11px] text-zinc-500">API Keys Console</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Traitement sécurisé côté serveur
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Inspecter une clé API
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Récupère les métadonnées d'une clé via l'endpoint{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-violet-300">
              /v1/organizations/api_keys/{"{id}"}
            </code>
            .
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Form */}
          <form
            onSubmit={onSubmit}
            className="lg:col-span-2 rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 shadow-2xl shadow-black/40"
          >
            <div className="mb-5 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-medium">Identifiants</h2>
            </div>

            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              ANTHROPIC_ADMIN_API_KEY
            </label>
            <div className="relative mb-4">
              <input
                type={showKey ? "text" : "password"}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="sk-ant-admin..."
                autoComplete="off"
                spellCheck={false}
                required
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 pr-10 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                aria-label={showKey ? "Masquer la clé" : "Afficher la clé"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              API_KEY_ID
            </label>
            <input
              type="text"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="apikey_01ABC..."
              autoComplete="off"
              spellCheck={false}
              required
              className="mb-5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
            />

            <button
              type="submit"
              disabled={loading || !adminKey || !keyId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Récupération…
                </>
              ) : (
                "Récupérer les informations"
              )}
            </button>

            <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/5 bg-black/30 p-3 text-[11px] leading-relaxed text-zinc-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
              <p>
                Les clés API sont transmises uniquement à une fonction Edge
                sécurisée qui relaie la requête vers Anthropic. Elles ne sont
                ni journalisées, ni stockées sur nos serveurs.
              </p>
            </div>
          </form>

          {/* Results */}
          <section className="lg:col-span-3">
            {loading && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02]">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="mt-4 text-sm text-zinc-400">
                  Interrogation de l'API Anthropic…
                </p>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
                <div>
                  <div className="text-sm font-semibold text-rose-200">
                    Requête échouée
                  </div>
                  <p className="mt-1 text-sm text-rose-300/90">{error}</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 shadow-2xl shadow-black/40">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">
                      Clé API
                    </div>
                    <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                      {result.name || "(sans nom)"}
                    </div>
                  </div>
                  <StatusBadge status={result.status} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard icon={Hash} label="ID de la clé" value={result.id} mono />
                  <InfoCard icon={Tag} label="Nom / Label" value={result.name} />
                  <InfoCard
                    icon={Calendar}
                    label="Date de création"
                    value={formatDate(result.created_at)}
                  />
                  <InfoCard
                    icon={Clock}
                    label="Dernière utilisation"
                    value={formatDate(result.last_used_at)}
                  />
                  <InfoCard
                    icon={Building2}
                    label="Workspace"
                    value={result.workspace_id ?? "Par défaut"}
                    mono={!!result.workspace_id}
                  />
                  <InfoCard
                    icon={User}
                    label="Créée par"
                    value={
                      result.created_by
                        ? `${result.created_by.type ?? "user"} · ${result.created_by.id ?? ""}`
                        : null
                    }
                    mono
                  />
                  {result.partial_key_hint && (
                    <div className="sm:col-span-2">
                      <InfoCard
                        icon={KeyRound}
                        label="Indice de clé"
                        value={result.partial_key_hint}
                        mono
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {!loading && !error && !result && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-8 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/20">
                  <KeyRound className="h-5 w-5 text-violet-400" />
                </div>
                <div className="text-sm font-medium text-zinc-300">
                  Aucune clé chargée
                </div>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  Renseigne ta clé admin et l'identifiant de la clé à inspecter
                  pour afficher ses informations.
                </p>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-12 text-center text-[11px] text-zinc-600">
          Console non-officielle — utilise l'API Admin Anthropic. Aucune
          donnée sensible n'est conservée.
        </footer>
      </div>
    </main>
  );
}

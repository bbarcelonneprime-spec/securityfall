// TON IA — crée ton propre assistant IA personnalisé (identité, ton, expertise) et discute avec lui.
import { useEffect, useState } from "react";
import { Home, BrainCircuit, Save, Sparkles, RotateCcw, Check, Store } from "lucide-react";
import ToolChat, { type ToolMsg } from "./ToolChat";

export type TonIaConfig = {
  name: string;
  emoji: string;
  role: string;
  tone: string;
  language: string;
  expertise: string;
  rules: string;
};

const STORAGE_KEY = "ton_ia_config_v1";

const DEFAULT_CONFIG: TonIaConfig = {
  name: "Mon IA",
  emoji: "🧠",
  role: "Assistant personnel polyvalent",
  tone: "amical",
  language: "Français",
  expertise: "",
  rules: "",
};

const TONES = ["amical", "professionnel", "direct", "pédagogue", "enthousiaste", "humoristique"];
const EMOJIS = ["🧠", "🤖", "✨", "🚀", "🎯", "📚", "💡", "🦉", "🐉", "🎨", "⚡", "🩺"];

function buildPrompt(c: TonIaConfig): string {
  return [
    `Tu es « ${c.name} », une IA personnalisée créée par son utilisateur.`,
    `Rôle : ${c.role || "assistant polyvalent"}.`,
    `Ton : ${c.tone}.`,
    `Langue principale : ${c.language}.`,
    c.expertise ? `Domaines d'expertise : ${c.expertise}.` : "",
    c.rules ? `Règles à toujours respecter : ${c.rules}` : "",
    "Sois utile, concret et cohérent avec cette identité dans toutes tes réponses.",
  ]
    .filter(Boolean)
    .join("\n");
}

type Props = {
  onHome: () => void;
  onRun: (p: { systemPrompt: string; messages: ToolMsg[] }) => Promise<string>;
  onPublish?: (p: { name: string; emoji: string; description: string; systemPrompt: string; starter: string }) => Promise<void>;
};

export default function TonIa({ onHome, onRun, onPublish }: Props) {
  const [cfg, setCfg] = useState<TonIaConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCfg({ ...DEFAULT_CONFIG, ...(JSON.parse(raw) as TonIaConfig) });
    } catch {
      /* ignore */
    }
  }, []);

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const set = <K extends keyof TonIaConfig>(k: K, v: TonIaConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const publish = async () => {
    if (!onPublish) return;
    await onPublish({
      name: cfg.name,
      emoji: cfg.emoji,
      description: cfg.role,
      systemPrompt: buildPrompt(cfg),
      starter: `Salut ! Je suis ${cfg.name}. Comment puis-je t'aider ?`,
    });
    setPublished(true);
    setTimeout(() => setPublished(false), 2200);
  };

  const field =
    "w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40";

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 backdrop-blur-xl transition hover:bg-white/10"
          aria-label="Accueil"
        >
          <Home className="h-4 w-4" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
          <BrainCircuit className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">TON IA</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">Crée ton assistant IA sur mesure et parle-lui</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Configuration */}
        <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div>
            <label htmlFor="tiName" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nom de ton IA</label>
            <input id="tiName" value={cfg.name} onChange={(e) => set("name", e.target.value)} maxLength={40} className={field} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Avatar</p>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set("emoji", e)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition ${cfg.emoji === e ? "border-cyan-400/60 bg-cyan-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="tiRole" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Rôle / mission</label>
            <input id="tiRole" value={cfg.role} onChange={(e) => set("role", e.target.value)} placeholder="Coach sportif, tuteur de maths…" maxLength={160} className={field} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ton</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("tone", t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${cfg.tone === t ? "border-cyan-400/60 bg-cyan-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="tiLang" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Langue</label>
            <select id="tiLang" value={cfg.language} onChange={(e) => set("language", e.target.value)} className={field}>
              {["Français", "Anglais", "Espagnol", "Allemand", "Italien", "Portugais", "Arabe"].map((l) => (
                <option key={l} value={l} className="bg-[#0d1122]">{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tiExp" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Expertise</label>
            <textarea id="tiExp" value={cfg.expertise} onChange={(e) => set("expertise", e.target.value)} rows={3} maxLength={600} placeholder="Nutrition, JavaScript, marketing…" className={`${field} resize-none`} />
          </div>

          <div>
            <label htmlFor="tiRules" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Règles</label>
            <textarea id="tiRules" value={cfg.rules} onChange={(e) => set("rules", e.target.value)} rows={3} maxLength={800} placeholder="Toujours répondre en 3 points, jamais de jargon…" className={`${field} resize-none`} />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={persist}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02]"
            >
              {saved ? <><Check className="h-4 w-4" /> Enregistré</> : <><Save className="h-4 w-4" /> Enregistrer</>}
            </button>
            <button
              type="button"
              onClick={() => setCfg(DEFAULT_CONFIG)}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </button>
          </div>
          {onPublish && (
            <button
              type="button"
              onClick={() => void publish()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
            >
              {published ? <><Check className="h-4 w-4" /> Ajouté à Alex Studio</> : <><Store className="h-4 w-4" /> Sauvegarder comme outil</>}
            </button>
          )}
        </aside>

        {/* Chat */}
        <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <ToolChat
            emoji={cfg.emoji}
            name={cfg.name || "Mon IA"}
            subtitle={`${cfg.role || "Assistant"} · ${cfg.tone}`}
            starter={`Salut ! Je suis ${cfg.name || "ton IA"}. ${cfg.role ? `Je suis là comme ${cfg.role.toLowerCase()}.` : ""} Que veux-tu faire ?`}
            onSend={(messages) => onRun({ systemPrompt: buildPrompt(cfg), messages })}
          />
        </section>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500">
        <Sparkles className="mr-1 inline h-3 w-3" /> TON IA — assistant personnalisé © Alex Graph
      </p>
    </div>
  );
}

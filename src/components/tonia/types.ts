// Types & constantes partagés du hub TON IA.
export type ToniaMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type ToniaThread = {
  id: string;
  title: string;
  messages: ToniaMsg[];
  favorite: boolean;
  updatedAt: number;
  agentId: string;
};

export type ToniaAgent = {
  id: string;
  name: string;
  emoji: string;
  role: string;
  tone: string;
  language: string;
  expertise: string;
  rules: string;
  model: string;
  temperature: number;
  memory: boolean;
  allowTools: boolean;
  knowledge: string;
};

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "qwen"
  | "mistral"
  | "openrouter"
  | "github"
  | "ollama";

export type ModelDef = {
  id: string;
  label: string;
  provider: ProviderId;
  providerLabel: string;
  skills: Array<"chat" | "code" | "vision" | "image">;
};

export const PROVIDERS: Array<{ id: ProviderId; label: string; hint: string }> = [
  { id: "openai", label: "OpenAI", hint: "sk-…" },
  { id: "anthropic", label: "Claude (Anthropic)", hint: "sk-ant-…" },
  { id: "google", label: "Google Gemini", hint: "AIza…" },
  { id: "deepseek", label: "DeepSeek", hint: "sk-…" },
  { id: "qwen", label: "Qwen", hint: "sk-…" },
  { id: "mistral", label: "Mistral", hint: "…" },
  { id: "openrouter", label: "OpenRouter", hint: "sk-or-…" },
  { id: "github", label: "GitHub Models", hint: "ghp_…" },
  { id: "ollama", label: "Ollama (local)", hint: "http://localhost:11434" },
];

export const MODEL_LIBRARY: ModelDef[] = [
  { id: "alex-base-1", label: "Alex Base 1 (fusion)", provider: "openai", providerLabel: "Alex IA", skills: ["chat", "code", "vision"] },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "openai", providerLabel: "OpenAI", skills: ["chat", "code", "vision", "image"] },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", providerLabel: "OpenAI", skills: ["chat", "code", "vision"] },
  { id: "claude-sonnet", label: "Claude Sonnet", provider: "anthropic", providerLabel: "Claude", skills: ["chat", "code", "vision"] },
  { id: "gemini-pro", label: "Gemini Pro", provider: "google", providerLabel: "Google", skills: ["chat", "code", "vision", "image"] },
  { id: "gemini-flash", label: "Gemini Flash", provider: "google", providerLabel: "Google", skills: ["chat", "vision"] },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "deepseek", providerLabel: "DeepSeek", skills: ["chat", "code"] },
  { id: "qwen-max", label: "Qwen Max", provider: "qwen", providerLabel: "Qwen", skills: ["chat", "code"] },
  { id: "mistral-large", label: "Mistral Large", provider: "mistral", providerLabel: "Mistral", skills: ["chat", "code"] },
  { id: "openrouter-auto", label: "OpenRouter Auto", provider: "openrouter", providerLabel: "OpenRouter", skills: ["chat", "code", "vision"] },
  { id: "github-models", label: "GitHub Models", provider: "github", providerLabel: "GitHub", skills: ["chat", "code"] },
  { id: "ollama-local", label: "Modèle local (Ollama)", provider: "ollama", providerLabel: "Local", skills: ["chat", "code"] },
];

export const TONES = ["amical", "professionnel", "direct", "pédagogue", "enthousiaste", "humoristique"];
export const EMOJIS = ["🧠", "🤖", "✨", "🚀", "🎯", "📚", "💡", "🦉", "🐉", "🎨", "⚡", "🩺"];

export const DEFAULT_AGENT: ToniaAgent = {
  id: "default",
  name: "Mon IA",
  emoji: "🧠",
  role: "Assistant personnel polyvalent",
  tone: "amical",
  language: "Français",
  expertise: "",
  rules: "",
  model: "alex-base-1",
  temperature: 0.7,
  memory: true,
  allowTools: true,
  knowledge: "",
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function buildPrompt(a: ToniaAgent, opts: { web: boolean; vision: boolean; tools: boolean; deep: boolean }): string {
  return [
    `Tu es « ${a.name} », une IA personnalisée créée par son utilisateur dans TON IA.`,
    `Rôle : ${a.role || "assistant polyvalent"}.`,
    `Ton : ${a.tone}.`,
    `Langue principale : ${a.language}.`,
    a.expertise ? `Domaines d'expertise : ${a.expertise}.` : "",
    a.rules ? `Règles à toujours respecter : ${a.rules}` : "",
    a.knowledge ? `Base de connaissances fournie par l'utilisateur :\n${a.knowledge}` : "",
    opts.web ? "Recherche Web activée : appuie-toi sur des faits vérifiables et cite tes sources quand tu les connais." : "",
    opts.vision ? "Vision activée : décris et analyse précisément les images fournies." : "",
    opts.tools && a.allowTools ? "Outils autorisés : tu peux proposer du code, des tableaux, des fichiers et des étapes exécutables." : "",
    opts.deep ? "Mode Deep Think : raisonne en profondeur, structure ta réponse, anticipe les cas limites." : "",
    "Formate tes réponses en Markdown quand c'est utile (titres, listes, blocs de code).",
  ]
    .filter(Boolean)
    .join("\n");
}

export function extractCode(text: string): { lang: string; code: string } | null {
  const m = /```(\w+)?\n([\s\S]*?)```/.exec(text);
  if (!m) return null;
  return { lang: m[1] || "txt", code: m[2] };
}

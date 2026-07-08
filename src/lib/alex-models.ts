// Registre des modèles IA disponibles pour Alex IA (façon Mammouth IA).
// Partagé entre le client (sélecteur de modèle) et le serveur (routage).
// Les modèles "groq" utilisent GROQ_API_KEY (ultra rapides) ; les modèles
// "lovable" passent par la passerelle IA de Lovable (aucune clé requise).

export type AlexModelProvider = "lovable" | "groq" | "super";

export type AlexModel = {
  id: string; // identifiant utilisé dans l'UI + envoyé au serveur
  label: string;
  provider: AlexModelProvider;
  model: string; // identifiant réel envoyé au fournisseur
  desc: string;
  badge: string; // libellé court affiché dans la barre
  fast?: boolean;
};

export const ALEX_MODELS: AlexModel[] = [
  {
    id: "alex-base-1",
    label: "Alex Base 1",
    provider: "super",
    model: "super",
    desc: "IA surpuissante — combine tous les modèles pour la meilleure réponse",
    badge: "Base 1",
    fast: true,
  },
  {
    id: "llama-instant",
    label: "Alex Turbo",
    provider: "groq",
    model: "llama-3.1-8b-instant",
    desc: "Ultra rapide — réponses instantanées",
    badge: "Turbo",
    fast: true,
  },
  {
    id: "llama-70b",
    label: "Alex Pro",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    desc: "Puissant et très rapide (Llama 3.3 70B)",
    badge: "Pro",
    fast: true,
  },
  {
    id: "gpt-oss-120b",
    label: "Alex Reasoning",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    desc: "Raisonnement avancé, rapide (GPT-OSS 120B)",
    badge: "Reasoning",
    fast: true,
  },
  {
    id: "qwen-32b",
    label: "Alex Multilingue",
    provider: "groq",
    model: "qwen/qwen3-32b",
    desc: "Excellent en multilingue (Qwen3 32B)",
    badge: "Qwen",
    fast: true,
  },
  {
    id: "flash",
    label: "Alex Flash",
    provider: "lovable",
    model: "google/gemini-3-flash-preview",
    desc: "Polyvalent et fiable (Gemini Flash)",
    badge: "Flash",
    fast: true,
  },
  {
    id: "gemini-pro",
    label: "Alex Vision",
    provider: "lovable",
    model: "google/gemini-2.5-pro",
    desc: "Analyse approfondie (Gemini 2.5 Pro)",
    badge: "Pro+",
  },
  {
    id: "gpt-5-mini",
    label: "Alex GPT",
    provider: "lovable",
    model: "openai/gpt-5-mini",
    desc: "Style OpenAI, polyvalent (GPT-5 mini)",
    badge: "GPT",
  },
];

// Modèle par défaut : l'IA surpuissante Alex Base 1.
export const DEFAULT_ALEX_MODEL = "alex-base-1";

export function getAlexModel(id?: string): AlexModel {
  return ALEX_MODELS.find((m) => m.id === id) ?? ALEX_MODELS.find((m) => m.id === DEFAULT_ALEX_MODEL) ?? ALEX_MODELS[0];
}

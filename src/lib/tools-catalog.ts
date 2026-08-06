// Types & catégories partagés entre Alex Studio, Alex Marketplace et le serveur.
export type ToolChangelogEntry = { version: string; date: number; note: string };

export type AlexTool = {
  id: string;
  userId: string;
  authorName: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  systemPrompt: string;
  model: string;
  agentId: string;
  starter: string;
  appHtml: string;
  version: string;
  status: string;
  favorite: boolean;
  isPublic: boolean;
  installs: number;
  changelog: ToolChangelogEntry[];
  screenshots: string[];
  createdAt: number;
  updatedAt: number;
  rating?: number;
  ratingCount?: number;
};

export type ToolReview = {
  id: string;
  toolId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: number;
  mine?: boolean;
};

export type InstalledTool = { installedVersion: string; tool: AlexTool };

export const TOOL_CATEGORIES = [
  { id: "general", label: "Général" },
  { id: "writing", label: "Écriture" },
  { id: "code", label: "Code" },
  { id: "business", label: "Business" },
  { id: "education", label: "Éducation" },
  { id: "creative", label: "Créatif" },
  { id: "productivity", label: "Productivité" },
  { id: "fun", label: "Fun" },
] as const;

export function categoryLabel(id: string): string {
  return TOOL_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

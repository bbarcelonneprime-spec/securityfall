// Panneau de chat réutilisable pour exécuter un outil IA (Alex Studio / Marketplace / TON IA).
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send, Sparkles, Trash2, Copy, AlertCircle } from "lucide-react";

export type ToolMsg = { role: "user" | "assistant"; content: string };

type Props = {
  emoji: string;
  name: string;
  subtitle?: string;
  starter?: string;
  placeholder?: string;
  onSend: (messages: ToolMsg[]) => Promise<string>;
  compact?: boolean;
};

export default function ToolChat({ emoji, name, subtitle, starter, placeholder, onSend, compact }: Props) {
  const [messages, setMessages] = useState<ToolMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [name, starter]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const content = await onSend(next);
      setMessages([...next, { role: "assistant", content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'outil n'a pas pu répondre.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
          >
            <Trash2 className="h-3 w-3" /> Effacer
          </button>
        )}
      </div>

      <div className={`flex-1 space-y-4 overflow-y-auto px-4 py-4 ${compact ? "max-h-[42vh]" : "max-h-[56vh]"}`}>
        {messages.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
            <p className="mb-1 flex items-center gap-2 font-medium text-white">
              <Sparkles className="h-4 w-4 text-violet-300" /> {name}
            </p>
            <p className="text-slate-400">{starter || "Pose ta première question pour démarrer."}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`group max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                  : "border border-white/10 bg-white/[0.05] text-slate-100"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(m.content)}
                  className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-200"
                >
                  <Copy className="h-3 w-3" /> Copier
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> L'outil réfléchit…
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/50 px-3 py-2 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-white/10 px-4 py-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(e);
            }
          }}
          rows={1}
          placeholder={placeholder || "Écris ton message…"}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-[#0d1122]/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Envoyer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

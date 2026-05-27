import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { ShieldCheck, Mail, Loader2, AlertCircle, Download, MessageCircle, X, Send, Bot, User } from "lucide-react";
import { analyzeEmail } from "../lib/analyze";
import { chatWithBot } from "../lib/chatbot.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Analyseur de sécurité e-mail" },
      {
        name: "description",
        content:
          "Diagnostic pédagogique de la sécurité de votre adresse e-mail et conseils de prévention par un expert IA.",
      },
    ],
  }),
});

function renderMarkdown(md: string) {
  // Minimal markdown: headings, bold, lists, paragraphs
  const lines = md.split("\n");
  const out: Array<React.ReactNode> = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-3 list-disc space-y-1 pl-6 text-slate-700">
          {listBuffer.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(l) }} />
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-sm">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{3}\s+/.test(line)) {
      flushList();
      out.push(
        <h3 key={out.length} className="mt-5 text-lg font-semibold text-slate-900"
          dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{3}\s+/, "")) }} />,
      );
    } else if (/^#{2}\s+/.test(line)) {
      flushList();
      out.push(
        <h2 key={out.length} className="mt-6 text-xl font-semibold text-slate-900"
          dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#{2}\s+/, "")) }} />,
      );
    } else if (/^#\s+/.test(line)) {
      flushList();
      out.push(
        <h2 key={out.length} className="mt-6 text-xl font-semibold text-slate-900"
          dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#\s+/, "")) }} />,
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p key={out.length} className="my-2 leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: inline(line) }} />,
      );
    }
  }
  flushList();
  return out;
}

function Index() {
  const analyze = useServerFn(analyzeEmail);
  const chatBotFn = useServerFn(chatWithBot);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Bonjour ! Je suis ton assistant cybersécurité. Pose-moi tes questions sur la sécurité des e-mails, les mots de passe, le phishing ou toute autre question numérique !" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendChatMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await chatBotFn({ data: { messages: newMessages } });
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.content }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur : ${err instanceof Error ? err.message : "Problème de connexion."}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await analyze({ data: { email } });
      setResult(res.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Analyseur de sécurité e-mail
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Obtiens un diagnostic pédagogique et 3 conseils concrets pour sécuriser ton adresse
            e-mail, sans jamais transmettre ton mot de passe.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-800">
            Ton adresse e-mail
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="prenom.nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyse…
                </>
              ) : (
                "Analyser"
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Aucun mot de passe n'est demandé. Seule l'adresse est analysée pour un diagnostic
            général.
          </p>
        </form>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <section
            id="diagnostic-result"
            className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                Diagnostic de sécurité
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter en PDF
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Analyse pour <span className="font-medium text-slate-700">{email}</span>
            </p>
            <article className="prose prose-slate max-w-none">{renderMarkdown(result)}</article>
          </section>
        )}

        <footer className="mt-12 text-center text-xs text-slate-400">
          Conseils éducatifs générés par IA. Ne remplace pas un audit de sécurité professionnel.
        </footer>
      </div>
    </main>
  );
}

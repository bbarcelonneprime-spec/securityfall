import { useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import alexGraphLogo from "@/assets/alex-graph-logo.jpg";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.5 0 10.3-1.8 13.8-4.9l-6.4-5.2c-2 1.5-4.6 2.4-7.4 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.4 5.2c-.5.4 6.8-4.9 6.8-14.6 0-1.2-.1-2.3-.3-3.5z" />
    </svg>
  );
}


export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    setInfo(null);
    setProviderLoading("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Échec de la connexion Google. Réessaie.");
        setProviderLoading(null);
        return;
      }
      // If redirected, the browser navigates away. Otherwise session is set.
    } catch {
      setError("Échec de la connexion Google. Réessaie.");
      setProviderLoading(null);
    }
  };

  const unsupportedProvider = (name: string) => {
    setError(null);
    setInfo(
      `La connexion avec ${name} arrive bientôt. Pour l'instant, connecte-toi avec Google ou par e-mail.`,
    );
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setInfo("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
        setMode("signin");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        // onAuthStateChange in the app picks up the session.
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(
        /invalid login credentials/i.test(msg)
          ? "Identifiants incorrects."
          : /email not confirmed/i.test(msg)
            ? "E-mail non confirmé. Vérifie ta boîte mail."
            : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0f1c] px-4 py-12 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-indigo-700/20 blur-[120px]" />
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-blue-700/15 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={alexGraphLogo}
            alt="Alex Graph"
            className="mb-5 h-20 w-20 rounded-2xl object-cover shadow-2xl shadow-indigo-900/40 ring-1 ring-white/10"
          />
          <h1 className="bg-gradient-to-r from-violet-300 via-white to-indigo-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Alex IA
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Connecte-toi pour accéder à <span className="font-medium text-slate-200">Alex IA</span> par Alex Graph
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          {/* Social providers */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={providerLoading !== null || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {providerLoading === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
              Continuer avec Google
            </button>
            <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
              <span>
                La connexion via <span className="font-medium text-slate-300">Discord</span> et{" "}
                <span className="font-medium text-slate-300">X</span> n'est pas disponible pour le moment.
                Utilise Google ou ton adresse e-mail ci-dessous.
              </span>
            </p>
          </div>


          <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            ou par e-mail
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email / password */}
          <form onSubmit={submitEmail} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#11162a] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/50"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Mot de passe (6 caractères min.)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#11162a] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-violet-400/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || providerLoading !== null}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <p className="mt-5 text-center text-xs text-slate-400">
            {mode === "signup" ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "signup" ? "signin" : "signup"));
                setError(null);
                setInfo(null);
              }}
              className="font-medium text-violet-300 hover:text-violet-200"
            >
              {mode === "signup" ? "Se connecter" : "Créer un compte"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">© Alex Graph — Alex IA</p>
      </div>
    </main>
  );
}

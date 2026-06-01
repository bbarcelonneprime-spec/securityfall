import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Loader2, User as UserIcon, SlidersHorizontal, ShieldCheck, Camera,
  ArrowLeft, Moon, Sun, Save, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/components/UserMenu";

export const Route = createFileRoute("/profile/settings")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/" });
    }
  },
  component: ProfileSettings,
  head: () => ({
    meta: [
      { title: "Mon profil — Alex IA" },
      { name: "description", content: "Personnalise ton profil Alex IA : avatar, pseudo, biographie et préférences." },
    ],
  }),
});

type Tab = "general" | "preferences" | "security";

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

const NAV: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: "general", label: "Général", icon: UserIcon },
  { id: "preferences", label: "Préférences", icon: SlidersHorizontal },
  { id: "security", label: "Sécurité", icon: ShieldCheck },
];

function applyDarkMode(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", enabled);
}

function ProfileSettings() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("general");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState("fr");
  const [darkMode, setDarkMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url, preferred_language, dark_mode")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url);
        setLanguage(data.preferred_language ?? "fr");
        setDarkMode(Boolean(data.dark_mode));
        applyDarkMode(Boolean(data.dark_mode));
      }
      setLoadingProfile(false);
    })();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisis un fichier image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (dbErr) throw dbErr;
      setAvatarUrl(publicUrl);
      window.dispatchEvent(new Event("profile-updated"));
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi de la photo.");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          preferred_language: language,
          dark_mode: darkMode,
        })
        .eq("id", userId);
      if (error) throw error;
      applyDarkMode(darkMode);
      window.dispatchEvent(new Event("profile-updated"));
      router.invalidate();
      toast.success("Profil mis à jour avec succès");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Mot de passe mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la mise à jour.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loadingProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  const initials = getInitials(displayName, email);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Personnalise ton compte Alex IA.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          {/* Left navigation */}
          <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right content */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {tab === "general" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-semibold text-white">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-60"
                      aria-label="Changer la photo"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Photo de profil</p>
                    <p className="text-xs text-muted-foreground">
                      JPG ou PNG, 5 Mo max. Sinon, tes initiales s'affichent.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Pseudo</label>
                  <input
                    type="text"
                    value={displayName}
                    maxLength={50}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ton pseudo"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium">Biographie</label>
                    <span className="text-xs text-muted-foreground">{bio.length}/200</span>
                  </div>
                  <textarea
                    value={bio}
                    maxLength={200}
                    rows={4}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Parle un peu de toi…"
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {tab === "preferences" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    {darkMode ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">Mode sombre</p>
                      <p className="text-xs text-muted-foreground">Active un thème sombre pour l'interface.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={darkMode}
                    onClick={() => {
                      const next = !darkMode;
                      setDarkMode(next);
                      applyDarkMode(next);
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
                      darkMode ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        darkMode ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Langue</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {tab === "security" && (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-sm font-medium">Adresse e-mail</p>
                  <p className="mt-1 text-sm text-muted-foreground">{email}</p>
                </div>

                <div className="border-t border-border pt-6">
                  <p className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4" /> Changer le mot de passe
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      type="password"
                      value={newPassword}
                      minLength={6}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      minLength={6}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme le mot de passe"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                    />
                    <div>
                      <button
                        type="button"
                        onClick={changePassword}
                        disabled={changingPassword || !newPassword}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
                      >
                        {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Mettre à jour
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

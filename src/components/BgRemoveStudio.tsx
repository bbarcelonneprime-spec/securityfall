// Retirer l'arrière-plan — studio complet : dépôt de fichier, options de rendu
// (fond transparent/couleur/dégradé, ombre) et comparaison avant/après.
import { useRef, useState, type DragEvent } from "react";
import {
  AlertCircle,
  Check,
  Download,
  Home,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Scissors,
  Sun,
  UploadCloud,
} from "lucide-react";

const BG_CHOICES = [
  { id: "transparent", label: "Transparent", css: null as string | null },
  { id: "white", label: "Blanc", css: "#ffffff" },
  { id: "black", label: "Noir", css: "#0b0f1c" },
  { id: "violet", label: "Violet", css: "linear-gradient(135deg,#7c3aed,#db2777)" },
  { id: "ocean", label: "Océan", css: "linear-gradient(135deg,#0ea5e9,#22d3ee)" },
  { id: "sunset", label: "Coucher", css: "linear-gradient(135deg,#f59e0b,#ef4444)" },
];

const CHECKER = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0,0 9px,9px -9px,-9px 0",
} as const;

type Props = {
  onHome: () => void;
  onRemove: (dataUrl: string) => Promise<string>;
};

export default function BgRemoveStudio({ onHome, onRemove }: Props) {
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bgChoice, setBgChoice] = useState("transparent");
  const [shadow, setShadow] = useState(false);
  const [compare, setCompare] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);

  const chosen = BG_CHOICES.find((b) => b.id === bgChoice) ?? BG_CHOICES[0];

  const process = async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Choisis un fichier image (JPG, PNG…)."); return; }
    if (file.size > 12 * 1024 * 1024) { setError("Image trop volumineuse (max 12 Mo)."); return; }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setOriginal(dataUrl);
      const out = await onRemove(dataUrl);
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du traitement.");
    } finally {
      setLoading(false);
    }
  };

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void process(f);
  };

  const reset = () => {
    setOriginal(null);
    setResult(null);
    setError(null);
  };

  const canvasStyle = chosen.css
    ? { background: chosen.css }
    : CHECKER;

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onHome} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 backdrop-blur-xl transition hover:bg-white/10" aria-label="Accueil">
          <Home className="h-4 w-4" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg">
          <Scissors className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Retirer l'arrière-plan</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">Détourage automatique — PNG transparent en un clic</p>
        </div>
        {(original || result) && (
          <button type="button" onClick={reset} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-slate-200 backdrop-blur-xl transition hover:bg-white/10">
            <RefreshCw className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void process(f); }} />

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {!original && !loading ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-20 text-center backdrop-blur-xl transition ${dragging ? "border-sky-400/70 bg-sky-500/10" : "border-white/15 bg-white/5"}`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg">
            <UploadCloud className="h-8 w-8" />
          </span>
          <div>
            <p className="text-base font-semibold text-white">Glisse ton image ici</p>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP — jusqu'à 12 Mo</p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
          >
            <ImageIcon className="h-4 w-4" /> Choisir un fichier
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* Résultat / comparaison */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Avant / Après</p>
              {result && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  <Check className="h-3 w-3" /> Détourage terminé
                </span>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl" style={canvasStyle}>
              {loading ? (
                <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <span className="text-xs">Détourage en cours…</span>
                </div>
              ) : (
                <div className="relative min-h-[18rem]">
                  {result && (
                    <img
                      src={result}
                      alt="Sans arrière-plan"
                      className="mx-auto max-h-[26rem] w-auto object-contain"
                      style={shadow ? { filter: "drop-shadow(0 18px 24px rgba(0,0,0,.45))" } : undefined}
                    />
                  )}
                  {original && result && (
                    <div className="absolute inset-0 overflow-hidden" style={{ width: `${compare}%` }}>
                      <img src={original} alt="Image d'origine" className="h-full w-auto max-w-none object-contain" style={{ maxHeight: "26rem" }} />
                    </div>
                  )}
                  {!result && original && (
                    <img src={original} alt="Image d'origine" className="mx-auto max-h-[26rem] w-auto object-contain" />
                  )}
                </div>
              )}
            </div>

            {original && result && (
              <div className="mt-4">
                <p className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                  <span>Curseur de comparaison</span><span className="text-slate-300">{compare}%</span>
                </p>
                <input type="range" min={0} max={100} value={compare} onChange={(e) => setCompare(Number(e.target.value))} className="w-full accent-sky-500" />
              </div>
            )}

            {result && !loading && (
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={result} download="sans-arriere-plan.png" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01]">
                  <Download className="h-4 w-4" /> Télécharger le PNG
                </a>
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10">
                  <UploadCloud className="h-4 w-4" /> Autre image
                </button>
              </div>
            )}
          </div>

          {/* Options */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Layers className="h-3.5 w-3.5" /> Arrière-plan
              </p>
              <div className="grid grid-cols-3 gap-2">
                {BG_CHOICES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBgChoice(b.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] transition ${bgChoice === b.id ? "border-sky-400/60 bg-sky-500/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
                  >
                    <span
                      className="h-8 w-full rounded-md border border-white/10"
                      style={b.css ? { background: b.css } : CHECKER}
                    />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Sun className="h-3.5 w-3.5" /> Rendu
              </p>
              <button
                type="button"
                onClick={() => setShadow((s) => !s)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${shadow ? "border-sky-400/60 bg-sky-500/10 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
              >
                Ombre portée
                <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${shadow ? "bg-sky-500" : "bg-white/15"}`}>
                  <span className={`h-4 w-4 rounded-full bg-white transition ${shadow ? "translate-x-4" : ""}`} />
                </span>
              </button>
              <p className="mt-2 text-[11px] text-slate-500">L'ombre est un aperçu visuel ; le PNG téléchargé reste détouré net.</p>
            </div>

            {original && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Original</p>
                <img src={original} alt="Miniature d'origine" className="w-full rounded-xl object-contain" />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

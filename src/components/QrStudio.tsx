// Générateur de QR code avancé : types de contenu, couleurs, logo, cadre.
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  AlertCircle,
  Copy,
  Download,
  Frame,
  Globe,
  Home,
  Image as ImageIcon,
  Loader2,
  Mail,
  Palette,
  Phone,
  QrCode,
  RefreshCw,
  Type,
  Wifi,
  X,
} from "lucide-react";

type ContentType = "url" | "text" | "email" | "phone" | "wifi";

const CONTENT_TYPES: Array<{ id: ContentType; label: string; icon: typeof Globe; placeholder: string }> = [
  { id: "url", label: "Lien", icon: Globe, placeholder: "https://exemple.com" },
  { id: "text", label: "Texte", icon: Type, placeholder: "Ton message…" },
  { id: "email", label: "E-mail", icon: Mail, placeholder: "contact@exemple.com" },
  { id: "phone", label: "Téléphone", icon: Phone, placeholder: "+33 6 12 34 56 78" },
  { id: "wifi", label: "Wi-Fi", icon: Wifi, placeholder: "NomDuReseau" },
];

const PRESETS = [
  { label: "Classique", fg: "#0b0f1c", bg: "#ffffff" },
  { label: "Violet", fg: "#6d28d9", bg: "#ffffff" },
  { label: "Océan", fg: "#0369a1", bg: "#f0f9ff" },
  { label: "Ambre", fg: "#b45309", bg: "#fffbeb" },
  { label: "Nuit", fg: "#e2e8f0", bg: "#0b0f1c" },
  { label: "Rose", fg: "#be185d", bg: "#fff1f2" },
];

export default function QrStudio({ onHome }: { onHome: () => void }) {
  const [type, setType] = useState<ContentType>("url");
  const [value, setValue] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [fg, setFg] = useState("#0b0f1c");
  const [bg, setBg] = useState("#ffffff");
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [level, setLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [frameLabel, setFrameLabel] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const current = CONTENT_TYPES.find((c) => c.id === type)!;

  const payload = useCallback(() => {
    const v = value.trim();
    if (!v) return "";
    if (type === "email") return `mailto:${v}`;
    if (type === "phone") return `tel:${v.replace(/\s+/g, "")}`;
    if (type === "wifi") return `WIFI:T:WPA;S:${v};P:${wifiPass};;`;
    if (type === "url") return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    return v;
  }, [type, value, wifiPass]);

  const build = useCallback(async () => {
    const data = payload();
    if (!data) {
      setDataUrl(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = await QRCode.toDataURL(data, {
        width: size,
        margin,
        errorCorrectionLevel: level,
        color: { dark: fg, light: bg },
      });

      if (!logo && !frameLabel.trim()) {
        setDataUrl(base);
        return;
      }

      // Composition : QR + logo centré + cadre/légende.
      const labelH = frameLabel.trim() ? Math.round(size * 0.13) : 0;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size + labelH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const qrImg = new Image();
      qrImg.src = base;
      await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; });
      ctx.drawImage(qrImg, 0, 0, size, size);

      if (logo) {
        const li = new Image();
        li.src = logo;
        await new Promise((res, rej) => { li.onload = res; li.onerror = rej; });
        const box = Math.round(size * 0.22);
        const x = (size - box) / 2;
        const pad = Math.round(box * 0.12);
        ctx.fillStyle = bg;
        ctx.fillRect(x - pad, x - pad, box + pad * 2, box + pad * 2);
        ctx.drawImage(li, x, x, box, box);
      }

      if (labelH) {
        ctx.fillStyle = fg;
        ctx.fillRect(0, size, size, labelH);
        ctx.fillStyle = bg;
        ctx.font = `600 ${Math.round(labelH * 0.45)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(frameLabel.trim().slice(0, 40), size / 2, size + labelH / 2);
      }

      setDataUrl(canvas.toDataURL("image/png"));
    } catch {
      setError("Impossible de générer ce QR code. Vérifie le contenu.");
      setDataUrl(null);
    } finally {
      setLoading(false);
    }
  }, [payload, size, margin, level, fg, bg, logo, frameLabel]);

  useEffect(() => {
    const t = setTimeout(() => { void build(); }, 250);
    return () => clearTimeout(t);
  }, [build]);

  const pickLogo = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choisis un fichier image pour le logo."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const downloadSvg = async () => {
    const data = payload();
    if (!data) return;
    const svg = await QRCode.toString(data, { type: "svg", margin, errorCorrectionLevel: level, color: { dark: fg, light: bg } });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyImage = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      await navigator.clipboard?.writeText(payload());
    }
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onHome} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 backdrop-blur-xl transition hover:bg-white/10" aria-label="Accueil">
          <Home className="h-4 w-4" />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <QrCode className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">Générateur de QR Code</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">Personnalise couleurs, logo et cadre — export PNG ou SVG</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Contenu */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Type de contenu</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {CONTENT_TYPES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setType(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition ${type === c.id ? "border-amber-400/50 bg-amber-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
                >
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={current.placeholder}
              className="w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-amber-400/40"
            />
            {type === "wifi" && (
              <input
                type="text"
                value={wifiPass}
                onChange={(e) => setWifiPass(e.target.value)}
                placeholder="Mot de passe du réseau"
                className="mt-3 w-full rounded-xl border border-white/10 bg-[#0d1122]/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-amber-400/40"
              />
            )}
          </div>

          {/* Personnalisation */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Palette className="h-3.5 w-3.5" /> Couleurs
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setFg(p.fg); setBg(p.bg); }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${fg === p.fg && bg === p.bg ? "border-amber-400/50 bg-amber-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
                >
                  <span className="flex h-4 w-4 overflow-hidden rounded-full border border-white/20">
                    <span className="h-full w-1/2" style={{ background: p.fg }} />
                    <span className="h-full w-1/2" style={{ background: p.bg }} />
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1122]/60 px-3 py-2.5 text-xs text-slate-300">
                Motif
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1122]/60 px-3 py-2.5 text-xs text-slate-300">
                Fond
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent" />
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs text-slate-400"><span>Taille</span><span className="text-slate-300">{size} px</span></p>
                <input type="range" min={256} max={1024} step={64} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs text-slate-400"><span>Marge</span><span className="text-slate-300">{margin}</span></p>
                <input type="range" min={0} max={6} step={1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs text-slate-400">Correction d'erreur</p>
                <div className="flex gap-1.5">
                  {(["L", "M", "Q", "H"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${level === l ? "border-amber-400/50 bg-amber-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Frame className="h-3.5 w-3.5" /> Légende du cadre</p>
                <input
                  type="text"
                  value={frameLabel}
                  onChange={(e) => setFrameLabel(e.target.value)}
                  maxLength={40}
                  placeholder="SCANNE-MOI"
                  className="w-full rounded-lg border border-white/10 bg-[#0d1122]/80 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400/40"
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400"><ImageIcon className="h-3.5 w-3.5" /> Logo central</p>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => logoInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10">
                  <ImageIcon className="h-3.5 w-3.5" /> {logo ? "Changer" : "Ajouter un logo"}
                </button>
                {logo && (
                  <button type="button" onClick={() => setLogo(null)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400 transition hover:bg-white/10">
                    <X className="h-3.5 w-3.5" /> Retirer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Aperçu */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Aperçu</p>
            <div className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-[#0d1122]/60 p-4">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin text-amber-300" />
              ) : dataUrl ? (
                <img src={dataUrl} alt="QR code généré" className="h-full w-full rounded-xl object-contain" />
              ) : (
                <div className="text-center text-xs text-slate-500">
                  <QrCode className="mx-auto mb-2 h-8 w-8" />
                  Saisis un contenu pour voir l'aperçu
                </div>
              )}
            </div>

            {dataUrl && (
              <div className="mt-4 space-y-2">
                <a
                  href={dataUrl}
                  download="qr-code.png"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01]"
                >
                  <Download className="h-4 w-4" /> Télécharger le PNG
                </a>
                <div className="flex gap-2">
                  <button type="button" onClick={downloadSvg} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10">
                    <Download className="h-3.5 w-3.5" /> SVG
                  </button>
                  <button type="button" onClick={copyImage} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10">
                    <Copy className="h-3.5 w-3.5" /> Copier
                  </button>
                  <button type="button" onClick={() => void build()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10" aria-label="Régénérer">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="break-all pt-1 text-center text-[11px] text-slate-500">{payload()}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// Extraction de texte côté client pour l'analyse de fichiers Alex IA.
// PDF géré via pdfjs-dist (import dynamique pour rester compatible SSR).

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".json", ".log", ".tsv", ".html", ".xml", ".rtf"];

export type ExtractedFile = { fileName: string; content: string };

export async function extractFileText(file: File): Promise<ExtractedFile> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    const content = await extractPdfText(file);
    return { fileName: name, content };
  }

  if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext)) || file.type.startsWith("text/")) {
    const content = await file.text();
    return { fileName: name, content };
  }

  // Tentative générique : lire comme texte
  try {
    const content = await file.text();
    if (content && /[\x20-\x7E]/.test(content)) return { fileName: name, content };
  } catch {
    /* ignore */
  }
  throw new Error("Format de fichier non pris en charge. Utilise un PDF, .txt, .md, .csv ou .json.");
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const maxPages = Math.min(pdf.numPages, 100);
  const parts: string[] = [];
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n").trim();
}

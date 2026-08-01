import type { SourceSegment } from "../../types";
import type { UploadInput } from "../provider";

/**
 * Stage 1 — Document ingestion.
 * Text files: read directly. PDFs: local text extraction via pdf.js.
 * Images: passed through to multimodal Gemma (transcription happens there).
 */

export interface IngestResult {
  kind: "text" | "image";
  /** Extracted text for text/PDF inputs; empty for images (Gemma reads them). */
  text: string;
  /** Base64 payload (no data: prefix) for image inputs. */
  imageBase64?: string;
  pages: number;
}

export async function ingest(input: UploadInput): Promise<IngestResult> {
  if (input.mimeType.startsWith("image/")) {
    const b64 = input.dataUrl?.split(",")[1];
    if (!b64) throw new Error("image upload missing data");
    return { kind: "image", text: "", imageBase64: b64, pages: 1 };
  }
  if (input.mimeType === "application/pdf") {
    if (!input.dataUrl) throw new Error("pdf upload missing data");
    return await extractPdf(input.dataUrl);
  }
  // plain text
  const text = input.textContent ?? (input.dataUrl ? atob(input.dataUrl.split(",")[1] ?? "") : "");
  if (!text.trim()) throw new Error("no readable text in upload");
  return { kind: "text", text, pages: 1 };
}

async function extractPdf(dataUrl: string): Promise<IngestResult> {
  // dynamic import keeps pdf.js out of the main bundle
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(`[Page ${p}] ${pageText}`);
  }
  const text = parts.join("\n\n");
  if (!text.trim()) throw new Error("PDF contains no extractable text — try photographing it instead");
  return { kind: "text", text, pages: doc.numPages };
}

/**
 * Chunk a transcript into citable source segments. Boundaries follow
 * blank lines / sentences; each segment stays small enough to cite exactly.
 */
export function chunkToSegments(text: string, docKey: string): SourceSegment[] {
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= 420) {
      chunks.push(para);
      continue;
    }
    // split long paragraphs at sentence boundaries
    let current = "";
    for (const sentence of para.split(/(?<=[.!?])\s+/)) {
      if ((current + " " + sentence).trim().length > 420 && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current = (current + " " + sentence).trim();
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.map((text, i) => ({
    id: `seg-${docKey}-${String(i + 1).padStart(2, "0")}`,
    text,
  }));
}

/** Normalize for quote-in-segment matching. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[""'']/g, '"')
    .replace(/[^\p{L}\p{N}$%./:@-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the segment that contains a verbatim quote. Falls back to matching
 * the first 40 normalized characters. Returns null when nothing matches —
 * the caller marks the claim "uncertain" instead of inventing a citation.
 */
export function findQuoteSegment(quote: string, segments: SourceSegment[]): string | null {
  const nq = normalizeForMatch(quote);
  if (nq.length < 4) return null;
  for (const seg of segments) {
    if (normalizeForMatch(seg.text).includes(nq)) return seg.id;
  }
  const head = nq.slice(0, 40);
  for (const seg of segments) {
    if (normalizeForMatch(seg.text).includes(head)) return seg.id;
  }
  return null;
}

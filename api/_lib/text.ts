/**
 * Self-contained text helpers for the serverless routes.
 * Mirrors src/services/gemma/ingest.ts so the functions stay free of any
 * Vite/browser-only imports.
 */

export interface Segment {
  id: string;
  text: string;
}

/** Chunk a transcript into citable segments at paragraph/sentence bounds. */
export function chunkToSegments(text: string, docKey: string): Segment[] {
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

  return chunks.map((t, i) => ({
    id: `seg-${docKey}-${String(i + 1).padStart(2, "0")}`,
    text: t,
  }));
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[""'']/g, '"')
    .replace(/[^\p{L}\p{N}$%./:@-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the segment containing a verbatim quote. Returns null when nothing
 * matches — the caller marks that claim uncertain rather than inventing a
 * citation.
 */
export function findQuoteSegment(quote: string, segments: Segment[]): string | null {
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

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
}

/** Deterministic human-date → ISO ("September 30, 2026" → 2026-09-30). */
export function parseHumanDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && isISODate(iso[1])) return iso[1];
  const m = text
    .toLowerCase()
    .match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/,
    );
  if (m) {
    const candidate = `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}`;
    if (isISODate(candidate)) return candidate;
  }
  return undefined;
}

/** Certainty language is stripped at the boundary — never shown to a user. */
export const BANNED_ELIGIBILITY = /you are eligible|you qualify|guaranteed|you will receive|approved for/i;

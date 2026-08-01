import type { AnalyzedDocument } from "../../types";
import { COVERAGE_PROGRAMS } from "../../fixtures/programs";
import { cosine, embed } from "./client";
import { gemmaConfig } from "./config";

/**
 * Stage 5 — Multilingual semantic retrieval over EmbeddingGemma.
 *
 * Embeds: document segments + extracted facts + coverage-program KB entries.
 * EmbeddingGemma is multilingual, so a Spanish question retrieves English
 * segments (and vice versa) — no translation step needed at query time.
 *
 * Vectors are cached in localStorage keyed by (model, text hash) so repeat
 * questions cost one embedding call for the query only.
 */

export interface RetrievedChunk {
  key: string; // "docId::segId" or "program::progId"
  documentId?: string;
  segmentId?: string;
  programId?: string;
  text: string;
  score: number;
}

const CACHE_KEY = "plaindocs-vectors-v1";

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function loadVectorCache(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

let vectorCache: Record<string, number[]> | null = null;

async function embedCached(texts: string[]): Promise<number[][]> {
  if (vectorCache === null) vectorCache = loadVectorCache();
  const missing: { idx: number; text: string; key: string }[] = [];
  const out: number[][] = new Array(texts.length);
  texts.forEach((t, i) => {
    const key = `${gemmaConfig.embedModel}:${hash(t)}`;
    const hit = vectorCache![key];
    if (hit) out[i] = hit;
    else missing.push({ idx: i, text: t, key });
  });
  if (missing.length > 0) {
    // batch in groups of 16 to keep request sizes sane on CPU
    for (let i = 0; i < missing.length; i += 16) {
      const batch = missing.slice(i, i + 16);
      const vecs = await embed(batch.map((m) => m.text));
      batch.forEach((m, j) => {
        out[m.idx] = vecs[j];
        vectorCache![m.key] = vecs[j];
      });
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(vectorCache));
    } catch {
      /* cache full — fine, we just recompute next time */
    }
  }
  return out;
}

interface CorpusEntry {
  key: string;
  documentId?: string;
  segmentId?: string;
  programId?: string;
  text: string;
}

function buildCorpus(documents: AnalyzedDocument[]): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  for (const doc of documents) {
    for (const seg of doc.segments) {
      entries.push({
        key: `${doc.id}::${seg.id}`,
        documentId: doc.id,
        segmentId: seg.id,
        text: seg.text,
      });
    }
    for (const fact of doc.facts) {
      // facts are indexed but cite their underlying segment
      const segId = fact.citations[0];
      if (segId) {
        entries.push({
          key: `${doc.id}::${segId}::fact:${fact.id}`,
          documentId: doc.id,
          segmentId: segId,
          text: `${fact.label}: ${fact.value}`,
        });
      }
    }
  }
  for (const prog of COVERAGE_PROGRAMS) {
    entries.push({
      key: `program::${prog.id}`,
      programId: prog.id,
      text: `${prog.name} — ${prog.summary} Benefit: ${prog.potentialBenefit}`,
    });
  }
  return entries;
}

export async function retrieve(
  question: string,
  documents: AnalyzedDocument[],
  k = 6,
): Promise<RetrievedChunk[]> {
  const corpus = buildCorpus(documents);
  if (corpus.length === 0) return [];
  const [qVec, ...docVecs] = await embedCached([question, ...corpus.map((c) => c.text)]);
  const scored = corpus.map((c, i) => ({ ...c, score: cosine(qVec, docVecs[i]) }));
  scored.sort((a, b) => b.score - a.score);

  // dedupe by segment (a fact and its segment shouldn't both appear)
  const seen = new Set<string>();
  const top: RetrievedChunk[] = [];
  for (const s of scored) {
    const dedupeKey = s.segmentId ? `${s.documentId}::${s.segmentId}` : s.key;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    top.push(s);
    if (top.length >= k) break;
  }
  return top;
}

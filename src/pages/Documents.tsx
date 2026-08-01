import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDocuments } from "../services/store";
import { EmptyState, KIND_LABEL, Tag, fmtDate } from "../components/common";
import { LANGUAGES } from "../types";

/**
 * My Documents — with search across titles, issuers, programs, facts and
 * full source text (the demo stand-in for EmbeddingGemma semantic search).
 */
export default function Documents() {
  const docs = useDocuments();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((d) => {
      const hay = [
        d.title,
        d.issuer,
        d.plainSummary,
        ...d.programs,
        ...d.facts.map((f) => `${f.label} ${f.value}`),
        ...d.segments.map((s) => s.text),
      ]
        .join(" ")
        .toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [docs, q]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          <p className="mt-1 text-ink-soft">
            {docs.length} document{docs.length !== 1 ? "s" : ""} in your private profile.
          </p>
        </div>
        <Link
          to="/upload"
          className="bg-brand px-5 py-2.5 font-bold text-white no-underline shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
        >
          + Add document
        </Link>
      </div>

      <div className="mt-5">
        <label htmlFor="doc-search" className="text-sm font-bold">
          Search your documents
        </label>
        <input
          id="doc-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Try "dental", "deadline", "policy number"…'
          className="mt-1 w-full max-w-lg border-2 border-ink px-3 py-2"
        />
        <p className="mt-1 text-xs text-ink-soft">
          Searches titles, extracted facts and full document text. Live semantic search
          (EmbeddingGemma) connects next phase.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {filtered.length === 0 && (
          <EmptyState
            title={q ? `Nothing matches "${q}"` : "No documents yet"}
            hint={q ? "Try different words." : "Upload your first document to get started."}
          />
        )}
        {filtered.map((d) => {
          const srcLang = LANGUAGES.find((l) => l.code === d.language)?.label ?? d.language;
          return (
            <div key={d.id} className="border border-line bg-paper p-5 hover:border-ink">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="blue">{KIND_LABEL[d.kind]}</Tag>
                    {d.isImage && <Tag tone="neutral">from photo</Tag>}
                    <Tag tone="green">{d.status === "ready" ? "analyzed" : d.status}</Tag>
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold">
                    <Link to={`/documents/${d.id}`} className="text-ink no-underline hover:underline">
                      {d.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-ink-soft">
                    {d.issuer} · uploaded {fmtDate(d.uploadedAt)} · source language {srcLang}
                  </p>
                  {d.programs.length > 0 && (
                    <p className="mt-1 text-sm">
                      <span className="font-semibold">Programs:</span> {d.programs.join("; ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {d.keyDate && (
                    <p className="text-sm">
                      <span className="font-semibold">{d.keyDate.label}:</span>{" "}
                      {fmtDate(d.keyDate.date)}
                    </p>
                  )}
                  <Link
                    to={`/documents/${d.id}`}
                    className="border-2 border-ink px-4 py-1.5 text-sm font-bold text-ink no-underline hover:bg-mist"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

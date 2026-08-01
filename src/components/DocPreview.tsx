import type { AnalyzedDocument } from "../types";

/**
 * Renders the "original document" panel. The photographed form renders as a
 * tilted paper photo (pure SVG/CSS — no binary assets); text documents render
 * as clean letter paper built from their real source segments.
 */
export function DocPreview({ doc }: { doc: AnalyzedDocument }) {
  if (doc.isImage) {
    return (
      <div className="bg-[#3f434a] p-6 md:p-8">
        <div
          className="mx-auto max-w-[420px] bg-[#fbfaf6] px-6 py-6 shadow-2xl"
          style={{ transform: "rotate(-1.2deg)" }}
        >
          <PaperContent doc={doc} photographed />
        </div>
        <p className="mt-3 text-center text-xs text-white/70">
          Photographed document (synthetic sample)
        </p>
      </div>
    );
  }
  return (
    <div className="bg-mist p-6 md:p-8">
      <div className="mx-auto max-w-[460px] border border-line bg-white px-7 py-7 shadow-sm">
        <PaperContent doc={doc} />
      </div>
    </div>
  );
}

function PaperContent({ doc, photographed = false }: { doc: AnalyzedDocument; photographed?: boolean }) {
  return (
    <div className={photographed ? "font-mono text-[11px] leading-relaxed" : "text-[12px] leading-relaxed"}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
        {doc.issuer}
      </p>
      <p className="mb-3 border-b-2 border-ink pb-2 text-sm font-bold text-ink">{doc.title}</p>
      {doc.segments.map((s) => (
        <p key={s.id} className="mb-2 text-ink/90">
          {s.text}
        </p>
      ))}
      <p className="mt-4 text-[10px] italic text-ink-soft">
        SYNTHETIC DEMONSTRATION DOCUMENT — not a real record
      </p>
    </div>
  );
}

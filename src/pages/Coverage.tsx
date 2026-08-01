import { Link } from "react-router-dom";
import { useDocuments } from "../services/store";
import { Card, CitationChip, EligibilityDisclaimer, EmptyState, Tag } from "../components/common";
import { COVERAGE_PROGRAMS, programById } from "../fixtures/programs";

/**
 * Coverage & eligibility — possible matches between the user's document
 * profile and the demo program knowledge base. Never claims eligibility.
 */
export default function Coverage() {
  const docs = useDocuments();
  const matches = docs.flatMap((d) => d.insights.map((insight) => ({ doc: d, insight })));

  return (
    <div>
      <h1 className="text-3xl font-bold">Coverage & eligibility</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">
        PlainDocs compares what your documents say with a knowledge base of assistance programs
        and shows <em>possible</em> matches. The official program always makes the final decision.
      </p>

      <div className="mt-4">
        <EligibilityDisclaimer />
      </div>

      <h2 className="mt-8 text-xl font-bold">Possible matches from your documents</h2>
      <div className="mt-3 space-y-4">
        {matches.length === 0 && (
          <EmptyState title="No possible matches yet" hint="Upload documents to check for opportunities." />
        )}
        {matches.map(({ doc, insight }) => {
          const prog = programById(insight.programId);
          if (!prog) return null;
          return (
            <Card key={`${doc.id}-${insight.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Tag tone={insight.confidence === "possible" ? "green" : "amber"}>
                  {insight.confidence === "possible" ? "You may be eligible" : "More information required"}
                </Tag>
                <span className="text-xs text-ink-soft">
                  Based on: <Link to={`/documents/${doc.id}`} className="font-semibold text-link">{doc.title}</Link>
                </span>
              </div>
              <h3 className="mt-2 text-xl font-bold">{prog.name}</h3>
              <p className="text-sm text-ink-soft">{prog.administrator}</p>
              <p className="mt-2">{insight.headline}</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    Why it may match — with sources
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {insight.whyItMayMatch.map((w, i) => (
                      <li key={i} className="text-sm">
                        {w.text}{" "}
                        {w.citations.map((c) => (
                          <CitationChip key={c} documentId={doc.id} segmentId={c} />
                        ))}
                      </li>
                    ))}
                  </ul>
                  {insight.missingInformation.length > 0 && (
                    <p className="mt-2 text-sm">
                      <strong className="text-warn">Still needed from you:</strong>{" "}
                      {insight.missingInformation.join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-sm">
                    <strong>Potential benefit:</strong> {insight.potentialBenefit}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    How to apply
                  </p>
                  <ol className="mt-1 space-y-1">
                    {prog.applicationSteps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="font-bold">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 border-l-4 border-warn bg-warn-soft px-3 py-2 text-xs">
                    {prog.officialContact}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mt-10 text-xl font-bold">Program knowledge base (demo)</h2>
      <p className="mt-1 text-sm text-ink-soft">
        All programs below are fictional demonstrations. Real program data can be added later
        without changing the matching flow.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {COVERAGE_PROGRAMS.map((p) => (
          <Card key={p.id}>
            <h3 className="font-bold">{p.name}</h3>
            <p className="text-xs text-ink-soft">{p.administrator}</p>
            <p className="mt-1.5 text-sm">{p.summary}</p>
            <p className="mt-1.5 text-sm">
              <strong>Benefit:</strong> {p.potentialBenefit}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

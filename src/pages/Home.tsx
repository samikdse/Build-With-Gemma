import { Link } from "react-router-dom";
import { useDocuments, useStore } from "../services/store";
import { Card, EligibilityDisclaimer, KIND_LABEL, Tag, daysUntil, fmtDate } from "../components/common";
import { programById } from "../fixtures/programs";

export default function Home() {
  const docs = useDocuments();
  const { reminders } = useStore();

  const deadlines = docs
    .flatMap((d) =>
      d.facts
        .filter((f) => f.date && (f.category === "date" || f.category === "action"))
        .map((f) => ({ doc: d, fact: f })),
    )
    .filter(({ fact }) => daysUntil(fact.date!) >= 0)
    .sort((a, b) => a.fact.date!.localeCompare(b.fact.date!));

  const insights = docs.flatMap((d) => d.insights.map((i) => ({ doc: d, insight: i })));
  const upcoming = reminders.filter((r) => r.status === "upcoming");

  const attention: { text: string; to: string }[] = [];
  for (const d of docs) {
    for (const i of d.insights) {
      if (i.missingInformation.length > 0) {
        attention.push({
          text: `${i.missingInformation.join(", ")} still needed for a possible coverage match`,
          to: "/coverage",
        });
        break;
      }
    }
  }
  const nearest = deadlines[0];
  if (nearest && daysUntil(nearest.fact.date!) <= 90) {
    attention.push({
      text: `${nearest.fact.label}: ${nearest.fact.value} (${daysUntil(nearest.fact.date!)} days away)`,
      to: `/documents/${nearest.doc.id}`,
    });
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight text-ink">
          Understand healthcare paperwork instantly
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink-soft">
          Upload a letter, form or notice — get a plain-language explanation, a translation, and
          numbered steps for what to do next.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/upload"
            className="bg-brand px-6 py-3 text-base font-bold text-white no-underline shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
          >
            Upload a document
          </Link>
          <Link
            to="/upload?mode=photo"
            className="border-2 border-ink px-6 py-3 text-base font-bold text-ink no-underline hover:bg-mist"
          >
            Take or upload a photo
          </Link>
        </div>
      </section>

      {/* Needs attention */}
      {attention.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Needs your attention</h2>
          <div className="space-y-2">
            {attention.map((a, i) => (
              <Link
                key={i}
                to={a.to}
                className="block border-l-4 border-warn bg-warn-soft px-4 py-3 text-sm font-semibold text-ink no-underline hover:bg-[#fdecd2]"
              >
                {a.text} →
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {/* Recent documents */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Recent documents</h2>
            <Link to="/documents" className="text-sm font-semibold text-link">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {docs.slice(0, 3).map((d) => (
              <Link key={d.id} to={`/documents/${d.id}`} className="block no-underline">
                <Card className="hover:border-ink">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{d.title}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {d.issuer} · uploaded {fmtDate(d.uploadedAt)}
                      </p>
                    </div>
                    <Tag tone="blue">{KIND_LABEL[d.kind]}</Tag>
                  </div>
                  {d.keyDate && (
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">{d.keyDate.label}:</span>{" "}
                      {fmtDate(d.keyDate.date)}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Upcoming deadlines */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Upcoming deadlines</h2>
            <Link to="/reminders" className="text-sm font-semibold text-link">
              Reminders
            </Link>
          </div>
          <div className="space-y-2">
            {deadlines.length === 0 && (
              <p className="text-sm text-ink-soft">No dates found yet — upload a document.</p>
            )}
            {deadlines.slice(0, 4).map(({ doc, fact }) => {
              const days = daysUntil(fact.date!);
              return (
                <Link key={fact.id} to={`/documents/${doc.id}`} className="block no-underline">
                  <div className="flex items-center justify-between border border-line px-4 py-2.5 hover:border-ink">
                    <div>
                      <p className="text-sm font-semibold text-ink">{fact.label}</p>
                      <p className="text-xs text-ink-soft">{doc.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{fmtDate(fact.date)}</p>
                      <p className={`text-xs font-semibold ${days <= 30 ? "text-alert" : days <= 90 ? "text-warn" : "text-ink-soft"}`}>
                        {days} days
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {upcoming.length > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              {upcoming.length} active reminder{upcoming.length > 1 ? "s" : ""} set.
            </p>
          )}
        </section>
      </div>

      {/* Coverage opportunities */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Possible coverage opportunities</h2>
          <Link to="/coverage" className="text-sm font-semibold text-link">
            Coverage page
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {insights.slice(0, 2).map(({ doc, insight }) => {
            const prog = programById(insight.programId);
            return (
              <Card key={insight.id}>
                <Tag tone={insight.confidence === "possible" ? "green" : "amber"}>
                  {insight.confidence === "possible" ? "You may be eligible" : "More info needed"}
                </Tag>
                <p className="mt-2 font-bold">{prog?.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{insight.headline}</p>
                <p className="mt-2 text-xs text-ink-soft">From: {doc.title}</p>
              </Card>
            );
          })}
          {insights.length === 0 && (
            <p className="text-sm text-ink-soft">Upload documents to see possible matches.</p>
          )}
        </div>
        <div className="mt-3">
          <EligibilityDisclaimer />
        </div>
      </section>
    </div>
  );
}

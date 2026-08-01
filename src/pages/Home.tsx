import { Link, useNavigate } from "react-router-dom";
import { useDocuments, useStore } from "../services/store";
import { Card, KIND_LABEL, Tag, daysUntil, fmtDate } from "../components/common";

export default function Home() {
  const docs = useDocuments();
  const { reminders } = useStore();
  const navigate = useNavigate();

  const deadlines = docs
    .flatMap((d) =>
      d.facts
        .filter((f) => f.date && (f.category === "date" || f.category === "action"))
        .map((f) => ({ doc: d, fact: f })),
    )
    .filter(({ fact }) => daysUntil(fact.date!) >= 0)
    .sort((a, b) => a.fact.date!.localeCompare(b.fact.date!));

  const upcoming = reminders.filter((r) => r.status === "upcoming");

  return (
    <div className="space-y-10">
      {/* Hero — short, plain, two clear actions */}
      <section className="pt-4">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight text-ink md:text-5xl">
          Understand your healthcare documents.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Upload a letter, form or photo. CareLens explains it, translates it and shows you what
          to do next.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/upload"
            className="bg-brand px-7 py-3.5 text-lg font-bold text-white no-underline shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
          >
            Upload a document
          </Link>
          <button
            onClick={() => navigate("/upload?sample=1")}
            className="border-2 border-ink px-7 py-3.5 text-lg font-bold text-ink hover:bg-mist"
          >
            Try a sample
          </button>
        </div>
      </section>

      {/* Your documents */}
      {docs.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Your documents</h2>
            <Link to="/documents" className="text-sm font-semibold text-link">
              View all
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {docs.slice(0, 2).map((d) => (
              <Link key={d.id} to={`/documents/${d.id}`} className="block no-underline">
                <Card className="hover:border-ink">
                  <Tag tone="blue">{KIND_LABEL[d.kind]}</Tag>
                  <p className="mt-1.5 font-bold text-ink">{d.title}</p>
                  {d.keyDate && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {d.keyDate.label}: <strong>{fmtDate(d.keyDate.date)}</strong>
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* What's coming up */}
      {(deadlines.length > 0 || upcoming.length > 0) && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Coming up</h2>
          <div className="space-y-2">
            {deadlines.slice(0, 3).map(({ doc, fact }) => {
              const days = daysUntil(fact.date!);
              return (
                <Link key={fact.id} to={`/documents/${doc.id}`} className="block no-underline">
                  <div className="flex items-center justify-between border border-line px-4 py-3 hover:border-ink">
                    <div>
                      <p className="text-sm font-semibold text-ink">{fact.label}</p>
                      <p className="text-xs text-ink-soft">{doc.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{fmtDate(fact.date)}</p>
                      <p
                        className={`text-xs font-semibold ${
                          days <= 30 ? "text-alert" : days <= 90 ? "text-warn" : "text-ink-soft"
                        }`}
                      >
                        in {days} days
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ask CareLens lives on the dashboard, not the top nav */}
      <section className="border border-line bg-mist/40 p-6">
        <h2 className="text-xl font-bold">Ask CareLens</h2>
        <p className="mt-1 text-ink-soft">
          Have a question about your documents? Ask in your own words — every answer shows where
          it came from.
        </p>
        <Link
          to="/ask"
          className="mt-4 inline-block border-2 border-ink px-5 py-2.5 font-bold text-ink no-underline hover:bg-white"
        >
          Ask a question
        </Link>
      </section>
    </div>
  );
}

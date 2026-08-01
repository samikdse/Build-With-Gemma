import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../services/store";
import { DocPreview } from "../components/DocPreview";
import { AgentPipeline } from "../components/AgentPipeline";
import {
  AiDraftNotice,
  Card,
  CitationChip,
  EligibilityDisclaimer,
  KIND_LABEL,
  Tag,
  fmtDate,
} from "../components/common";
import { programById } from "../fixtures/programs";
import { LANGUAGES, type ExtractedFact } from "../types";

const TABS = [
  { id: "overview", label: "Summary" },
  { id: "source", label: "Sources" },
  { id: "details", label: "Details" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DocumentView() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { documents, runs, language, addReminder, reminders } = useStore();
  const doc = id ? documents[id] : undefined;
  const run = id ? runs[id] : undefined;

  const tab = (params.get("tab") as TabId) || "overview";
  const targetSegment = params.get("segment");
  const fresh = params.get("fresh") === "1";
  const segmentRefs = useRef<Record<string, HTMLElement | null>>({});
  const [showPipeline, setShowPipeline] = useState(false);

  useEffect(() => {
    if (targetSegment && tab === "source") {
      const el = segmentRefs.current[targetSegment];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetSegment, tab, doc?.id]);

  const translation = useMemo(
    () => doc?.translations.find((t) => t.language === language),
    [doc, language],
  );

  if (!doc) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Document not found</h1>
        <p className="mt-2 text-ink-soft">
          It may have been cleared by a demo reset.{" "}
          <Link to="/documents" className="text-link font-semibold">
            Back to My Documents
          </Link>
        </p>
      </div>
    );
  }

  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    next.delete("fresh");
    setParams(next, { replace: true });
  };

  const reminderExists = (title: string, dueAt: string) =>
    reminders.some((r) => r.title === title && r.dueAt === dueAt);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="blue">{KIND_LABEL[doc.kind]}</Tag>
            {doc.isImage && <Tag tone="neutral">from photo</Tag>}
            <Tag tone="green">every claim linked to the original</Tag>
            {/* Developer-only engine indicator: dot + tooltip, not a label. */}
            <span
              className={`h-2 w-2 rounded-full ${doc.engine === "gemma" ? "bg-brand" : "bg-line"}`}
              title={doc.engine === "gemma" ? "Live Gemma" : "Validated demo cache"}
              aria-hidden
            />
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{doc.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {doc.issuer} · for {doc.recipient} · uploaded {fmtDate(doc.uploadedAt)}
          </p>
        </div>
        {doc.keyDate && (
          <div className="border-l-4 border-brand bg-brand-soft px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand">{doc.keyDate.label}</p>
            <p className="text-lg font-bold">{fmtDate(doc.keyDate.date)}</p>
          </div>
        )}
      </div>

      {/* Fallback notice — honest about what the user is seeing */}
      {run?.fallbackReason && (
        <div className="mt-4 border-l-4 border-warn bg-warn-soft px-4 py-3 text-sm">
          <strong>Showing the validated cached analysis.</strong> Live Gemma was unavailable
          ({run.fallbackReason}). Start Ollama and re-upload to run this live.
        </div>
      )}

      {/* Fresh-analysis banner */}
      {fresh && run && (
        <div className="mt-4 border border-brand bg-brand-soft px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Analysis complete — {run.verification?.checked ?? 0} claims checked against the
              source · {run.verification?.flagged ?? 0} flagged as uncertain · unsupported claims
              are never shown as fact.
            </p>
            <button
              onClick={() => setShowPipeline((v) => !v)}
              className="text-sm font-bold text-link underline"
            >
              {showPipeline ? "Hide" : "Show"} processing details
            </button>
          </div>
          {showPipeline && (
            <div className="mt-3">
              <AgentPipeline run={run} compact />
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-1 border-b-2 border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-bold ${
              tab === t.id
                ? "-mb-0.5 border-2 border-b-0 border-line border-b-paper bg-paper"
                : "text-link hover:bg-mist"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body: result beside original */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {tab === "overview" && (
            <Overview
              doc={doc}
              addReminder={addReminder}
              reminderExists={reminderExists}
              translation={translation}
              langCode={language}
              onOpenSources={() => setTab("source")}
            />
          )}
          {tab === "details" && (
            <div className="space-y-8">
              <div>
                <h2 className="mb-2 text-lg font-bold">Everything we found</h2>
                <ImportantInfo facts={doc.facts} docId={doc.id} />
              </div>
              <div>
                <h2 className="mb-2 text-lg font-bold">Coverage insights</h2>
                <CoverageTab doc={doc} />
              </div>
            </div>
          )}
          {tab === "source" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                The exact text CareLens read. Citations elsewhere link to these sections.
              </p>
              {doc.segments.map((s) => (
                <p
                  key={s.id}
                  ref={(el) => {
                    segmentRefs.current[s.id] = el;
                  }}
                  className={`border border-line px-4 py-3 text-sm leading-relaxed ${
                    targetSegment === s.id ? "pd-segment-hit" : ""
                  }`}
                >
                  <span className="mr-2 text-xs font-bold text-ink-soft">
                    §{s.id.split("-").pop()}
                  </span>
                  {s.text}
                </p>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <DocPreview doc={doc} />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- sub-views */

/**
 * Results screen, in the order a worried person actually needs it:
 * 1 what it says · 2 what matters most · 3 what to do next
 * 4 important date · 5 add reminder · 6 translation · 7 sources
 * Technical detail lives in the Details tab, below.
 */
function Overview({
  doc,
  addReminder,
  reminderExists,
  translation,
  langCode,
  onOpenSources,
}: {
  doc: import("../types").AnalyzedDocument;
  addReminder: ReturnType<typeof useStore>["addReminder"];
  reminderExists: (t: string, d: string) => boolean;
  translation?: import("../types").TranslationBundle;
  langCode: string;
  onOpenSources: () => void;
}) {
  const warnings = doc.facts.filter((f) => f.category === "warning");
  const attention = [
    ...(doc.plain?.attention ?? []).map((text) => ({ text, citations: [] as string[] })),
    ...warnings.map((w) => ({ text: `${w.label}: ${w.value}`, citations: w.citations })),
  ];

  return (
    <div className="space-y-8">
      {/* 1 — What it says */}
      <section>
        <h2 className="text-xl font-bold">What it says</h2>
        <p className="mt-2 text-lg leading-relaxed">{doc.plainSummary}</p>
        {doc.plain?.whatThisMeans && (
          <p className="mt-2 leading-relaxed text-ink-soft">{doc.plain.whatThisMeans}</p>
        )}
      </section>

      {/* 2 — What matters most */}
      {attention.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">What matters most</h2>
          <div className="mt-2 space-y-2">
            {attention.map((a, i) => (
              <p key={i} className="border-l-4 border-warn bg-warn-soft px-4 py-3">
                {a.text}{" "}
                {a.citations.map((c) => (
                  <CitationChip key={c} documentId={doc.id} segmentId={c} />
                ))}
              </p>
            ))}
          </div>
          {doc.connections.map((c, i) => (
            <p key={i} className="mt-2 border-l-4 border-link bg-[#eef4fa] px-4 py-3">
              {c.text}{" "}
              <Link to={`/documents/${c.relatedDocumentId}`} className="font-bold text-link">
                Open that document →
              </Link>
            </p>
          ))}
        </section>
      )}

      {/* 3 — What to do next */}
      {doc.steps.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">What to do next</h2>
          <ol className="mt-2 space-y-2">
            {doc.steps.map((s) => (
              <li key={s.order} className="flex gap-3 border border-line px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center bg-ink text-sm font-bold text-white">
                  {s.order}
                </span>
                <div>
                  <p className="leading-relaxed">
                    {s.text}{" "}
                    {s.citations.map((c) => (
                      <CitationChip key={c} documentId={doc.id} segmentId={c} />
                    ))}
                  </p>
                  {s.deadline && (
                    <p className="mt-1 text-sm font-semibold text-warn">
                      By {fmtDate(s.deadline)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 4 — Important date */}
      {doc.keyDate && (
        <section>
          <h2 className="text-xl font-bold">Important date</h2>
          <div className="mt-2 border-l-4 border-brand bg-brand-soft px-5 py-4">
            <p className="text-sm font-bold uppercase tracking-wide text-brand">
              {doc.keyDate.label}
            </p>
            <p className="text-2xl font-bold">{fmtDate(doc.keyDate.date)}</p>
          </div>
        </section>
      )}

      {/* 5 — Add reminder */}
      {doc.suggestedReminders.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">Add a reminder</h2>
          {doc.suggestedReminders.map((r, i) => {
            const exists = reminderExists(r.title, r.dueAt);
            return (
              <div
                key={i}
                className="mt-2 flex flex-wrap items-center justify-between gap-3 border border-line px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-ink-soft">
                    {fmtDate(r.dueAt)} — {r.reason}
                  </p>
                </div>
                <button
                  disabled={exists}
                  onClick={() =>
                    addReminder({ title: r.title, dueAt: r.dueAt, reason: r.reason, documentId: doc.id })
                  }
                  className={`px-5 py-2.5 font-bold ${
                    exists
                      ? "cursor-default bg-mist text-ink-soft"
                      : "bg-brand text-white shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
                  }`}
                >
                  {exists ? "✓ Reminder added" : "Add reminder"}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* 6 — Translation */}
      <section>
        <h2 className="text-xl font-bold">Translation</h2>
        <div className="mt-2">
          <Translation translation={translation} langCode={langCode} doc={doc} />
        </div>
      </section>

      {/* 7 — Sources */}
      <section>
        <h2 className="text-xl font-bold">Sources</h2>
        <p className="mt-1 text-ink-soft">
          Every statement above comes from the original document. Nothing is invented.
        </p>
        <button
          onClick={onOpenSources}
          className="mt-3 border-2 border-ink px-5 py-2.5 font-bold hover:bg-mist"
        >
          See the original text
        </button>
        <div className="mt-3">
          <AiDraftNotice />
        </div>
      </section>
    </div>
  );
}

function Translation({
  translation,
  langCode,
  doc,
}: {
  translation?: import("../types").TranslationBundle;
  langCode: string;
  doc: import("../types").AnalyzedDocument;
}) {
  const lang = LANGUAGES.find((l) => l.code === langCode);
  if (langCode === "en")
    return (
      <p className="text-ink-soft">
        Your preferred language is English — the plain-language explanation is already in English.
        Choose another language in the top bar to see a translation.
      </p>
    );
  if (!translation)
    return (
      <div className="border border-dashed border-line bg-mist/50 p-6">
        <p className="font-semibold">
          {lang?.label} translation isn't in the demo cache for this document.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          When live Gemma connects (next phase), translations are generated on demand for all
          eight languages. Demo translations exist for:{" "}
          {doc.translations.map((t) => LANGUAGES.find((l) => l.code === t.language)?.label).join(", ")}.
        </p>
      </div>
    );
  const rtl = translation.language === "ar";
  return (
    <div className="space-y-4" dir={rtl ? "rtl" : "ltr"}>
      <p className="text-lg leading-relaxed">{translation.plainSummary}</p>
      <ol className="space-y-2">
        {translation.steps.map((s, i) => (
          <li key={i} className="flex gap-3 border border-line px-4 py-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center bg-ink text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-soft" dir="ltr">
        Names, dates, amounts and identifiers are kept exactly as in the original.
      </p>
    </div>
  );
}

const FACT_GROUPS: { title: string; categories: ExtractedFact["category"][] }[] = [
  { title: "Key dates", categories: ["date"] },
  { title: "Coverage & amounts", categories: ["coverage", "amount"] },
  { title: "Requirements & actions", categories: ["requirement", "action"] },
  { title: "Warnings", categories: ["warning"] },
  { title: "Program & identifiers", categories: ["program", "identifier"] },
  { title: "Contacts", categories: ["contact"] },
];

function ImportantInfo({ facts, docId }: { facts: ExtractedFact[]; docId: string }) {
  return (
    <div className="space-y-5">
      {FACT_GROUPS.map((g) => {
        const rows = facts.filter((f) => g.categories.includes(f.category));
        if (rows.length === 0) return null;
        return (
          <div key={g.title}>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{g.title}</h3>
            <div className="divide-y divide-line border border-line">
              {rows.map((f) => (
                <div key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="text-sm">{f.value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.verification === "verified" ? (
                      <Tag tone="green">verified in source</Tag>
                    ) : (
                      <Tag tone="amber">uncertain</Tag>
                    )}
                    {f.citations.map((c) => (
                      <CitationChip key={c} documentId={docId} segmentId={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CoverageTab({ doc }: { doc: import("../types").AnalyzedDocument }) {
  if (doc.insights.length === 0)
    return <p className="text-ink-soft">No possible coverage matches were found in this document.</p>;
  return (
    <div className="space-y-4">
      {doc.insights.map((ins) => {
        const prog = programById(ins.programId);
        return (
          <Card key={ins.id}>
            <Tag tone={ins.confidence === "possible" ? "green" : "amber"}>
              {ins.confidence === "possible" ? "You may be eligible" : "More information required"}
            </Tag>
            <h3 className="mt-2 text-lg font-bold">{prog?.name}</h3>
            <p className="mt-1 text-sm">{ins.headline}</p>
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Why it may match</p>
              {ins.whyItMayMatch.map((w, i) => (
                <p key={i} className="mt-1 text-sm">
                  {w.text}{" "}
                  {w.citations.map((c) => (
                    <CitationChip key={c} documentId={doc.id} segmentId={c} />
                  ))}
                </p>
              ))}
            </div>
            {ins.missingInformation.length > 0 && (
              <p className="mt-2 text-sm">
                <strong className="text-warn">Still needed:</strong> {ins.missingInformation.join(", ")}
              </p>
            )}
            <p className="mt-2 text-sm">
              <strong>Potential benefit:</strong> {ins.potentialBenefit}
            </p>
            <Link to="/coverage" className="mt-3 inline-block text-sm font-bold text-link">
              Full details & application steps →
            </Link>
          </Card>
        );
      })}
      <EligibilityDisclaimer />
    </div>
  );
}

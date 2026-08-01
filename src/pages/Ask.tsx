import { useState } from "react";
import { Link } from "react-router-dom";
import { provider } from "../services";
import { useDocuments, useStore } from "../services/store";
import { CitationChip, Tag } from "../components/common";
import { SUGGESTED_QUESTIONS } from "../fixtures/ask";
import type { AskAnswer } from "../types";

/**
 * Ask PlainDocs — grounded Q&A across the user's documents. Answers cite
 * source segments; when the documents don't contain the answer, it says so.
 */
export default function Ask() {
  const docs = useDocuments();
  const { documents } = useStore();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AskAnswer[]>([]);
  const [error, setError] = useState("");

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const answer = await provider.ask(trimmed, docs);
      setHistory((h) => [answer, ...h]);
      setQuestion("");
    } catch {
      setError("Something went wrong answering that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Ask PlainDocs</h1>
      <p className="mt-1 text-ink-soft">
        Ask about anything in your {docs.length} uploaded document{docs.length !== 1 ? "s" : ""}.
        Answers come only from your documents and always show their sources.
      </p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. When does my coverage expire?"
          className="w-full border-2 border-ink px-4 py-3 text-lg"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className={`shrink-0 px-6 py-3 font-bold ${
            busy || !question.trim()
              ? "cursor-not-allowed bg-mist text-ink-soft"
              : "bg-brand text-white shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
          }`}
        >
          {busy ? "Searching…" : "Ask"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => void submit(q)}
            disabled={busy}
            className="border border-line px-3 py-1.5 text-sm text-link hover:border-link"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-4 border-l-4 border-alert bg-alert-soft px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      {busy && (
        <div className="mt-6 border border-line bg-mist/40 px-4 py-6 text-center">
          <p className="font-semibold text-ink-soft pd-pulse">Searching your documents…</p>
        </div>
      )}

      <div className="mt-6 space-y-5">
        {history.map((a, i) => (
          <div key={i} className="border border-line bg-paper pd-fade-up">
            <div className="border-b border-line bg-mist/50 px-5 py-3">
              <p className="font-bold">{a.question}</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {a.status === "not_found" && <Tag tone="amber">not found in your documents</Tag>}
              {a.paragraphs.map((p, j) => (
                <p key={j} className="leading-relaxed">
                  {p.text}{" "}
                  {p.citations.map((c) => {
                    const doc = documents[c.documentId];
                    return (
                      <CitationChip
                        key={`${c.documentId}-${c.segmentId}`}
                        documentId={c.documentId}
                        segmentId={c.segmentId}
                        label={doc ? `${doc.title.split("—")[0].trim()} §${c.segmentId.split("-").pop()}` : undefined}
                      />
                    );
                  })}
                </p>
              ))}
              <p className="text-xs text-ink-soft">
                Answered from your documents only · engine: {a.fromCache ? "demo cache" : "Gemma"} ·
                click a source to see the original text
              </p>
            </div>
          </div>
        ))}
        {history.length === 0 && !busy && (
          <p className="text-sm text-ink-soft">
            Tip: try a suggested question above, or{" "}
            <Link to="/documents" className="font-semibold text-link">
              browse your documents
            </Link>{" "}
            first.
          </p>
        )}
      </div>
    </div>
  );
}

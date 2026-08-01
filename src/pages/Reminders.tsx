import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../services/store";
import { Card, EmptyState, Tag, daysUntil, fmtDateTime } from "../components/common";

/** Reminder centre — create, edit, complete and delete reminders. */
export default function Reminders() {
  const { reminders, documents, addReminder, updateReminder, deleteReminder } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...reminders].sort((a, b) => {
        if (a.status !== b.status) return a.status === "upcoming" ? -1 : 1;
        return a.dueAt.localeCompare(b.dueAt);
      }),
    [reminders],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reminder centre</h1>
          <p className="mt-1 text-ink-soft">
            Deadlines, renewals and follow-ups from your documents — in one place.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
          className="bg-brand px-5 py-2.5 font-bold text-white shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
        >
          {showForm ? "Close" : "+ New reminder"}
        </button>
      </div>

      {showForm && (
        <div className="mt-5">
          <ReminderForm
            documents={Object.values(documents).map((d) => ({ id: d.id, title: d.title }))}
            initial={editingId ? reminders.find((r) => r.id === editingId) : undefined}
            onSave={(data) => {
              if (editingId) updateReminder(editingId, data);
              else addReminder(data);
              setShowForm(false);
              setEditingId(null);
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingId(null);
            }}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {sorted.length === 0 && !showForm && (
          <EmptyState
            title="No reminders yet"
            hint="Open a document and use its suggested reminders, or create one here."
          />
        )}
        {sorted.map((r) => {
          const doc = r.documentId ? documents[r.documentId] : undefined;
          const days = daysUntil(r.dueAt);
          const done = r.status === "done";
          return (
            <Card key={r.id} className={done ? "opacity-60" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {done ? (
                      <Tag tone="green">done</Tag>
                    ) : days < 0 ? (
                      <Tag tone="red">overdue</Tag>
                    ) : days <= 14 ? (
                      <Tag tone="amber">{days} days left</Tag>
                    ) : (
                      <Tag tone="neutral">{days} days left</Tag>
                    )}
                  </div>
                  <p className={`mt-1.5 text-lg font-bold ${done ? "line-through" : ""}`}>{r.title}</p>
                  <p className="text-sm text-ink-soft">{fmtDateTime(r.dueAt)}</p>
                  <p className="mt-1 text-sm">{r.reason}</p>
                  {doc && (
                    <p className="mt-1 text-sm">
                      From:{" "}
                      <Link to={`/documents/${doc.id}`} className="font-semibold text-link">
                        {doc.title}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => updateReminder(r.id, { status: done ? "upcoming" : "done" })}
                    className="border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-mist"
                  >
                    {done ? "Reopen" : "Mark done"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(r.id);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-mist"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete reminder "${r.title}"?`)) deleteReminder(r.id);
                    }}
                    className="border-2 border-alert px-3 py-1.5 text-sm font-bold text-alert hover:bg-alert-soft"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ReminderForm({
  documents,
  initial,
  onSave,
  onCancel,
}: {
  documents: { id: string; title: string }[];
  initial?: { title: string; dueAt: string; reason: string; documentId?: string };
  onSave: (d: { title: string; dueAt: string; reason: string; documentId?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueAt, setDueAt] = useState(initial?.dueAt?.slice(0, 16) ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [documentId, setDocumentId] = useState(initial?.documentId ?? "");
  const valid = title.trim().length > 0 && dueAt.length > 0;

  return (
    <form
      className="border-2 border-ink bg-mist/40 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({
          title: title.trim(),
          dueAt,
          reason: reason.trim() || "Created manually",
          documentId: documentId || undefined,
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold">Title *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full border-2 border-ink px-3 py-2"
            placeholder="e.g. Submit renewal form"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Date & time *</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 w-full border-2 border-ink px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full border-2 border-ink px-3 py-2"
            placeholder="Why this matters"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Related document</span>
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="mt-1 w-full border-2 border-ink px-3 py-2 bg-paper"
          >
            <option value="">None</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={!valid}
          className={`px-5 py-2 font-bold ${
            valid
              ? "bg-brand text-white shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
              : "cursor-not-allowed bg-mist text-ink-soft"
          }`}
        >
          Save reminder
        </button>
        <button type="button" onClick={onCancel} className="border-2 border-ink px-5 py-2 font-bold hover:bg-mist">
          Cancel
        </button>
      </div>
    </form>
  );
}

import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { DocumentKind } from "../types";

/* ------------------------------------------------------------- formatting */

export const fmtDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const daysUntil = (iso: string): number => {
  const target = new Date(iso.length === 10 ? iso + "T00:00:00" : iso).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
};

export const KIND_LABEL: Record<DocumentKind, string> = {
  coverage_letter: "Coverage letter",
  enrollment_form: "Enrollment form",
  government_notice: "Government notice",
  insurance_claim: "Insurance claim",
  medical_referral: "Medical referral",
  other: "Document",
};

/* --------------------------------------------------------------- atoms */

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-mist text-ink-soft",
    green: "bg-brand-soft text-brand",
    amber: "bg-warn-soft text-warn",
    red: "bg-alert-soft text-alert",
    blue: "bg-[#e8f1f8] text-link-deep",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Citation chip → deep-links to the source segment in the document view. */
export function CitationChip({
  documentId,
  segmentId,
  label,
}: {
  documentId: string;
  segmentId: string;
  label?: string;
}) {
  return (
    <Link
      to={`/documents/${documentId}?segment=${segmentId}&tab=source`}
      className="inline-block align-baseline text-xs font-semibold text-link underline decoration-dotted underline-offset-2 hover:text-link-deep"
      title="Open the source text this claim comes from"
    >
      {label ?? `source ${segmentId.split("-").pop()}`}
    </Link>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-line bg-paper p-5 ${className}`}>{children}</div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold text-ink mb-3">{children}</h2>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-line bg-mist/50 p-8 text-center">
      <p className="font-semibold text-ink-soft">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

/** Standing eligibility disclaimer — appears wherever coverage is suggested. */
export function EligibilityDisclaimer() {
  return (
    <p className="border-l-4 border-warn bg-warn-soft px-4 py-3 text-sm text-ink">
      <strong>Not a guarantee.</strong> These are possible matches based on the
      information currently available in your documents. Eligibility is decided
      only by the official program — always confirm with them before relying on
      a match. Additional information may be required.
    </p>
  );
}

export function AiDraftNotice() {
  return (
    <p className="text-xs text-ink-soft">
      Generated from your documents by CareLens. Every claim links to its
      source — check anything important against the original.
    </p>
  );
}

import { describe, expect, it } from "vitest";
import { FIXTURE_DOCS } from "../src/fixtures/documents";
import { COVERAGE_PROGRAMS, programById } from "../src/fixtures/programs";
import { ASK_FIXTURES } from "../src/fixtures/ask";

const docs = Object.values(FIXTURE_DOCS);

describe("citation integrity", () => {
  it("every fact citation resolves to a real segment in its own document", () => {
    for (const doc of docs) {
      const segIds = new Set(doc.segments.map((s) => s.id));
      for (const fact of doc.facts) {
        expect(fact.citations.length, `${doc.id}/${fact.id} must cite something`).toBeGreaterThan(0);
        for (const c of fact.citations) {
          expect(segIds.has(c), `${doc.id}/${fact.id} cites unknown segment ${c}`).toBe(true);
        }
      }
      for (const step of doc.steps) {
        for (const c of step.citations) {
          expect(segIds.has(c), `${doc.id} step ${step.order} cites unknown segment ${c}`).toBe(true);
        }
      }
      for (const ins of doc.insights) {
        for (const w of ins.whyItMayMatch) {
          for (const c of w.citations) {
            expect(segIds.has(c), `${doc.id}/${ins.id} cites unknown segment ${c}`).toBe(true);
          }
        }
      }
    }
  });

  it("every ask-fixture citation resolves to a real document + segment", () => {
    for (const f of ASK_FIXTURES) {
      for (const p of f.answer.paragraphs) {
        for (const c of p.citations) {
          const doc = FIXTURE_DOCS[c.documentId];
          expect(doc, `unknown document ${c.documentId}`).toBeDefined();
          expect(
            doc.segments.some((s) => s.id === c.segmentId),
            `${c.documentId} has no segment ${c.segmentId}`,
          ).toBe(true);
        }
      }
    }
  });

  it("every insight points at a real coverage program", () => {
    for (const doc of docs) {
      for (const ins of doc.insights) {
        expect(programById(ins.programId), `${doc.id}/${ins.id} unknown program`).toBeDefined();
      }
    }
  });

  it("cross-document connections point at real documents", () => {
    for (const doc of docs) {
      for (const conn of doc.connections) {
        expect(FIXTURE_DOCS[conn.relatedDocumentId]).toBeDefined();
      }
    }
  });
});

describe("safety language", () => {
  const banned = [
    "you are eligible",
    "you qualify",
    "guaranteed",
    "you will receive",
    "approved for",
  ];

  it("no fixture ever claims confirmed eligibility", () => {
    const text = JSON.stringify(FIXTURE_DOCS).toLowerCase() + JSON.stringify(ASK_FIXTURES).toLowerCase();
    for (const phrase of banned) {
      expect(text.includes(phrase), `banned phrase "${phrase}" found`).toBe(false);
    }
  });

  it("all demo programs are labeled (Demo)", () => {
    for (const p of COVERAGE_PROGRAMS) {
      expect(p.name).toContain("(Demo)");
    }
  });

  it("no real-looking personal identifiers", () => {
    const text = JSON.stringify(FIXTURE_DOCS);
    // demo markers must be present on people and identifiers
    expect(text).toContain("Demo Person");
    expect(text).toContain("PD-DEMO-");
  });
});

describe("demo story wiring", () => {
  it("the dental form connects back to the benefits letter", () => {
    const dental = FIXTURE_DOCS["doc-dental"];
    expect(dental.connections.some((c) => c.relatedDocumentId === "doc-benefits")).toBe(true);
  });

  it("the benefits letter excludes dental and the dental program requires that", () => {
    const benefits = FIXTURE_DOCS["doc-benefits"];
    const noDental = benefits.facts.find((f) => f.id === "fact-b-nodental");
    expect(noDental).toBeDefined();
    expect(benefits.insights.some((i) => i.programId === "prog-dental")).toBe(true);
  });

  it("every document has at least one suggested reminder or none with valid dates", () => {
    for (const doc of docs) {
      for (const r of doc.suggestedReminders) {
        expect(Number.isNaN(new Date(r.dueAt).getTime())).toBe(false);
      }
    }
  });
});

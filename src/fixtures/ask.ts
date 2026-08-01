import type { AskAnswer } from "../types";

/**
 * Cached grounded answers for Ask PlainDocs. Each entry has keyword
 * matchers; the fixture provider picks the best match or returns a
 * clearly-labeled "not found" answer. Every claim cites a real segment.
 */
export interface AskFixture {
  matchers: string[]; // lowercase keywords — all in one group must match
  answer: AskAnswer;
}

export const ASK_FIXTURES: AskFixture[] = [
  {
    matchers: ["expire", "coverage"],
    answer: {
      question: "When does my coverage expire?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "Your MapleShield extended health benefits are in effect until December 31, 2026.",
          citations: [{ documentId: "doc-benefits", segmentId: "seg-b-02" }],
        },
        {
          text: "To keep coverage for 2027, your renewal declaration must be received before November 15, 2026.",
          citations: [{ documentId: "doc-benefits", segmentId: "seg-b-05" }],
        },
      ],
    },
  },
  {
    matchers: ["dental", "included"],
    answer: {
      question: "Is dental care included?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "No — your benefits letter states that dental services of any kind are excluded from the Group 400 plan.",
          citations: [{ documentId: "doc-benefits", segmentId: "seg-b-04" }],
        },
        {
          text: "You may be eligible for the Community Dental Support Program (Demo), which exists for people whose plans exclude dental. Confirm with the official program before relying on this.",
          citations: [{ documentId: "doc-dental", segmentId: "seg-d-03" }],
        },
      ],
    },
  },
  {
    matchers: ["policy", "number"],
    answer: {
      question: "Which document contains my policy number?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "Your policy number PD-DEMO-448812 appears in the Extended Health Benefits Confirmation Letter from MapleShield.",
          citations: [{ documentId: "doc-benefits", segmentId: "seg-b-01" }],
        },
      ],
    },
  },
  {
    matchers: ["submit", "need"],
    answer: {
      question: "What do I need to submit?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "For the dental program: the completed enrollment form (sections A–D), proof of household income, and a statement that your plan excludes dental — your MapleShield letter covers that last one. Deadline: September 30, 2026.",
          citations: [
            { documentId: "doc-dental", segmentId: "seg-d-02" },
            { documentId: "doc-dental", segmentId: "seg-d-03" },
            { documentId: "doc-dental", segmentId: "seg-d-04" },
          ],
        },
        {
          text: "For your benefits renewal: the Renewal Declaration (Form RD-27) before November 15, 2026.",
          citations: [{ documentId: "doc-benefits", segmentId: "seg-b-05" }],
        },
      ],
    },
  },
  {
    matchers: ["next", "do"],
    answer: {
      question: "What should I do next?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "The nearest deadline in your documents is September 30, 2026 — the dental program application must be received by then, and incomplete applications are returned without processing.",
          citations: [{ documentId: "doc-dental", segmentId: "seg-d-04" }],
        },
        {
          text: "The one document you still need is proof of household income. After that, your renewal declaration is due before November 15, 2026.",
          citations: [
            { documentId: "doc-dental", segmentId: "seg-d-02" },
            { documentId: "doc-benefits", segmentId: "seg-b-05" },
          ],
        },
      ],
    },
  },
  {
    matchers: ["qualify", "program"],
    answer: {
      question: "Do my documents suggest I may qualify for another program?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "Possibly. Based on the information currently available, your plan's dental exclusion matches the main requirement of the Community Dental Support Program (Demo).",
          citations: [
            { documentId: "doc-benefits", segmentId: "seg-b-04" },
            { documentId: "doc-dental", segmentId: "seg-d-03" },
          ],
        },
        {
          text: "This is not a guarantee of eligibility — additional information is required (proof of income), and you should confirm with the official program.",
          citations: [{ documentId: "doc-dental", segmentId: "seg-d-02" }],
        },
      ],
    },
  },
  {
    matchers: ["physio"],
    answer: {
      question: "How much physiotherapy is covered?",
      status: "answered",
      fromCache: true,
      paragraphs: [
        {
          text: "Your plan covers physiotherapy up to $500 per year.",
          citations: [{ documentId: "doc-benefits", segmentId: "seg-b-03" }],
        },
      ],
    },
  },
];

export const NOT_FOUND_ANSWER = (question: string): AskAnswer => ({
  question,
  status: "not_found",
  fromCache: true,
  paragraphs: [
    {
      text: "I couldn't find this in your uploaded documents. PlainDocs only answers from documents you have added — it does not guess. Try uploading the document that contains this information, or rephrase your question.",
      citations: [],
    },
  ],
});

export const SUGGESTED_QUESTIONS = [
  "When does my coverage expire?",
  "Is dental care included?",
  "What do I need to submit?",
  "Which document contains my policy number?",
  "What should I do next?",
  "Do my documents suggest I may qualify for another program?",
];

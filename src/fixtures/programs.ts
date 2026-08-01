import type { CoverageProgram } from "../types";

/**
 * Local demonstration knowledge base of coverage programs.
 * Every program is FICTIONAL and carries a "(Demo)" suffix.
 * CareLens never claims confirmed eligibility against these.
 */
export const COVERAGE_PROGRAMS: CoverageProgram[] = [
  {
    id: "prog-dental",
    name: "Community Dental Support Program (Demo)",
    administrator: "Demo Regional Health Services",
    summary:
      "A demonstration program that helps cover basic dental care for residents whose health plan does not include dental benefits.",
    potentialBenefit: "Up to $1,300 per year toward basic dental care (demo figure).",
    applicationSteps: [
      "Complete the enrollment form",
      "Attach proof of household income",
      "Attach a statement showing your current coverage does not include dental",
      "Submit before the program deadline",
    ],
    officialContact: "Confirm details with the official program office (demo: 1-800-555-0134).",
  },
  {
    id: "prog-copay",
    name: "Prescription Copay Relief (Demo)",
    administrator: "Demo Provincial Pharmacare Office",
    summary:
      "A demonstration program that reduces the portion of prescription costs you pay yourself when your plan covers less than 100%.",
    potentialBenefit: "Could reduce your 20% prescription copay (demo figure).",
    applicationSteps: [
      "Provide your current drug coverage percentage",
      "Provide proof of household income",
      "Apply online or by mail",
    ],
    officialContact: "Confirm details with the official pharmacare office (demo: 1-800-555-0178).",
  },
  {
    id: "prog-transport",
    name: "Health Travel Support (Demo)",
    administrator: "Demo Community Assistance Office",
    summary:
      "A demonstration program that reimburses travel costs for medical appointments for people receiving provincial assistance.",
    potentialBenefit: "Reimbursement for bus fare or mileage to medical appointments (demo).",
    applicationSteps: [
      "Show that you receive provincial assistance",
      "Keep receipts for travel to appointments",
      "Submit a claim within 90 days of travel",
    ],
    officialContact: "Confirm details with the official assistance office (demo: 1-800-555-0192).",
  },
  {
    id: "prog-vision",
    name: "Vision Care Boost 55+ (Demo)",
    administrator: "Demo Regional Health Services",
    summary:
      "A demonstration program that tops up vision care allowances for residents aged 55 and older.",
    potentialBenefit: "An additional $150 toward eyewear every two years (demo figure).",
    applicationSteps: [
      "Confirm your age with government ID",
      "Show your current vision allowance",
      "Apply at a participating provider",
    ],
    officialContact: "Confirm details with the official program office (demo: 1-800-555-0121).",
  },
];

export const programById = (id: string): CoverageProgram | undefined =>
  COVERAGE_PROGRAMS.find((p) => p.id === id);

import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../src/services/fixtureProvider";

const provider = new FixtureProvider();

describe("fixture provider — analyze", () => {
  it("routes images to the photographed dental form", async () => {
    const result = await provider.analyze(
      { fileName: "photo.jpg", mimeType: "image/jpeg" },
      "es",
      () => {},
    );
    expect(result.document.id).toBe("doc-dental");
    expect(result.document.isImage).toBe(true);
    expect(result.document.uploadedAt).not.toBe("");
  }, 15000);

  it("routes non-images to the renewal notice and runs all six agents", async () => {
    const updates: string[] = [];
    const result = await provider.analyze(
      { fileName: "notice.pdf", mimeType: "application/pdf" },
      "en",
      (p) => updates.push(p.run.stages.map((s) => s.status).join(",")),
    );
    expect(result.document.id).toBe("doc-notice");
    expect(result.run.stages).toHaveLength(6);
    // translation is skipped for English targets
    expect(result.run.stages.find((s) => s.agent === "translation")?.status).toBe("skipped");
    const others = result.run.stages.filter((s) => s.agent !== "translation");
    expect(others.every((s) => s.status === "done")).toBe(true);
    expect(updates.length).toBeGreaterThan(5);
    // verification always reports
    expect(result.run.verification?.checked).toBeGreaterThan(0);
    expect(result.run.verification?.flagged).toBe(0);
  }, 15000);
});

describe("fixture provider — ask", () => {
  it("answers grounded questions with citations", async () => {
    const a = await provider.ask("When does my coverage expire?");
    expect(a.status).toBe("answered");
    expect(a.paragraphs[0].citations.length).toBeGreaterThan(0);
  });

  it("says not_found instead of guessing", async () => {
    const a = await provider.ask("What is the weather in Toronto?");
    expect(a.status).toBe("not_found");
    expect(a.paragraphs[0].citations).toHaveLength(0);
    expect(a.paragraphs[0].text.toLowerCase()).toContain("couldn't find");
  });

  it("hedges eligibility language in program-match answers", async () => {
    const a = await provider.ask("Do my documents suggest I may qualify for another program?");
    const text = a.paragraphs.map((p) => p.text).join(" ").toLowerCase();
    expect(text).toContain("not a guarantee");
    expect(text.includes("you are eligible")).toBe(false);
  });
});

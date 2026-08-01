/**
 * Hosted-path tests. No API key and no network: the provider fetch is mocked,
 * so these verify OUR contract — request shape, key handling, grounding,
 * citation validation and fallback wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunkToSegments,
  findQuoteSegment,
  parseHumanDate,
  BANNED_ELIGIBILITY,
} from "../api/_lib/text";
import { retrieveLexical } from "../src/services/hostedProvider";
import { BENEFITS_DOC, DENTAL_FORM_DOC } from "../src/fixtures/documents";

describe("server text helpers", () => {
  it("chunks a transcript into stable citable segments", () => {
    const segs = chunkToSegments("First para.\n\nSecond para here.", "x");
    expect(segs.map((s) => s.id)).toEqual(["seg-x-01", "seg-x-02"]);
  });

  it("grounds a verbatim quote to its segment", () => {
    const segs = chunkToSegments("Applications must be received by September 30, 2026.", "x");
    expect(findQuoteSegment("received by September 30, 2026", segs)).toBe("seg-x-01");
  });

  it("returns null for a quote that is not in the source (no invented citation)", () => {
    const segs = chunkToSegments("Applications must be received by September 30, 2026.", "x");
    expect(findQuoteSegment("you will receive $500 per month", segs)).toBeNull();
  });

  it("parses human dates deterministically", () => {
    expect(parseHumanDate("by September 30, 2026")).toBe("2026-09-30");
    expect(parseHumanDate("2026-08-20")).toBe("2026-08-20");
    expect(parseHumanDate("sometime next year")).toBeUndefined();
  });

  it("flags certainty language", () => {
    expect(BANNED_ELIGIBILITY.test("You are eligible for this")).toBe(true);
    expect(BANNED_ELIGIBILITY.test("You may be eligible for this")).toBe(false);
  });
});

describe("hosted client key handling", () => {
  const OLD = process.env.GEMMA_API_KEY;
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env.GEMMA_API_KEY = OLD;
    vi.restoreAllMocks();
  });

  it("reports not-configured when no key is set", async () => {
    delete process.env.GEMMA_API_KEY;
    const { readConfig } = await import("../api/_lib/hosted");
    expect(readConfig()).toBeNull();
  });

  it("sends the key as a header, never in the URL or body", async () => {
    process.env.GEMMA_API_KEY = "test-key-123";
    const { readConfig, callGemma } = await import("../api/_lib/hosted");
    const cfg = readConfig()!;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await callGemma(cfg, { prompt: "hello" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("test-key-123");
    expect(String(init.body)).not.toContain("test-key-123");
    expect(init.headers["x-goog-api-key"]).toBe("test-key-123");
  });

  it("scrubs the key out of provider error messages", async () => {
    process.env.GEMMA_API_KEY = "secret-abc";
    const { readConfig, callGemma } = await import("../api/_lib/hosted");
    const cfg = readConfig()!;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "denied for key secret-abc",
      }),
    );
    await expect(callGemma(cfg, { prompt: "x" })).rejects.toThrow(/\[redacted\]/);
  });

  it("retries once and then succeeds", async () => {
    process.env.GEMMA_API_KEY = "k";
    const { readConfig, callGemma } = await import("../api/_lib/hosted");
    const cfg = readConfig()!;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await callGemma(cfg, { prompt: "x" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry rather than hanging", async () => {
    process.env.GEMMA_API_KEY = "k";
    const { readConfig, callGemma } = await import("../api/_lib/hosted");
    const cfg = readConfig()!;
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    vi.stubGlobal("fetch", fetchMock);
    await expect(callGemma(cfg, { prompt: "x" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("extracts JSON from fenced model output", async () => {
    const { extractJSON } = await import("../api/_lib/hosted");
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});

describe("lexical retrieval for Ask", () => {
  const docs = [BENEFITS_DOC, DENTAL_FORM_DOC];

  it("finds the dental exclusion passage", () => {
    const hits = retrieveLexical("Is dental care included?", docs, 6);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.segmentId === "seg-b-04")).toBe(true);
  });

  it("finds the coverage dates passage", () => {
    const hits = retrieveLexical("When does my coverage expire?", docs, 6);
    expect(hits.some((h) => h.documentId === "doc-benefits")).toBe(true);
  });

  it("returns nothing for an unrelated question", () => {
    expect(retrieveLexical("zzzz qqqq wwww", docs, 6)).toHaveLength(0);
  });
});

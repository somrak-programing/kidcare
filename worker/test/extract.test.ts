import { describe, expect, test, vi } from "vitest";
import { buildParams, extractVaccines, type ClaudeLike } from "../src/extract";

const images = [{ mediaType: "image/jpeg" as const, data: "AAAA" }];
const rec = {
  pageIndex: 0, vaccineRaw: "BCG", vaccineCode: "BCG", doseNo: 1, dateRaw: "1/7/66", dateGiven: "2023-07-01",
  lotNo: null, place: "รพ.เมือง", confidence: "high", note: null,
};

function fake(res: { stop_reason: string | null; content: Array<{ type: string; text?: string }> }) {
  const create = vi.fn().mockResolvedValue(res);
  return { client: { beta: { messages: { create } } } as ClaudeLike, create };
}

describe("buildParams", () => {
  test("model, fallback, structured output, images before text", () => {
    const p = buildParams(images, "2023-07-01", "2026-10-01") as any;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.fallbacks).toBe("default");
    expect(p.output_config.effort).toBe("medium");
    expect(p.output_config.format.type).toBe("json_schema");
    const content = p.messages[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
    expect(content.at(-1).type).toBe("text");
    expect(content.at(-1).text).toContain("2023-07-01");
    expect(content.at(-1).text).toContain("2026-10-01");
  });
});

describe("extractVaccines", () => {
  test("returns validated records and drops out-of-range pageIndex", async () => {
    const { client, create } = fake({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ records: [rec, { ...rec, pageIndex: 3 }] }) }] });
    expect(await extractVaccines(client, images, "2023-07-01")).toEqual([rec]);
    expect(create).toHaveBeenCalledOnce();
  });
  test("ignores non-text blocks (e.g. fallback/thinking)", async () => {
    const { client } = fake({ stop_reason: "end_turn", content: [{ type: "thinking" }, { type: "text", text: JSON.stringify({ records: [] }) }] });
    expect(await extractVaccines(client, images, "2023-07-01")).toEqual([]);
  });
  test.each([
    ["refusal", { stop_reason: "refusal", content: [] }],
    ["truncated", { stop_reason: "max_tokens", content: [{ type: "text", text: "{\"records\":[" }] }],
    ["invalid_output", { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] }],
    ["invalid_output", { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ records: [{ ...rec, vaccineCode: "XYZ" }] }) }] }],
  ])("throws %s", async (code, res) => {
    const { client } = fake(res);
    await expect(extractVaccines(client, images, "2023-07-01")).rejects.toMatchObject({ code });
  });
});

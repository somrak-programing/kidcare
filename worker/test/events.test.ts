import { describe, expect, test, vi } from "vitest";
import type { ClaudeLike } from "../src/extract";
import { buildEventParams, extractEvents } from "../src/events/extract";

const sampleEvent = {
  title: "วันสุดท้ายของภาคเรียน",
  date: "2026-10-07",
  time: null,
  place: "โรงเรียน",
  notes: "เด็กๆ มาโรงเรียนวันสุดท้ายของภาคเรียน",
};

function fake(res: { stop_reason: string | null; content: Array<{ type: string; text?: string }> }) {
  const create = vi.fn().mockResolvedValue(res);
  return { client: { beta: { messages: { create } } } as ClaudeLike, create };
}

describe("buildEventParams", () => {
  test("generates valid prompt and JSON schema request", () => {
    const p = buildEventParams("วันสุดท้ายของภาคเรียน พุธ 7 ตุลาคม", "2026-10-05") as any;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.output_config.format.type).toBe("json_schema");
    expect(p.messages[0].content[0].text).toContain("2026-10-05");
    expect(p.messages[0].content[0].text).toContain("วันสุดท้ายของภาคเรียน");
  });
});

describe("extractEvents", () => {
  test("returns empty array when text is empty or blank", async () => {
    const { client } = fake({ stop_reason: "end_turn", content: [] });
    expect(await extractEvents(client, "   ")).toEqual([]);
  });

  test("returns validated events from Claude JSON output", async () => {
    const { client, create } = fake({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ events: [sampleEvent] }) }],
    });
    const res = await extractEvents(client, "เด็กๆมาโรงเรียนวันสุดท้ายของภาคเรียน พุธ 7 ต.ค.", "2026-10-05");
    expect(res).toEqual([sampleEvent]);
    expect(create).toHaveBeenCalledOnce();
  });

  test("handles empty events list when no dates are in text", async () => {
    const { client } = fake({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ events: [] }) }],
    });
    const res = await extractEvents(client, "สวัสดีครับคุณครู", "2026-10-05");
    expect(res).toEqual([]);
  });

  test.each([
    ["refusal", { stop_reason: "refusal", content: [] }],
    ["truncated", { stop_reason: "max_tokens", content: [{ type: "text", text: "{\"events\":[" }] }],
    ["invalid_output", { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] }],
  ])("throws %s on error response", async (code, res) => {
    const { client } = fake(res);
    await expect(extractEvents(client, "some text", "2026-10-05")).rejects.toMatchObject({ code });
  });
});

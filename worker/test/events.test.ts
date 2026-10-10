import { describe, expect, test, vi } from "vitest";
import type { ClaudeLike } from "../src/extract";
import { buildEventParams, extractEvents } from "../src/events/extract";
import { parseThaiEvents } from "../src/events/thaiParser";

const sampleUserMessage = `@All 

✅เด็กๆมาโรงเรียนวัดสุดท้ายของภาคเรียน >>>คือวันพุธ ที่ 7 ตุลาคมนี้ค่า

✅เปิดเทอมภาคเรียนที่ 2 
>>>วันที่ 29 ตุลาคมค่า`;

function fake(res: { stop_reason: string | null; content: Array<{ type: string; text?: string }> }) {
  const create = vi.fn().mockResolvedValue(res);
  return { client: { beta: { messages: { create } } } as ClaudeLike, create };
}

describe("parseThaiEvents", () => {
  test("extracts school closing and opening from user's exact message with typo fix", () => {
    const events = parseThaiEvents(sampleUserMessage, "2026-10-05");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "เด็กๆมาโรงเรียนวันสุดท้ายของภาคเรียน",
      date: "2026-10-07",
      place: "โรงเรียน",
    });
    expect(events[1]).toMatchObject({
      title: "เปิดเทอมภาคเรียนที่ 2",
      date: "2026-10-29",
      place: "โรงเรียน",
    });
  });

  test("handles Thai Buddhist Era years like 15 พ.ย. 69 or 2569", () => {
    const events = parseThaiEvents("สอบปลายภาค วันที่ 15 พ.ย. 69", "2026-10-05");
    expect(events).toEqual([
      expect.objectContaining({
        title: "สอบปลายภาค",
        date: "2026-11-15",
      }),
    ]);
  });

  test("extracts relative date 'ในวันพรุ่งนี้' from workplace announcement", () => {
    const text = `เรียน พนักงานทุกท่าน

แจ้งเตือนเกี่ยวกับกิจกรรมทำบุญตักบาตรที่จะมาถึงในวันพรุ่งนี้

ขอเรียนเชิญพนักงานทุกท่านมาร่วมทำบุญด้วยกันนะครับ`;

    const events = parseThaiEvents(text, "2026-10-06");
    expect(events).toEqual([
      expect.objectContaining({
        title: "กิจกรรมทำบุญตักบาตร",
        date: "2026-10-07",
        place: "ที่ทำงาน",
      }),
    ]);
  });

  test("extracts directly typed message 'พรุ่งนี้เอารถยอมตั้งศูนย์ที่ปลวกแดงเวลา 14.00 น.'", () => {
    const events = parseThaiEvents("พรุ่งนี้เอารถยอมตั้งศูนย์ที่ปลวกแดงเวลา 14.00 น.", "2026-10-08");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "เอารถยอมตั้งศูนย์ที่ปลวกแดง",
      date: "2026-10-09",
      time: "14:00",
    });
  });

  test("extracts colloquial times like 9 โมง, บ่ายสอง, and relative weekdays like วันศุกร์นี้", () => {
    // 2026-10-08 is Thursday. วันศุกร์นี้ = 2026-10-09 (Friday)
    const friEvents = parseThaiEvents("วันศุกร์นี้ บ่ายสอง มีนัดตัดผม", "2026-10-08");
    expect(friEvents).toHaveLength(1);
    expect(friEvents[0]).toMatchObject({
      title: "มีนัดตัดผม",
      date: "2026-10-09",
      time: "14:00",
    });

    const morningEvents = parseThaiEvents("พรุ่งนี้ 9 โมง พาแม่ไปหาหมอ", "2026-10-08");
    expect(morningEvents).toHaveLength(1);
    expect(morningEvents[0]).toMatchObject({
      title: "พาแม่ไปหาหมอ",
      date: "2026-10-09",
      time: "09:00",
      place: "โรงพยาบาล",
    });
  });

  test("extracts message with date, 'ตอน 18.00 น.', and 'ที่อาร์ทการาจ'", () => {
    const text = "วันจันทร์ ที่ 12 ตุลาคม 2026 นัดไปรับรถกระบะตอน 18.00 น. ที่อาร์ทการาจ";
    const events = parseThaiEvents(text, "2026-10-10");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: expect.stringContaining("นัดไปรับรถกระบะ"),
      date: "2026-10-12",
      time: "18:00",
      place: "อาร์ทการาจ",
    });
  });
});

describe("buildEventParams", () => {
  test("generates valid prompt", () => {
    const p = buildEventParams("นัดประชุมผู้ปกครอง", "2026-10-05") as any;
    expect(p.model).toBe("claude-3-5-haiku-20241022");
    expect(p.messages[0].content[0].text).toContain("2026-10-05");
  });
});

describe("extractEvents", () => {
  test("returns empty array when text is empty or blank", async () => {
    const { client } = fake({ stop_reason: "end_turn", content: [] });
    expect(await extractEvents(client, "   ")).toEqual([]);
  });

  test("returns parsed events instantly using rule-based engine", async () => {
    const { client, create } = fake({ stop_reason: "end_turn", content: [] });
    const res = await extractEvents(client, sampleUserMessage, "2026-10-05");
    expect(res).toHaveLength(2);
    expect(res[0].date).toBe("2026-10-07");
    expect(res[1].date).toBe("2026-10-29");
    // Rule-based engine should handle it without needing Claude API call
    expect(create).not.toHaveBeenCalled();
  });

  test("falls back to Claude when rule-based parser doesn't find dates in complex text", async () => {
    const { client, create } = fake({
      stop_reason: "end_turn",
      content: [{
        type: "text",
        text: JSON.stringify({
          events: [{ title: "นัดพิเศษ", date: "2026-10-20", time: null, place: null, notes: null }],
        }),
      }],
    });
    const res = await extractEvents(client, "เจอกันวันนัดพิเศษสัปดาห์ถัดไป", "2026-10-05");
    expect(res).toEqual([{ title: "นัดพิเศษ", date: "2026-10-20", time: null, place: null, notes: null }]);
    expect(create).toHaveBeenCalledOnce();
  });

  test("returns empty array for casual chit-chat", async () => {
    const { client } = fake({ stop_reason: "end_turn", content: [] });
    const res = await extractEvents(client, "สวัสดีตอนเช้าครับทุกคน", "2026-10-05");
    expect(res).toEqual([]);
  });
});

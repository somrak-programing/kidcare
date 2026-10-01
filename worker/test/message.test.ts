import { describe, expect, test } from "vitest";
import { bangkokDate, buildReminderText, thaiDay } from "../src/reminders/message";

describe("bangkokDate", () => {
  test("00:00 UTC is 07:00 same day in Bangkok", () => {
    expect(bangkokDate(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
    expect(bangkokDate(new Date("2026-10-01T00:00:00Z"), 1)).toBe("2026-10-02");
  });
  test("17:00 UTC is already next day in Bangkok", () => {
    expect(bangkokDate(new Date("2026-09-30T17:00:00Z"))).toBe("2026-10-01");
  });
  test("crosses month end", () => expect(bangkokDate(new Date("2026-10-31T00:00:00Z"), 1)).toBe("2026-11-01"));
});

test("thaiDay", () => {
  expect(thaiDay("2026-10-02")).toBe("ศ. 2 ต.ค.");
  expect(thaiDay("2026-10-04")).toBe("อา. 4 ต.ค.");
});

describe("buildReminderText", () => {
  const T = "2026-10-02";
  const M = "2026-10-03";
  test("null when nothing today or tomorrow", () => {
    expect(buildReminderText([{ date: "2026-10-09", childName: "มะลิ", title: "x" }], T, M)).toBeNull();
    expect(buildReminderText([], T, M)).toBeNull();
  });
  test("formats sections, sorts by time (untimed first)", () => {
    const text = buildReminderText(
      [
        { date: M, childName: "ต้นกล้า", title: "นัดหมอ", time: "09:30", place: "คลินิกเด็ก" },
        { date: T, childName: "มะลิ", title: "พิษสุนัขบ้า เข็ม 2", place: "รพ.เมืองสมุทรปากน้ำ" },
        { date: M, childName: "มะลิ", title: "OPV เข็ม 4" },
      ],
      T,
      M,
    );
    expect(text).toBe(
      [
        "🔔 KidCare — นัดของลูก",
        "วันนี้ (ศ. 2 ต.ค.)",
        "• มะลิ: พิษสุนัขบ้า เข็ม 2 · รพ.เมืองสมุทรปากน้ำ",
        "",
        "พรุ่งนี้ (ส. 3 ต.ค.)",
        "• มะลิ: OPV เข็ม 4",
        "• ต้นกล้า: นัดหมอ 09:30 น. · คลินิกเด็ก",
      ].join("\n"),
    );
  });
  test("only tomorrow section when nothing today", () => {
    const text = buildReminderText([{ date: M, childName: "มะลิ", title: "x" }], T, M)!;
    expect(text).not.toContain("วันนี้");
    expect(text).toContain("พรุ่งนี้ (ส. 3 ต.ค.)");
  });
});

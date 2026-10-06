import { describe, expect, test } from "vitest";
import { bangkokDate, buildEveningReminderText, buildReminderText, formatUpcomingSummary, thaiDay } from "../src/reminders/message";

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
        "🔔 KidCare — แจ้งเตือนนัดหมาย",
        "วันนี้ (ศ. 2 ต.ค.)",
        "• มะลิ: พิษสุนัขบ้า เข็ม 2 · รพ.เมืองสมุทรปากน้ำ",
        "",
        "พรุ่งนี้ (ส. 3 ต.ค.)",
        "• มะลิ: OPV เข็ม 4",
        "• ต้นกล้า: นัดหมอ 09:30 น. · คลินิกเด็ก",
      ].join("\n"),
    );
  });
  test("deduplicates identical appointments on the same day for the same person", () => {
    const text = buildReminderText(
      [
        { date: T, childName: "คุณพ่อ", title: "ทำบุญตักบาตร", place: "ที่ทำงาน" },
        { date: T, childName: "คุณพ่อ", title: "ทำบุญตักบาตร", place: "ที่ทำงาน" },
      ],
      T,
      M,
    );
    expect(text).toBe(
      [
        "🔔 KidCare — แจ้งเตือนนัดหมาย",
        "วันนี้ (ศ. 2 ต.ค.)",
        "• คุณพ่อ: ทำบุญตักบาตร · ที่ทำงาน",
      ].join("\n"),
    );
  });
});

describe("buildEveningReminderText", () => {
  const M = "2026-10-03";
  test("returns null if no items or no special timing items for tomorrow", () => {
    expect(buildEveningReminderText([], M)).toBeNull();
    expect(buildEveningReminderText([{ date: M, childName: "มะลิ", title: "x", remindTiming: "normal" }], M)).toBeNull();
  });
  test("formats evening prep text for items with special timing", () => {
    const text = buildEveningReminderText(
      [
        { date: M, childName: "คุณพ่อ", title: "ทำบุญตักบาตร", remindTiming: "special", place: "ที่ทำงาน" },
        { date: M, childName: "น้องมะลิ", title: "เปิดเทอม", remindTiming: "normal" },
      ],
      M,
    );
    expect(text).toContain("🔔 KidCare — เตือนเตรียมตัวช่วงเย็น (นัดพรุ่งนี้ ส. 3 ต.ค.)");
    expect(text).toContain("• คุณพ่อ: ทำบุญตักบาตร · ที่ทำงาน");
    expect(text).not.toContain("เปิดเทอม");
    expect(text).toContain("💡 เตือนล่วงหน้าช่วงเย็นเผื่อแวะซื้อของ/เตรียมอุปกรณ์ล่วงหน้าครับ");
  });
});

describe("formatUpcomingSummary", () => {
  test("returns empty text message if no items", () => {
    expect(formatUpcomingSummary([])).toBe("ยังไม่มีนัดหมายอื่นที่รออยู่ครับ");
  });

  test("formats upcoming items with child name, date and details", () => {
    const text = formatUpcomingSummary([
      { date: "2026-10-07", childName: "คุณพ่อ", title: "ทำบุญ", time: "07:30", place: "ที่ทำงาน" },
      { date: "2026-10-29", childName: "น้องมะลิ", title: "เปิดเทอม", place: "โรงเรียน" },
    ]);
    expect(text).toBe(
      [
        "• คุณพ่อ: ทำบุญ (พ. 7 ต.ค. 07:30 น. · ที่ทำงาน)",
        "• น้องมะลิ: เปิดเทอม (พฤ. 29 ต.ค. · โรงเรียน)",
      ].join("\n"),
    );
  });
});

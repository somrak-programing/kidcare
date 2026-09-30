import { describe, expect, test } from "vitest";
import { buildIcs, googleCalendarUrl } from "./ics";

const NOW = new Date(Date.UTC(2026, 8, 30, 2, 0, 0));

const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("buildIcs", () => {
  test("all-day event with two alarms", () => {
    const ics = buildIcs({ uid: "dose-abc", title: "น้องมะลิ: พิษสุนัขบ้า เข็ม 2", date: "2026-10-02", location: "รพ.เมือง" }, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const u = unfold(ics);
    expect(u).toContain("UID:dose-abc@kidcare");
    expect(u).toContain("DTSTAMP:20260930T020000Z");
    expect(u).toContain("DTSTART;VALUE=DATE:20261002");
    expect(u).toContain("DTEND;VALUE=DATE:20261003");
    expect(u).toContain("SUMMARY:น้องมะลิ: พิษสุนัขบ้า เข็ม 2");
    expect(u).toContain("TRIGGER:-P1D");
    expect(u).toContain("TRIGGER:PT7H");
    expect(u.match(/BEGIN:VALARM/g)).toHaveLength(2);
  });

  test("timed event converts Bangkok to UTC and alarms at 07:00 local", () => {
    const u = unfold(buildIcs({ uid: "appt-1", title: "นัดหมอ", date: "2026-10-02", time: "09:30" }, NOW));
    expect(u).toContain("DTSTART:20261002T023000Z");
    expect(u).toContain("DTEND:20261002T033000Z");
    expect(u).toContain("TRIGGER;VALUE=DATE-TIME:20261002T000000Z");
  });

  test("escapes special characters", () => {
    const u = unfold(buildIcs({ uid: "x", title: "a,b;c\\d", date: "2026-10-02", description: "l1\nl2" }, NOW));
    expect(u).toContain("SUMMARY:a\\,b\\;c\\\\d");
    expect(u).toContain("DESCRIPTION:l1\\nl2");
  });

  test("folds lines longer than 75 bytes", () => {
    const ics = buildIcs({ uid: "x", title: "ก".repeat(60), date: "2026-10-02" }, NOW);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain("SUMMARY:" + "ก".repeat(60));
  });
});

describe("googleCalendarUrl", () => {
  test("all-day uses date range with exclusive end", () => {
    const url = new URL(googleCalendarUrl({ uid: "x", title: "นัด", date: "2026-10-02", location: "รพ." }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("นัด");
    expect(url.searchParams.get("dates")).toBe("20261002/20261003");
    expect(url.searchParams.get("location")).toBe("รพ.");
  });
  test("timed uses UTC range", () => {
    const url = new URL(googleCalendarUrl({ uid: "x", title: "นัด", date: "2026-10-02", time: "09:30" }));
    expect(url.searchParams.get("dates")).toBe("20261002T023000Z/20261002T033000Z");
  });
});

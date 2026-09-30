import { describe, expect, test } from "vitest";
import type { Appointment, VaccineDose } from "@/types";
import { ageTimeline, childColor, childProgress, monthlyUpcoming, pickHomeUpcoming, summarize, toUpcomingItems } from "./dashboard";

const T = "2026-09-30";

let n = 0;
function dose(over: Partial<VaccineDose>): VaccineDose {
  n += 1;
  return {
    id: `d${n}`, familyId: "f", childId: "c1", seriesId: "s", vaccineName: "OPV", vaccineCode: "OPV", doseNo: 1,
    dueDate: null, given: false, givenDate: null, givenDateUnknown: false, source: "manual", ...over,
  };
}
function appt(over: Partial<Appointment>): Appointment {
  n += 1;
  return { id: `a${n}`, familyId: "f", childId: "c1", date: T, place: "รพ.", purpose: "นัดหมอ", done: false, ...over };
}

describe("toUpcomingItems", () => {
  test("pending doses with dueDate and open appointments only", () => {
    const items = toUpcomingItems(
      [dose({ dueDate: "2026-10-02", vaccineName: "พิษสุนัขบ้า", doseNo: 2 }), dose({ given: true, dueDate: "2026-10-03" }), dose({ dueDate: null })],
      [appt({ date: "2026-10-05", time: "09:30", purpose: "ตรวจ" }), appt({ done: true })],
    );
    expect(items.map((i) => [i.kind, i.date, i.title, i.time])).toEqual([
      ["dose", "2026-10-02", "พิษสุนัขบ้า เข็ม 2", undefined],
      ["appointment", "2026-10-05", "ตรวจ", "09:30"],
    ]);
  });
});

describe("summarize", () => {
  test("counts overdue, next item, coverage, next 30 days", () => {
    const doses = [
      dose({ given: true, givenDate: "2025-01-01", dueDate: "2025-01-01" }),
      dose({ given: true, givenDateUnknown: true, dueDate: "2025-03-01" }),
      dose({ given: true, givenDate: "2025-05-01", dueDate: "2025-05-01" }),
      dose({ dueDate: "2026-09-01" }), // overdue
      dose({ dueDate: T }), // due today: not overdue, not in coverage denominator
      dose({ dueDate: "2026-10-31" }), // in 30 days (diff 31? no: 31 days) -> excluded
      dose({ dueDate: "2026-10-30" }), // diff 30 -> included
    ];
    const s = summarize(doses, [appt({ date: "2026-10-01", childId: "c2", purpose: "ตรวจ" })], T);
    expect(s.overdueCount).toBe(1);
    expect(s.coveragePct).toBe(75);
    expect(s.next).toEqual({ date: T, daysAway: 0, childId: "c1", title: "OPV เข็ม 1" });
    expect(s.next30Count).toBe(3); // today dose, 2026-10-01 appt, 2026-10-30 dose
  });
  test("empty data", () => {
    expect(summarize([], [], T)).toEqual({ overdueCount: 0, next: null, coveragePct: null, next30Count: 0 });
  });
  test("next ignores past items and orders same-day by time (untimed first)", () => {
    const s = summarize([dose({ dueDate: "2026-09-01" })], [appt({ date: "2026-10-02", time: "13:00", purpose: "บ่าย" }), appt({ date: "2026-10-02", purpose: "ไม่ระบุเวลา" })], T);
    expect(s.next?.title).toBe("ไม่ระบุเวลา");
    expect(s.next?.daysAway).toBe(2);
  });
});

describe("childProgress", () => {
  test("given / overdue / upcoming and next dose", () => {
    const p = childProgress(
      [
        dose({ given: true, givenDate: "2025-01-01", dueDate: "2025-01-01" }),
        dose({ dueDate: "2026-01-01" }),
        dose({ dueDate: "2027-06-26", vaccineName: "JE", doseNo: 2 }),
        dose({ dueDate: "2026-12-26", vaccineName: "DTP", doseNo: 5 }),
        dose({ dueDate: null }),
      ],
      T,
    );
    expect([p.given, p.overdue, p.upcoming]).toEqual([1, 1, 3]);
    expect(p.next && [p.next.vaccineName, p.next.doseNo]).toEqual(["DTP", 5]);
  });
  test("no doses", () => {
    expect(childProgress([], T)).toEqual({ given: 0, overdue: 0, upcoming: 0, next: null });
  });
});

describe("monthlyUpcoming", () => {
  test("12 buckets from current month, counts per child, excludes past and out-of-range", () => {
    const items = toUpcomingItems(
      [
        dose({ dueDate: "2026-09-15" }), // past this month -> excluded (date < today)
        dose({ dueDate: T }), // today -> Sep bucket
        dose({ dueDate: "2026-12-26", childId: "c2" }),
        dose({ dueDate: "2027-08-31" }), // last bucket (Aug 2027)
        dose({ dueDate: "2027-09-01" }), // out of range
      ],
      [appt({ date: "2026-12-01", childId: "c2" })],
    );
    const b = monthlyUpcoming(items, T);
    expect(b).toHaveLength(12);
    expect(b[0]).toMatchObject({ key: "2026-09", label: "ก.ย.", yearBE: 2569, total: 1, counts: { c1: 1 } });
    expect(b[3]).toMatchObject({ key: "2026-12", label: "ธ.ค.", total: 2, counts: { c2: 2 } });
    expect(b[11]).toMatchObject({ key: "2027-08", yearBE: 2570, total: 1 });
    expect(b.reduce((s, x) => s + x.total, 0)).toBe(4);
  });
});

describe("ageTimeline", () => {
  const birth = "2024-12-26";
  test("places given at givenDate, pending at dueDate, skips unknown/no-date, computes max", () => {
    const t = ageTimeline(
      birth,
      [
        dose({ id: "g", given: true, givenDate: "2024-12-26", dueDate: "2024-12-26" }),
        dose({ id: "u", given: true, givenDateUnknown: true, dueDate: "2025-02-26" }),
        dose({ id: "o", dueDate: "2025-06-26" }),
        dose({ id: "f", dueDate: "2028-12-26" }),
        dose({ id: "x", dueDate: null }),
      ],
      T,
    );
    expect(t.points.map((p) => [p.doseId, p.status])).toEqual([["g", "given"], ["o", "overdue"], ["f", "upcoming"]]);
    expect(t.points[0].ageMonths).toBeCloseTo(0, 5);
    expect(t.points[1].ageMonths).toBeCloseTo(6, 0);
    expect(t.points[2].ageMonths).toBeCloseTo(48, 0);
    expect(t.todayAgeMonths).toBeCloseTo(21.1, 0);
    expect(t.maxAgeMonths).toBe(60);
  });
  test("maxAge grows in whole years past 60 months", () => {
    const t = ageTimeline(birth, [dose({ dueDate: "2031-01-26" })], T); // ~73 months
    expect(t.maxAgeMonths).toBe(84);
  });
});

test("childColor is fixed by index", () => {
  expect(childColor(0)).toBe("#3987e5");
  expect(childColor(1)).toBe("#d95926");
});

describe("pickHomeUpcoming", () => {
  test("soon first, then most recent overdue, then later", () => {
    const items = toUpcomingItems(
      [
        ...["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"].map((dueDate) => dose({ dueDate, vaccineName: `old-${dueDate}` })),
        dose({ dueDate: "2026-10-30", vaccineName: "later" }),
      ],
      [appt({ date: "2026-10-01", purpose: "พรุ่งนี้" })],
    );
    const r = pickHomeUpcoming(items, T);
    expect(r.map((i) => i.title)).toEqual(["พรุ่งนี้", "old-2026-08-01 เข็ม 1", "old-2026-07-01 เข็ม 1", "old-2026-06-01 เข็ม 1", "old-2026-05-01 เข็ม 1"]);
  });
  test("without soon/overdue items returns earliest later items", () => {
    const items = toUpcomingItems(
      ["2026-12-01", "2026-11-01", "2026-11-15", "2027-01-01", "2026-10-20", "2027-02-01"].map((dueDate) => dose({ dueDate })),
      [],
    );
    expect(pickHomeUpcoming(items, T, 3).map((i) => i.date)).toEqual(["2026-10-20", "2026-11-01", "2026-11-15"]);
  });
});

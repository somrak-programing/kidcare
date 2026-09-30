import { describe, expect, test } from "vitest";
import { generateCustomDoses, generateEpiSeries, parseDayOffsets, shiftRemainingDoses, type EpiTemplateItem } from "./schedule";

const FIXTURE: EpiTemplateItem[] = [
  { vaccineCode: "BCG", vaccineName: "BCG", doseNo: 1, ageMonths: 0 },
  { vaccineCode: "OPV", vaccineName: "OPV", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "MMR", vaccineName: "MMR", doseNo: 1, ageMonths: 9 },
  { vaccineCode: "OPV", vaccineName: "OPV", doseNo: 2, ageMonths: 4 },
];

describe("generateEpiSeries", () => {
  test("groups by vaccineCode in first-appearance order with due dates from birth", () => {
    const s = generateEpiSeries(FIXTURE, "2025-01-31");
    expect(s.map((x) => x.name)).toEqual(["BCG", "OPV", "MMR"]);
    expect(s[1]).toMatchObject({ source: "epi", templateKey: "epi:OPV" });
    expect(s[1].doses).toEqual([
      { vaccineName: "OPV", vaccineCode: "OPV", doseNo: 1, dueDate: "2025-03-31" },
      { vaccineName: "OPV", vaccineCode: "OPV", doseNo: 2, dueDate: "2025-05-31" },
    ]);
    expect(s[0].doses[0].dueDate).toBe("2025-01-31");
  });
});

describe("generateCustomDoses", () => {
  const rabiesIM = { name: "พิษสุนัขบ้า", vaccineCode: "RABIES", dayOffsets: [0, 3, 7, 14, 28] };

  test("anchor on dose 1 schedules all doses", () => {
    const d = generateCustomDoses(rabiesIM, { doseNo: 1, date: "2026-09-29" });
    expect(d.map((x) => x.dueDate)).toEqual(["2026-09-29", "2026-10-02", "2026-10-06", "2026-10-13", "2026-10-27"]);
    expect(d.every((x) => !x.given)).toBe(true);
    expect(d[0]).toMatchObject({ vaccineName: "พิษสุนัขบ้า", vaccineCode: "RABIES", doseNo: 1 });
  });

  test("anchor on dose 2 marks dose 1 given with back-computed date", () => {
    const d = generateCustomDoses(rabiesIM, { doseNo: 2, date: "2026-10-02" });
    expect(d[0]).toMatchObject({ doseNo: 1, given: true, givenDate: "2026-09-29", givenDateUnknown: false, dueDate: "2026-09-29" });
    expect(d[1]).toMatchObject({ doseNo: 2, dueDate: "2026-10-02" });
    expect(d[1].given).toBeFalsy();
    expect(d[4].dueDate).toBe("2026-10-27");
  });

  test("rejects an anchor outside the template", () => {
    for (const doseNo of [0, 6, -1, 1.5]) {
      expect(() => generateCustomDoses(rabiesIM, { doseNo, date: "2026-10-02" })).toThrow(RangeError);
    }
  });
});

describe("shiftRemainingDoses", () => {
  test("shifts only later, pending, scheduled doses", () => {
    const doses = [
      { id: "a", doseNo: 1, given: true, dueDate: "2026-09-29" },
      { id: "b", doseNo: 2, given: true, dueDate: "2026-10-02" },
      { id: "c", doseNo: 3, given: false, dueDate: "2026-10-06" },
      { id: "d", doseNo: 4, given: false, dueDate: null },
      { id: "e", doseNo: 5, given: false, dueDate: "2026-10-27" },
    ];
    expect(shiftRemainingDoses(doses, 2, 2)).toEqual([
      { id: "c", dueDate: "2026-10-08" },
      { id: "e", dueDate: "2026-10-29" },
    ]);
  });

  test("handles doses in shuffled order and still produces sorted output", () => {
    const doses = [
      { id: "e", doseNo: 5, given: false, dueDate: "2026-10-27" },
      { id: "c", doseNo: 3, given: false, dueDate: "2026-10-06" },
      { id: "a", doseNo: 1, given: true, dueDate: "2026-09-29" },
      { id: "d", doseNo: 4, given: false, dueDate: null },
      { id: "b", doseNo: 2, given: true, dueDate: "2026-10-02" },
    ];
    expect(shiftRemainingDoses(doses, 2, 2)).toEqual([
      { id: "c", dueDate: "2026-10-08" },
      { id: "e", dueDate: "2026-10-29" },
    ]);
  });
});

describe("parseDayOffsets", () => {
  test("parses a valid list", () => {
    expect(parseDayOffsets("0, 3, 7, 14, 28")).toEqual({ offsets: [0, 3, 7, 14, 28] });
  });
  test("ignores trailing empty tokens", () => {
    expect(parseDayOffsets("0,3,")).toEqual({ offsets: [0, 3] });
  });
  test.each(["", "0,-3", "0,1.5", "3,7", "0,7,3", "0,3,3"])("rejects %j", (text) => {
    expect(parseDayOffsets(text)).toHaveProperty("error");
  });
});

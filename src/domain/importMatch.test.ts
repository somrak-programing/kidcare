import { describe, expect, test } from "vitest";
import type { VaccineDose } from "@/types";
import { findDuplicateTargets, matchImportedDoses, type ImportedRecord } from "./importMatch";

const B = "2023-07-01";
const T = "2026-09-30";

const dose = (id: string, code: string, doseNo: number, given = false): VaccineDose => ({
  id, familyId: "f", childId: "c", seriesId: `s-${code}`, vaccineName: code, vaccineCode: code, doseNo,
  dueDate: "2024-01-01", given, givenDate: null, givenDateUnknown: false, source: "manual",
});
const rec = (over: Partial<ImportedRecord>): ImportedRecord => ({
  pageIndex: 0, vaccineRaw: "x", vaccineCode: "OPV", doseNo: null, dateRaw: null, dateGiven: "2023-09-01",
  lotNo: null, place: null, confidence: "high", note: null, ...over,
});

const DOSES = [dose("opv1", "OPV", 1), dose("opv2", "OPV", 2), dose("opv3", "OPV", 3), dose("bcg1", "BCG", 1, true)];

describe("matchImportedDoses", () => {
  test("matches by code + doseNo", () => {
    const rows = matchImportedDoses([rec({ doseNo: 2 })], DOSES, B, T);
    expect(rows[0]).toMatchObject({ target: "opv2", include: true, warnings: [] });
  });

  test("null doseNo assigns earliest pending doses in date order, output keeps input order", () => {
    const rows = matchImportedDoses(
      [rec({ dateGiven: "2023-11-01" }), rec({ dateGiven: "2023-09-01" })],
      DOSES, B, T,
    );
    expect(rows.map((r) => r.target)).toEqual(["opv2", "opv1"]);
  });

  test("no candidate → new; OTHER → new", () => {
    const rows = matchImportedDoses([rec({ vaccineCode: "MMR", doseNo: 1 }), rec({ vaccineCode: "OTHER", vaccineRaw: "ไข้เลือดออก" })], DOSES, B, T);
    expect(rows.map((r) => r.target)).toEqual(["new", "new"]);
  });

  test("warns when overwriting an already-given dose", () => {
    const rows = matchImportedDoses([rec({ vaccineCode: "BCG", doseNo: 1 })], DOSES, B, T);
    expect(rows[0].target).toBe("bcg1");
    expect(rows[0].warnings).toContain("เข็มนี้บันทึกว่าฉีดแล้ว — จะเขียนทับ");
  });

  test("date problems are warned and not pre-ticked", () => {
    const rows = matchImportedDoses(
      [rec({ dateGiven: null }), rec({ dateGiven: "2023-06-30" }), rec({ dateGiven: "2026-10-01" })],
      DOSES, B, T,
    );
    expect(rows.map((r) => r.include)).toEqual([false, false, false]);
    expect(rows[0].warnings).toContain("อ่านวันที่ไม่ออก");
    expect(rows[1].warnings).toContain("วันที่ก่อนวันเกิด");
    expect(rows[2].warnings).toContain("วันที่อยู่ในอนาคต");
  });

  test("low confidence is warned but still pre-ticked when the date is valid", () => {
    const rows = matchImportedDoses([rec({ doseNo: 1, confidence: "low" })], DOSES, B, T);
    expect(rows[0].include).toBe(true);
    expect(rows[0].warnings).toContain("AI ไม่มั่นใจ ตรวจกับสมุดอีกครั้ง");
  });

  test("keys are unique", () => {
    const rows = matchImportedDoses([rec({}), rec({})], DOSES, B, T);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  describe("ordinal fallback for non-contiguous EPI dose numbers", () => {
    const OPV345 = [dose("opv3", "OPV", 3), dose("opv4", "OPV", 4), dose("opv5", "OPV", 5)];

    test("doseNo 1 and 2 map to the 1st and 2nd OPV doses (3 and 4)", () => {
      const rows = matchImportedDoses(
        [rec({ doseNo: 1, dateGiven: "2023-09-01" }), rec({ doseNo: 2, dateGiven: "2023-11-01" })],
        OPV345, B, T,
      );
      expect(rows.map((r) => r.target)).toEqual(["opv3", "opv4"]);
    });

    test("an exact doseNo match wins over ordinal position", () => {
      const DTP = [dose("dtp4", "DTP", 4), dose("dtp5", "DTP", 5)];
      const rows = matchImportedDoses([rec({ vaccineCode: "DTP", doseNo: 4 })], DTP, B, T);
      expect(rows[0].target).toBe("dtp4");
    });

    test("ordinal beyond the available doses falls back to earliest pending, then new", () => {
      const rows = matchImportedDoses(
        [rec({ doseNo: 9, dateGiven: "2023-09-01" }), rec({ doseNo: 9, dateGiven: "2023-10-01" }), rec({ doseNo: 9, dateGiven: "2023-11-01" }), rec({ doseNo: 9, dateGiven: "2023-12-01" })],
        OPV345, B, T,
      );
      expect(rows.map((r) => r.target)).toEqual(["opv3", "opv4", "opv5", "new"]);
    });

    test("exact matches are claimed before ordinal ones regardless of date order", () => {
      const rows = matchImportedDoses(
        [rec({ doseNo: 1, dateGiven: "2023-09-01" }), rec({ doseNo: 3, dateGiven: "2023-11-01" })],
        OPV345, B, T,
      );
      expect(rows.map((r) => r.target)).toEqual(["opv4", "opv3"]);
    });
  });
});

test("findDuplicateTargets ignores new and excluded rows", () => {
  const r = (key: string, target: string, include = true) => ({ key, record: rec({}), target, include, warnings: [] });
  expect(findDuplicateTargets([r("a", "opv1"), r("b", "opv1"), r("c", "new"), r("d", "new"), r("e", "opv2"), r("f", "opv2", false)])).toEqual(new Set(["opv1"]));
});

import { describe, expect, test } from "vitest";
import { EPI_TEMPLATE } from "./epi";

const ALLOWED = ["BCG", "HB", "DTP-HB-Hib", "DTP", "OPV", "IPV", "ROTA", "MMR", "JE", "HPV", "dT", "RABIES", "FLU", "OTHER"];

describe("EPI_TEMPLATE", () => {
  test("every vaccineCode+doseNo pair is unique", () => {
    const keys = EPI_TEMPLATE.map((i) => `${i.vaccineCode}#${i.doseNo}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("doseNo is ascending within each code", () => {
    const last = new Map<string, number>();
    for (const i of EPI_TEMPLATE) {
      const prev = last.get(i.vaccineCode);
      if (prev !== undefined) expect(i.doseNo, `${i.vaccineCode} dose ${i.doseNo}`).toBeGreaterThan(prev);
      last.set(i.vaccineCode, i.doseNo);
    }
  });

  test("ageMonths is a non-negative number", () => {
    for (const i of EPI_TEMPLATE) {
      expect(Number.isFinite(i.ageMonths)).toBe(true);
      expect(i.ageMonths).toBeGreaterThanOrEqual(0);
    }
  });

  test("codes are a subset of the allowed vaccine codes", () => {
    for (const i of EPI_TEMPLATE) expect(ALLOWED).toContain(i.vaccineCode);
  });
});

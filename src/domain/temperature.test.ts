import { describe, expect, test } from "vitest";
import { calculateParacetamolDose, checkAntipyreticSafety, classifyFever } from "./temperature";

describe("classifyFever", () => {
  test("classifies normal temp (< 37.5)", () => {
    expect(classifyFever(36.8).level).toBe("normal");
    expect(classifyFever(37.4).level).toBe("normal");
  });

  test("classifies low fever (37.5 - 38.4)", () => {
    expect(classifyFever(37.5).level).toBe("low");
    expect(classifyFever(38.0).level).toBe("low");
    expect(classifyFever(38.4).level).toBe("low");
  });

  test("classifies high fever (38.5 - 39.4)", () => {
    expect(classifyFever(38.5).level).toBe("high");
    expect(classifyFever(39.0).level).toBe("high");
    expect(classifyFever(39.4).level).toBe("high");
  });

  test("classifies very high fever (>= 39.5)", () => {
    expect(classifyFever(39.5).level).toBe("very_high");
    expect(classifyFever(40.2).level).toBe("very_high");
  });
});

describe("checkAntipyreticSafety", () => {
  const baseTime = new Date("2026-10-01T12:00:00Z");

  test("returns none when no prior dose", () => {
    const res = checkAntipyreticSafety(null, baseTime);
    expect(res.severity).toBe("none");
    expect(res.canGiveSafely).toBe(true);
  });

  test("returns danger when less than 4 hours (e.g. 2 hours)", () => {
    const lastGiven = new Date("2026-10-01T10:00:00Z"); // 2 hours ago
    const res = checkAntipyreticSafety(lastGiven, baseTime);
    expect(res.severity).toBe("danger");
    expect(res.canGiveSafely).toBe(false);
    expect(res.minutesSinceLast).toBe(120);
    expect(res.timeText).toBe("2 ชม. 0 นาที");
  });

  test("returns danger when 3 hours 45 minutes", () => {
    const lastGiven = new Date("2026-10-01T08:15:00Z"); // 3h 45m ago = 225m
    const res = checkAntipyreticSafety(lastGiven, baseTime);
    expect(res.severity).toBe("danger");
    expect(res.canGiveSafely).toBe(false);
  });

  test("returns warning when between 4 and 6 hours (e.g. 4.5 hours)", () => {
    const lastGiven = new Date("2026-10-01T07:30:00Z"); // 4.5 hours ago = 270m
    const res = checkAntipyreticSafety(lastGiven, baseTime);
    expect(res.severity).toBe("warning");
    expect(res.canGiveSafely).toBe(true);
    expect(res.timeText).toBe("4 ชม. 30 นาที");
  });

  test("returns safe when 6 hours or more", () => {
    const lastGiven = new Date("2026-10-01T05:00:00Z"); // 7 hours ago
    const res = checkAntipyreticSafety(lastGiven, baseTime);
    expect(res.severity).toBe("safe");
    expect(res.canGiveSafely).toBe(true);
  });
});

describe("calculateParacetamolDose", () => {
  test("calculates dose range for 12 kg toddler", () => {
    const r = calculateParacetamolDose(12);
    // 12kg * 10mg = 120mg -> 5ml
    // 12kg * 15mg = 180mg -> 7.5ml
    expect(r.minMl).toBe(5);
    expect(r.maxMl).toBe(7.5);
  });
});

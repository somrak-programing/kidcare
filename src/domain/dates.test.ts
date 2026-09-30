import { describe, expect, test } from "vitest";
import { addDaysISO, addMonthsISO, ageText, diffDays, formatThaiDate, todayISO } from "./dates";

describe("dates", () => {
  test("addDaysISO crosses month and year", () => {
    expect(addDaysISO("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDaysISO("2026-12-30", 5)).toBe("2027-01-04");
    expect(addDaysISO("2026-10-02", -3)).toBe("2026-09-29");
  });

  test("addMonthsISO clamps to month end", () => {
    expect(addMonthsISO("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsISO("2023-01-31", 1)).toBe("2023-02-28");
    expect(addMonthsISO("2023-05-15", 18)).toBe("2024-11-15");
  });

  test("diffDays is a minus b", () => {
    expect(diffDays("2026-10-02", "2026-09-30")).toBe(2);
    expect(diffDays("2026-09-30", "2026-10-02")).toBe(-2);
    expect(diffDays("2026-09-30", "2026-09-30")).toBe(0);
  });

  test("todayISO formats local date", () => {
    expect(todayISO(new Date(2026, 8, 30, 23, 59))).toBe("2026-09-30");
  });

  test("formatThaiDate uses Buddhist era and short Thai month", () => {
    expect(formatThaiDate("2026-10-02")).toBe("2 ต.ค. 2569");
    expect(formatThaiDate("2025-01-15")).toBe("15 ม.ค. 2568");
  });

  test("ageText", () => {
    expect(ageText("2023-07-01", "2026-09-30")).toBe("3 ปี 2 เดือน");
    expect(ageText("2025-08-01", "2026-08-01")).toBe("1 ปี");
    expect(ageText("2026-06-15", "2026-09-30")).toBe("3 เดือน");
    expect(ageText("2026-09-20", "2026-09-30")).toBe("0 เดือน");
  });
});

import { describe, expect, test } from "vitest";
import { calculateAgeInMonths, evaluateHeightForAge, evaluateWeightForAge } from "./growth";

describe("calculateAgeInMonths", () => {
  test("calculates exact months", () => {
    expect(calculateAgeInMonths("2025-01-15", "2025-04-15")).toBe(3);
    expect(calculateAgeInMonths("2024-01-15", "2025-01-15")).toBe(12);
  });

  test("accounts for day of month", () => {
    // 2025-04-10 has not reached the 15th yet, so 2 months
    expect(calculateAgeInMonths("2025-01-15", "2025-04-10")).toBe(2);
  });
});

describe("evaluateWeightForAge", () => {
  test("evaluates boy weight at 12 months", () => {
    // 12m boy median is 9.6 kg
    expect(evaluateWeightForAge(9.6, 12, "M").status).toBe("normal");
    expect(evaluateWeightForAge(7.0, 12, "M").status).toBe("low");
    expect(evaluateWeightForAge(13.0, 12, "M").status).toBe("high");
  });

  test("evaluates girl weight at 24 months", () => {
    // 24m girl median is 11.5 kg
    expect(evaluateWeightForAge(11.5, 24, "F").status).toBe("normal");
    expect(evaluateWeightForAge(8.5, 24, "F").status).toBe("low");
  });
});

describe("evaluateHeightForAge", () => {
  test("evaluates boy height at 24 months", () => {
    // 24m boy median is 87.8 cm
    expect(evaluateHeightForAge(88, 24, "M").status).toBe("normal");
    expect(evaluateHeightForAge(79, 24, "M").status).toBe("low");
  });
});

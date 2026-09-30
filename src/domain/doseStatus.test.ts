import { describe, expect, test } from "vitest";
import { doseStatus } from "./doseStatus";

const T = "2026-09-30";

describe("doseStatus", () => {
  test("given wins over everything", () => {
    expect(doseStatus({ given: true, dueDate: "2026-01-01" }, T)).toBe("given");
    expect(doseStatus({ given: true, dueDate: null }, T)).toBe("given");
  });
  test("no due date → unscheduled", () => {
    expect(doseStatus({ given: false, dueDate: null }, T)).toBe("unscheduled");
  });
  test("past due → overdue", () => {
    expect(doseStatus({ given: false, dueDate: "2026-09-29" }, T)).toBe("overdue");
  });
  test("today through +7 days → dueSoon", () => {
    expect(doseStatus({ given: false, dueDate: T }, T)).toBe("dueSoon");
    expect(doseStatus({ given: false, dueDate: "2026-10-07" }, T)).toBe("dueSoon");
  });
  test("beyond 7 days → scheduled", () => {
    expect(doseStatus({ given: false, dueDate: "2026-10-08" }, T)).toBe("scheduled");
  });
});

import { describe, expect, test } from "vitest";
import { calendarName } from "./names";

describe("calendarName", () => {
  test("prefers nickname", () => {
    expect(calendarName({ nickname: "น้องบี", name: "บี สมชาย ใจดี" })).toBe("น้องบี");
  });
  test("falls back to the first word of name only (no surname)", () => {
    expect(calendarName({ nickname: undefined, name: "สมหญิง ใจดี" })).toBe("สมหญิง");
    expect(calendarName({ nickname: "", name: "  สมหญิง   ใจดี " })).toBe("สมหญิง");
  });
  test("single-word name is kept; empty gives empty", () => {
    expect(calendarName({ name: "บี" })).toBe("บี");
    expect(calendarName({ name: "" })).toBe("");
  });
});

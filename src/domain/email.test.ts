import { describe, expect, test } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Zoe@Gmail.COM ")).toBe("zoe@gmail.com");
  });
});

describe("isValidEmail", () => {
  test("accepts a normal address", () => {
    expect(isValidEmail("zoe@gmail.com")).toBe(true);
  });
  test("rejects invalid input", () => {
    expect(isValidEmail("zoe")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
  test("rejects addresses longer than 254 characters", () => {
    const local = "a".repeat(64);
    const long = `${local}@${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(60)}.com`;
    expect(long.length).toBeGreaterThan(254);
    expect(isValidEmail(long)).toBe(false);
    expect(isValidEmail(`${local}@${"b".repeat(50)}.com`)).toBe(true);
  });
});

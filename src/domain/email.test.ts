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
});

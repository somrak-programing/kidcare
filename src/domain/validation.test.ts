import { describe, expect, test } from "vitest";
import { allergySchema, appointmentSchema, childSchema, firstError, validateGivenDate } from "./validation";

const T = "2026-09-30";

describe("childSchema", () => {
  const ok = { name: "มะลิ", nickname: "", birthDate: "2023-07-01", sex: "F", bloodType: "", hospitals: [{ name: "รพ.เมือง", hn: "6918843" }] };
  test("accepts valid input and trims", () => {
    const r = childSchema(T).safeParse({ ...ok, name: "  มะลิ " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("มะลิ");
  });
  test("rejects future birth date", () => {
    const r = childSchema(T).safeParse({ ...ok, birthDate: "2026-10-01" });
    expect(firstError(r)).toBe("วันเกิดต้องไม่อยู่ในอนาคต");
  });
  test("rejects empty name and bad date format", () => {
    expect(firstError(childSchema(T).safeParse({ ...ok, name: " " }))).toBe("กรุณาใส่ชื่อ");
    expect(childSchema(T).safeParse({ ...ok, birthDate: "1/7/2566" }).success).toBe(false);
  });
  test("rejects hospital row missing HN", () => {
    expect(childSchema(T).safeParse({ ...ok, hospitals: [{ name: "รพ.", hn: "" }] }).success).toBe(false);
  });
});

test("allergySchema requires substance", () => {
  expect(firstError(allergySchema.safeParse({ type: "drug", substance: "", reaction: "ผื่น", severity: "mild" }))).toBe("กรุณาใส่ชื่อยา/อาหารที่แพ้");
  expect(allergySchema.safeParse({ type: "drug", substance: "Amoxicillin", reaction: "ผื่น", severity: "severe" }).success).toBe(true);
});

test("appointmentSchema validates time format", () => {
  const base = { childId: "c1", date: "2026-10-02", place: "รพ.", purpose: "ตรวจตามนัด" };
  expect(appointmentSchema.safeParse(base).success).toBe(true);
  expect(appointmentSchema.safeParse({ ...base, time: "09:30" }).success).toBe(true);
  expect(appointmentSchema.safeParse({ ...base, time: "9.30" }).success).toBe(false);
});

describe("validateGivenDate", () => {
  test("before birth", () => expect(validateGivenDate("2023-06-30", "2023-07-01", T)).toBe("วันที่ฉีดต้องไม่ก่อนวันเกิด"));
  test("in future", () => expect(validateGivenDate("2026-10-01", "2023-07-01", T)).toBe("วันที่ฉีดต้องไม่อยู่ในอนาคต"));
  test("ok", () => expect(validateGivenDate("2026-09-30", "2023-07-01", T)).toBeNull());
});

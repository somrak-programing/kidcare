import { describe, expect, test } from "vitest";
import { HttpError, MAX_IMAGE_B64, parseExtractRequest } from "../src/request";

const img = (data = "aGVsbG8=") => ({ mediaType: "image/jpeg", data });

describe("parseExtractRequest", () => {
  test("accepts valid body", () => {
    expect(parseExtractRequest({ images: [img()], birthDate: "2023-07-01" })).toEqual({ images: [img()], birthDate: "2023-07-01" });
  });
  test("400 on bad shape", () => {
    for (const body of [null, {}, { images: [], birthDate: "2023-07-01" }, { images: [img()], birthDate: "1/7/66" }, { images: [{ mediaType: "image/gif", data: "x" }], birthDate: "2023-07-01" }]) {
      expect(() => parseExtractRequest(body)).toThrowError(expect.objectContaining({ status: 400, code: "bad_request" }));
    }
  });
  test("413 on too many or too large images", () => {
    const seven = Array.from({ length: 7 }, () => img());
    expect(() => parseExtractRequest({ images: seven, birthDate: "2023-07-01" })).toThrowError(expect.objectContaining({ status: 413, code: "too_large" }));
    const big = img("a".repeat(MAX_IMAGE_B64 + 1));
    expect(() => parseExtractRequest({ images: [big], birthDate: "2023-07-01" })).toThrowError(expect.objectContaining({ status: 413 }));
  });
  test("HttpError carries status and code", () => {
    const e = new HttpError(403, "forbidden");
    expect(e).toBeInstanceOf(Error);
    expect([e.status, e.code]).toEqual([403, "forbidden"]);
  });
});

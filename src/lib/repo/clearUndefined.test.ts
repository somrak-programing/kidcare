import { deleteField, type FieldValue } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { undefinedToDelete } from "./clearUndefined";

const isDelete = (v: unknown) => (v as FieldValue).isEqual(deleteField());

describe("undefinedToDelete", () => {
  it("turns present-but-undefined values into deleteField()", () => {
    const out = undefinedToDelete({ a: undefined, b: 1 });
    expect(isDelete(out.a)).toBe(true);
    expect(out.b).toBe(1);
  });

  it("passes defined values through (including null and falsy)", () => {
    const out = undefinedToDelete({ a: null, b: 0, c: "", d: false });
    expect(out).toEqual({ a: null, b: 0, c: "", d: false });
  });

  it("keeps keys absent from the object absent when no keys are given", () => {
    const out = undefinedToDelete({ a: 1 });
    expect("b" in out).toBe(false);
    expect(Object.keys(out)).toEqual(["a"]);
  });

  it("with keys, converts only those keys (absent or undefined) and leaves others", () => {
    const out = undefinedToDelete({ a: undefined, b: undefined, c: 3 }, ["a", "x"]);
    expect(isDelete(out.a)).toBe(true);
    expect(isDelete(out.x)).toBe(true);
    expect(out.b).toBeUndefined();
    expect("b" in out).toBe(true);
    expect(out.c).toBe(3);
  });

  it("with keys, does not touch listed keys that have a value", () => {
    expect(undefinedToDelete({ a: "x" }, ["a"])).toEqual({ a: "x" });
  });
});

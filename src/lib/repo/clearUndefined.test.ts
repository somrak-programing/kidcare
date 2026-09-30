import { deleteField, type FieldValue } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { undefinedKeysToDelete, undefinedToDelete } from "./clearUndefined";

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

describe("undefinedKeysToDelete", () => {
  it("converts only listed keys that are present with value undefined", () => {
    const out = undefinedKeysToDelete({ brand: undefined, lotNo: "L1", dueDate: undefined, given: true }, ["brand", "lotNo", "site"]);
    expect(isDelete(out.brand)).toBe(true);
    expect(out.lotNo).toBe("L1");
    expect(out.given).toBe(true);
  });

  it("does NOT delete listed keys that are absent from the patch", () => {
    const out = undefinedKeysToDelete({ given: true }, ["brand", "site"]);
    expect("brand" in out).toBe(false);
    expect("site" in out).toBe(false);
    expect(Object.keys(out)).toEqual(["given"]);
  });

  it("leaves unlisted undefined keys untouched (not converted)", () => {
    const out = undefinedKeysToDelete({ dueDate: undefined, brand: undefined }, ["brand"]);
    expect("dueDate" in out).toBe(true);
    expect(out.dueDate).toBeUndefined();
    expect(isDelete(out.brand)).toBe(true);
  });
});

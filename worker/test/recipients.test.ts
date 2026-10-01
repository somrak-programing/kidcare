import { expect, test } from "vitest";
import { kvRecipientStore } from "../src/line/recipients";
import { memoryKV } from "./helpers";

test("put / get / list / delete", async () => {
  const s = kvRecipientStore(memoryKV());
  const a = { userId: "U1", displayName: "แม่", status: "pending" as const, addedAt: "2026-09-30T00:00:00Z" };
  const b = { ...a, userId: "U2", displayName: "แฟน", status: "approved" as const };
  await s.put(a);
  await s.put(b);
  expect(await s.get("U1")).toEqual(a);
  expect(await s.get("U9")).toBeNull();
  expect(await s.list()).toEqual([a, b]);
  await s.delete("U1");
  expect(await s.list()).toEqual([b]);
});

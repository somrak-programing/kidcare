import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { verifyLineSignature } from "../src/line/signature";

const secret = "s3cret";
const body = JSON.stringify({ events: [{ type: "follow" }], x: "ไทย" });
const good = createHmac("sha256", secret).update(body).digest("base64");

test("accepts a valid signature", async () => expect(await verifyLineSignature(body, good, secret)).toBe(true));
test("rejects wrong / missing / tampered", async () => {
  expect(await verifyLineSignature(body, good, "other")).toBe(false);
  expect(await verifyLineSignature(body, null, secret)).toBe(false);
  expect(await verifyLineSignature(body + " ", good, secret)).toBe(false);
});

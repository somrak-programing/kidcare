import { expect, test } from "vitest";
import { VACCINE_CODES } from "./vaccineCodes";
import { VACCINE_CODES as WORKER_CODES } from "../../worker/src/schema";
import { EPI_TEMPLATE } from "./epi";
import { CUSTOM_TEMPLATES } from "./customTemplates";

test("web and worker vaccine codes are identical", () => {
  expect([...VACCINE_CODES]).toEqual([...WORKER_CODES]);
});

test("every template vaccineCode is a known code", () => {
  const codes = new Set<string>(VACCINE_CODES);
  for (const it of EPI_TEMPLATE) expect(codes.has(it.vaccineCode), it.vaccineCode).toBe(true);
  for (const t of CUSTOM_TEMPLATES) if (t.vaccineCode) expect(codes.has(t.vaccineCode), t.vaccineCode).toBe(true);
});

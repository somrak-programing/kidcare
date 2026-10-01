import { z } from "zod";

// ต้องตรงกับ src/data/vaccineCodes.ts ของเว็บ (มี test ตรวจ)
export const VACCINE_CODES = [
  "BCG", "HB", "DTP-HB-Hib", "DTP", "OPV", "IPV", "ROTA", "MMR", "JE", "HPV", "dT", "RABIES", "FLU", "OTHER",
] as const;
export type VaccineCode = (typeof VACCINE_CODES)[number];

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

export const RECORDS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["records"],
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageIndex", "vaccineRaw", "vaccineCode", "doseNo", "dateRaw", "dateGiven", "lotNo", "place", "confidence", "note"],
        properties: {
          pageIndex: { type: "integer" },
          vaccineRaw: { type: "string" },
          vaccineCode: { type: "string", enum: [...VACCINE_CODES] },
          doseNo: { anyOf: [{ type: "integer" }, { type: "null" }] },
          dateRaw: nullableString,
          dateGiven: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
          lotNo: nullableString,
          place: nullableString,
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: nullableString,
        },
      },
    },
  },
} as const;

export const RecordSchema = z.object({
  pageIndex: z.number().int().min(0),
  vaccineRaw: z.string(),
  vaccineCode: z.enum(VACCINE_CODES),
  doseNo: z.number().int().min(1).nullable(),
  dateRaw: z.string().nullable(),
  dateGiven: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  lotNo: z.string().nullable(),
  place: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().nullable(),
});
export const RecordsSchema = z.object({ records: z.array(RecordSchema) });
export type ImportedRecord = z.infer<typeof RecordSchema>;

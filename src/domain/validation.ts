import { z } from "zod";
import type { ISODate } from "@/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const optText = z.string().trim().optional().transform((v) => (v ? v : undefined));

export const childSchema = (today: ISODate) =>
  z.object({
    name: z.string().trim().min(1, "กรุณาใส่ชื่อ"),
    nickname: optText,
    birthDate: isoDate.refine((d) => d <= today, "วันเกิดต้องไม่อยู่ในอนาคต"),
    sex: z.enum(["M", "F"]),
    bloodType: optText,
    hospitals: z.array(
      z.object({
        name: z.string().trim().min(1, "กรุณาใส่ชื่อโรงพยาบาล"),
        hn: z.string().trim().min(1, "กรุณาใส่ HN"),
      }),
    ),
  });

export const allergySchema = z.object({
  type: z.enum(["drug", "food", "other"]),
  substance: z.string().trim().min(1, "กรุณาใส่ชื่อยา/อาหารที่แพ้"),
  reaction: z.string().trim().min(1, "กรุณาใส่อาการที่แพ้"),
  severity: z.enum(["mild", "moderate", "severe"]),
  notes: optText,
});

export const appointmentSchema = z.object({
  childId: z.string().min(1, "กรุณาเลือกผู้รับนัดหมาย"),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง").optional(),
  place: z.string().trim().min(1, "กรุณาใส่สถานที่"),
  purpose: z.string().trim().min(1, "กรุณาใส่เรื่องที่นัด"),
  notes: optText,
});

export function validateGivenDate(givenDate: ISODate, birthDate: ISODate, today: ISODate): string | null {
  if (givenDate < birthDate) return "วันที่ฉีดต้องไม่ก่อนวันเกิด";
  if (givenDate > today) return "วันที่ฉีดต้องไม่อยู่ในอนาคต";
  return null;
}

export function firstError(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : result.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}

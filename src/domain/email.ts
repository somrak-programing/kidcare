import { z } from "zod";

const emailSchema = z.string().email();

/** trim + lowercase — ใช้เป็น doc id ของ invites/{email} */
export const normalizeEmail = (s: string): string => s.trim().toLowerCase();

/** รูปแบบถูกต้องและยาวไม่เกิน 254 ตัวอักษร */
export const isValidEmail = (s: string): boolean => {
  const t = s.trim();
  return t.length <= 254 && emailSchema.safeParse(t).success;
};

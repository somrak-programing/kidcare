import { z } from "zod";

const emailSchema = z.string().email();

/** trim + lowercase — ใช้เป็น doc id ของ invites/{email} */
export const normalizeEmail = (s: string): string => s.trim().toLowerCase();

export const isValidEmail = (s: string): boolean => emailSchema.safeParse(s.trim()).success;

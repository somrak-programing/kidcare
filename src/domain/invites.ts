import { normalizeEmail } from "./email";

export const INVITE_TTL_DAYS = 14;

/** doc id ของ invites/{familyId}_{emailLower} — ต้องตรงกับ firestore.rules */
export const inviteId = (familyId: string, email: string): string => `${familyId}_${normalizeEmail(email)}`;

/** คำเชิญยังไม่หมดอายุ (createdAt เป็น null = server timestamp ยังไม่ resolve) */
export const isInviteActive = (createdAtMillis: number | null, nowMillis: number): boolean =>
  createdAtMillis === null || nowMillis - createdAtMillis < INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

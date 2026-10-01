import { normalizeEmail } from "./email";

export const INVITE_TTL_DAYS = 14;

/** doc id ของ invites/{familyId}_{emailLower} — ต้องตรงกับ firestore.rules */
export const inviteId = (familyId: string, email: string): string => `${familyId}_${normalizeEmail(email)}`;

/** คำเชิญยังไม่หมดอายุ (createdAt เป็น null = server timestamp ยังไม่ resolve) */
export const isInviteActive = (createdAtMillis: number | null, nowMillis: number): boolean =>
  createdAtMillis === null || nowMillis - createdAtMillis < INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** joinFamily ล้มเหลวเพราะคำเชิญหมดอายุ/ถูกยกเลิก/ครอบครัวไม่มีแล้ว */
export const isStaleInviteError = (e: unknown): boolean => {
  const code = (e as { code?: string } | null)?.code;
  return code === "permission-denied" || code === "not-found";
};

export const STALE_INVITE_MESSAGE = "คำเชิญนี้หมดอายุหรือถูกยกเลิกแล้ว";
export const JOIN_FAILED_MESSAGE = "เข้าร่วมไม่สำเร็จ ลองอีกครั้ง";

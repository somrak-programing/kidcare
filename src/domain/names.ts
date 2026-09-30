import type { Child } from "@/types";

/** ชื่อสำหรับข้อความปฏิทิน: ชื่อเล่น ถ้าไม่มีใช้คำแรกของชื่อ (ไม่ส่งชื่อ-นามสกุลเต็มออกไปปฏิทิน) */
export function calendarName(c: Pick<Child, "name" | "nickname">): string {
  const nick = c.nickname?.trim();
  if (nick) return nick;
  return c.name.trim().split(/\s+/)[0] ?? "";
}

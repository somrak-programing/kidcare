import { deleteField } from "firebase/firestore";

/**
 * Firestore instance ใช้ ignoreUndefinedProperties จึงเคลียร์ field ด้วย undefined ไม่ได้
 * แปลง undefined -> deleteField() สำหรับใช้กับ updateDoc
 * - ไม่ระบุ keys: แปลงเฉพาะ key ที่มีอยู่ใน obj และเป็น undefined
 * - ระบุ keys: แปลง key เหล่านั้นถ้าค่าเป็น undefined (รวมกรณี key ไม่อยู่ใน obj); key อื่นคงเดิม
 */
export function undefinedToDelete<T extends object>(obj: T, keys?: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  const targets = keys ?? Object.keys(out);
  for (const k of targets) if (out[k] === undefined) out[k] = deleteField();
  return out;
}

/**
 * สำหรับ patch ที่ไม่ควรลบ field ที่ "ไม่ได้ส่งมา" (เช่น updateDose):
 * แปลงเฉพาะ key ใน keys ที่ปรากฏใน obj และมีค่า undefined -> deleteField()
 * key ที่ไม่อยู่ใน obj คงไม่อยู่; undefined ของ key อื่นคงเดิม
 */
export function undefinedKeysToDelete<T extends object>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const k of keys) if (k in out && out[k] === undefined) out[k] = deleteField();
  return out;
}

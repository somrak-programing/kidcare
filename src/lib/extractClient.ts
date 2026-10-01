import type { ImportedRecord } from "@/domain/importMatch";
import { auth } from "./firebase";

export class ExtractClientError extends Error {}

const TIMEOUT_MS = 90_000;
const TIMEOUT_MSG = "ใช้เวลานานเกินไป ลองใหม่อีกครั้ง หรือส่งทีละน้อยรูปลง";

const MESSAGES: Record<string, string> = {
  unauthorized: "กรุณาออกจากระบบแล้วเข้าใหม่",
  forbidden: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้การอ่านสมุด",
  too_large: "รูปใหญ่หรือเยอะเกินไป (สูงสุด 6 รูป)",
  bad_request: "ข้อมูลที่ส่งไม่ถูกต้อง",
  refusal: "AI อ่านรูปนี้ไม่ได้ ลองถ่ายใหม่ หรือติ๊กเข็มเอง",
  truncated: "รายการยาวเกินไป ลองส่งทีละน้อยรูปลง",
  invalid_output: "อ่านผลไม่สำเร็จ ลองอีกครั้ง",
  rate_limited: "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่",
  upstream: "บริการ AI ขัดข้อง หรือเครดิตหมด",
};

export async function callExtract(images: { mediaType: string; data: string }[], birthDate: string): Promise<ImportedRecord[]> {
  if (!navigator.onLine) throw new ExtractClientError("ต้องต่ออินเทอร์เน็ตเพื่ออ่านรูป");
  const base = import.meta.env.VITE_WORKER_URL;
  if (!base) throw new ExtractClientError("ยังไม่ได้ตั้งค่าบริการอ่านรูป (VITE_WORKER_URL)");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ExtractClientError(MESSAGES.unauthorized);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  let body: { error?: string; records?: ImportedRecord[] };
  try {
    try {
      res = await fetch(`${base.replace(/\/$/, "")}/extract-vaccines`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ images, birthDate }),
        signal: ctrl.signal,
      });
    } catch {
      throw new ExtractClientError(ctrl.signal.aborted ? TIMEOUT_MSG : "เชื่อมต่อบริการอ่านรูปไม่ได้");
    }
    try {
      body = (await res.json()) as typeof body;
    } catch {
      if (ctrl.signal.aborted) throw new ExtractClientError(TIMEOUT_MSG);
      body = {};
    }
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ExtractClientError(MESSAGES[body.error ?? ""] ?? `เกิดข้อผิดพลาด (${res.status})`);
  return body.records ?? [];
}

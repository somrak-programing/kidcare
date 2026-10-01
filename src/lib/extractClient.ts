import type { ImportedRecord } from "@/domain/importMatch";
import { auth } from "./firebase";

export class ExtractClientError extends Error {}

const TIMEOUT_MS = 90_000;
const TIMEOUT_MSG = "ใช้เวลานานเกินไป ลดจำนวนรูปแล้วลองใหม่";

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

/** Thrown when the caller's own AbortSignal fires (e.g. page unmounted) — not a timeout. */
export class ExtractAbortedError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}

export async function callExtract(
  images: { mediaType: string; data: string }[],
  birthDate: string,
  signal?: AbortSignal,
): Promise<ImportedRecord[]> {
  if (signal?.aborted) throw new ExtractAbortedError();
  if (!navigator.onLine) throw new ExtractClientError("ต้องต่ออินเทอร์เน็ตเพื่ออ่านรูป");
  const base = import.meta.env.VITE_WORKER_URL;
  if (!base) throw new ExtractClientError("ยังไม่ได้ตั้งค่าบริการอ่านรูป (VITE_WORKER_URL)");
  const token = await auth.currentUser?.getIdToken();
  if (signal?.aborted) throw new ExtractAbortedError();
  if (!token) throw new ExtractClientError(MESSAGES.unauthorized);
  // one controller for the fetch: aborted by either the timeout or the caller's signal
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);
  const onUserAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onUserAbort, { once: true });
  const abortError = () =>
    timedOut ? new ExtractClientError(TIMEOUT_MSG) : signal?.aborted ? new ExtractAbortedError() : null;
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
      throw abortError() ?? new ExtractClientError("เชื่อมต่อบริการอ่านรูปไม่ได้");
    }
    try {
      body = (await res.json()) as typeof body;
    } catch {
      const aborted = abortError();
      if (aborted) throw aborted;
      body = {};
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onUserAbort);
  }
  if (!res.ok) throw new ExtractClientError(MESSAGES[body.error ?? ""] ?? `เกิดข้อผิดพลาด (${res.status})`);
  return body.records ?? [];
}

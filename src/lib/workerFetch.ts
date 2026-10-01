import { auth } from "./firebase";

export class WorkerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "WorkerError";
  }
}

const TIMEOUT_MS = 20_000;

const COMMON: Record<string, string> = {
  unauthorized: "กรุณาออกจากระบบแล้วเข้าใหม่",
  forbidden: "บัญชีนี้ยังไม่ได้รับสิทธิ์",
  not_found: "ไม่พบรายการ",
  bad_request: "ข้อมูลที่ส่งไม่ถูกต้อง",
  rate_limited: "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่",
  upstream: "บริการภายนอกขัดข้อง ลองใหม่ภายหลัง",
  no_recipients: "ยังไม่มีผู้รับที่อนุมัติ",
  timeout: "ใช้เวลานานเกินไป ลองใหม่",
};

export async function workerFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  messages: Record<string, string> = {},
): Promise<T> {
  const msg = (code: string, fallback: string) => new WorkerError(code, messages[code] ?? COMMON[code] ?? fallback);
  if (!navigator.onLine) throw msg("offline", "ต้องต่ออินเทอร์เน็ต");
  const base = import.meta.env.VITE_WORKER_URL as string | undefined;
  if (!base) throw msg("config", "ยังไม่ได้ตั้งค่า VITE_WORKER_URL");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw msg("unauthorized", "กรุณาเข้าสู่ระบบ");

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        method: init.method ?? "GET",
        headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw timedOut ? msg("timeout", "ใช้เวลานานเกินไป ลองใหม่") : msg("network", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    let body: { error?: string } & T;
    try {
      const parsed: unknown = await res.json();
      body = (typeof parsed === "object" && parsed !== null ? parsed : {}) as { error?: string } & T;
    } catch {
      if (timedOut) throw msg("timeout", "ใช้เวลานานเกินไป ลองใหม่");
      body = {} as { error?: string } & T;
    }
    if (!res.ok) throw msg(body.error ?? "unknown", `เกิดข้อผิดพลาด (${res.status})`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** ยิง write แบบไม่รอ (offline write จะ resolve ตอน server ตอบรับเท่านั้น) — แจ้งเตือนเมื่อพลาด */
export function fire(p: Promise<unknown>, msg = "บันทึกไม่สำเร็จ") {
  p.catch((err: { code?: string; message?: string }) => {
    console.error(err);
    alert(`${msg}: ${err?.code ?? err?.message ?? "unknown"}`);
  });
}

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workerFetch } from "@/lib/workerFetch";

interface Recipient {
  userId: string;
  displayName: string;
  status: "pending" | "approved";
  addedAt: string;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function LineSettings() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [addUrl, setAddUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Returns true when the list was loaded successfully. */
  const load = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setMsg(null);
    let ok = false;
    try {
      const r = await workerFetch<{ recipients: Recipient[]; addFriendUrl: string }>("/line/recipients");
      if (!mounted.current) return false;
      setRecipients(r.recipients);
      setAddUrl(r.addFriendUrl);
      ok = true;
      try {
        const dataUrl = await QRCode.toDataURL(r.addFriendUrl, { margin: 1, width: 180 });
        if (mounted.current) setQr(dataUrl);
      } catch {
        // QR is a convenience; the "open in LINE" link still works without it.
        if (mounted.current) setQr("");
      }
    } catch (e) {
      if (mounted.current) setMsg(errText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
    return ok;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      if (mounted.current) {
        setMsg(errText(e));
        setBusy(false);
      }
      return;
    }
    const ok = await load();
    if (ok && done && mounted.current) setMsg(done);
  }

  const pending = recipients.filter((r) => r.status === "pending");
  const approved = recipients.filter((r) => r.status === "approved");
  const label = (r: Recipient) => r.displayName || `ผู้ใช้ LINE …${r.userId.slice(-4)}`;

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">แจ้งเตือนทาง LINE</h2>
        <Button variant="ghost" size="icon" aria-label="รีเฟรช" disabled={busy} onClick={() => void load()}><RefreshCw size={16} /></Button>
      </div>
      <p className="text-sm text-muted-foreground">ทุกเช้า 7 โมง ระบบส่งนัดของวันนี้และพรุ่งนี้ให้ผู้รับที่อนุมัติแล้ว ให้แต่ละคนสแกน QR เพื่อเพิ่มเพื่อน แล้วกดอนุมัติที่นี่</p>
      {qr && (
        <div className="flex items-center gap-3">
          <img src={qr} alt="QR เพิ่มเพื่อน LINE" className="h-32 w-32 shrink-0 rounded bg-white p-1" />
          <Button asChild variant="outline" size="sm"><a href={addUrl} target="_blank" rel="noreferrer">เปิดใน LINE</a></Button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">รออนุมัติ</p>
          {pending.map((r) => (
            <div key={r.userId} className="flex items-center justify-between gap-2 rounded border border-amber-500/50 px-2 py-1 text-sm">
              <span className="min-w-0 flex-1 break-words">{label(r)}</span>
              <span className="flex shrink-0 gap-1">
                <Button size="sm" disabled={busy} onClick={() => void act(() => workerFetch(`/line/recipients/${encodeURIComponent(r.userId)}/approve`, { method: "POST" }))}><Check size={14} /> อนุมัติ</Button>
                <Button size="icon" variant="ghost" aria-label="ลบ" disabled={busy}
                  onClick={() => window.confirm(`ลบ ${label(r)}?`) && void act(() => workerFetch(`/line/recipients/${encodeURIComponent(r.userId)}`, { method: "DELETE" }))}><Trash2 size={14} /></Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-semibold">ผู้รับแจ้งเตือน ({approved.length})</p>
        {approved.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มี</p>}
        {approved.map((r) => (
          <div key={r.userId} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 break-words">{label(r)}</span>
            <Button size="icon" variant="ghost" className="shrink-0" aria-label="ลบ" disabled={busy}
              onClick={() => window.confirm(`หยุดส่งแจ้งเตือนให้ ${label(r)}?`) && void act(() => workerFetch(`/line/recipients/${encodeURIComponent(r.userId)}`, { method: "DELETE" }))}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" disabled={busy || approved.length === 0}
        onClick={() => void act(() => workerFetch("/line/test", { method: "POST" }), "ส่งข้อความทดสอบแล้ว ให้ทุกคนเช็ก LINE")}>
        <Send size={14} /> ส่งข้อความทดสอบ
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  );
}

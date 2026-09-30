import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { loginGoogle } from "@/lib/auth";

const SILENT_CODES = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

export default function Login() {
  const { user, loading } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <p className="p-6 text-muted-foreground">กำลังโหลด…</p>;
  if (user) return <Navigate to="/" replace />;

  async function onSignIn() {
    setErr(null);
    setBusy(true);
    try {
      await loginGoogle();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (!code || !SILENT_CODES.includes(code)) setErr(code ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-3xl font-bold">KidCare</h1>
        <p className="text-muted-foreground">สมุดสุขภาพลูก — วัคซีน การแพ้ยา นัดหมอ</p>
      </div>
      <Button disabled={busy} onClick={onSignIn}>เข้าสู่ระบบด้วย Google</Button>
      {err && <p className="text-sm text-destructive">เข้าสู่ระบบไม่สำเร็จ: {err}</p>}
    </div>
  );
}

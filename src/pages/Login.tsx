import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { loginGoogle } from "@/lib/auth";

export default function Login() {
  const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-3xl font-bold">KidCare</h1>
        <p className="text-muted-foreground">สมุดสุขภาพลูก — วัคซีน การแพ้ยา นัดหมอ</p>
      </div>
      <Button onClick={() => loginGoogle().catch((e) => setErr(e?.code ?? String(e)))}>เข้าสู่ระบบด้วย Google</Button>
      {err && <p className="text-sm text-destructive">เข้าสู่ระบบไม่สำเร็จ: {err}</p>}
    </div>
  );
}

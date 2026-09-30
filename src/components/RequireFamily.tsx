import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { familyCacheKey, useFamilyStore } from "@/hooks/useFamilyId";
import { ensureFamily } from "@/lib/repo/family";

export default function RequireFamily({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const familyId = useFamilyStore((s) => s.familyId);
  const setFamilyId = useFamilyStore((s) => s.setFamilyId);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const uid = user?.uid ?? null;

  useEffect(() => {
    setError(null);
    if (!user) return;
    let cancelled = false;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(familyCacheKey(user.uid));
    } catch {
      /* private mode */
    }
    if (cached) setFamilyId(cached);
    ensureFamily(user)
      .then((id) => {
        if (cancelled) return;
        try {
          localStorage.setItem(familyCacheKey(user.uid), id);
        } catch {
          /* ignore */
        }
        if (id !== cached) setFamilyId(id);
      })
      .catch((e) => {
        if (cancelled || cached) return; // มี cache อยู่ → ใช้ต่อได้ (เช่น เริ่มแอปแบบออฟไลน์)
        setError(e?.code ?? String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, attempt, setFamilyId]);

  if (loading) return <p className="p-6 text-muted-foreground">กำลังโหลด…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error)
    return (
      <div className="space-y-3 p-6">
        <p>ตั้งค่าครอบครัวไม่สำเร็จ ({error}) — ต้องต่ออินเทอร์เน็ตในการเข้าใช้ครั้งแรก</p>
        <Button
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          ลองใหม่
        </Button>
      </div>
    );
  if (!familyId) return <p className="p-6 text-muted-foreground">กำลังเตรียมข้อมูลครอบครัว…</p>;
  return <>{children}</>;
}

import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { familyCacheKey, useFamilyStore } from "@/hooks/useFamilyId";
import { ensureFamily } from "@/lib/repo/family";

export default function RequireFamily({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { familyId, setFamilyId } = useFamilyStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || familyId) return;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(familyCacheKey(user.uid));
    } catch {
      /* private mode */
    }
    if (cached) {
      setFamilyId(cached);
      return;
    }
    ensureFamily(user)
      .then((id) => {
        try {
          localStorage.setItem(familyCacheKey(user.uid), id);
        } catch {
          /* ignore */
        }
        setFamilyId(id);
      })
      .catch((e) => setError(e?.code ?? String(e)));
  }, [user, familyId, setFamilyId]);

  if (loading) return <p className="p-6 text-muted-foreground">กำลังโหลด…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) return <p className="p-6">ตั้งค่าครอบครัวไม่สำเร็จ ({error}) — ต้องต่ออินเทอร์เน็ตในการเข้าใช้ครั้งแรก</p>;
  if (!familyId) return <p className="p-6 text-muted-foreground">กำลังเตรียมข้อมูลครอบครัว…</p>;
  return <>{children}</>;
}

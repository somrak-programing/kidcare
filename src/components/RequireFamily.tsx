import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import InviteChoice from "@/components/InviteChoice";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { familyCacheKey, useFamilyStore, writeFamilyCache } from "@/hooks/useFamilyId";
import { createFamily, findMyInvites, resolveFamily } from "@/lib/repo/family";
import type { Invite } from "@/types";

const writeCache = writeFamilyCache;

export default function RequireFamily({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const familyId = useFamilyStore((s) => s.familyId);
  const setFamilyId = useFamilyStore((s) => s.setFamilyId);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const uid = user?.uid ?? null;

  useEffect(() => {
    setError(null);
    setInvites(null);
    if (!user) return;
    let cancelled = false;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(familyCacheKey(user.uid));
    } catch {
      /* private mode */
    }

    const adopt = (id: string) => {
      writeCache(user.uid, id);
      setFamilyId(id);
    };

    // ไม่มี cache: resolve -> คำเชิญ (ให้ผู้ใช้เลือกเอง) -> สร้างใหม่
    const freshFlow = async () => {
      const id = await resolveFamily(user);
      if (cancelled) return;
      if (id) return adopt(id);
      const found = await findMyInvites(user);
      if (cancelled) return;
      if (found.length > 0) return setInvites(found);
      const created = await createFamily(user);
      if (cancelled) return;
      adopt(created);
    };
    const fail = (e: unknown) => {
      if (cancelled) return;
      setError((e as { code?: string })?.code ?? String(e));
    };

    if (cached) {
      // ใช้ cache ทันที แล้วตรวจสอบเบื้องหลัง (ออฟไลน์/ผิดพลาด = ใช้ cache ต่อ)
      setFamilyId(cached);
      resolveFamily(user)
        .then((id) => {
          if (cancelled) return;
          if (id) {
            if (id !== cached) adopt(id);
            return;
          }
          // ไม่ได้เป็นสมาชิกแล้ว -> ล้าง cache แล้วเริ่มขั้นตอนใหม่
          writeCache(user.uid, null);
          setFamilyId(null);
          return freshFlow().catch(fail);
        })
        .catch(() => {
          /* offline: ใช้ cache ต่อ */
        });
    } else {
      setFamilyId(null);
      freshFlow().catch(fail);
    }
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
  if (!familyId && invites) {
    const done = (id: string) => {
      writeCache(user.uid, id);
      setInvites(null);
      setFamilyId(id);
    };
    return <InviteChoice user={user} invites={invites} onJoin={done} onCreateOwn={done} />;
  }
  if (!familyId) return <p className="p-6 text-muted-foreground">กำลังเตรียมข้อมูลครอบครัว…</p>;
  return <>{children}</>;
}

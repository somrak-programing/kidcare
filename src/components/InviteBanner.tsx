import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isStaleInviteError, JOIN_FAILED_MESSAGE, STALE_INVITE_MESSAGE } from "@/domain/invites";
import { useAuth } from "@/hooks/useAuth";
import { useMyInvites } from "@/hooks/family";
import { useFamilyStore, writeFamilyCache } from "@/hooks/useFamilyId";
import { auth } from "@/lib/firebase";
import { cancelInvite, joinFamily } from "@/lib/repo/family";
import type { Invite } from "@/types";

/** คำเชิญเข้าครอบครัวอื่นสำหรับผู้ใช้ที่มีครอบครัวอยู่แล้ว — เข้าร่วมต้องยืนยันเสมอ */
export default function InviteBanner() {
  const { user } = useAuth();
  const familyId = useFamilyStore((s) => s.familyId);
  const setFamilyId = useFamilyStore((s) => s.setFamilyId);
  const navigate = useNavigate();
  const { data } = useMyInvites(user);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const invites = data.filter((i) => i.familyId !== familyId && !hidden.has(i.id));
  if (invites.length === 0 && !error) return null;

  const uid = user.uid;
  const sameUser = () => auth.currentUser?.uid === uid;

  const join = async (invite: Invite) => {
    if (
      !window.confirm(
        `ย้ายไปใช้ครอบครัว “${invite.familyName}” ที่เชิญโดย ${invite.inviterEmail}? ข้อมูลในครอบครัวปัจจุบันของคุณจะไม่ถูกย้ายไปด้วย และสมาชิกครอบครัวนั้นจะเห็นข้อมูลที่คุณบันทึกหลังจากนี้`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await joinFamily(user, invite);
      if (!sameUser()) return;
      writeFamilyCache(uid, invite.familyId);
      setFamilyId(invite.familyId);
      navigate("/");
    } catch (e) {
      if (!sameUser()) return;
      if (isStaleInviteError(e)) {
        setHidden((h) => new Set(h).add(invite.id));
        cancelInvite(invite);
        setError(STALE_INVITE_MESSAGE);
      } else {
        setError(JOIN_FAILED_MESSAGE);
      }
    } finally {
      setBusy(false);
    }
  };

  // cancelInvite แจ้ง error เองผ่าน alert (fire-and-forget); รายการหายจาก snapshot ทันที
  const decline = (invite: Invite) => {
    setError(null);
    cancelInvite(invite);
  };

  return (
    <div className="space-y-3">
      {invites.map((invite) => (
        <div key={invite.id} className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="text-amber-200">
            {invite.inviterEmail} เชิญคุณเข้าครอบครัว “{invite.familyName}”
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => join(invite)}>
              เข้าร่วม
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decline(invite)}>
              ไม่สนใจ
            </Button>
          </div>
        </div>
      ))}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 text-sm text-destructive">
          <p>{error}</p>
          <button type="button" aria-label="ปิด" className="px-2 text-base leading-none" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

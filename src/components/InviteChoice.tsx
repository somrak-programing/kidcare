import { useState } from "react";
import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isStaleInviteError, JOIN_FAILED_MESSAGE, STALE_INVITE_MESSAGE } from "@/domain/invites";
import { auth } from "@/lib/firebase";
import { createFamily, joinFamily } from "@/lib/repo/family";
import type { Invite } from "@/types";

interface Props {
  user: User;
  invites: Invite[];
  onJoin: (familyId: string) => void;
  onCreateOwn: (familyId: string) => void;
}

/** ผู้ใช้ที่ยังไม่มีครอบครัวแต่มีคำเชิญค้างอยู่ — ต้องเลือกเองว่าจะเข้าร่วมหรือสร้างใหม่ (ไม่ auto-join) */
export default function InviteChoice({ user, invites, onJoin, onCreateOwn }: Props) {
  const [list, setList] = useState<Invite[]>(invites);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ผู้ใช้เปลี่ยนบัญชีระหว่างรอ -> ไม่ใช้ผลลัพธ์
  const sameUser = () => auth.currentUser?.uid === user.uid;

  const createOwn = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createFamily(user);
      if (sameUser()) onCreateOwn(id);
    } catch (e) {
      if (!sameUser()) return;
      setError(`สร้างครอบครัวไม่สำเร็จ (${(e as { code?: string })?.code ?? String(e)})`);
      setBusy(false);
    }
  };

  const join = async (invite: Invite) => {
    if (
      !window.confirm(
        `เข้าร่วมครอบครัว “${invite.familyName}” ที่เชิญโดย ${invite.inviterEmail}? สมาชิกในครอบครัวนี้จะเห็นข้อมูลสุขภาพลูกที่คุณบันทึก`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await joinFamily(user, invite);
      if (sameUser()) onJoin(invite.familyId);
    } catch (e) {
      if (!sameUser()) return;
      if (isStaleInviteError(e)) {
        const rest = list.filter((i) => i.id !== invite.id);
        setList(rest);
        if (rest.length === 0) {
          await createOwn();
          return;
        }
        setError(STALE_INVITE_MESSAGE);
      } else {
        setError(JOIN_FAILED_MESSAGE);
      }
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">คุณได้รับคำเชิญเข้าครอบครัว</h1>
      {list.map((invite) => (
        <Card key={invite.id}>
          <CardHeader>
            <CardTitle>“{invite.familyName}”</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">เชิญโดย {invite.inviterEmail}</p>
            <Button disabled={busy} onClick={() => join(invite)}>
              เข้าร่วมครอบครัวนี้
            </Button>
          </CardContent>
        </Card>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button variant="outline" disabled={busy} onClick={createOwn}>
        ไม่ใช่ — สร้างครอบครัวของฉันเอง
      </Button>
    </div>
  );
}

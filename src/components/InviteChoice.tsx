import { useState } from "react";
import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      onJoin(invite.familyId);
    } catch (e) {
      setError(`เข้าร่วมครอบครัวไม่สำเร็จ (${(e as { code?: string })?.code ?? String(e)})`);
      setBusy(false);
    }
  };

  const createOwn = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreateOwn(await createFamily(user));
    } catch (e) {
      setError(`สร้างครอบครัวไม่สำเร็จ (${(e as { code?: string })?.code ?? String(e)})`);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">คุณได้รับคำเชิญเข้าครอบครัว</h1>
      {invites.map((invite) => (
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

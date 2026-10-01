import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidEmail, normalizeEmail } from "@/domain/email";
import { isInviteActive } from "@/domain/invites";
import { useAuth } from "@/hooks/useAuth";
import { useSentInvites } from "@/hooks/family";
import { cancelInvite, inviteMember, removeMember } from "@/lib/repo/family";
import type { Family } from "@/types";

export default function FamilyMembers({ fid, family }: { fid: string; family: Family }) {
  const { user } = useAuth();
  const isOwner = !!user && family.ownerUid === user.uid;
  const { data: sent } = useSentInvites(isOwner ? user.uid : null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const profiles = family.memberProfiles ?? {};
  const now = Date.now();
  const pending = sent.filter((i) => i.familyId === fid && isInviteActive(i.createdAt?.toMillis() ?? null, now));

  const nameOf = (uid: string) =>
    profiles[uid]?.name || profiles[uid]?.email || `สมาชิก …${uid.slice(-4)}`;

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!isValidEmail(email)) return setError("รูปแบบอีเมลไม่ถูกต้อง");
    const norm = normalizeEmail(email);
    if (norm === normalizeEmail(user.email ?? "")) return setError("ไม่สามารถเชิญตัวเองได้");
    if (Object.values(profiles).some((p) => normalizeEmail(p.email ?? "") === norm))
      return setError("อีเมลนี้เป็นสมาชิกอยู่แล้ว");
    if (pending.some((i) => normalizeEmail(i.email) === norm)) return setError("มีคำเชิญอีเมลนี้อยู่แล้ว");
    setError(null);
    inviteMember(fid, family.name, user, norm);
    setEmail("");
  }

  function onRemove(uid: string) {
    if (window.confirm(`นำ ${nameOf(uid)} ออกจากครอบครัว? เขาจะดูข้อมูลลูกไม่ได้อีก`)) removeMember(fid, uid);
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-semibold">สมาชิกครอบครัว ({family.memberUids.length})</h2>
        <ul className="space-y-2">
          {family.memberUids.map((uid) => {
            const p = profiles[uid];
            return (
              <li key={uid} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {nameOf(uid)}
                    {uid === family.ownerUid && (
                      <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-xs">เจ้าของ</span>
                    )}
                    {uid === user.uid && (
                      <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">คุณ</span>
                    )}
                  </p>
                  {p?.name && p.email && p.email !== p.name && (
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  )}
                </div>
                {isOwner && uid !== family.ownerUid && (
                  <Button size="sm" variant="outline" onClick={() => onRemove(uid)}>
                    นำออก
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {isOwner && (
        <>
          <form onSubmit={onInvite} className="space-y-2">
            <Label htmlFor="invite-email">เชิญด้วยอีเมล (แฟน/สมาชิก — อีเมล Google)</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
              />
              <Button type="submit" disabled={!email.trim()}>
                เชิญ
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              ให้คนที่เชิญเปิด https://kidcare-2w.web.app แล้วเข้าสู่ระบบด้วย Google อีเมลนี้ แล้วกดยืนยันเข้าร่วม
              (คำเชิญหมดอายุใน 14 วัน)
            </p>
          </form>

          {pending.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">คำเชิญที่รออยู่</h3>
              <ul className="space-y-2">
                {pending.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{invite.email}</span>
                    <Button size="sm" variant="outline" onClick={() => cancelInvite(invite)}>
                      ยกเลิก
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

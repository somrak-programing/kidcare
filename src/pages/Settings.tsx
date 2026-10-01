import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FamilyMembers from "@/components/FamilyMembers";
import LineSettings from "@/components/LineSettings";
import ErrorState from "@/components/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { useDocument } from "@/hooks/useCollection";
import { familyCacheKey, useFamilyId } from "@/hooks/useFamilyId";
import { logout } from "@/lib/auth";
import { familyDoc } from "@/lib/paths";
import { renameFamily } from "@/lib/repo/family";
import type { Family } from "@/types";

export default function Settings() {
  const fid = useFamilyId();
  const { user } = useAuth();
  const { data: family, error } = useDocument<Family>(familyDoc(fid), `family/${fid}`);
  const [name, setName] = useState("");
  useEffect(() => setName(family?.name ?? ""), [family?.name]);

  if (error) return <ErrorState error={error} />;

  async function onLogout() {
    try {
      await logout();
    } catch {
      alert("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    }
    try {
      if (user) localStorage.removeItem(familyCacheKey(user.uid));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ตั้งค่าระบบและครอบครัว</h1>
          <p className="text-sm text-muted-foreground">
            จัดการข้อมูลครอบครัว สมาชิก และการแจ้งเตือน
          </p>
        </div>
        {user?.email && (
          <span className="text-xs text-muted-foreground self-start sm:self-center bg-secondary/80 px-3 py-1 rounded-full border">
            {user.email}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Family & Account */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
            <h2 className="font-semibold text-base">ชื่อครอบครัว</h2>
            <div className="space-y-2">
              <Label htmlFor="fname" className="text-xs text-muted-foreground">ชื่อที่ใช้แสดงสำหรับทุกคนในบ้าน</Label>
              <div className="flex gap-2">
                <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} />
                <Button disabled={!name.trim() || name === family?.name} onClick={() => renameFamily(fid, name.trim())}>
                  บันทึก
                </Button>
              </div>
            </div>
          </div>

          {family && (
            <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
              <FamilyMembers fid={fid} family={family} />
            </div>
          )}

          <div className="rounded-xl border bg-card/60 p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-sm text-destructive">บัญชีผู้ใช้</h2>
            <p className="text-xs text-muted-foreground">ออกจากระบบ KidCare บนอุปกรณ์นี้</p>
            <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={onLogout}>
              ออกจากระบบ
            </Button>
          </div>
        </div>

        {/* Right Column: LINE Notifications */}
        <div className="lg:col-span-6 space-y-6">
          <LineSettings />
        </div>
      </div>
    </div>
  );
}

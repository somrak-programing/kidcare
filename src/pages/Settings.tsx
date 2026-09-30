import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { useDocument } from "@/hooks/useCollection";
import { familyCacheKey, useFamilyId, useFamilyStore } from "@/hooks/useFamilyId";
import { logout } from "@/lib/auth";
import { familyDoc } from "@/lib/paths";
import { renameFamily } from "@/lib/repo/family";
import type { Family } from "@/types";

export default function Settings() {
  const fid = useFamilyId();
  const { user } = useAuth();
  const setFamilyId = useFamilyStore((s) => s.setFamilyId);
  const { data: family, error } = useDocument<Family>(familyDoc(fid), `family/${fid}`);
  const [name, setName] = useState("");
  useEffect(() => setName(family?.name ?? ""), [family?.name]);

  if (error) return <ErrorState error={error} />;

  async function onLogout() {
    try {
      if (user) localStorage.removeItem(familyCacheKey(user.uid));
    } catch {
      /* ignore */
    }
    setFamilyId(null);
    await logout();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ตั้งค่า</h1>
      <div className="space-y-2">
        <Label htmlFor="fname">ชื่อครอบครัว</Label>
        <div className="flex gap-2">
          <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || name === family?.name} onClick={() => renameFamily(fid, name.trim())}>บันทึก</Button>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-semibold">สมาชิก ({family?.memberUids.length ?? 0})</p>
        <p className="text-muted-foreground">คุณ: {user?.email}</p>
        <p className="text-muted-foreground">การเชิญสมาชิกเพิ่มจะมาในเวอร์ชันถัดไป</p>
      </div>
      <Button variant="outline" onClick={onLogout}>ออกจากระบบ</Button>
    </div>
  );
}

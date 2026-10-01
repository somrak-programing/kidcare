import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FamilyMembers from "@/components/FamilyMembers";
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
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ตั้งค่า</h1>
      <div className="space-y-2">
        <Label htmlFor="fname">ชื่อครอบครัว</Label>
        <div className="flex gap-2">
          <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || name === family?.name} onClick={() => renameFamily(fid, name.trim())}>บันทึก</Button>
        </div>
      </div>
      {family && <FamilyMembers fid={fid} family={family} />}
      <Button variant="outline" onClick={onLogout}>ออกจากระบบ</Button>
    </div>
  );
}

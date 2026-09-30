import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { todayISO } from "@/domain/dates";
import { childSchema, firstError } from "@/domain/validation";
import { createChild, updateChild } from "@/lib/repo/children";
import { createEpiSeries } from "@/lib/repo/vaccines";
import type { Hospital, Sex } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function ChildForm() {
  const { id } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const editing = Boolean(id);
  const { data: existing } = useChild(fid, id ?? "__none__");

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<Sex>("F");
  const [bloodType, setBloodType] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [withEpi, setWithEpi] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setNickname(existing.nickname ?? "");
    setBirthDate(existing.birthDate);
    setSex(existing.sex);
    setBloodType(existing.bloodType ?? "");
    setHospitals(existing.hospitals ?? []);
  }, [existing]);

  function onSave() {
    const r = childSchema(todayISO()).safeParse({ name, nickname, birthDate, sex, bloodType, hospitals });
    const msg = firstError(r);
    if (msg || !r.success) return setError(msg);
    if (editing && id) {
      updateChild(fid, id, r.data);
      nav(`/children/${id}`);
    } else {
      const cid = createChild(fid, r.data);
      if (withEpi) createEpiSeries(fid, cid, r.data.birthDate);
      nav(`/children/${cid}`);
    }
  }

  const setHospital = (i: number, patch: Partial<Hospital>) =>
    setHospitals((hs) => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{editing ? "แก้ไขข้อมูลลูก" : "เพิ่มลูก"}</h1>
      <div className="space-y-1"><Label>ชื่อ</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1"><Label>ชื่อเล่น</Label><Input value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
      <div className="space-y-1"><Label>วันเกิด</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>เพศ</Label>
          <select className={selectCls} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="F">หญิง</option>
            <option value="M">ชาย</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>กรุ๊ปเลือด</Label>
          <select className={selectCls} value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
            <option value="">ไม่ทราบ</option>
            {["A", "B", "AB", "O", "A Rh-", "B Rh-", "AB Rh-", "O Rh-"].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>HN โรงพยาบาล</Label>
        {hospitals.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="โรงพยาบาล" value={h.name} onChange={(e) => setHospital(i, { name: e.target.value })} />
            <Input placeholder="HN" className="w-32" value={h.hn} onChange={(e) => setHospital(i, { hn: e.target.value })} />
            <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => setHospitals((hs) => hs.filter((_, j) => j !== i))}><Trash2 size={16} /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setHospitals((hs) => [...hs, { name: "", hn: "" }])}><Plus size={16} /> เพิ่มโรงพยาบาล</Button>
      </div>

      {!editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withEpi} onChange={(e) => setWithEpi(e.target.checked)} />
          สร้างตารางวัคซีนพื้นฐาน (EPI) จากวันเกิด
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={onSave}>บันทึก</Button>
        <Button variant="ghost" onClick={() => nav(-1)}>ยกเลิก</Button>
      </div>
    </div>
  );
}

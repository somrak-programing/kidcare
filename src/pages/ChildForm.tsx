import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { EPI_TEMPLATE } from "@/data/epi";
import { recomputeEpiDueDates } from "@/domain/schedule";
import { useChild, useDoses, useSeries } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { todayISO } from "@/domain/dates";
import { childSchema, firstError } from "@/domain/validation";
import { createChild, updateChild } from "@/lib/repo/children";
import { applyDueDates, createEpiSeries } from "@/lib/repo/vaccines";
import type { Hospital, Sex } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const BLOOD_TYPES = ["A", "B", "AB", "O", "A Rh-", "B Rh-", "AB Rh-", "O Rh-"];

export default function ChildForm() {
  const { id } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const editing = Boolean(id);
  const { data: existing, loading, error: loadError } = useChild(fid, id ?? null);

  const { data: series } = useSeries(fid, id ?? null);
  const { data: allDoses } = useDoses(fid, id ?? null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<Sex>("F");
  const [bloodType, setBloodType] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [withEpi, setWithEpi] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefilledId = useRef<string | null>(null);

  useEffect(() => {
    if (!existing || existing.id === prefilledId.current) return;
    prefilledId.current = existing.id;
    setName(existing.name);
    setNickname(existing.nickname ?? "");
    setBirthDate(existing.birthDate);
    setSex(existing.sex);
    setBloodType(existing.bloodType ?? "");
    setHospitals(existing.hospitals ?? []);
  }, [existing]);

  if (editing) {
    if (loadError) return <ErrorState error={loadError} />;
    if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
    if (!existing) return <p>ไม่พบข้อมูล</p>;
  }

  function onSave() {
    const r = childSchema(todayISO()).safeParse({ name, nickname, birthDate, sex, bloodType, hospitals });
    const msg = firstError(r);
    if (msg || !r.success) return setError(msg);
    if (editing && id) {
      const birthChanged = existing ? r.data.birthDate !== existing.birthDate : false;
      updateChild(fid, id, r.data);
      if (birthChanged) {
        const epiIds = new Set(series.filter((s) => s.source === "epi").map((s) => s.id));
        const updates = recomputeEpiDueDates(allDoses.filter((d) => epiIds.has(d.seriesId)), EPI_TEMPLATE, r.data.birthDate);
        if (updates.length && confirm(`วันเกิดเปลี่ยน — ปรับวันนัดวัคซีน EPI ที่ยังไม่ได้ฉีด ${updates.length} เข็มตามวันเกิดใหม่ไหม?`)) {
          applyDueDates(fid, id, updates);
        }
      }
      nav(`/children/${id}`);
    } else {
      const cid = createChild(fid, r.data);
      if (withEpi) createEpiSeries(fid, cid, r.data.birthDate);
      nav(`/children/${cid}`, { replace: true });
    }
  }

  const setHospital = (i: number, patch: Partial<Hospital>) =>
    setHospitals((hs) => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  const bloodOptions = bloodType && !BLOOD_TYPES.includes(bloodType) ? [...BLOOD_TYPES, bloodType] : BLOOD_TYPES;

  return (
    <form
      className="space-y-4 max-w-xl mx-auto rounded-xl border bg-card p-5 sm:p-6 shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h1 className="text-xl font-bold">{editing ? "แก้ไขข้อมูลลูก" : "เพิ่มลูก"}</h1>
      <div className="space-y-1"><Label htmlFor="child-name">ชื่อ</Label><Input id="child-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="child-nickname">ชื่อเล่น</Label><Input id="child-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="child-birth">วันเกิด</Label><Input id="child-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="child-sex">เพศ</Label>
          <select id="child-sex" className={selectCls} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="F">หญิง</option>
            <option value="M">ชาย</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="child-blood">กรุ๊ปเลือด</Label>
          <select id="child-blood" className={selectCls} value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
            <option value="">ไม่ทราบ</option>
            {bloodOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium leading-none">HN โรงพยาบาล</p>
        {hospitals.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="โรงพยาบาล" aria-label={`ชื่อโรงพยาบาลแถว ${i + 1}`} value={h.name} onChange={(e) => setHospital(i, { name: e.target.value })} />
            <Input placeholder="HN" aria-label={`HN แถว ${i + 1}`} className="w-32" value={h.hn} onChange={(e) => setHospital(i, { hn: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" aria-label={`ลบโรงพยาบาลแถว ${i + 1}`} onClick={() => setHospitals((hs) => hs.filter((_, j) => j !== i))}><Trash2 size={16} /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setHospitals((hs) => [...hs, { name: "", hn: "" }])}><Plus size={16} /> เพิ่มโรงพยาบาล</Button>
      </div>

      {!editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withEpi} onChange={(e) => setWithEpi(e.target.checked)} />
          สร้างตารางวัคซีนพื้นฐาน (EPI) จากวันเกิด
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit">บันทึก</Button>
        <Button type="button" variant="ghost" onClick={() => nav(editing && id ? `/children/${id}` : "/")}>ยกเลิก</Button>
      </div>
    </form>
  );
}

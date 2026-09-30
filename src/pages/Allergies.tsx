import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { useAllergies, useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { allergySchema, firstError } from "@/domain/validation";
import { deleteAllergy, saveAllergy } from "@/lib/repo/allergies";
import type { Allergy, AllergyType, Severity } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const EMPTY = { type: "drug" as AllergyType, substance: "", reaction: "", severity: "moderate" as Severity, notes: "" };

export default function Allergies() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child } = useChild(fid, cid);
  const { data, error } = useAllergies(fid, cid);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <ErrorState error={error} />;

  function onSave() {
    const r = allergySchema.safeParse(form);
    const m = firstError(r);
    if (m || !r.success) return setMsg(m);
    saveAllergy(fid, cid, r.data, editId);
    setForm(EMPTY);
    setEditId(undefined);
    setMsg(null);
  }

  function onEdit(a: Allergy) {
    setForm({ type: a.type, substance: a.substance, reaction: a.reaction, severity: a.severity, notes: a.notes ?? "" });
    setEditId(a.id);
  }

  return (
    <div className="space-y-4">
      <Link to={`/children/${cid}`} className="text-sm underline">← {child?.nickname || child?.name}</Link>
      <h1 className="text-xl font-bold">การแพ้ยา/อาหาร</h1>
      <ul className="space-y-2">
        {data.map((a) => (
          <li key={a.id} className="flex items-start justify-between rounded-lg border p-3">
            <div className="text-sm">
              <p className="font-semibold">{a.substance}</p>
              <p className="text-muted-foreground">{a.reaction}{a.notes ? ` · ${a.notes}` : ""}</p>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="แก้ไข" onClick={() => onEdit(a)}><Pencil size={16} /></Button>
              <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => confirm(`ลบ "${a.substance}"?`) && deleteAllergy(fid, cid, a.id)}><Trash2 size={16} /></Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="font-semibold">{editId ? "แก้ไข" : "เพิ่มรายการ"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>ประเภท</Label>
            <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AllergyType })}>
              <option value="drug">ยา</option><option value="food">อาหาร</option><option value="other">อื่น ๆ</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>ความรุนแรง</Label>
            <select className={selectCls} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}>
              <option value="mild">เล็กน้อย</option><option value="moderate">ปานกลาง</option><option value="severe">รุนแรง</option>
            </select>
          </div>
        </div>
        <div className="space-y-1"><Label>แพ้อะไร</Label><Input value={form.substance} onChange={(e) => setForm({ ...form, substance: e.target.value })} /></div>
        <div className="space-y-1"><Label>อาการ</Label><Input value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} /></div>
        <div className="space-y-1"><Label>หมายเหตุ</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <div className="flex gap-2">
          <Button onClick={onSave}>บันทึก</Button>
          {editId && <Button variant="ghost" onClick={() => { setForm(EMPTY); setEditId(undefined); }}>ยกเลิก</Button>}
        </div>
      </div>
    </div>
  );
}

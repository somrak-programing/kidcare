import { useEffect, useState } from "react";
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
const SEV: Record<Severity, string> = { mild: "เล็กน้อย", moderate: "ปานกลาง", severe: "รุนแรง" };

export default function Allergies() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child } = useChild(fid, cid);
  const { data, loading, error } = useAllergies(fid, cid);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);

  // If the allergy being edited disappears (deleted here or elsewhere), reset the form.
  useEffect(() => {
    if (editId && !loading && !error && !data.some((a) => a.id === editId)) {
      setForm(EMPTY);
      setEditId(undefined);
      setMsg(null);
    }
  }, [editId, data, loading, error]);

  if (error) return <ErrorState error={error} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  function resetForm() {
    setForm(EMPTY);
    setEditId(undefined);
    setMsg(null);
  }

  function onSave() {
    const r = allergySchema.safeParse(form);
    const m = firstError(r);
    if (m || !r.success) return setMsg(m);
    saveAllergy(fid, cid, r.data, editId);
    resetForm();
  }

  function onEdit(a: Allergy) {
    setForm({ type: a.type, substance: a.substance, reaction: a.reaction, severity: a.severity, notes: a.notes ?? "" });
    setEditId(a.id);
    setMsg(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <Link to={`/children/${cid}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← กลับหน้า {child?.nickname || child?.name}
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">ประวัติการแพ้ยาและอาหาร</h1>
        </div>
        <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full border">
          {child?.nickname || child?.name}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of allergies (7 cols) */}
        <section className="lg:col-span-7 rounded-xl border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
          <h2 className="text-base font-bold">รายการที่แพ้ ({data.length})</h2>
          {data.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              ยังไม่มีบันทึกประวัติการแพ้
            </div>
          ) : (
            <ul className="space-y-2.5">
              {data.map((a) => (
                <li key={a.id} className="flex items-start justify-between rounded-xl border p-3.5 bg-muted/10">
                  <div className="text-sm space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                      <span>{a.substance}</span>
                      <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {a.type === "drug" ? "ยา" : a.type === "food" ? "อาหาร" : "อื่น ๆ"} · {SEV[a.severity]}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{a.reaction}{a.notes ? ` · ${a.notes}` : ""}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="แก้ไข" onClick={() => onEdit(a)}>
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="ลบ" onClick={() => confirm(`ลบ "${a.substance}"?`) && deleteAllergy(fid, cid, a.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right Column: Form (5 cols) */}
        <form
          className="lg:col-span-5 space-y-4 rounded-xl border bg-card p-4 sm:p-5 shadow-xs"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <div className="border-b pb-2.5">
            <h2 className="font-bold text-base">{editId ? "แก้ไขรายการแพ้" : "เพิ่มรายการแพ้ใหม่"}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="allergy-type">ประเภท</Label>
              <select id="allergy-type" className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AllergyType })}>
                <option value="drug">ยา</option>
                <option value="food">อาหาร</option>
                <option value="other">อื่น ๆ</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="allergy-severity">ความรุนแรง</Label>
              <select id="allergy-severity" className={selectCls} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}>
                <option value="mild">เล็กน้อย</option>
                <option value="moderate">ปานกลาง</option>
                <option value="severe">รุนแรง</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="allergy-substance">สิ่งที่แพ้ (ชื่อยา/อาหาร) *</Label>
            <Input id="allergy-substance" value={form.substance} onChange={(e) => setForm({ ...form, substance: e.target.value })} placeholder="เช่น Amoxicillin, กุ้ง, ไข่" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="allergy-reaction">อาการที่แพ้</Label>
            <Input id="allergy-reaction" value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} placeholder="เช่น ลมพิษ, ตาบวม, หายใจเหนื่อย" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="allergy-notes">หมายเหตุ</Label>
            <Input id="allergy-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="เช่น แพ้ตอน 2 ขวบ" />
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit">{editId ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}</Button>
            {editId && <Button type="button" variant="ghost" onClick={resetForm}>ยกเลิก</Button>}
          </div>
        </form>
      </div>
    </div>
  );
}

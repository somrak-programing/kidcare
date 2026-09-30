import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { diffDays, todayISO } from "@/domain/dates";
import { shiftRemainingDoses } from "@/domain/schedule";
import { validateGivenDate } from "@/domain/validation";
import { applyDueDates, updateDose } from "@/lib/repo/vaccines";
import type { Child, VaccineDose } from "@/types";

interface Props {
  fid: string;
  child: Child;
  dose: VaccineDose | null;
  doses: VaccineDose[]; // doses of the same series
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const FIELDS = [
  ["brand", "ยี่ห้อ"],
  ["lotNo", "Lot No."],
  ["amount", "ขนาด (เช่น 0.5 ml)"],
  ["site", "ตำแหน่งที่ฉีด"],
  ["givenBy", "ผู้ฉีด"],
  ["place", "สถานที่"],
  ["notes", "หมายเหตุ"],
] as const;
type Extra = Record<(typeof FIELDS)[number][0], string>;

export default function RecordDoseDialog({ fid, child, dose, doses, open, onOpenChange }: Props) {
  const uid = useId();
  const [given, setGiven] = useState(true);
  const [givenDate, setGivenDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [extra, setExtra] = useState<Extra>({ brand: "", lotNo: "", amount: "", site: "", givenBy: "", place: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dose) return;
    setGiven(true);
    setGivenDate(dose.givenDate ?? todayISO());
    setDueDate(dose.dueDate ?? "");
    setExtra({
      brand: dose.brand ?? "", lotNo: dose.lotNo ?? "", amount: dose.amount ?? "", site: dose.site ?? "",
      givenBy: dose.givenBy ?? "", place: dose.place ?? "", notes: dose.notes ?? "",
    });
    setError(null);
  }, [dose]);

  if (!dose) return null;

  function onSave() {
    if (!dose) return;
    const trimmed = Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.trim() || undefined])) as Partial<Extra>;
    if (!given) {
      updateDose(fid, child.id, dose.id, { dueDate: dueDate || null, ...trimmed });
      onOpenChange(false);
      return;
    }
    const err = !givenDate ? "กรุณาใส่วันที่ฉีด" : validateGivenDate(givenDate, child.birthDate, todayISO());
    if (err) return setError(err);
    const effectiveDue = dueDate || dose.dueDate;
    updateDose(fid, child.id, dose.id, {
      given: true, givenDate, givenDateUnknown: false, dueDate: effectiveDue, ...trimmed,
    });
    const late = effectiveDue ? diffDays(givenDate, effectiveDue) : 0;
    if (!dose.given && late > 0) {
      const updates = shiftRemainingDoses(doses, dose.doseNo, late);
      if (updates.length && confirm(`ฉีดช้ากว่านัด ${late} วัน — เลื่อนนัดเข็มที่เหลือ (${updates.length} เข็ม) ออกไป ${late} วันไหม?`)) {
        applyDueDates(fid, child.id, updates);
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dose.vaccineName} เข็ม {dose.doseNo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={given} onChange={(e) => setGiven(e.target.checked)} /> ฉีดแล้ว
          </label>
          {given && (
            <div className="space-y-1">
              <Label htmlFor={`${uid}-givenDate`}>วันที่ฉีด</Label>
              <Input id={`${uid}-givenDate`} type="date" value={givenDate} onChange={(e) => setGivenDate(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`${uid}-dueDate`}>วันนัด</Label>
            <Input id={`${uid}-dueDate`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`${uid}-${k}`}>{label}</Label>
              <Input id={`${uid}-${k}`} value={extra[k]} onChange={(e) => setExtra({ ...extra, [k]: e.target.value })} />
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={onSave}>บันทึก</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

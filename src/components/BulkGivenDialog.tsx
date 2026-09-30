import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { validateGivenDate } from "@/domain/validation";
import { markDosesGiven } from "@/lib/repo/vaccines";
import type { Child, VaccineDose } from "@/types";

interface Row { checked: boolean; date: string } // date "" = ไม่ทราบวันที่

export default function BulkGivenDialog({ fid, child, doses, open, onOpenChange }: {
  fid: string; child: Child; doses: VaccineDose[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const today = todayISO();
  const candidates = doses.filter((d) => !d.given && d.dueDate && d.dueDate <= today);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [error, setError] = useState<string | null>(null);
  const rowOf = (id: string): Row => rows[id] ?? { checked: false, date: "" };

  useEffect(() => {
    if (open) setRows(Object.fromEntries(candidates.map((d) => [d.id, { checked: false, date: "" }])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSave() {
    const items = candidates.filter((d) => rowOf(d.id).checked).map((d) => ({ id: d.id, givenDate: rowOf(d.id).date || null }));
    for (const it of items) {
      const err = it.givenDate ? validateGivenDate(it.givenDate, child.birthDate, today) : null;
      if (err) return setError(err);
    }
    markDosesGiven(fid, child.id, items);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ติ๊กเข็มที่ฉีดไปแล้ว</DialogTitle></DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีเข็มที่ถึงกำหนดแล้วและยังไม่บันทึก</p>
        ) : (
          <ul className="space-y-2">
            {candidates.map((d) => (
              <li key={d.id} className="space-y-1 rounded border p-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rowOf(d.id).checked}
                    onChange={(e) => setRows({ ...rows, [d.id]: { ...rowOf(d.id), checked: e.target.checked } })} />
                  {d.vaccineName} เข็ม {d.doseNo} <span className="text-muted-foreground">(กำหนด {formatThaiDate(d.dueDate!)})</span>
                </label>
                {rowOf(d.id).checked && (
                  <div className="flex items-center gap-2 pl-6">
                    <Input type="date" className="h-8" value={rowOf(d.id).date}
                      aria-label={`วันที่ฉีด ${d.vaccineName} เข็ม ${d.doseNo}`}
                      onChange={(e) => setRows({ ...rows, [d.id]: { ...rowOf(d.id), date: e.target.value } })} />
                    <span className="text-xs text-muted-foreground">เว้นว่าง = ไม่ทราบวันที่</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={!candidates.length} onClick={onSave}>บันทึก</Button>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Check, Thermometer, ShieldAlert, Pill } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { classifyFever, checkAntipyreticSafety, type AntipyreticSafety } from "@/domain/temperature";
import { createTemperatureLog } from "@/lib/repo/temperatureLogs";
import type { Child, TempMethod, TemperatureLog } from "@/types";

interface Props {
  fid: string;
  child: Child;
  recentLogs?: TemperatureLog[];
  illnessId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function QuickTempDialog({
  fid,
  child,
  recentLogs = [],
  illnessId,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [temp, setTemp] = useState("37.8");
  const [method, setMethod] = useState<TempMethod>("ear");
  const [gaveMed, setGaveMed] = useState(false);
  const [medName, setMedName] = useState("พาราเซตามอล (Paracetamol)");
  const [medDose, setMedDose] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // หาล่าสุดที่ให้ยาลดไข้
  const lastGivenLog = recentLogs.find((l) => l.gaveAntipyretic);
  const safety: AntipyreticSafety = checkAntipyreticSafety(
    lastGivenLog ? lastGivenLog.measuredAt : null,
  );

  const numTemp = parseFloat(temp) || 0;
  const fever = classifyFever(numTemp);

  useEffect(() => {
    if (open) {
      setTemp("38.0");
      setGaveMed(false);
      setNotes("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (numTemp < 34 || numTemp > 43) {
      alert("กรุณากรอกอุณหภูมิที่ถูกต้อง (34.0 - 43.0 °C)");
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      await createTemperatureLog(fid, child.id, {
        childId: child.id,
        illnessId: illnessId ?? null,
        measuredAt: nowIso,
        tempCelsius: numTemp,
        method,
        gaveAntipyretic: gaveMed,
        antipyreticMedName: gaveMed ? medName : undefined,
        antipyreticDose: gaveMed ? medDose : undefined,
        notes: notes.trim() || undefined,
      });

      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Thermometer className="text-primary" size={20} />
            บันทึกอุณหภูมิ / วัดไข้ — {child.nickname || child.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* อุณหภูมิ & แถบระดับไข้ */}
          <div className="space-y-2">
            <Label htmlFor="temp-val">อุณหภูมิที่วัดได้ (°C)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="temp-val"
                type="number"
                step="0.1"
                min="34"
                max="43"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="text-2xl font-bold h-12 text-center"
                autoFocus
              />
              <span className="text-xl font-medium text-muted-foreground">°C</span>
            </div>

            {/* Quick buttons */}
            <div className="flex gap-1.5 justify-center">
              {["37.0", "37.5", "38.0", "38.5", "39.0", "39.5"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemp(t)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    temp === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-input"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* การประเมินระดับไข้ */}
            {numTemp >= 35 && numTemp <= 42 && (
              <div className={`rounded-lg border p-2.5 text-xs space-y-1 ${fever.badgeClass}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>{fever.label} ({numTemp} °C)</span>
                </div>
                <p>{fever.description}</p>
              </div>
            )}
          </div>

          {/* ตำแหน่งที่วัด */}
          <div className="space-y-1.5">
            <Label>ตำแหน่งที่วัด</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: "ear", label: "ทางหู" },
                { key: "armpit", label: "รักแร้" },
                { key: "forehead", label: "หน้าผาก" },
                { key: "rectal", label: "ทวารหนัก" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key as TempMethod)}
                  className={`text-xs py-2 rounded-md border font-medium transition-colors ${
                    method === m.key
                      ? "bg-secondary text-secondary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ให้ยาลดไข้ */}
          <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <Checkbox
                id="gave-antipyretic"
                checked={gaveMed}
                onCheckedChange={(c) => setGaveMed(Boolean(c))}
              />
              <Label htmlFor="gave-antipyretic" className="cursor-pointer font-semibold flex items-center gap-1.5">
                <Pill size={15} /> ให้ยาลดไข้พร้อมกันในครั้งนี้
              </Label>
            </div>

            {/* แสดงการเตือนเรื่องระยะห่างยาลดไข้ */}
            {gaveMed && (
              <div className="space-y-3 pl-6 pt-1">
                {safety.severity === "danger" && (
                  <div className="rounded-md bg-rose-500/15 border border-rose-500/40 p-2.5 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert size={16} /> เตือน: ระยะห่างยายังไม่ถึง 4 ชั่วโมง!
                    </div>
                    <p>{safety.message}</p>
                  </div>
                )}

                {safety.severity === "warning" && (
                  <div className="rounded-md bg-amber-500/15 border border-amber-500/40 p-2.5 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={15} /> ข้อควรระวัง: ระยะห่าง 4-6 ชั่วโมง
                    </div>
                    <p>{safety.message}</p>
                  </div>
                )}

                {safety.severity === "safe" && (
                  <div className="rounded-md bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check size={14} /> {safety.message}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="med-name" className="text-xs">ชื่อยา</Label>
                    <Input
                      id="med-name"
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="เช่น พาราเซตามอล"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="med-dose" className="text-xs">ปริมาณ (มล./ซีซี)</Label>
                    <Input
                      id="med-dose"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="เช่น 5 ml หรือ 1 ช้อนชา"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* บันทึกเพิ่มเติม */}
          <div className="space-y-1">
            <Label htmlFor="temp-notes" className="text-xs">อาการร่วม / บันทึกเพิ่มเติม</Label>
            <Input
              id="temp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ตัวร้อน มือเท้าร้อน เช็ดตัวแล้ว"
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

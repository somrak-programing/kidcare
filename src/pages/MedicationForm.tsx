import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { todayISO } from "@/domain/dates";
import { useFamilyId } from "@/hooks/useFamilyId";
import { createMedication } from "@/lib/repo/medications";
import type { MedicationType } from "@/types";

const COMMON_MED_PRESETS: { name: string; type: MedicationType; dosage: string; frequency: string; complete: boolean }[] = [
  { name: "พาราเซตามอล (Tempra/Sara)", type: "fever", dosage: "5 ml", frequency: "ทุก 4-6 ชม. เวลาเป็นไข้", complete: false },
  { name: "อะม็อกซีซิลลิน (Amoxicillin)", type: "antibiotic", dosage: "5 ml", frequency: "เช้า-เย็น หลังอาหาร ติดต่อกันจนหมด", complete: true },
  { name: "ออคเมนติน (Augmentin)", type: "antibiotic", dosage: "5 ml", frequency: "เช้า-เย็น หลังอาหาร ติดต่อกันจนหมด", complete: true },
  { name: "ยาแก้แพ้/ลดน้ำมูก (Zyrtec/Cetirizine)", type: "allergy", dosage: "2.5 ml", frequency: "วันละ 1 ครั้ง ก่อนนอน", complete: false },
  { name: "ยาละลายเสมหะ (Flemex/Fluifort)", type: "cough_cold", dosage: "2.5 ml", frequency: "วันละ 2 ครั้ง เช้า-เย็น", complete: false },
  { name: "น้ำเกลือแร่ (ORS)", type: "other", dosage: "1 ซอง", frequency: "จิบบ่อยๆ เวลาถ่ายเหลว", complete: false },
];

export default function MedicationForm() {
  const { id: cid = "" } = useParams();
  const [params] = useSearchParams();
  const illnessId = params.get("illnessId") || undefined;
  const visitId = params.get("visitId") || undefined;

  const fid = useFamilyId();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [type, setType] = useState<MedicationType>("fever");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [requiresCompletion, setRequiresCompletion] = useState(false);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function applyPreset(p: typeof COMMON_MED_PRESETS[0]) {
    setName(p.name);
    setType(p.type);
    setDosage(p.dosage);
    setFrequency(p.frequency);
    setRequiresCompletion(p.complete);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      alert("กรุณากรอกชื่อยา");
      return;
    }

    setSaving(true);
    try {
      await createMedication(fid, cid, {
        childId: cid,
        illnessId,
        visitId,
        name: name.trim(),
        type,
        dosage: dosage.trim() || undefined as never,
        frequency: frequency.trim() || undefined as never,
        requiresCompletion,
        startDate,
        endDate: endDate || null,
        status: "active",
        notes: notes.trim() || undefined,
      });

      if (illnessId) {
        nav(`/children/${cid}/illnesses/${illnessId}`);
      } else {
        nav(`/children/${cid}`);
      }
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold">บันทึกยาที่ได้รับ</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกวิธีใช้ยาและติดตามการให้ยาของลูก
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Presets */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ยายอดนิยม (คลิกเพื่อเลือกอัตโนมัติ)</Label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_MED_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs px-2.5 py-1 rounded-full border bg-muted/30 hover:bg-muted text-muted-foreground transition-colors"
              >
                {p.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="med-name">ชื่อยา *</Label>
          <Input
            id="med-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น Tempra, Amoxicillin"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="med-type">ชนิดของยา</Label>
            <select
              id="med-type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as MedicationType)}
            >
              <option value="fever">ยาลดไข้</option>
              <option value="antibiotic">ยาฆ่าเชื้อ / ปฏิชีวนะ</option>
              <option value="cough_cold">ยาแก้ไอ / ลดน้ำมูก / ละลายเสมหะ</option>
              <option value="allergy">ยาแก้แพ้</option>
              <option value="other">ยาอื่นๆ</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="med-dose">ปริมาณต่อครั้ง</Label>
            <Input
              id="med-dose"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="เช่น 5 ml, 1 เม็ด"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="med-freq">วิธีรับประทาน</Label>
          <Input
            id="med-freq"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="เช่น ทุก 4-6 ชม. เวลามีไข้, เช้า-เย็น หลังอาหาร"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="med-complete"
            checked={requiresCompletion}
            onCheckedChange={(c) => setRequiresCompletion(Boolean(c))}
          />
          <Label htmlFor="med-complete" className="cursor-pointer text-sm">
            ต้องกินติดต่อกันจนหมด (เช่น ยาฆ่าเชื้อ)
          </Label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="med-start">วันที่เริ่มยา</Label>
            <Input
              id="med-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="med-end">วันสิ้นสุดยา (ถ้ามี)</Label>
            <Input
              id="med-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="med-notes">หมายเหตุ</Label>
          <Input
            id="med-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="เช่น เก็บในตู้เย็น, เขย่าขวดก่อนกิน"
          />
        </div>

        <div className="flex gap-2 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกยา"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => nav(-1)}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </div>
  );
}

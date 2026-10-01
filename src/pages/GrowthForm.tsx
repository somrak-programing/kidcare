import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/domain/dates";
import { calculateAgeInMonths } from "@/domain/growth";
import { useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { createGrowthRecord } from "@/lib/repo/growth";

export default function GrowthForm() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: child } = useChild(fid, cid);

  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const ageMonths = child ? calculateAgeInMonths(child.birthDate, date) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = weight ? parseFloat(weight) : undefined;
    const h = height ? parseFloat(height) : undefined;
    const hd = head ? parseFloat(head) : undefined;

    if (!w && !h) {
      alert("กรุณากรอกน้ำหนักหรือส่วนสูงอย่างน้อยหนึ่งค่า");
      return;
    }

    setSaving(true);
    try {
      await createGrowthRecord(fid, cid, {
        childId: cid,
        date,
        ageMonths,
        weightKg: w,
        heightCm: h,
        headCircumferenceCm: hd,
        notes: notes.trim() || undefined,
      });

      nav(`/children/${cid}/growth`);
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto rounded-xl border bg-card p-5 sm:p-6 shadow-xs">
      <div className="border-b pb-3">
        <h1 className="text-xl font-bold">บันทึกการเจริญเติบโต</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {child?.nickname || child?.name} (อายุ ณ วันที่วัด: {Math.floor(ageMonths / 12)} ปี {ageMonths % 12} เดือน)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="growth-date">วันที่วัด *</Label>
          <Input
            id="growth-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="growth-weight">น้ำหนัก (กิโลกรัม)</Label>
            <Input
              id="growth-weight"
              type="number"
              step="0.1"
              min="1"
              max="60"
              placeholder="เช่น 12.4"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="growth-height">ส่วนสูง (เซนติเมตร)</Label>
            <Input
              id="growth-height"
              type="number"
              step="0.5"
              min="30"
              max="160"
              placeholder="เช่น 88.5"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="growth-head">เส้นรอบศีรษะ (เซนติเมตร - ถ้ามี)</Label>
          <Input
            id="growth-head"
            type="number"
            step="0.1"
            min="20"
            max="60"
            placeholder="เช่น 47.0"
            value={head}
            onChange={(e) => setHead(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="growth-notes">บันทึกเพิ่มเติม</Label>
          <Input
            id="growth-notes"
            placeholder="เช่น ชั่งตอนฉีดวัคซีนที่ รพ., ชั่งที่บ้าน"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => nav(-1)}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </div>
  );
}

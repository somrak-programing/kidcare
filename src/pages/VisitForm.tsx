import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/domain/dates";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useChild } from "@/hooks/data";
import { createVisit } from "@/lib/repo/visits";

export default function VisitForm() {
  const { id: cid = "" } = useParams();
  const [params] = useSearchParams();
  const illnessId = params.get("illnessId") || undefined;

  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: child } = useChild(fid, cid);

  const defaultHospital = child?.hospitals?.[0]?.name || "";
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [hospital, setHospital] = useState(defaultHospital);
  const [doctor, setDoctor] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [nextApptDate, setNextApptDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospital.trim()) {
      alert("กรุณากรอกโรงพยาบาลหรือคลินิก");
      return;
    }

    setSaving(true);
    try {
      await createVisit(fid, cid, {
        childId: cid,
        illnessId,
        date,
        time: time || undefined,
        hospital: hospital.trim(),
        doctor: doctor.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        advice: advice.trim() || undefined,
        nextApptDate: nextApptDate || undefined,
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
    <div className="space-y-5 max-w-xl mx-auto rounded-xl border bg-card p-5 sm:p-6 shadow-xs">
      <div className="border-b pb-3">
        <h1 className="text-xl font-bold">บันทึกการไปพบแพทย์</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          บันทึกการตรวจรักษาของ {child?.nickname || child?.name}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="visit-date">วันที่ไปตรวจ *</Label>
            <Input
              id="visit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="visit-time">เวลา</Label>
            <Input
              id="visit-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-hosp">โรงพยาบาล / คลินิก *</Label>
          <Input
            id="visit-hosp"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            placeholder="เช่น รพ.เมืองสมุทรปากน้ำ"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-doc">ชื่อแพทย์ผู้ตรวจ</Label>
          <Input
            id="visit-doc"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="เช่น พญ.สมหญิง"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-diag">ผลการวินิจฉัย</Label>
          <Input
            id="visit-diag"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="เช่น ลำไส้อักเสบจากไวรัส, คออักเสบ"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-advice">คำแนะนำแพทย์ / แผนการรักษา</Label>
          <Input
            id="visit-advice"
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            placeholder="เช่น ดื่มเกลือแร่บ่อยๆ, ถ้าไข้ไม่ลดใน 3 วันให้กลับมาตรวจซ้ำ"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="visit-next">นัดตรวจซ้ำ (ถ้ามี)</Label>
          <Input
            id="visit-next"
            type="date"
            value={nextApptDate}
            onChange={(e) => setNextApptDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 pt-3">
          <Button type="submit" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกการไปตรวจ"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => nav(-1)}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </div>
  );
}

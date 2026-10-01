import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/domain/dates";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useIllnesses } from "@/hooks/data";
import { createIllness, updateIllness } from "@/lib/repo/illnesses";
import type { IllnessStatus } from "@/types";

const COMMON_ILLNESSES = [
  "ไข้หวัด",
  "ไข้หวัดใหญ่",
  "มือเท้าปาก",
  "RSV",
  "ท้องร่วง / ลำไส้อักเสบ",
  "โควิด-19",
  "ผื่นคัน / ลมพิษ",
  "หูชั้นกลางอักเสบ",
];

const COMMON_SYMPTOMS = [
  "มีไข้",
  "ไอ",
  "มีน้ำมูก",
  "เจ็บคอ",
  "มีเสมหะ",
  "หายใจเหนื่อย/ครืดคราด",
  "อาเจียน",
  "ถ่ายเหลว / ท้องเสีย",
  "มีผื่น",
  "ตุ่มในปาก / เจ็บปาก",
  "ซึม / ไม่กินข้าว",
  "งอแงผิดปกติ",
];

export default function IllnessForm() {
  const { id: cid = "", illnessId } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: illnesses } = useIllnesses(fid, cid);
  const editing = illnessId ? illnesses.find((it) => it.id === illnessId) : undefined;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState<string>("");
  const [status, setStatus] = useState<IllnessStatus>("active");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setStartDate(editing.startDate);
      setEndDate(editing.endDate || "");
      setStatus(editing.status);
      setSelectedSymptoms(editing.symptoms || []);
      setNotes(editing.notes || "");
    }
  }, [editing]);

  function toggleSymptom(s: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function addCustomSymptom() {
    const trimmed = customSymptom.trim();
    if (!trimmed || selectedSymptoms.includes(trimmed)) return;
    setSelectedSymptoms((prev) => [...prev, trimmed]);
    setCustomSymptom("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      alert("กรุณาระบุชื่อโรคหรืออาการ");
      return;
    }
    if (!startDate) {
      alert("กรุณาระบุวันที่เริ่มมีอาการ");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        updateIllness(fid, cid, editing.id, {
          name: name.trim(),
          startDate,
          endDate: status === "recovered" ? (endDate || todayISO()) : null,
          status,
          symptoms: selectedSymptoms,
          notes: notes.trim() || undefined,
        });
      } else {
        await createIllness(fid, cid, {
          childId: cid,
          name: name.trim(),
          startDate,
          endDate: status === "recovered" ? (endDate || todayISO()) : null,
          status,
          symptoms: selectedSymptoms,
          notes: notes.trim() || undefined,
        });
      }
      nav(`/children/${cid}/illnesses`);
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
        <h1 className="text-xl font-bold">
          {editing ? "แก้ไขบันทึกการป่วย" : "บันทึกการเจ็บป่วย"}
        </h1>
        <p className="text-sm text-muted-foreground">
          บันทึกประวัติเพื่อติดตามอาการ และให้หมอดูย้อนหลังได้สะดวก
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ชื่อโรค / อาการ */}
        <div className="space-y-2">
          <Label htmlFor="illness-name">ชื่อโรคหรืออาการหลัก *</Label>
          <Input
            id="illness-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ไข้หวัด, ท้องร่วง, ผื่นลมพิษ"
            required
          />
          {/* Quick select tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {COMMON_ILLNESSES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setName(item)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  name === item
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 hover:bg-muted border-input text-muted-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* วันที่เริ่ม & วันที่หาย */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="start-date">วันที่เริ่มมีอาการ *</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="illness-status">สถานะ</Label>
            <select
              id="illness-status"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as IllnessStatus)}
            >
              <option value="active">กำลังป่วยอยู่</option>
              <option value="recovered">หายดีแล้ว</option>
            </select>
          </div>
        </div>

        {status === "recovered" && (
          <div className="space-y-1">
            <Label htmlFor="end-date">วันที่หายดี</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}

        {/* อาการที่มี */}
        <div className="space-y-2">
          <Label>อาการร่วม (เลือกได้หลายข้อ)</Label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_SYMPTOMS.map((sym) => {
              const active = selectedSymptoms.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => toggleSymptom(sym)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                    active
                      ? "bg-primary/15 border-primary text-primary font-semibold"
                      : "bg-background border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {active ? `✓ ${sym}` : sym}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <Input
              placeholder="อาการอื่นๆ พิมพ์เพิ่ม..."
              value={customSymptom}
              onChange={(e) => setCustomSymptom(e.target.value)}
              className="h-9 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSymptom();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomSymptom}
            >
              เพิ่ม
            </Button>
          </div>
        </div>

        {/* หมายเหตุ */}
        <div className="space-y-1">
          <Label htmlFor="illness-notes">บันทึกเพิ่มเติม</Label>
          <Input
            id="illness-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="เช่น ติดมาจากเพื่อนที่โรงเรียน, มีน้ำมูกใสในวันแรก"
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

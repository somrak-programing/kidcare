import { useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOM_TEMPLATES } from "@/data/customTemplates";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { generateCustomDoses } from "@/domain/schedule";
import { useFamilyId } from "@/hooks/useFamilyId";
import { createSeriesWithDoses } from "@/lib/repo/vaccines";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function NewSeries() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const uid = useId();
  const [tplKey, setTplKey] = useState(CUSTOM_TEMPLATES[0].key);
  const tpl = CUSTOM_TEMPLATES.find((t) => t.key === tplKey)!;
  const [name, setName] = useState(tpl.name);
  const [offsetsText, setOffsetsText] = useState(tpl.dayOffsets.join(", "));
  const [anchorDose, setAnchorDose] = useState(1);
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [reason, setReason] = useState("");

  function pickTemplate(key: string) {
    const t = CUSTOM_TEMPLATES.find((x) => x.key === key)!;
    setTplKey(key);
    setName(t.name);
    setOffsetsText(t.dayOffsets.join(", "));
    setAnchorDose(1);
  }

  const offsets = useMemo(
    () => offsetsText.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0),
    [offsetsText],
  );
  const valid = Boolean(name.trim() && offsets.length > 0 && anchorDose >= 1 && anchorDose <= offsets.length && anchorDate);
  const preview = valid ? generateCustomDoses({ name: name.trim(), vaccineCode: tpl.vaccineCode, dayOffsets: offsets }, { doseNo: anchorDose, date: anchorDate }) : [];

  function onSave() {
    if (!valid) return;
    createSeriesWithDoses(fid, cid, { name: name.trim(), source: "custom", templateKey: tpl.key, reason: reason.trim() || undefined, doses: preview });
    nav(`/children/${cid}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เพิ่มชุดวัคซีน</h1>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-tpl`}>แม่แบบ</Label>
        <select id={`${uid}-tpl`} className={selectCls} value={tplKey} onChange={(e) => pickTemplate(e.target.value)}>
          {CUSTOM_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name || "กำหนดเอง"}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-name`}>ชื่อวัคซีน</Label>
        <Input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-offsets`}>วันที่ของแต่ละเข็ม นับจากเข็มแรก (วัน, คั่นด้วยจุลภาค)</Label>
        <Input id={`${uid}-offsets`} value={offsetsText} onChange={(e) => setOffsetsText(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-anchor`}>เข็มที่ทราบวันที่</Label>
          <select id={`${uid}-anchor`} className={selectCls} value={anchorDose} onChange={(e) => setAnchorDose(Number(e.target.value))}>
            {offsets.map((_, i) => <option key={i} value={i + 1}>เข็ม {i + 1}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-anchorDate`}>วันที่ของเข็มนั้น</Label>
          <Input id={`${uid}-anchorDate`} type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-reason`}>เหตุผล (เช่น ถูกสุนัขกัด)</Label>
        <Input id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      {preview.length > 0 && (
        <ul className="rounded-lg border p-3 text-sm">
          {preview.map((d) => (
            <li key={d.doseNo} className="flex justify-between">
              <span>เข็ม {d.doseNo}</span>
              <span>{formatThaiDate(d.dueDate!)} {d.given ? "· ฉีดแล้ว" : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">เข็มก่อน "เข็มที่ทราบวันที่" จะถูกบันทึกว่าฉีดแล้วตามวันที่คำนวณ — แก้ไขได้ภายหลัง</p>
      <div className="flex gap-2">
        <Button disabled={!valid} onClick={onSave}>บันทึก</Button>
        <Button variant="ghost" onClick={() => nav(-1)}>ยกเลิก</Button>
      </div>
    </div>
  );
}

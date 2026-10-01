import { useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOM_TEMPLATES } from "@/data/customTemplates";
import { addDaysISO, formatThaiDate, todayISO } from "@/domain/dates";
import { validateGivenDate } from "@/domain/validation";
import { useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { createSeriesWithDoses } from "@/lib/repo/vaccines";
import type { ISODate } from "@/types";

interface DoseRow {
  doseNo: number;
  dueDate: ISODate;
  given: boolean;
}

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function NewSeries() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: child, error: childError, loading } = useChild(fid, cid);
  const uid = useId();
  const today = todayISO();

  const [tplKey, setTplKey] = useState(CUSTOM_TEMPLATES[0].key);
  const tpl = CUSTOM_TEMPLATES.find((t) => t.key === tplKey)!;
  const [name, setName] = useState(tpl.name);
  const [startDate, setStartDate] = useState(today);
  const [reason, setReason] = useState("");

  // รายการเข็มที่สร้างขึ้น สามารถแก้ไขวันที่ของแต่ละเข็มได้โดยตรง
  const [doses, setDoses] = useState<DoseRow[]>(() => {
    return tpl.dayOffsets.map((off, i) => ({
      doseNo: i + 1,
      dueDate: addDaysISO(today, off),
      given: i === 0, // เข็ม 1 ติ๊กฉีดแล้วเป็นค่าเริ่มต้นถ้าเริ่มวันนี้
    }));
  });

  function pickTemplate(key: string) {
    const t = CUSTOM_TEMPLATES.find((x) => x.key === key)!;
    setTplKey(key);
    setName(t.name);
    const newDoses = (t.dayOffsets.length > 0 ? t.dayOffsets : [0]).map((off, i) => ({
      doseNo: i + 1,
      dueDate: addDaysISO(startDate, off),
      given: i === 0 && startDate <= today,
    }));
    setDoses(newDoses);
  }

  function onStartDateChange(newStart: ISODate) {
    setStartDate(newStart);
    // คำนวณวันของแต่ละเข็มใหม่ตามระยะห่างเดิม
    if (doses.length === 0) return;
    const oldBase = doses[0]?.dueDate || startDate;
    const updated = doses.map((d, i) => {
      // ถ้าระยะห่างจากเข็มแรก
      let daysFromStart = 0;
      if (tpl && i < tpl.dayOffsets.length) {
        daysFromStart = tpl.dayOffsets[i];
      } else {
        const d1 = new Date(oldBase).getTime();
        const d2 = new Date(d.dueDate).getTime();
        daysFromStart = Math.max(0, Math.round((d2 - d1) / (86400 * 1000)));
      }
      return {
        ...d,
        dueDate: addDaysISO(newStart, daysFromStart),
        given: i === 0 ? newStart <= today : d.given,
      };
    });
    setDoses(updated);
  }

  function updateDoseDate(index: number, newDate: ISODate) {
    setDoses((prev) =>
      prev.map((d, i) => (i === index ? { ...d, dueDate: newDate } : d)),
    );
  }

  function toggleDoseGiven(index: number) {
    setDoses((prev) =>
      prev.map((d, i) => (i === index ? { ...d, given: !d.given } : d)),
    );
  }

  function addDose() {
    setDoses((prev) => {
      const last = prev[prev.length - 1];
      const lastDate = last ? last.dueDate : startDate;
      const nextDate = addDaysISO(lastDate, 7);
      return [
        ...prev,
        {
          doseNo: prev.length + 1,
          dueDate: nextDate,
          given: false,
        },
      ];
    });
  }

  function removeDose(index: number) {
    if (doses.length <= 1) return;
    setDoses((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((d, i) => ({ ...d, doseNo: i + 1 })),
    );
  }

  // ตรวจสอบความถูกต้อง
  const nameValid = Boolean(name.trim());
  const dosesValid = doses.length > 0 && doses.every((d) => Boolean(d.dueDate));

  let validationError: string | null = null;
  if (!nameValid) {
    validationError = "กรุณากรอกชื่อวัคซีน";
  } else if (!dosesValid) {
    validationError = "กรุณาระบุวันของทุกเข็มให้ครบถ้วน";
  } else if (child) {
    for (const d of doses) {
      if (d.given) {
        const err = validateGivenDate(d.dueDate, child.birthDate, today);
        if (err) {
          validationError = `เข็มที่ ${d.doseNo}: ${err}`;
          break;
        }
      }
    }
  }

  function onSave() {
    if (validationError || !nameValid || !dosesValid) return;
    const renamed = name.trim() !== tpl.name.trim();
    const finalDoses = doses.map((d) => ({
      vaccineName: name.trim(),
      vaccineCode: renamed ? undefined : tpl.vaccineCode,
      doseNo: d.doseNo,
      dueDate: d.dueDate,
      given: d.given,
      givenDate: d.given ? d.dueDate : null,
      givenDateUnknown: false,
    }));

    createSeriesWithDoses(fid, cid, {
      name: name.trim(),
      source: "custom",
      templateKey: tpl.key,
      reason: reason.trim() || undefined,
      doses: finalDoses,
    });
    nav(`/children/${cid}`);
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto rounded-xl border bg-card p-5 sm:p-6 shadow-xs">
      <div className="border-b pb-3">
        <h1 className="text-xl font-bold">เพิ่มชุดวัคซีน</h1>
        <p className="text-xs text-muted-foreground mt-0.5">บันทึกวัคซีนเฉพาะกิจ เช่น พิษสุนัขบ้า หรือวัคซีนเสริม</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${uid}-tpl`}>เลือกแม่แบบวัคซีน</Label>
        <select
          id={`${uid}-tpl`}
          className={selectCls}
          value={tplKey}
          onChange={(e) => pickTemplate(e.target.value)}
        >
          {CUSTOM_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name || "กำหนดเอง (ระบุจำนวนเข็มและวันเอง)"}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${uid}-name`}>ชื่อชุดวัคซีน</Label>
        <Input
          id={`${uid}-name`}
          value={name}
          placeholder="เช่น พิษสุนัขบ้า"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card p-3 space-y-2">
        <Label htmlFor={`${uid}-start`} className="flex items-center gap-1.5 font-medium">
          <Calendar size={15} /> วันที่เริ่มฉีด (เข็มที่ 1)
        </Label>
        <Input
          id={`${uid}-start`}
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          min="2000-01-01"
          max="2100-12-31"
        />
        <p className="text-xs text-muted-foreground">
          ระบบจะคำนวณวันนัดของเข็มถัดไปให้อัตโนมัติ (และสามารถแก้ไขวันที่แต่ละเข็มในตารางด้านล่างได้)
        </p>
      </div>

      {/* ตารางกำหนดการแต่ละเข็ม */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-sm">กำหนดการฉีดแต่ละเข็ม ({doses.length} เข็ม)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addDose}>
            <Plus size={14} className="mr-1" /> เพิ่มเข็ม
          </Button>
        </div>

        <div className="space-y-2">
          {doses.map((d, index) => (
            <div
              key={d.doseNo}
              className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                d.given ? "bg-muted/40 border-muted" : "bg-card"
              }`}
            >
              <div className="min-w-[65px] font-semibold text-sm">
                เข็ม {d.doseNo}
              </div>

              <div className="flex-1">
                <Input
                  type="date"
                  value={d.dueDate}
                  onChange={(e) => updateDoseDate(index, e.target.value)}
                  className="h-9 text-sm"
                  min="2000-01-01"
                  max="2100-12-31"
                />
              </div>

              <button
                type="button"
                onClick={() => toggleDoseGiven(index)}
                className={`flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-medium border transition-colors shrink-0 ${
                  d.given
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-input hover:bg-accent"
                }`}
                title="คลิกเพื่อเปลี่ยนสถานะว่าฉีดแล้วหรือไม่"
              >
                {d.given && <Check size={13} />}
                {d.given ? "ฉีดแล้ว" : "ยังไม่ฉีด"}
              </button>

              {doses.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`ลบเข็ม ${d.doseNo}`}
                  onClick={() => removeDose(index)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* สรุปวันที่ภาษาไทย */}
        <div className="rounded-md bg-muted/30 p-2.5 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">สรุปวันนัด:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {doses.map((d) => (
              <span key={d.doseNo}>
                • เข็ม {d.doseNo}: {formatThaiDate(d.dueDate)} {d.given ? "(ฉีดแล้ว)" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${uid}-reason`}>เหตุผล / หมายเหตุ (ถ้ามี)</Label>
        <Input
          id={`${uid}-reason`}
          placeholder="เช่น ถูกสุนัขกัด, ฉีดกระตุ้น"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-destructive font-medium">
          {validationError}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button disabled={Boolean(validationError) || loading} onClick={onSave}>
          บันทึกชุดวัคซีน
        </Button>
        <Button variant="ghost" onClick={() => nav(-1)}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

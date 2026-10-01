import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Thermometer,
  Stethoscope,
  Pill,
  CheckCircle,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import QuickTempDialog from "@/components/QuickTempDialog";
import TemperatureChart from "@/components/TemperatureChart";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { classifyFever } from "@/domain/temperature";
import { useChild, useIllnesses, useMedications, useTemperatureLogs, useVisits } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { deleteIllness, markIllnessRecovered } from "@/lib/repo/illnesses";
import { deleteMedication } from "@/lib/repo/medications";
import { deleteTemperatureLog } from "@/lib/repo/temperatureLogs";
import { deleteVisit } from "@/lib/repo/visits";

export default function IllnessDetail() {
  const { id: cid = "", illnessId = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();

  const { data: child, error: e1 } = useChild(fid, cid);
  const { data: illnesses, error: e2 } = useIllnesses(fid, cid);
  const { data: allVisits, error: e3 } = useVisits(fid, cid);
  const { data: allMeds, error: e4 } = useMedications(fid, cid);
  const { data: allTemps, error: e5 } = useTemperatureLogs(fid, cid);

  const [tempDialogOpen, setTempDialogOpen] = useState(false);

  const err = e1 ?? e2 ?? e3 ?? e4 ?? e5;
  if (err) return <ErrorState error={err} />;

  const illness = illnesses.find((it) => it.id === illnessId);
  if (!illness && illnesses.length > 0) return <p className="text-muted-foreground">ไม่พบข้อมูลการเจ็บป่วย</p>;
  if (!illness || !child) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  // กรองข้อมูลที่ผูกกับ illness นี้
  const visits = allVisits.filter((v) => v.illnessId === illnessId);
  const meds = allMeds.filter((m) => m.illnessId === illnessId);
  const temps = allTemps.filter((t) => t.illnessId === illnessId || (!t.illnessId && t.measuredAt.slice(0, 10) >= illness.startDate));

  const isActive = illness.status === "active";

  function handleMarkRecovered() {
    if (confirm("บันทึกว่าลูกหายป่วยจากอาการนี้แล้ว?")) {
      markIllnessRecovered(fid, cid, illnessId, todayISO());
    }
  }

  function handleDelete() {
    if (confirm(`ลบประวัติการป่วย "${illness?.name}"?`)) {
      deleteIllness(fid, cid, illnessId);
      nav(`/children/${cid}/illnesses`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="space-y-2">
        <Link
          to={`/children/${cid}/illnesses`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> กลับหน้ารวมประวัติการเจ็บป่วย
        </Link>

        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{illness.name}</h1>
              {isActive ? (
                <span className="rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 text-xs font-semibold">
                  กำลังป่วยอยู่
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-semibold">
                  หายดีแล้ว
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground flex items-center gap-1.5 pt-1">
              <Calendar size={14} /> เริ่มมีอาการ {formatThaiDate(illness.startDate)}
              {illness.endDate && ` — หายเมื่อ ${formatThaiDate(illness.endDate)}`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="แก้ไข">
              <Link to={`/children/${cid}/illnesses/${illnessId}/edit`}>
                <Pencil size={16} />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label="ลบ"
              onClick={handleDelete}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        {/* Symptoms & Notes */}
        {illness.symptoms && illness.symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {illness.symptoms.map((s) => (
              <span
                key={s}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {illness.notes && (
          <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-md">
            หมายเหตุ: {illness.notes}
          </p>
        )}

        {isActive && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 flex items-center gap-1.5"
              onClick={handleMarkRecovered}
            >
              <CheckCircle size={15} /> บันทึกว่าหายดีแล้ว
            </Button>
          </div>
        )}
      </div>

      {/* Main Grid: Left 7 cols (Temperature Chart & Logs), Right 5 cols (Meds & Visits) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 1. อุณหภูมิ & บันทึกไข้ */}
        <section className="lg:col-span-7 space-y-3 rounded-xl border p-4 sm:p-5 bg-card shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Thermometer className="text-primary" size={18} />
              <h2 className="font-bold text-base">บันทึกอุณหภูมิร่างกาย</h2>
            </div>
            <Button
              size="sm"
              onClick={() => setTempDialogOpen(true)}
              className="flex items-center gap-1.5 h-8 text-xs"
            >
              <Plus size={14} /> บันทึกไข้
            </Button>
          </div>

          {/* กราฟอุณหภูมิ */}
          <TemperatureChart logs={temps} />

          {/* รายการวัดไข้ล่าสุด */}
          {temps.length > 0 && (
            <div className="divide-y rounded-lg border text-sm max-h-72 overflow-y-auto">
              {temps.slice(0, 15).map((t) => {
                const fever = classifyFever(t.tempCelsius);
                const dateStr = new Date(t.measuredAt).toLocaleString("th-TH", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={t.id} className="flex items-center justify-between p-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-base ${fever.colorClass}`}>
                          {t.tempCelsius}°C
                        </span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${fever.badgeClass}`}>
                          {fever.label}
                        </span>
                        {t.gaveAntipyretic && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 border border-purple-500/20 font-medium flex items-center gap-1">
                            <Pill size={11} /> {t.antipyreticMedName || "ให้ยาลดไข้"} {t.antipyreticDose ? `(${t.antipyreticDose})` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={11} /> {dateStr} · {t.method === "ear" ? "หู" : t.method === "armpit" ? "รักแร้" : t.method === "forehead" ? "หน้าผาก" : "ทวารหนัก"}
                        {t.notes ? ` · ${t.notes}` : ""}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => confirm("ลบบันทึกอุณหภูมินี้?") && deleteTemperatureLog(fid, cid, t.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Meds & Visits */}
        <div className="lg:col-span-5 space-y-6">
          {/* 2. ยาที่ได้รับ (Medications) */}
          <section className="space-y-3 rounded-xl border p-4 sm:p-5 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Pill className="text-primary" size={18} />
                <h2 className="font-bold text-base">ยาที่ได้รับ ({meds.length})</h2>
              </div>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <Link to={`/children/${cid}/medications/new?illnessId=${illnessId}`}>
                  <Plus size={13} /> เพิ่มยา
                </Link>
              </Button>
            </div>

            {meds.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                ยังไม่มีรายการยาที่บันทึก
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {meds.map((m) => (
                  <div key={m.id} className="rounded-lg border p-3 text-sm space-y-1 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{m.name}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => confirm(`ลบยา ${m.name}?`) && deleteMedication(fid, cid, m.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {m.dosage && <span>ปริมาณ: <strong>{m.dosage}</strong></span>}
                      {m.frequency && <span>วิธีใช้: <strong>{m.frequency}</strong></span>}
                    </div>

                    {m.requiresCompletion && (
                      <span className="inline-block text-[11px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        ⚠️ ต้องทานติดต่อกันจนหมด (ยาฆ่าเชื้อ)
                      </span>
                    )}
                    {m.notes && <p className="text-xs text-muted-foreground">หมายเหตุ: {m.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. การไปพบแพทย์ (Visits) */}
          <section className="space-y-3 rounded-xl border p-4 sm:p-5 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="text-primary" size={18} />
                <h2 className="font-bold text-base">ประวัติพบแพทย์ ({visits.length})</h2>
              </div>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <Link to={`/children/${cid}/visits/new?illnessId=${illnessId}`}>
                  <Plus size={13} /> บันทึกการตรวจ
                </Link>
              </Button>
            </div>

            {visits.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                ยังไม่มีบันทึกการไปพบแพทย์ในรอบการป่วยนี้
              </p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {visits.map((v) => (
                  <div key={v.id} className="rounded-lg border p-3.5 text-sm space-y-1.5 bg-muted/10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{v.hospital}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatThaiDate(v.date)} {v.time ? `${v.time} น.` : ""} {v.doctor ? `· ${v.doctor}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => confirm("ลบบันทึกการพบแพทย์นี้?") && deleteVisit(fid, cid, v.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>

                    {v.diagnosis && (
                      <p className="text-xs">
                        <span className="font-semibold">ผลตรวจ:</span> {v.diagnosis}
                      </p>
                    )}
                    {v.advice && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">คำแนะนำ:</span> {v.advice}
                      </p>
                    )}
                    {v.nextApptDate && (
                      <p className="text-xs text-primary font-medium">
                        📅 นัดดูอาการซ้ำ: {formatThaiDate(v.nextApptDate)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Modal บันทึกไข้ */}
      <QuickTempDialog
        fid={fid}
        child={child}
        recentLogs={allTemps}
        illnessId={illnessId}
        open={tempDialogOpen}
        onOpenChange={setTempDialogOpen}
      />
    </div>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, ChevronRight, Pencil, Printer, Thermometer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import AllergyBanner from "@/components/AllergyBanner";
import ErrorState from "@/components/ErrorState";
import QuickTempDialog from "@/components/QuickTempDialog";
import VaccineTimeline from "@/components/VaccineTimeline";
import CalendarButtons from "@/components/CalendarButtons";
import { useChild, useGrowth, useIllnesses, useOpenAppointments, useTemperatureLogs } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { ageText, formatThaiDate, todayISO } from "@/domain/dates";
import { calendarName } from "@/domain/names";

export default function ChildDetail() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child, loading, error } = useChild(fid, cid);
  const { data: illnesses } = useIllnesses(fid, cid);
  const { data: tempLogs } = useTemperatureLogs(fid, cid);
  const { data: growth } = useGrowth(fid, cid);
  const latestGrowth = growth[0];

  const [tempDialogOpen, setTempDialogOpen] = useState(false);

  if (error) return <ErrorState error={error} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!child) return <p>ไม่พบข้อมูล</p>;

  const activeIllness = illnesses.find((i) => i.status === "active");

  return (
    <div className="space-y-6">
      <AllergyBanner fid={fid} cid={cid} />

      {/* Child Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold text-lg">
            {(child.nickname || child.name).slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {child.nickname ? `${child.nickname} (${child.name})` : child.name}
              </h1>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                {child.sex === "F" ? "👧 เด็กหญิง" : "👦 เด็กชาย"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ageText(child.birthDate, todayISO())} · เกิด {formatThaiDate(child.birthDate)}
              {child.bloodType ? ` · กรุ๊ป ${child.bloodType}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button asChild variant="outline" size="sm" className="h-9 text-xs">
            <Link to={`/children/${cid}/report`}>
              <Printer size={14} className="mr-1.5" /> สรุปประวัติ (PDF)
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="แก้ไข" className="h-9 w-9">
            <Link to={`/children/${cid}/edit`}>
              <Pencil size={16} />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2-Column Responsive Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Vaccines - 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <section id="vaccines" className="rounded-xl border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold">ตารางวัคซีน</h2>
              <span className="text-xs text-muted-foreground">ตามเกณฑ์และวัคซีนเสริม</span>
            </div>
            <VaccineTimeline fid={fid} child={child} />
          </section>
        </div>

        {/* Right Column (Health, Growth, Appointments, Hospitals - 5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* กล่องสถานะสุขภาพ / บันทึกการป่วย */}
          <div className="rounded-xl border p-4 space-y-3 bg-card shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Activity size={16} className="text-primary" /> สุขภาพ & ประวัติเจ็บป่วย
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex items-center gap-1"
                  onClick={() => setTempDialogOpen(true)}
                >
                  <Thermometer size={13} /> บันทึกไข้
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link to={`/children/${cid}/illnesses`}>
                    ประวัติ ({illnesses.length}) <ChevronRight size={13} />
                  </Link>
                </Button>
              </div>
            </div>

            {activeIllness ? (
              <Link
                to={`/children/${cid}/illnesses/${activeIllness.id}`}
                className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 transition-colors hover:bg-rose-500/15"
              >
                <div className="space-y-0.5">
                  <span className="font-bold flex items-center gap-1">
                    ⚠️ กำลังป่วย: {activeIllness.name}
                  </span>
                  <span className="text-muted-foreground">
                    เริ่ม {formatThaiDate(activeIllness.startDate)}
                    {activeIllness.symptoms?.length ? ` · ${activeIllness.symptoms.join(", ")}` : ""}
                  </span>
                </div>
                <span className="font-semibold underline">ดูกราฟไข้ & ยา</span>
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                ไม่มีอาการป่วยในขณะนี้ แตะ "บันทึกไข้" เพื่อวัดอุณหภูมิด่วนได้ตลอดเวลา
              </p>
            )}
          </div>

          {/* ทางลัด: การเจริญเติบโต & สรุปประวัติพบแพทย์ */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to={`/children/${cid}/growth`}
              className="flex items-center justify-between rounded-xl border bg-card p-3.5 text-xs hover:border-primary/50 transition-colors shadow-xs"
            >
              <div className="space-y-1">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-primary" /> การเจริญเติบโต
                </span>
                <span className="text-muted-foreground block text-xs">
                  {latestGrowth
                    ? `${latestGrowth.weightKg ? `${latestGrowth.weightKg} กก.` : ""} ${latestGrowth.heightCm ? `${latestGrowth.heightCm} ซม.` : ""}`
                    : "กราฟน้ำหนัก/ส่วนสูง"}
                </span>
              </div>
              <ChevronRight size={15} className="text-muted-foreground" />
            </Link>

            <Link
              to={`/children/${cid}/report`}
              className="flex items-center justify-between rounded-xl border bg-card p-3.5 text-xs hover:border-primary/50 transition-colors shadow-xs"
            >
              <div className="space-y-1">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <Printer size={15} className="text-primary" /> สรุปประวัติ
                </span>
                <span className="text-muted-foreground block text-xs">ยื่นหมอ / พิมพ์ PDF</span>
              </div>
              <ChevronRight size={15} className="text-muted-foreground" />
            </Link>
          </div>

          {/* นัดหมายของเด็กคนนี้ */}
          <section id="appointments" className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h2 className="font-semibold text-sm">นัดหมายของน้อง</h2>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link to={`/appointments/new?child=${cid}`}>+ เพิ่มนัด</Link>
              </Button>
            </div>
            <ChildAppointments fid={fid} cid={cid} who={calendarName(child)} />
          </section>

          {/* โรงพยาบาล & HN */}
          {(child.hospitals?.length ?? 0) > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                โรงพยาบาล & เลขประจำตัว (HN)
              </h3>
              <ul className="divide-y text-sm">
                {child.hospitals?.map((h, i) => (
                  <li key={i} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                    <span className="font-medium">{h.name}</span>
                    <span className="font-mono text-muted-foreground">HN {h.hn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Quick Temp Dialog */}
      <QuickTempDialog
        fid={fid}
        child={child}
        recentLogs={tempLogs}
        illnessId={activeIllness?.id}
        open={tempDialogOpen}
        onOpenChange={setTempDialogOpen}
      />
    </div>
  );
}

function ChildAppointments({ fid, cid, who }: { fid: string; cid: string; who: string }) {
  const { data, error } = useOpenAppointments(fid);
  if (error) return <ErrorState error={error} />;
  const mine = data
    .filter((a) => a.childId === cid)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return (
    <div className="space-y-2">
      {!mine.length && <p className="text-sm text-muted-foreground">ยังไม่มีนัด</p>}
      {mine.map((a) => (
        <div key={a.id} className="space-y-1 rounded-lg border p-3 text-sm">
          <Link to={`/appointments/${a.id}/edit`} className="block">
            <p className="font-semibold">{a.purpose}</p>
            <p className="text-muted-foreground">{formatThaiDate(a.date)}{a.time ? ` ${a.time} น.` : ""} · {a.place}</p>
          </Link>
          <CalendarButtons event={{ uid: `appt-${a.id}`, title: `${who}: ${a.purpose}`, date: a.date, time: a.time, location: a.place }} />
        </div>
      ))}
      <Button asChild size="sm" variant="outline"><Link to={`/appointments/new?child=${cid}`}>เพิ่มนัด</Link></Button>
    </div>
  );
}

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
    <div className="space-y-4">
      <AllergyBanner fid={fid} cid={cid} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{child.nickname ? `${child.nickname} (${child.name})` : child.name}</h1>
          <p className="text-sm text-muted-foreground">
            {ageText(child.birthDate, todayISO())} · เกิด {formatThaiDate(child.birthDate)}
            {child.bloodType ? ` · กรุ๊ป ${child.bloodType}` : ""}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="แก้ไข"><Link to={`/children/${cid}/edit`}><Pencil size={16} /></Link></Button>
      </div>

      {/* กล่องสถานะสุขภาพ / บันทึกการป่วย */}
      <div className="rounded-lg border p-3.5 space-y-2.5 bg-card">
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
            className="flex items-center justify-between rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-400"
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
            <span className="font-semibold underline">ดูบันทึก & กราฟไข้</span>
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">
            ไม่มีอาการป่วยในขณะนี้ แตะ "บันทึกไข้" เพื่อวัดอุณหภูมิด่วนได้ตลอดเวลา
          </p>
        )}
      </div>

      {/* ทางลัด: การเจริญเติบโต & พิมพ์รายงานให้แพทย์ */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          to={`/children/${cid}/growth`}
          className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs hover:border-primary/50 transition-colors"
        >
          <div className="space-y-0.5">
            <span className="font-semibold text-sm flex items-center gap-1.5">
              <TrendingUp size={15} className="text-primary" /> การเจริญเติบโต
            </span>
            <span className="text-muted-foreground block">
              {latestGrowth
                ? `${latestGrowth.weightKg ? `${latestGrowth.weightKg} กก.` : ""} ${latestGrowth.heightCm ? `${latestGrowth.heightCm} ซม.` : ""}`
                : "กราฟน้ำหนัก/ส่วนสูง"}
            </span>
          </div>
          <ChevronRight size={15} className="text-muted-foreground" />
        </Link>

        <Link
          to={`/children/${cid}/report`}
          className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs hover:border-primary/50 transition-colors"
        >
          <div className="space-y-0.5">
            <span className="font-semibold text-sm flex items-center gap-1.5">
              <Printer size={15} className="text-primary" /> สรุปประวัติ / PDF
            </span>
            <span className="text-muted-foreground block">ยื่นหมอ / พิมพ์รายงาน</span>
          </div>
          <ChevronRight size={15} className="text-muted-foreground" />
        </Link>
      </div>

      {(child.hospitals?.length ?? 0) > 0 && (
        <ul className="rounded-lg border p-3 text-sm">
          {child.hospitals?.map((h, i) => (
            <li key={i} className="flex justify-between"><span>{h.name}</span><span className="font-mono">HN {h.hn}</span></li>
          ))}
        </ul>
      )}

      <section id="vaccines" className="space-y-2">
        <h2 className="font-semibold">วัคซีน</h2>
        <VaccineTimeline fid={fid} child={child} />
      </section>

      <section id="appointments" className="space-y-2">
        <h2 className="font-semibold">นัดหมาย</h2>
        <ChildAppointments fid={fid} cid={cid} who={calendarName(child)} />
      </section>

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

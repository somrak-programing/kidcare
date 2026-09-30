import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BulkGivenDialog from "@/components/BulkGivenDialog";
import CalendarButtons from "@/components/CalendarButtons";
import ErrorState from "@/components/ErrorState";
import RecordDoseDialog from "@/components/RecordDoseDialog";
import StatusBadge from "@/components/StatusBadge";
import { useDoses, useSeries } from "@/hooks/data";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { doseStatus } from "@/domain/doseStatus";
import { calendarName } from "@/domain/names";
import { createEpiSeries, deleteSeries } from "@/lib/repo/vaccines";
import type { Child, VaccineDose } from "@/types";

export default function VaccineTimeline({ fid, child }: { fid: string; child: Child }) {
  const { data: series, loading: seriesLoading, error: e1 } = useSeries(fid, child.id);
  const { data: doses, error: e2 } = useDoses(fid, child.id);
  const [active, setActive] = useState<VaccineDose | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const today = todayISO();
  const who = calendarName(child);
  const hasEpi = series.some((s) => s.source === "epi");

  const bySeries = useMemo(() => {
    const m = new Map<string, VaccineDose[]>();
    for (const d of doses) m.set(d.seriesId, [...(m.get(d.seriesId) ?? []), d]);
    return m;
  }, [doses]);

  // เรียง series ตามวันนัดเข็มแรกที่ยังไม่ฉีด (series ที่ฉีดครบไปท้ายสุด)
  const ordered = useMemo(() => {
    const nextDue = (sid: string) => bySeries.get(sid)?.find((d) => !d.given)?.dueDate ?? "9999";
    return [...series].sort((a, b) => nextDue(a.id).localeCompare(nextDue(b.id)));
  }, [series, bySeries]);

  if (e1 || e2) return <ErrorState error={(e1 ?? e2)!} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><Link to={`/children/${child.id}/series/new`}><Plus size={14} /> เพิ่มชุดวัคซีน</Link></Button>
        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><CheckSquare size={14} /> ติ๊กเข็มที่ฉีดแล้ว</Button>
        {!seriesLoading && !hasEpi && (
          <Button size="sm" variant="outline"
            onClick={() => confirm("สร้างตารางวัคซีนพื้นฐาน (EPI) จากวันเกิดของเด็ก?") && createEpiSeries(fid, child.id, child.birthDate)}>
            <CalendarPlus size={14} /> สร้างตาราง EPI
          </Button>
        )}
      </div>

      {ordered.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลวัคซีน</p>}

      {ordered.map((s) => {
        const list = bySeries.get(s.id) ?? [];
        return (
          <div key={s.id} className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-semibold">{s.name}</p>
              <Button variant="ghost" size="icon" aria-label={`ลบชุด ${s.name}`}
                onClick={() => confirm(`ลบชุด "${s.name}" และทุกเข็ม?`) && deleteSeries(fid, child.id, s.id, list.map((d) => d.id))}>
                <Trash2 size={14} />
              </Button>
            </div>
            <ul className="divide-y">
              {list.map((d) => {
                const st = doseStatus(d, today);
                return (
                  <li key={d.id} className="space-y-1 px-3 py-2 text-sm">
                    <button className="flex w-full items-center justify-between text-left" aria-label={`${s.name} เข็ม ${d.doseNo}`} onClick={() => setActive(d)}>
                      <span>เข็ม {d.doseNo}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {d.given
                            ? d.givenDateUnknown || !d.givenDate ? "ไม่ทราบวันที่" : formatThaiDate(d.givenDate)
                            : d.dueDate ? formatThaiDate(d.dueDate) : "—"}
                        </span>
                        <StatusBadge status={st} />
                      </span>
                    </button>
                    {!d.given && d.dueDate && (st === "dueSoon" || st === "scheduled" || st === "overdue") && (
                      <CalendarButtons event={{ uid: `dose-${d.id}`, title: `${who}: ${d.vaccineName} เข็ม ${d.doseNo}`, date: d.dueDate, location: d.place }} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <RecordDoseDialog fid={fid} child={child} dose={active} doses={active ? bySeries.get(active.seriesId) ?? [] : []}
        open={active !== null} onOpenChange={(o) => !o && setActive(null)} />
      <BulkGivenDialog fid={fid} child={child} doses={doses} open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}

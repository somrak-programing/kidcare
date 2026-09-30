import { Link, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import AllergyBanner from "@/components/AllergyBanner";
import ErrorState from "@/components/ErrorState";
import VaccineTimeline from "@/components/VaccineTimeline";
import CalendarButtons from "@/components/CalendarButtons";
import { useChild, useOpenAppointments } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { ageText, formatThaiDate, todayISO } from "@/domain/dates";
import { calendarName } from "@/domain/names";

export default function ChildDetail() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child, loading, error } = useChild(fid, cid);

  if (error) return <ErrorState error={error} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!child) return <p>ไม่พบข้อมูล</p>;

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

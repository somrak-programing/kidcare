import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChildCard from "@/components/ChildCard";
import ErrorState from "@/components/ErrorState";
import UpcomingList from "@/components/UpcomingList";
import { useChildren, useOpenAppointments, usePendingDoses } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { todayISO } from "@/domain/dates";
import type { UpcomingItem } from "@/domain/upcoming";

export default function Home() {
  const fid = useFamilyId();
  const { data: children, loading: childrenLoading, error } = useChildren(fid);
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const { data: pending, error: e2, loading: pendingLoading } = usePendingDoses(fid, childIds);
  const { data: appts, error: e3, loading: apptsLoading } = useOpenAppointments(fid);
  const today = todayISO();

  const items: UpcomingItem[] = useMemo(
    () => [
      ...pending
        .filter((d) => d.dueDate)
        .map((d) => ({ kind: "dose" as const, id: d.id, childId: d.childId, date: d.dueDate!, title: `${d.vaccineName} เข็ม ${d.doseNo}`, place: d.place })),
      ...appts.map((a) => ({ kind: "appointment" as const, id: a.id, childId: a.childId, date: a.date, time: a.time, title: a.purpose, place: a.place })),
    ],
    [pending, appts],
  );

  const dataLoading = pendingLoading || apptsLoading;
  const err = error ?? e2 ?? e3;
  if (err) return <ErrorState error={err} />;
  if (childrenLoading) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  if (!children.length)
    return (
      <div className="space-y-3 py-10 text-center">
        <p>เริ่มจากเพิ่มข้อมูลลูก</p>
        <Button asChild><Link to="/children/new"><UserPlus size={16} /> เพิ่มลูก</Link></Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">นัดที่รออยู่</h2>
          <Button asChild size="sm" variant="outline"><Link to="/appointments/new"><CalendarPlus size={14} /> นัดหมอ</Link></Button>
        </div>
        {dataLoading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : <UpcomingList fid={fid} items={items} kids={children} />}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ลูก</h2>
          <Button asChild size="sm" variant="ghost"><Link to="/children/new"><UserPlus size={14} /> เพิ่ม</Link></Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {children.map((c) => (
            <ChildCard key={c.id} fid={fid} child={c}
              overdueCount={dataLoading ? 0 : pending.filter((d) => d.childId === c.id && d.dueDate && d.dueDate < today).length} />
          ))}
        </div>
      </section>
    </div>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import UpcomingList from "@/components/UpcomingList";
import { StatTiles } from "@/components/dashboard/StatTiles";
import { ChildSummaryCard } from "@/components/dashboard/ChildSummaryCard";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { AgeTimeline } from "@/components/dashboard/AgeTimeline";
import { useChildren, useOpenAppointments, useFamilyDoses } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { todayISO } from "@/domain/dates";
import { ageTimeline, childColor, monthlyUpcoming, pickHomeUpcoming, summarize, toUpcomingItems } from "@/domain/dashboard";
import { byDateTime } from "@/domain/upcoming";

const PREVIEW_COUNT = 5;

export default function Home() {
  const fid = useFamilyId();
  const { data: children, loading: childrenLoading, error } = useChildren(fid);
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const { data: doses, error: e2, loading: dosesLoading } = useFamilyDoses(fid, childIds);
  const { data: appts, error: e3, loading: apptsLoading } = useOpenAppointments(fid);
  const today = todayISO();

  const items = useMemo(() => toUpcomingItems(doses, appts).sort(byDateTime), [doses, appts]);
  const summary = useMemo(() => summarize(doses, appts, today), [doses, appts, today]);
  const kidsById = useMemo(() => Object.fromEntries(children.map((c) => [c.id, c.nickname || c.name])), [children]);
  const kids = useMemo(() => children.map((c, i) => ({ id: c.id, name: c.nickname || c.name, color: childColor(i) })), [children]);
  const buckets = useMemo(() => monthlyUpcoming(items, today), [items, today]);
  const rows = useMemo(
    () =>
      children.map((c) => ({
        id: c.id,
        name: c.nickname || c.name,
        data: ageTimeline(c.birthDate, doses.filter((d) => d.childId === c.id), today),
        hasDoses: doses.some((d) => d.childId === c.id),
      })),
    [children, doses, today],
  );

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

  if (dosesLoading || apptsLoading) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  return (
    <div className="space-y-6">
      {/* Top Stat KPI Tiles */}
      <StatTiles summary={summary} kidsById={kidsById} />

      {/* Main Grid: Left 8 cols, Right 4 cols on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Children cards + Monthly chart + Age timeline) */}
        <div className="lg:col-span-8 space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">ลูก ({children.length})</h2>
              <Button asChild size="sm" variant="ghost">
                <Link to="/children/new">
                  <UserPlus size={14} className="mr-1" /> เพิ่มข้อมูลลูก
                </Link>
              </Button>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {children.map((c) => (
                <ChildSummaryCard
                  key={c.id}
                  fid={fid}
                  child={c}
                  today={today}
                  doses={doses.filter((d) => d.childId === c.id)}
                />
              ))}
            </div>
          </section>

          <MonthlyChart buckets={buckets} kids={kids} />
          <AgeTimeline rows={rows} />
        </div>

        {/* Right Column (Upcoming list & Quick Actions) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upcoming Section */}
          <section className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-semibold text-sm">นัดที่รออยู่</h2>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link to="/appointments/new">
                  <CalendarPlus size={13} className="mr-1" /> นัดหมอ
                </Link>
              </Button>
            </div>
            <UpcomingList fid={fid} items={pickHomeUpcoming(items, today, PREVIEW_COUNT)} kids={children} />
            {items.length > PREVIEW_COUNT && (
              <Button asChild size="sm" variant="link" className="w-full text-xs text-muted-foreground pt-1">
                <Link to="/appointments">ดูนัดหมายทั้งหมด ({items.length} รายการ)</Link>
              </Button>
            )}
          </section>

          {/* Quick Actions Card */}
          <section className="rounded-xl border bg-card/60 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ทางลัดด่วน</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button asChild variant="outline" size="sm" className="h-9 justify-start">
                <Link to="/children/new">
                  <UserPlus size={14} className="mr-1.5 text-primary" /> เพิ่มลูก
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 justify-start">
                <Link to="/appointments/new">
                  <CalendarPlus size={14} className="mr-1.5 text-accent" /> นัดหมอ
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

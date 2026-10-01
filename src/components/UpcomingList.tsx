import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarButtons from "@/components/CalendarButtons";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { calendarName } from "@/domain/names";
import { groupUpcoming, type UpcomingItem } from "@/domain/upcoming";
import { setAppointmentDone } from "@/lib/repo/appointments";
import type { Child } from "@/types";

export default function UpcomingList({
  fid,
  items,
  kids,
  showAll = false,
  columns = 1,
}: {
  fid: string;
  items: UpcomingItem[];
  kids: Child[];
  showAll?: boolean;
  columns?: 1 | 2;
}) {
  const g = groupUpcoming(items, todayISO());
  const who = (cid: string) => {
    const c = kids.find((x) => x.id === cid);
    return c ? c.nickname || c.name || "ไม่ระบุ" : "ไม่ระบุ";
  };
  const calWho = (cid: string) => {
    const c = kids.find((x) => x.id === cid);
    return (c && calendarName(c)) || "ไม่ระบุ";
  };
  const sections: [string, UpcomingItem[], string][] = [
    ["เลยกำหนด", g.overdue, "border-red-500/60"],
    ["7 วันข้างหน้า", g.soon, "border-amber-500/60"],
    ["ถัดไป", showAll ? g.later : g.later.slice(0, 5), "border-border"],
  ];
  if (!items.length) return <p className="text-sm text-muted-foreground">ไม่มีนัดที่รออยู่</p>;
  return (
    <div className="space-y-4">
      {sections.map(([label, list, border]) =>
        list.length ? (
          <div key={label} className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label} ({list.length})</h3>
            <div className={columns === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2.5"}>
              {list.map((it) => (
                <div key={`${it.kind}-${it.id}`} className={`space-y-2 rounded-xl border-l-4 ${border} border-t border-r border-b bg-card p-3.5 shadow-xs transition-colors hover:border-primary/40`}>
                  <Link to={it.kind === "dose" ? `/children/${it.childId}` : `/appointments/${it.id}/edit`} className="block text-sm">
                    <p className="font-semibold text-foreground">{who(it.childId)} · {it.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatThaiDate(it.date)}{it.time ? ` ${it.time} น.` : ""}{it.place ? ` · ${it.place}` : ""}</p>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <CalendarButtons event={{ uid: `${it.kind === "dose" ? "dose" : "appt"}-${it.id}`, title: `${calWho(it.childId)}: ${it.title}`, date: it.date, time: it.time, location: it.place }} />
                    {it.kind === "appointment" && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" aria-label={`ไปแล้ว: ${it.title}`} onClick={() => setAppointmentDone(fid, it.id, true)}>
                        <Check size={14} className="mr-1" /> ไปแล้ว
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

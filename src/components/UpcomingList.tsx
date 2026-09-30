import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarButtons from "@/components/CalendarButtons";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { groupUpcoming, type UpcomingItem } from "@/domain/upcoming";
import { setAppointmentDone } from "@/lib/repo/appointments";
import type { Child } from "@/types";

export default function UpcomingList({ fid, items, kids }: { fid: string; items: UpcomingItem[]; kids: Child[] }) {
  const g = groupUpcoming(items, todayISO());
  const who = (cid: string) => {
    const c = kids.find((x) => x.id === cid);
    return c ? c.nickname || c.name : "";
  };
  const sections: [string, UpcomingItem[], string][] = [
    ["เลยกำหนด", g.overdue, "border-red-500/60"],
    ["7 วันข้างหน้า", g.soon, "border-amber-500/60"],
    ["ถัดไป", g.later.slice(0, 5), "border-border"],
  ];
  if (!items.length) return <p className="text-sm text-muted-foreground">ไม่มีนัดที่รออยู่</p>;
  return (
    <div className="space-y-4">
      {sections.map(([label, list, border]) =>
        list.length ? (
          <div key={label} className="space-y-2">
            <h3 className="text-sm font-semibold">{label}</h3>
            {list.map((it) => (
              <div key={`${it.kind}-${it.id}`} className={`space-y-2 rounded-lg border-l-4 ${border} bg-card p-3`}>
                <Link to={it.kind === "dose" ? `/children/${it.childId}` : `/appointments/${it.id}/edit`} className="block text-sm">
                  <p className="font-semibold">{who(it.childId)} · {it.title}</p>
                  <p className="text-muted-foreground">{formatThaiDate(it.date)}{it.time ? ` ${it.time} น.` : ""}{it.place ? ` · ${it.place}` : ""}</p>
                </Link>
                <div className="flex flex-wrap gap-1">
                  <CalendarButtons event={{ uid: `${it.kind === "dose" ? "dose" : "appt"}-${it.id}`, title: `${who(it.childId)}: ${it.title}`, date: it.date, time: it.time, location: it.place }} />
                  {it.kind === "appointment" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAppointmentDone(fid, it.id, true)}><Check size={14} /> ไปแล้ว</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

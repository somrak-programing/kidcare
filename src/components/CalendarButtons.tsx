import { CalendarPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/domain/ics";
import { downloadText } from "@/lib/download";

export default function CalendarButtons({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex gap-1">
      <Button asChild variant="outline" size="sm">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer"><CalendarPlus size={14} /> Google</a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadText(`${event.uid}.ics`, buildIcs(event), "text/calendar")}>
        <Download size={14} /> .ics
      </Button>
    </div>
  );
}

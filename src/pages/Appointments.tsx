import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import UpcomingList from "@/components/UpcomingList";
import { useChildren, useFamilyDoses, useOpenAppointments } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { toUpcomingItems } from "@/domain/dashboard";

export default function Appointments() {
  const fid = useFamilyId();
  const { data: children, loading: childrenLoading, error: e1 } = useChildren(fid);
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const { data: doses, loading: dosesLoading, error: e2 } = useFamilyDoses(fid, childIds);
  const { data: appts, loading: apptsLoading, error: e3 } = useOpenAppointments(fid);
  const items = useMemo(() => toUpcomingItems(doses, appts), [doses, appts]);

  const err = e1 ?? e2 ?? e3;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">นัดหมายทั้งหมด</h1>
        <Button asChild size="sm" variant="outline"><Link to="/appointments/new"><CalendarPlus size={14} /> นัดหมอ</Link></Button>
      </div>
      {err ? (
        <ErrorState error={err} />
      ) : childrenLoading || dosesLoading || apptsLoading ? (
        <p className="text-muted-foreground">กำลังโหลด…</p>
      ) : (
        <UpcomingList fid={fid} items={items} kids={children} showAll />
      )}
    </div>
  );
}

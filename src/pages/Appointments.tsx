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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ตารางนัดหมายทั้งหมด</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            รวมนัดฉีดวัคซีนและนัดพบแพทย์ของทุกคนในครอบครัว
          </p>
        </div>
        <Button asChild size="sm" className="self-start sm:self-center">
          <Link to="/appointments/new">
            <CalendarPlus size={15} className="mr-1.5" /> บันทึกนัดหมอ
          </Link>
        </Button>
      </div>

      {err ? (
        <ErrorState error={err} />
      ) : childrenLoading || dosesLoading || apptsLoading ? (
        <p className="text-muted-foreground">กำลังโหลด…</p>
      ) : (
        <UpcomingList fid={fid} items={items} kids={children} showAll columns={2} />
      )}
    </div>
  );
}

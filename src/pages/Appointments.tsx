import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import UpcomingList from "@/components/UpcomingList";
import AppointmentFilterBar from "@/components/AppointmentFilterBar";
import { useChildren, useFamilyDoses, useOpenAppointments } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { toUpcomingItems } from "@/domain/dashboard";
import {
  type AppointmentFilters,
  filterAppointments,
  INITIAL_APPOINTMENT_FILTERS,
} from "@/domain/appointmentFilters";
import { todayISO } from "@/domain/dates";

export default function Appointments() {
  const fid = useFamilyId();
  const today = todayISO();
  const { data: children, loading: childrenLoading, error: e1 } = useChildren(fid);
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const { data: doses, loading: dosesLoading, error: e2 } = useFamilyDoses(fid, childIds);
  const { data: appts, loading: apptsLoading, error: e3 } = useOpenAppointments(fid);
  const items = useMemo(() => toUpcomingItems(doses, appts), [doses, appts]);

  const [filters, setFilters] = useState<AppointmentFilters>(INITIAL_APPOINTMENT_FILTERS);

  const filteredItems = useMemo(
    () => filterAppointments(items, filters, today),
    [items, filters, today],
  );

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
        <div className="space-y-6">
          <AppointmentFilterBar
            items={items}
            kids={children}
            filters={filters}
            onFilterChange={setFilters}
            onReset={() => setFilters(INITIAL_APPOINTMENT_FILTERS)}
            filteredCount={filteredItems.length}
            totalCount={items.length}
          />

          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Search size={20} />
              </div>
              <p className="text-sm font-medium text-foreground">ไม่พบนัดหมายที่ตรงกับเงื่อนไขตัวกรอง</p>
              <p className="text-xs text-muted-foreground">ลองเปลี่ยนสมาชิก, เดือน, หรือกลุ่มโรคภัยดูนะครับ</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(INITIAL_APPOINTMENT_FILTERS)}
                className="text-xs h-8"
              >
                <RotateCcw size={13} className="mr-1.5" /> ล้างตัวกรองทั้งหมด
              </Button>
            </div>
          ) : (
            <UpcomingList fid={fid} items={filteredItems} kids={children} showAll columns={2} />
          )}
        </div>
      )}
    </div>
  );
}

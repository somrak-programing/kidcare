import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Thermometer, ChevronRight, Activity, CheckCircle2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import QuickTempDialog from "@/components/QuickTempDialog";
import { formatThaiDate } from "@/domain/dates";
import { useChild, useIllnesses, useTemperatureLogs } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import type { Illness } from "@/types";

export default function Illnesses() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child, loading: childLoading, error: e1 } = useChild(fid, cid);
  const { data: illnesses, loading: illLoading, error: e2 } = useIllnesses(fid, cid);
  const { data: tempLogs } = useTemperatureLogs(fid, cid);

  const [tempDialogOpen, setTempDialogOpen] = useState(false);

  if (e1 || e2) return <ErrorState error={(e1 ?? e2)!} />;
  if (childLoading || illLoading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!child) return <p>ไม่พบข้อมูลเด็ก</p>;

  const active = illnesses.filter((i) => i.status === "active");
  const recovered = illnesses.filter((i) => i.status === "recovered");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ประวัติการเจ็บป่วย</h1>
          <p className="text-sm text-muted-foreground">
            {child.nickname || child.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5"
            onClick={() => setTempDialogOpen(true)}
          >
            <Thermometer size={15} /> บันทึกไข้
          </Button>
          <Button asChild size="sm">
            <Link to={`/children/${cid}/illnesses/new`}>
              <Plus size={15} /> บันทึกการป่วย
            </Link>
          </Button>
        </div>
      </div>

      {/* กำลังป่วยอยู่ (Active) */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 text-rose-500">
          <Activity size={16} /> กำลังป่วยอยู่ ({active.length})
        </h2>

        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            สุขภาพแข็งแรงดี ไม่มีอาการป่วยที่กำลังดำเนินอยู่ ✨
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {active.map((ill) => (
              <IllnessCard key={ill.id} cid={cid} illness={ill} />
            ))}
          </div>
        )}
      </section>

      {/* ประวัติที่หายแล้ว (Recovered) */}
      {recovered.length > 0 && (
        <section className="space-y-2.5 pt-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 size={16} /> ประวัติที่หายดีแล้ว ({recovered.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recovered.map((ill) => (
              <IllnessCard key={ill.id} cid={cid} illness={ill} />
            ))}
          </div>
        </section>
      )}

      {/* Quick Temp Dialog */}
      <QuickTempDialog
        fid={fid}
        child={child}
        recentLogs={tempLogs}
        open={tempDialogOpen}
        onOpenChange={setTempDialogOpen}
      />
    </div>
  );
}

function IllnessCard({ cid, illness }: { cid: string; illness: Illness }) {
  const isActive = illness.status === "active";

  return (
    <Link
      to={`/children/${cid}/illnesses/${illness.id}`}
      className={`block rounded-lg border p-3.5 transition-all hover:border-primary/50 ${
        isActive
          ? "border-rose-500/30 bg-rose-500/[0.03]"
          : "bg-card hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{illness.name}</h3>
            {isActive ? (
              <span className="rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-xs font-semibold">
                กำลังป่วย
              </span>
            ) : (
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                หายแล้ว
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={13} />
            <span>เริ่ม {formatThaiDate(illness.startDate)}</span>
            {illness.endDate && <span>— หาย {formatThaiDate(illness.endDate)}</span>}
          </div>

          {illness.symptoms && illness.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {illness.symptoms.map((s) => (
                <span
                  key={s}
                  className="rounded bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <ChevronRight size={18} className="text-muted-foreground shrink-0 mt-1" />
      </div>
    </Link>
  );
}

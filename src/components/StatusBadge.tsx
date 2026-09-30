import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/domain/doseStatus";
import type { DoseStatus } from "@/types";

const CLS: Record<DoseStatus, string> = {
  given: "bg-emerald-500/20 text-emerald-300",
  overdue: "bg-red-500/20 text-red-300",
  dueSoon: "bg-amber-500/20 text-amber-300",
  scheduled: "bg-sky-500/20 text-sky-300",
  unscheduled: "bg-muted text-muted-foreground",
};

export default function StatusBadge({ status }: { status: DoseStatus }) {
  return <span className={cn("rounded px-2 py-0.5 text-xs", CLS[status])}>{STATUS_LABEL[status]}</span>;
}

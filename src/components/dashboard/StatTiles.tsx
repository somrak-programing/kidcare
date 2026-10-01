import { AlertTriangle } from "lucide-react";
import { formatThaiDate } from "@/domain/dates";
import type { DashboardSummary } from "@/domain/dashboard";

function daysAwayText(d: number): string {
  if (d === 0) return "วันนี้";
  if (d === 1) return "พรุ่งนี้";
  return `อีก ${d} วัน`;
}

const tile = "min-w-0 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30";
const label = "text-xs font-medium text-muted-foreground";

export function StatTiles({ summary, kidsById }: { summary: DashboardSummary; kidsById: Record<string, string> }) {
  const { overdueCount, next, coveragePct, next30Count } = summary;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className={tile}>
        <p className={label}>เลยกำหนด</p>
        <p className={`flex items-center gap-1.5 text-2xl font-bold mt-1 ${overdueCount > 0 ? "text-rose-400" : ""}`}>
          {overdueCount > 0 && <AlertTriangle size={18} aria-hidden="true" />} {overdueCount} เข็ม
        </p>
      </div>
      <div className={tile}>
        <p className={label}>นัดถัดไป</p>
        <p className="text-2xl font-bold mt-1">{next ? daysAwayText(next.daysAway) : "—"}</p>
        {next && (
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {formatThaiDate(next.date)} · {kidsById[next.childId] ?? "ไม่ระบุ"}
          </p>
        )}
      </div>
      <div className={tile}>
        <p className={label}>ฉีดครบตามวัย</p>
        <p className="text-2xl font-bold mt-1 text-emerald-400">{coveragePct === null ? "—" : `${coveragePct}%`}</p>
      </div>
      <div className={tile}>
        <p className={label}>นัด 30 วันข้างหน้า</p>
        <p className="text-2xl font-bold mt-1">{next30Count} นัด</p>
      </div>
    </div>
  );
}

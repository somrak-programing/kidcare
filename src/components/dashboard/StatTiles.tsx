import { AlertTriangle } from "lucide-react";
import { formatThaiDate } from "@/domain/dates";
import type { DashboardSummary } from "@/domain/dashboard";

function daysAwayText(d: number): string {
  if (d === 0) return "วันนี้";
  if (d === 1) return "พรุ่งนี้";
  return `อีก ${d} วัน`;
}

const tile = "min-w-0 rounded-lg bg-muted p-3";
const label = "text-xs text-muted-foreground";

export function StatTiles({ summary, kidsById }: { summary: DashboardSummary; kidsById: Record<string, string> }) {
  const { overdueCount, next, coveragePct, next30Count } = summary;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={tile}>
        <p className={label}>เลยกำหนด</p>
        <p className={`flex items-center gap-1 text-2xl font-bold ${overdueCount > 0 ? "text-red-300" : ""}`}>
          {overdueCount > 0 && <AlertTriangle size={18} aria-hidden="true" />} {overdueCount} เข็ม
        </p>
      </div>
      <div className={tile}>
        <p className={label}>นัดถัดไป</p>
        <p className="text-2xl font-bold">{next ? daysAwayText(next.daysAway) : "—"}</p>
        {next && (
          <p className="truncate text-xs text-muted-foreground">
            {formatThaiDate(next.date)} · {kidsById[next.childId] ?? "ไม่ระบุ"} · {next.title}
          </p>
        )}
      </div>
      <div className={tile}>
        <p className={label}>ฉีดครบตามวัย</p>
        <p className="text-2xl font-bold">{coveragePct === null ? "—" : `${coveragePct}%`}</p>
      </div>
      <div className={tile}>
        <p className={label}>นัด 30 วันข้างหน้า</p>
        <p className="text-2xl font-bold">{next30Count} นัด</p>
      </div>
    </div>
  );
}

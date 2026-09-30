import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useAllergies } from "@/hooks/data";
import { ageText, formatThaiDate } from "@/domain/dates";
import { childProgress } from "@/domain/dashboard";
import type { Child, ISODate, VaccineDose } from "@/types";

const GIVEN = "#0ca30c";
const OVERDUE = "#d03b3b";
const UPCOMING = "#6b7280";
const HATCH = "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 2px, transparent 2px 5px)";

function AllergyBadge({ fid, childId }: { fid: string; childId: string }) {
  const { data, loading, error } = useAllergies(fid, childId);
  if (error) return <span className="shrink-0 text-xs text-amber-300">โหลดข้อมูลแพ้ไม่ได้</span>;
  if (loading) return null;
  if (data.length > 0)
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-red-300">
        <AlertTriangle size={14} aria-hidden="true" /> แพ้ {data.length}
      </span>
    );
  return <span className="shrink-0 text-xs text-muted-foreground">ไม่มีประวัติแพ้</span>;
}

export function ChildSummaryCard({ fid, child, doses, today }: { fid: string; child: Child; doses: VaccineDose[]; today: ISODate }) {
  const p = childProgress(doses, today);
  const segs = [
    { n: p.given, bg: GIVEN, hatch: false },
    { n: p.overdue, bg: OVERDUE, hatch: true },
    { n: p.upcoming, bg: UPCOMING, hatch: false },
  ].filter((s) => s.n > 0);
  const name = child.nickname || child.name;
  return (
    <Link to={`/children/${child.id}`} className="block rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{name}</p>
          <p className="text-sm text-muted-foreground">{ageText(child.birthDate, today)}</p>
        </div>
        <AllergyBadge fid={fid} childId={child.id} />
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs text-muted-foreground">วัคซีน</p>
        {segs.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลวัคซีน</p>
        ) : (
          <>
            <div className="flex h-[10px] gap-[2px]" aria-hidden="true">
              {segs.map((s, i) => (
                <div
                  key={s.bg}
                  style={{ flexGrow: s.n, flexBasis: 0, backgroundColor: s.bg, backgroundImage: s.hatch ? HATCH : undefined }}
                  className={`${i === 0 ? "rounded-l-[4px]" : ""} ${i === segs.length - 1 ? "rounded-r-[4px]" : ""}`}
                />
              ))}
            </div>
            <p className="text-xs">ฉีดแล้ว {p.given} · เลยกำหนด {p.overdue} · รอถึงวัย {p.upcoming}</p>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        {p.next ? (
          <p className="min-w-0">
            ถัดไป: {p.next.vaccineName} เข็ม {p.next.doseNo} · {formatThaiDate(p.next.dueDate!)}
          </p>
        ) : p.overdue > 0 ? (
          <p className="text-red-300">มีเข็มเลยกำหนด {p.overdue} เข็ม</p>
        ) : (
          <span />
        )}
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}

import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAllergies } from "@/hooks/data";
import { ageText, todayISO } from "@/domain/dates";
import type { Child } from "@/types";

export default function ChildCard({ fid, child, overdueCount }: { fid: string; child: Child; overdueCount: number }) {
  const { data: allergies } = useAllergies(fid, child.id);
  return (
    <Link to={`/children/${child.id}`} className="block rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{child.nickname || child.name}</p>
        {allergies.length > 0 && <span className="flex items-center gap-1 text-xs text-red-300"><AlertTriangle size={14} /> แพ้ {allergies.length}</span>}
      </div>
      <p className="text-sm text-muted-foreground">{ageText(child.birthDate, todayISO())}</p>
      {overdueCount > 0 && <p className="text-xs text-red-300">วัคซีนเลยกำหนด {overdueCount} เข็ม</p>}
    </Link>
  );
}

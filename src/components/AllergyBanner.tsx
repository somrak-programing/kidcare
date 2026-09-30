import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAllergies } from "@/hooks/data";
import type { Severity } from "@/types";

const SEV: Record<Severity, string> = { mild: "เล็กน้อย", moderate: "ปานกลาง", severe: "รุนแรง" };

export default function AllergyBanner({ fid, cid }: { fid: string; cid: string }) {
  const { data, loading } = useAllergies(fid, cid);
  if (loading) return null;
  if (!data.length)
    return (
      <Link to={`/children/${cid}/allergies`} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck size={16} /> ไม่มีประวัติแพ้ยา/อาหาร (แตะเพื่อเพิ่ม)
      </Link>
    );
  return (
    <Link to={`/children/${cid}/allergies`} className="block rounded-lg border-2 border-red-500 bg-red-500/15 px-3 py-2">
      <p className="flex items-center gap-2 font-bold text-red-300"><AlertTriangle size={18} /> แพ้</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {data.map((a) => (
          <li key={a.id}>
            <b>{a.substance}</b> — {a.reaction} ({SEV[a.severity]})
          </li>
        ))}
      </ul>
    </Link>
  );
}

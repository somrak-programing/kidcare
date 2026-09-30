import { Link, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import AllergyBanner from "@/components/AllergyBanner";
import ErrorState from "@/components/ErrorState";
import { useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { ageText, formatThaiDate, todayISO } from "@/domain/dates";

export default function ChildDetail() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child, loading, error } = useChild(fid, cid);

  if (error) return <ErrorState error={error} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!child) return <p>ไม่พบข้อมูล</p>;

  return (
    <div className="space-y-4">
      <AllergyBanner fid={fid} cid={cid} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{child.nickname ? `${child.nickname} (${child.name})` : child.name}</h1>
          <p className="text-sm text-muted-foreground">
            {ageText(child.birthDate, todayISO())} · เกิด {formatThaiDate(child.birthDate)}
            {child.bloodType ? ` · กรุ๊ป ${child.bloodType}` : ""}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="แก้ไข"><Link to={`/children/${cid}/edit`}><Pencil size={16} /></Link></Button>
      </div>

      {(child.hospitals?.length ?? 0) > 0 && (
        <ul className="rounded-lg border p-3 text-sm">
          {child.hospitals.map((h, i) => (
            <li key={i} className="flex justify-between"><span>{h.name}</span><span className="font-mono">HN {h.hn}</span></li>
          ))}
        </ul>
      )}

      <section id="vaccines" className="space-y-2">
        <h2 className="font-semibold">วัคซีน</h2>
        {/* Task 11: <VaccineTimeline fid={fid} child={child} /> */}
      </section>

      <section id="appointments" className="space-y-2">
        <h2 className="font-semibold">นัดหมาย</h2>
        {/* Task 12: child appointments */}
      </section>
    </div>
  );
}

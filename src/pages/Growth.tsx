import { Link, useParams } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import GrowthChart from "@/components/GrowthChart";
import { formatThaiDate } from "@/domain/dates";
import { evaluateHeightForAge, evaluateWeightForAge } from "@/domain/growth";
import { useChild, useGrowth } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { deleteGrowthRecord } from "@/lib/repo/growth";

export default function Growth() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();

  const { data: child, error: e1 } = useChild(fid, cid);
  const { data: records, loading, error: e2 } = useGrowth(fid, cid);

  if (e1 || e2) return <ErrorState error={(e1 ?? e2)!} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!child) return <p>ไม่พบข้อมูลเด็ก</p>;

  // รายการล่าสุดที่มีน้ำหนักและส่วนสูง
  const latestWeight = records.find((r) => r.weightKg != null);
  const latestHeight = records.find((r) => r.heightCm != null);

  const weightEval = latestWeight
    ? evaluateWeightForAge(latestWeight.weightKg!, latestWeight.ageMonths, child.sex)
    : null;

  const heightEval = latestHeight
    ? evaluateHeightForAge(latestHeight.heightCm!, latestHeight.ageMonths, child.sex)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          to={`/children/${cid}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> กลับหน้าข้อมูลเด็ก
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="text-primary" size={22} /> การเจริญเติบโต
            </h1>
            <p className="text-sm text-muted-foreground">
              {child.nickname || child.name} ({child.sex === "F" ? "เด็กหญิง" : "เด็กชาย"})
            </p>
          </div>

          <Button asChild size="sm">
            <Link to={`/children/${cid}/growth/new`}>
              <Plus size={15} /> บันทึกการเติบโต
            </Link>
          </Button>
        </div>
      </div>

      {/* สรุปล่าสุด (น้ำหนัก & ส่วนสูง) */}
      <div className="grid grid-cols-2 gap-3">
        {/* น้ำหนัก */}
        <div className="rounded-xl border p-4 bg-card space-y-1.5">
          <span className="text-xs text-muted-foreground">น้ำหนักล่าสุด</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{latestWeight?.weightKg ?? "—"}</span>
            <span className="text-xs text-muted-foreground">กก.</span>
          </div>
          {weightEval && (
            <div>
              <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${weightEval.badgeClass}`}>
                {weightEval.label}
              </span>
              <p className="text-[10px] text-muted-foreground pt-1">
                วัดเมื่อ {formatThaiDate(latestWeight!.date)}
              </p>
            </div>
          )}
        </div>

        {/* ส่วนสูง */}
        <div className="rounded-xl border p-4 bg-card space-y-1.5">
          <span className="text-xs text-muted-foreground">ส่วนสูงล่าสุด</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{latestHeight?.heightCm ?? "—"}</span>
            <span className="text-xs text-muted-foreground">ซม.</span>
          </div>
          {heightEval && (
            <div>
              <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${heightEval.badgeClass}`}>
                {heightEval.label}
              </span>
              <p className="text-[10px] text-muted-foreground pt-1">
                วัดเมื่อ {formatThaiDate(latestHeight!.date)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* กราฟการเจริญเติบโต */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">กราฟเปรียบเทียบเกณฑ์มาตรฐาน (0-5 ปี)</h2>
        <GrowthChart records={records} sex={child.sex} />
      </section>

      {/* ตารางประวัติ */}
      <section className="space-y-2 pt-2">
        <h2 className="text-sm font-semibold">ประวัติการบันทึก ({records.length})</h2>

        {records.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีบันทึกการเจริญเติบโต กด "บันทึกการเติบโต" เพื่อเริ่มต้น
          </div>
        ) : (
          <div className="divide-y rounded-lg border bg-card text-sm">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatThaiDate(r.date)}</span>
                    <span className="text-xs text-muted-foreground">
                      (อายุ {Math.floor(r.ageMonths / 12)} ปี {r.ageMonths % 12} ด.)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {r.weightKg && <span>น้ำหนัก: <strong>{r.weightKg} กก.</strong></span>}
                    {r.heightCm && <span>ส่วนสูง: <strong>{r.heightCm} ซม.</strong></span>}
                    {r.headCircumferenceCm && <span>รอบหัว: <strong>{r.headCircumferenceCm} ซม.</strong></span>}
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground">หมายเหตุ: {r.notes}</p>}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => confirm("ลบบันทึกนี้?") && deleteGrowthRecord(fid, cid, r.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

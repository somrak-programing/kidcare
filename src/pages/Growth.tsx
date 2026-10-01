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

      {/* สรุปล่าสุด (น้ำหนัก & ส่วนสูง & รอบหัว) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        {/* น้ำหนัก */}
        <div className="rounded-xl border p-4 bg-card space-y-1.5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">น้ำหนักล่าสุด</span>
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
        <div className="rounded-xl border p-4 bg-card space-y-1.5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">ส่วนสูงล่าสุด</span>
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

        {/* รอบศีรษะ */}
        <div className="col-span-2 sm:col-span-1 rounded-xl border p-4 bg-card space-y-1.5 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">เส้นรอบศีรษะล่าสุด</span>
          {records.find((r) => r.headCircumferenceCm != null) ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {records.find((r) => r.headCircumferenceCm != null)?.headCircumferenceCm}
                </span>
                <span className="text-xs text-muted-foreground">ซม.</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                วัดเมื่อ {formatThaiDate(records.find((r) => r.headCircumferenceCm != null)!.date)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pt-1">—</p>
          )}
        </div>
      </div>

      {/* Main Responsive Grid: Chart (Left 7 cols) & History (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* กราฟการเจริญเติบโต */}
        <section className="lg:col-span-7 rounded-xl border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
          <h2 className="text-base font-bold">กราฟเปรียบเทียบเกณฑ์มาตรฐาน (0-5 ปี)</h2>
          <GrowthChart records={records} sex={child.sex} />
        </section>

        {/* ตารางประวัติ */}
        <section className="lg:col-span-5 rounded-xl border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-base font-bold">ประวัติการบันทึก ({records.length})</h2>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link to={`/children/${cid}/growth/new`}>+ เพิ่มบันทึก</Link>
            </Button>
          </div>

          {records.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              ยังไม่มีบันทึกการเจริญเติบโต กด "บันทึกการเติบโต" เพื่อเริ่มต้น
            </div>
          ) : (
            <div className="divide-y rounded-lg border bg-background/50 text-sm max-h-[500px] overflow-y-auto">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs">{formatThaiDate(r.date)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        ({Math.floor(r.ageMonths / 12)} ปี {r.ageMonths % 12} ด.)
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                      {r.weightKg && <span>น.น.: <strong className="text-foreground">{r.weightKg}</strong> กก.</span>}
                      {r.heightCm && <span>ส.ส.: <strong className="text-foreground">{r.heightCm}</strong> ซม.</span>}
                      {r.headCircumferenceCm && <span>รอบหัว: <strong className="text-foreground">{r.headCircumferenceCm}</strong> ซม.</span>}
                    </div>
                    {r.notes && <p className="text-[11px] text-muted-foreground">หมายเหตุ: {r.notes}</p>}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
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
    </div>
  );
}

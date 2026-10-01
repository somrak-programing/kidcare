import { useParams, Link } from "react-router-dom";
import { Printer, ArrowLeft, AlertTriangle, ShieldCheck, Calendar, Activity, Pill, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import { ageText, formatThaiDate, todayISO } from "@/domain/dates";
import { useAllergies, useChild, useDoses, useGrowth, useIllnesses, useMedications } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";

export default function MedicalReport() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const today = todayISO();

  const { data: child, error: e1 } = useChild(fid, cid);
  const { data: allergies, error: e2 } = useAllergies(fid, cid);
  const { data: doses, error: e3 } = useDoses(fid, cid);
  const { data: illnesses, error: e4 } = useIllnesses(fid, cid);
  const { data: meds, error: e5 } = useMedications(fid, cid);
  const { data: growth, error: e6 } = useGrowth(fid, cid);

  const err = e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6;
  if (err) return <ErrorState error={err} />;
  if (!child) return <p className="text-muted-foreground p-6">กำลังโหลดข้อมูล…</p>;

  const givenDoses = doses.filter((d) => d.given);
  const upcomingDoses = doses.filter((d) => !d.given && d.dueDate);
  const activeIllness = illnesses.find((i) => i.status === "active");
  const activeMeds = meds.filter((m) => m.status === "active");
  const latestGrowth = growth[0];

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Action Bar (ไม่แสดงตอนพิมพ์) */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link
          to={`/children/${cid}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> กลับหน้าข้อมูลเด็ก
        </Link>
        <Button onClick={handlePrint} className="flex items-center gap-1.5 shadow-sm">
          <Printer size={16} /> พิมพ์รายงาน / บันทึก PDF
        </Button>
      </div>

      {/* เอกสารสรุปสุขภาพ (Medical Summary Document) */}
      <div className="rounded-xl border bg-card p-6 sm:p-8 space-y-6 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* หัวกระดาษ */}
        <div className="border-b pb-4 space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              KidCare — รายงานประวัติสุขภาพเด็ก
            </h1>
            <span className="text-xs text-muted-foreground">
              พิมพ์เมื่อ {formatThaiDate(today)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            เอกสารสรุปประวัติสุขภาพ การแพ้ วัคซีน และการเจริญเติบโต สำหรับพบแพทย์
          </p>
        </div>

        {/* 1. ข้อมูลส่วนตัวเด็ก */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <User size={15} /> ข้อมูลทั่วไป
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border p-3.5 bg-muted/10 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">ชื่อ-นามสกุล</span>
              <span className="font-semibold">{child.name}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">ชื่อเล่น</span>
              <span className="font-semibold">{child.nickname || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">วันเกิด / อายุ</span>
              <span className="font-semibold">{formatThaiDate(child.birthDate)}</span>
              <span className="text-xs text-muted-foreground block">({ageText(child.birthDate, today)})</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">เพศ / กรุ๊ปเลือด</span>
              <span className="font-semibold">
                {child.sex === "F" ? "หญิง" : "ชาย"} {child.bloodType ? `· กรุ๊ป ${child.bloodType}` : ""}
              </span>
            </div>
          </div>

          {child.hospitals && child.hospitals.length > 0 && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span>เลขประจำตัวผู้ป่วย (HN):</span>
              {child.hospitals.map((h, i) => (
                <strong key={i} className="text-foreground">
                  {h.name}: {h.hn}
                </strong>
              ))}
            </div>
          )}
        </section>

        {/* 2. ประวัติการแพ้ยา/อาหาร (เด่นชัดที่สุด) */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-rose-500" /> ประวัติการแพ้ยา / แพ้อาหาร
          </h2>
          {allergies.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
              <ShieldCheck size={16} /> ไม่มีประวัติการแพ้ยาหรืออาหารที่บันทึกไว้
            </div>
          ) : (
            <div className="rounded-lg border-2 border-rose-500/50 bg-rose-500/10 p-3.5 space-y-2">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                ⚠️ มีประวัติการแพ้ {allergies.length} รายการ (โปรดแจ้งแพทย์ก่อนสั่งยา)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {allergies.map((a) => (
                  <div key={a.id} className="rounded border border-rose-500/30 bg-card p-2 text-xs space-y-0.5">
                    <p className="font-bold text-rose-600">
                      {a.substance} ({a.type === "drug" ? "ยา" : a.type === "food" ? "อาหาร" : "สารอื่นๆ"})
                    </p>
                    {a.reaction && <p className="text-muted-foreground">อาการ: {a.reaction}</p>}
                    {a.severity && <p className="text-muted-foreground">ความรุนแรง: {a.severity}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. การเจริญเติบโตล่าสุด */}
        {latestGrowth && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity size={15} /> การเจริญเติบโตล่าสุด (วัดเมื่อ {formatThaiDate(latestGrowth.date)})
            </h2>
            <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-center text-sm bg-muted/10">
              <div>
                <span className="text-xs text-muted-foreground block">น้ำหนัก</span>
                <span className="text-lg font-bold">{latestGrowth.weightKg ?? "—"} กก.</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">ส่วนสูง</span>
                <span className="text-lg font-bold">{latestGrowth.heightCm ?? "—"} ซม.</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">รอบศีรษะ</span>
                <span className="text-lg font-bold">{latestGrowth.headCircumferenceCm ? `${latestGrowth.headCircumferenceCm} ซม.` : "—"}</span>
              </div>
            </div>
          </section>
        )}

        {/* 4. อาการป่วยปัจจุบัน & ยาที่กำลังทาน */}
        {(activeIllness || activeMeds.length > 0) && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Pill size={15} /> อาการป่วยปัจจุบัน & ยาที่กำลังใช้
            </h2>
            <div className="rounded-lg border p-3.5 space-y-2 bg-muted/10 text-xs">
              {activeIllness && (
                <div>
                  <span className="font-bold text-foreground">อาการป่วย: </span>
                  <span>{activeIllness.name} (เริ่ม {formatThaiDate(activeIllness.startDate)})</span>
                  {activeIllness.symptoms?.length ? ` · อาการ: ${activeIllness.symptoms.join(", ")}` : ""}
                </div>
              )}
              {activeMeds.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  <span className="font-bold text-foreground">ยาที่กำลังรับประทาน:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {activeMeds.map((m) => (
                      <li key={m.id}>
                        <strong className="text-foreground">{m.name}</strong>
                        {m.dosage ? ` (${m.dosage})` : ""} — {m.frequency}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 5. ประวัติวัคซีนที่ฉีดแล้ว */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck size={15} /> ประวัติวัคซีนที่ฉีดแล้ว ({givenDoses.length} เข็ม)
          </h2>
          {givenDoses.length === 0 ? (
            <p className="text-xs text-muted-foreground">ยังไม่มีบันทึกวัคซีนที่ฉีดแล้ว</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-semibold">
                  <tr>
                    <th className="p-2">วัคซีน</th>
                    <th className="p-2">เข็มที่</th>
                    <th className="p-2">วันที่ฉีด</th>
                    <th className="p-2">Lot / ยี่ห้อ</th>
                    <th className="p-2">สถานที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {givenDoses.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/20">
                      <td className="p-2 font-medium">{d.vaccineName}</td>
                      <td className="p-2">{d.doseNo}</td>
                      <td className="p-2">
                        {d.givenDateUnknown || !d.givenDate ? "ไม่ทราบวันที่" : formatThaiDate(d.givenDate)}
                      </td>
                      <td className="p-2 text-muted-foreground">{d.lotNo || d.brand || "—"}</td>
                      <td className="p-2 text-muted-foreground">{d.place || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 6. วัคซีนนัดถัดไป */}
        {upcomingDoses.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar size={15} /> วัคซีนที่นัดหมายถัดไป
            </h2>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-semibold">
                  <tr>
                    <th className="p-2">วัคซีน</th>
                    <th className="p-2">เข็มที่</th>
                    <th className="p-2">วันครบกำหนด / วันนัด</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {upcomingDoses.slice(0, 5).map((d) => (
                    <tr key={d.id}>
                      <td className="p-2 font-medium">{d.vaccineName}</td>
                      <td className="p-2">{d.doseNo}</td>
                      <td className="p-2 font-semibold text-primary">{formatThaiDate(d.dueDate!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

import type { VaccineCode } from "@/data/vaccineCodes";
import type { ISODate, VaccineDose } from "@/types";

export interface ImportedRecord {
  pageIndex: number;
  vaccineRaw: string;
  vaccineCode: VaccineCode;
  doseNo: number | null;
  dateRaw: string | null;
  dateGiven: ISODate | null;
  lotNo: string | null;
  place: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
}

export interface ImportRow {
  key: string;
  record: ImportedRecord;
  target: string; // dose id | "new"
  include: boolean;
  warnings: string[];
}

function dateProblem(r: ImportedRecord, birthDate: ISODate, today: ISODate): string | null {
  if (!r.dateGiven) return "อ่านวันที่ไม่ออก";
  if (r.dateGiven < birthDate) return "วันที่ก่อนวันเกิด";
  if (r.dateGiven > today) return "วันที่อยู่ในอนาคต";
  return null;
}

export function rowWarnings(r: ImportedRecord, target: string, doses: VaccineDose[], birthDate: ISODate, today: ISODate): string[] {
  const w: string[] = [];
  const dp = dateProblem(r, birthDate, today);
  if (dp) w.push(dp);
  if (r.confidence === "low") w.push("AI ไม่มั่นใจ ตรวจกับสมุดอีกครั้ง");
  if (target !== "new" && doses.find((d) => d.id === target)?.given) w.push("เข็มนี้บันทึกว่าฉีดแล้ว — จะเขียนทับ");
  return w;
}

export function matchImportedDoses(records: ImportedRecord[], doses: VaccineDose[], birthDate: ISODate, today: ISODate): ImportRow[] {
  const used = new Set<string>();
  const targets = new Array<string>(records.length).fill("new");
  const order = records
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.dateGiven ?? "9999").localeCompare(b.r.dateGiven ?? "9999"));

  // รอบแรก (ก): มีเลขเข็ม → จับตรงตัว
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo === null) continue;
    const m = doses.find((d) => d.vaccineCode === r.vaccineCode && d.doseNo === r.doseNo && !used.has(d.id));
    if (m) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }
  // รอบแรก (ข): เลขเข็มในตาราง EPI ไม่ต่อเนื่อง (OPV 3–5, DTP 4–5) → ถ้าไม่ตรงตัว ใช้ลำดับที่ (เข็มที่ N ของวัคซีนนั้น)
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo === null || targets[i] !== "new") continue;
    const sameCode = doses.filter((d) => d.vaccineCode === r.vaccineCode).sort((a, b) => a.doseNo - b.doseNo);
    const m = sameCode[r.doseNo - 1];
    if (m && !used.has(m.id)) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }
  // รอบสอง: ไม่มีเลขเข็ม (หรือจับไม่ได้) → เข็มที่ยังไม่ฉีดลำดับแรกของวัคซีนนั้น ตามลำดับวันที่
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || targets[i] !== "new") continue;
    const m = doses
      .filter((d) => d.vaccineCode === r.vaccineCode && !d.given && !used.has(d.id))
      .sort((a, b) => a.doseNo - b.doseNo)[0];
    if (m) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }

  return records.map((r, i) => ({
    key: `${i}-${r.pageIndex}-${r.vaccineCode}-${r.doseNo ?? "x"}`,
    record: r,
    target: targets[i],
    include: dateProblem(r, birthDate, today) === null,
    warnings: rowWarnings(r, targets[i], doses, birthDate, today),
  }));
}

export function findDuplicateTargets(rows: ImportRow[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const r of rows) {
    if (!r.include || r.target === "new") continue;
    if (seen.has(r.target)) dup.add(r.target);
    seen.add(r.target);
  }
  return dup;
}

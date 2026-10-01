import type { VaccineCode } from "@/data/vaccineCodes";
import { diffDays } from "./dates";
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

const FAR_FROM_SCHEDULE_DAYS = 183;

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
  const dose = target === "new" ? undefined : doses.find((d) => d.id === target);
  if (r.dateGiven && dose?.dueDate && Math.abs(diffDays(r.dateGiven, dose.dueDate)) > FAR_FROM_SCHEDULE_DAYS) {
    w.push("วันที่ฉีดห่างจากกำหนดของเข็มนี้มาก — ตรวจว่าจับคู่ถูกเข็ม");
  }
  return w;
}

export function matchImportedDoses(records: ImportedRecord[], doses: VaccineDose[], birthDate: ISODate, today: ISODate): ImportRow[] {
  const used = new Set<string>();
  const targets = new Array<string>(records.length).fill("new");
  const order = records
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.dateGiven ?? "9999").localeCompare(b.r.dateGiven ?? "9999"));

  // รอบ 1ก: มีเลขเข็ม → จับตรงตัว (code + doseNo) ที่ยังไม่ถูกใช้
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo === null) continue;
    const m = doses.find((d) => d.vaccineCode === r.vaccineCode && d.doseNo === r.doseNo && !used.has(d.id));
    if (m) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }
  // รอบ 1ข: ใช้ลำดับที่ เฉพาะเมื่อเลขเข็มนั้น "ไม่มีอยู่เลย" ในวัคซีนนั้น (เช่น สมุดเก่านับ OPV 1,2 แต่ตาราง EPI เริ่มที่ 3)
  const doseNosByCode = new Map<string, Set<number>>();
  for (const d of doses) {
    if (!d.vaccineCode) continue;
    const set = doseNosByCode.get(d.vaccineCode) ?? new Set<number>();
    set.add(d.doseNo);
    doseNosByCode.set(d.vaccineCode, set);
  }
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo === null || targets[i] !== "new") continue;
    if (doseNosByCode.get(r.vaccineCode)?.has(r.doseNo)) continue;
    const sameCode = doses.filter((d) => d.vaccineCode === r.vaccineCode).sort((a, b) => a.doseNo - b.doseNo);
    const m = sameCode[r.doseNo - 1];
    if (m && !used.has(m.id)) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }
  // รอบ 2: ไม่มีเลขเข็ม → เข็มที่ยังไม่ฉีดลำดับแรกของวัคซีนนั้น ตามลำดับวันที่
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo !== null || targets[i] !== "new") continue;
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

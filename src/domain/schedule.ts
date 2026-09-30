import type { ISODate, SeriesSource, VaccineDose } from "@/types";
import { addDaysISO, addMonthsISO } from "./dates";

export interface EpiTemplateItem {
  vaccineCode: string;
  vaccineName: string;
  doseNo: number;
  ageMonths: number;
}

export interface DoseDraft {
  vaccineName: string;
  vaccineCode?: string;
  doseNo: number;
  dueDate: ISODate | null;
  given?: boolean;
  givenDate?: ISODate | null;
  givenDateUnknown?: boolean;
}

export interface SeriesDraft {
  name: string;
  source: SeriesSource;
  templateKey?: string;
  reason?: string;
  doses: DoseDraft[];
}

export interface CustomTemplate {
  key: string;
  name: string;
  vaccineCode?: string;
  dayOffsets: number[];
}

export function generateEpiSeries(items: EpiTemplateItem[], birthDate: ISODate): SeriesDraft[] {
  const byCode = new Map<string, SeriesDraft>();
  for (const it of items) {
    let s = byCode.get(it.vaccineCode);
    if (!s) {
      s = { name: it.vaccineName, source: "epi", templateKey: `epi:${it.vaccineCode}`, doses: [] };
      byCode.set(it.vaccineCode, s);
    }
    s.doses.push({
      vaccineName: it.vaccineName,
      vaccineCode: it.vaccineCode,
      doseNo: it.doseNo,
      dueDate: addMonthsISO(birthDate, it.ageMonths),
    });
  }
  for (const s of byCode.values()) s.doses.sort((a, b) => a.doseNo - b.doseNo);
  return [...byCode.values()];
}

export function generateCustomDoses(
  tpl: Pick<CustomTemplate, "name" | "vaccineCode" | "dayOffsets">,
  anchor: { doseNo: number; date: ISODate },
): DoseDraft[] {
  if (!Number.isInteger(anchor.doseNo) || anchor.doseNo < 1 || anchor.doseNo > tpl.dayOffsets.length) {
    throw new RangeError("anchor.doseNo out of range");
  }
  const base = tpl.dayOffsets[anchor.doseNo - 1];
  return tpl.dayOffsets.map((offset, i) => {
    const doseNo = i + 1;
    const date = addDaysISO(anchor.date, offset - base);
    const draft: DoseDraft = { vaccineName: tpl.name, vaccineCode: tpl.vaccineCode, doseNo, dueDate: date };
    if (doseNo < anchor.doseNo) {
      draft.given = true;
      draft.givenDate = date;
      draft.givenDateUnknown = false;
    }
    return draft;
  });
}

export function shiftRemainingDoses(
  doses: Pick<VaccineDose, "id" | "doseNo" | "given" | "dueDate">[],
  fromDoseNo: number,
  days: number,
): { id: string; dueDate: ISODate }[] {
  return doses
    .filter((d) => d.doseNo > fromDoseNo && !d.given && d.dueDate)
    .sort((a, b) => a.doseNo - b.doseNo)
    .map((d) => ({ id: d.id, dueDate: addDaysISO(d.dueDate!, days) }));
}

export function parseDayOffsets(text: string): { offsets: number[] } | { error: string } {
  const tokens = text.split(",").map((s) => s.trim()).filter((s) => s !== "");
  if (tokens.length === 0) return { error: "กรอกตัวเลขวันอย่างน้อย 1 ค่า" };
  if (!tokens.every((t) => /^\d+$/.test(t))) return { error: "ใช้ได้เฉพาะจำนวนเต็มตั้งแต่ 0 ขึ้นไป" };
  const offsets = tokens.map(Number);
  if (offsets[0] !== 0) return { error: "เข็มแรกต้องเป็นวันที่ 0" };
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] <= offsets[i - 1]) return { error: "วันต้องเรียงจากน้อยไปมากและไม่ซ้ำ" };
  }
  return { offsets };
}

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInMonths,
  format,
  parseISO,
} from "date-fns";
import type { ISODate } from "@/types";

const toISO = (d: Date): ISODate => format(d, "yyyy-MM-dd");

export function addDaysISO(iso: ISODate, n: number): ISODate {
  return toISO(addDays(parseISO(iso), n));
}

export function addMonthsISO(iso: ISODate, n: number): ISODate {
  return toISO(addMonths(parseISO(iso), n));
}

/** a − b in calendar days */
export function diffDays(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now);
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function thaiMonthShort(monthIndex0: number): string {
  return TH_MONTHS[monthIndex0];
}

export function formatThaiDate(iso: ISODate): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function ageText(birth: ISODate, today: ISODate): string {
  const months = Math.max(0, differenceInMonths(parseISO(today), parseISO(birth)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} เดือน`;
  return m ? `${y} ปี ${m} เดือน` : `${y} ปี`;
}

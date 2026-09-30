import type { DoseStatus, ISODate, VaccineDose } from "@/types";
import { diffDays } from "./dates";

export const DUE_SOON_DAYS = 7;

export function doseStatus(d: Pick<VaccineDose, "given" | "dueDate">, today: ISODate): DoseStatus {
  if (d.given) return "given";
  if (!d.dueDate) return "unscheduled";
  const diff = diffDays(d.dueDate, today);
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_DAYS) return "dueSoon";
  return "scheduled";
}

export const STATUS_LABEL: Record<DoseStatus, string> = {
  given: "ฉีดแล้ว",
  overdue: "เลยกำหนด",
  dueSoon: "ใกล้ถึง",
  scheduled: "นัดแล้ว",
  unscheduled: "ยังไม่นัด",
};

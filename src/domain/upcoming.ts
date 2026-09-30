import type { ISODate } from "@/types";
import { diffDays } from "./dates";
import { DUE_SOON_DAYS } from "./doseStatus";

export interface UpcomingItem {
  kind: "dose" | "appointment";
  id: string;
  childId: string;
  date: ISODate;
  time?: string;
  title: string;
  place?: string;
}

export const byDateTime = (a: UpcomingItem, b: UpcomingItem) =>
  a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");

export function groupUpcoming(items: UpcomingItem[], today: ISODate) {
  const sorted = [...items].sort(byDateTime);
  return {
    overdue: sorted.filter((i) => diffDays(i.date, today) < 0),
    soon: sorted.filter((i) => {
      const d = diffDays(i.date, today);
      return d >= 0 && d <= DUE_SOON_DAYS;
    }),
    later: sorted.filter((i) => diffDays(i.date, today) > DUE_SOON_DAYS),
  };
}

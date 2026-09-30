import type { Appointment, ISODate, VaccineDose } from "@/types";
import { diffDays, thaiMonthShort } from "./dates";
import { byDateTime, type UpcomingItem } from "./upcoming";

export const CHILD_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500"] as const;
export const childColor = (index: number): string => CHILD_COLORS[index % CHILD_COLORS.length];

export function toUpcomingItems(doses: VaccineDose[], appts: Appointment[]): UpcomingItem[] {
  return [
    ...doses
      .filter((d) => !d.given && d.dueDate)
      .map((d) => ({ kind: "dose" as const, id: d.id, childId: d.childId, date: d.dueDate!, title: `${d.vaccineName} เข็ม ${d.doseNo}`, place: d.place })),
    ...appts
      .filter((a) => !a.done)
      .map((a) => ({ kind: "appointment" as const, id: a.id, childId: a.childId, date: a.date, time: a.time, title: a.purpose, place: a.place })),
  ];
}

/** Home preview order: due within 7 days, then overdue (most recent first), then later. */
export function pickHomeUpcoming(items: UpcomingItem[], today: ISODate, n = 5): UpcomingItem[] {
  const soon: UpcomingItem[] = [];
  const overdue: UpcomingItem[] = [];
  const later: UpcomingItem[] = [];
  for (const it of items) {
    if (it.date < today) overdue.push(it);
    else if (diffDays(it.date, today) <= 7) soon.push(it);
    else later.push(it);
  }
  return [...soon.sort(byDateTime), ...overdue.sort((a, b) => byDateTime(b, a)), ...later.sort(byDateTime)].slice(0, n);
}

export interface DashboardSummary {
  overdueCount: number;
  next: { date: ISODate; daysAway: number; childId: string; title: string } | null;
  coveragePct: number | null;
  next30Count: number;
}

export function summarize(doses: VaccineDose[], appts: Appointment[], today: ISODate): DashboardSummary {
  const isOverdue = (d: VaccineDose) => !d.given && d.dueDate !== null && d.dueDate < today;
  const overdueCount = doses.filter(isOverdue).length;
  const given = doses.filter((d) => d.given).length;
  const coveragePct = given + overdueCount === 0 ? null : Math.round((100 * given) / (given + overdueCount));
  const future = toUpcomingItems(doses, appts).filter((i) => i.date >= today).sort(byDateTime);
  const first = future[0];
  return {
    overdueCount,
    next: first ? { date: first.date, daysAway: diffDays(first.date, today), childId: first.childId, title: first.title } : null,
    coveragePct,
    next30Count: future.filter((i) => diffDays(i.date, today) <= 30).length,
  };
}

export interface ChildProgress {
  given: number;
  overdue: number;
  upcoming: number;
  next: VaccineDose | null;
}

export function childProgress(doses: VaccineDose[], today: ISODate): ChildProgress {
  let given = 0;
  let overdue = 0;
  let upcoming = 0;
  let next: VaccineDose | null = null;
  for (const d of doses) {
    if (d.given) given += 1;
    else if (d.dueDate !== null && d.dueDate < today) overdue += 1;
    else {
      upcoming += 1;
      if (d.dueDate !== null && (!next || d.dueDate < next.dueDate!)) next = d;
    }
  }
  return { given, overdue, upcoming, next };
}

export interface MonthBucket {
  key: string; // YYYY-MM
  label: string; // Thai short month
  yearBE: number;
  counts: Record<string, number>; // childId -> count
  total: number;
}

export function monthlyUpcoming(items: UpcomingItem[], today: ISODate, months = 12): MonthBucket[] {
  const [y0, m0] = today.split("-").map(Number);
  const buckets: MonthBucket[] = Array.from({ length: months }, (_, i) => {
    const idx = m0 - 1 + i;
    const y = y0 + Math.floor(idx / 12);
    const m = idx % 12;
    return { key: `${y}-${String(m + 1).padStart(2, "0")}`, label: thaiMonthShort(m), yearBE: y + 543, counts: {}, total: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const it of items) {
    if (it.date < today) continue;
    const i = index.get(it.date.slice(0, 7));
    if (i === undefined) continue;
    const b = buckets[i];
    b.counts[it.childId] = (b.counts[it.childId] ?? 0) + 1;
    b.total += 1;
  }
  return buckets;
}

export type TimelineStatus = "given" | "overdue" | "upcoming";

export interface AgeTimelineData {
  points: { doseId: string; ageMonths: number; status: TimelineStatus; date: ISODate; label: string }[];
  todayAgeMonths: number;
  maxAgeMonths: number;
}

const DAYS_PER_MONTH = 30.4375;
const ageAt = (birth: ISODate, date: ISODate) => diffDays(date, birth) / DAYS_PER_MONTH;

export function ageTimeline(birthDate: ISODate, doses: VaccineDose[], today: ISODate): AgeTimelineData {
  const points: AgeTimelineData["points"] = [];
  for (const d of doses) {
    let date: ISODate | null = null;
    let status: TimelineStatus;
    if (d.given) {
      if (!d.givenDate) continue;
      date = d.givenDate;
      status = "given";
    } else {
      if (!d.dueDate) continue;
      date = d.dueDate;
      status = d.dueDate < today ? "overdue" : "upcoming";
    }
    points.push({ doseId: d.id, ageMonths: ageAt(birthDate, date), status, date, label: `${d.vaccineName} เข็ม ${d.doseNo}` });
  }
  points.sort((a, b) => a.ageMonths - b.ageMonths);
  const todayAgeMonths = ageAt(birthDate, today);
  const furthest = Math.max(60, todayAgeMonths, ...points.map((p) => p.ageMonths));
  return { points, todayAgeMonths, maxAgeMonths: Math.ceil(furthest / 12) * 12 };
}

# KidCare Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page with a dashboard (stat tiles, per-child progress cards, 12-month appointments chart, vaccine-by-age timeline, top-5 upcoming list) and move the full upcoming list to `/appointments`.

**Architecture:** All numbers come from pure functions in `src/domain/dashboard.ts` (unit-tested). Charts are hand-written SVG React components (no chart library). Home reads all doses of all children via a new `useFamilyDoses` hook that replaces `usePendingDoses`.

**Tech Stack:** existing — React 18, TypeScript, Tailwind, date-fns, Vitest, Firebase.

**Spec:** `docs/superpowers/specs/2026-09-30-kidcare-dashboard-design.md`

## Global Constraints

- UI text in Thai; dates shown Buddhist Era (`formatThaiDate`), stored ISO `YYYY-MM-DD`.
- Child series colors (fixed by birth-date order, never by rank of values): `["#3987e5", "#d95926", "#199e70", "#c98500"]`.
- Status colors: given `#0ca30c`, overdue `#d03b3b`, upcoming/neutral `#6b7280` — never color alone: progress bar has 2px gaps, hatched overdue segment and numeric text; timeline uses shape (filled circle / diamond / hollow circle) + legend text.
- Numbers and labels use theme text colors (`text-foreground`, `text-muted-foreground`), never the series color.
- Every chart: `role="img"` + Thai `aria-label` summary + an `sr-only` table with the same data; tooltip on hover and on tap (tap elsewhere closes); hit targets ≥ 24px.
- While children/doses/appointments load, show "กำลังโหลด…" instead of the dashboard (never show 0 / empty states before data arrives).
- No new dependencies. Firestore writes (none expected here) are never awaited.
- Mobile first: must fit 375px width without horizontal scroll (SVG uses `viewBox` + `width="100%"`).

## File Structure

```
src/domain/dashboard.ts            pure: toUpcomingItems, summarize, childProgress, monthlyUpcoming, ageTimeline, CHILD_COLORS, childColor
src/domain/dashboard.test.ts
src/domain/dates.ts                + export thaiMonthShort(monthIndex0)
src/hooks/data.ts                  usePendingDoses → useFamilyDoses (all doses)
src/components/dashboard/MonthlyChart.tsx
src/components/dashboard/AgeTimeline.tsx
src/components/dashboard/StatTiles.tsx
src/components/dashboard/ChildSummaryCard.tsx
src/pages/Home.tsx                 rewritten as dashboard
src/pages/Appointments.tsx         full upcoming list
src/App.tsx                        + /appointments route
```

---

### Task 1: Dashboard domain logic + family doses hook

**Files:**
- Create: `src/domain/dashboard.ts`, `src/domain/dashboard.test.ts`
- Modify: `src/domain/dates.ts` (export `thaiMonthShort`), `src/hooks/data.ts` (replace `usePendingDoses` with `useFamilyDoses`), `src/pages/Home.tsx` (switch to `useFamilyDoses` and derive pending with `.filter(d => !d.given)` so the app keeps working — the dashboard UI comes in Task 3)

**Interfaces:**
- Produces:
  - `thaiMonthShort(monthIndex0: number): string` (0 → "ม.ค.")
  - `CHILD_COLORS: readonly string[]`, `childColor(index: number): string`
  - `toUpcomingItems(doses: VaccineDose[], appts: Appointment[]): UpcomingItem[]` (pending doses with dueDate + not-done appointments)
  - `summarize(doses, appts, today): DashboardSummary`
  - `childProgress(doses: VaccineDose[], today): ChildProgress`
  - `monthlyUpcoming(items: UpcomingItem[], today, months?: number): MonthBucket[]`
  - `ageTimeline(birthDate, doses, today): AgeTimelineData`
  - `useFamilyDoses(fid, childIds): { data: VaccineDose[]; error: FirestoreError | null; loading: boolean }` — same semantics as the old `usePendingDoses` (loading until every current child delivered a first snapshot; reset on child-set change; false for empty set; error cleared on success) but the per-child query has no `where` (all doses).

- [ ] **Step 1: Export month helper** — in `src/domain/dates.ts` add below `TH_MONTHS`:

```ts
export function thaiMonthShort(monthIndex0: number): string {
  return TH_MONTHS[monthIndex0];
}
```

- [ ] **Step 2: Write failing tests** — `src/domain/dashboard.test.ts`

```ts
import { describe, expect, test } from "vitest";
import type { Appointment, VaccineDose } from "@/types";
import { ageTimeline, childColor, childProgress, monthlyUpcoming, summarize, toUpcomingItems } from "./dashboard";

const T = "2026-09-30";

let n = 0;
function dose(over: Partial<VaccineDose>): VaccineDose {
  n += 1;
  return {
    id: `d${n}`, familyId: "f", childId: "c1", seriesId: "s", vaccineName: "OPV", vaccineCode: "OPV", doseNo: 1,
    dueDate: null, given: false, givenDate: null, givenDateUnknown: false, source: "manual", ...over,
  };
}
function appt(over: Partial<Appointment>): Appointment {
  n += 1;
  return { id: `a${n}`, familyId: "f", childId: "c1", date: T, place: "รพ.", purpose: "นัดหมอ", done: false, ...over };
}

describe("toUpcomingItems", () => {
  test("pending doses with dueDate and open appointments only", () => {
    const items = toUpcomingItems(
      [dose({ dueDate: "2026-10-02", vaccineName: "พิษสุนัขบ้า", doseNo: 2 }), dose({ given: true, dueDate: "2026-10-03" }), dose({ dueDate: null })],
      [appt({ date: "2026-10-05", time: "09:30", purpose: "ตรวจ" }), appt({ done: true })],
    );
    expect(items.map((i) => [i.kind, i.date, i.title, i.time])).toEqual([
      ["dose", "2026-10-02", "พิษสุนัขบ้า เข็ม 2", undefined],
      ["appointment", "2026-10-05", "ตรวจ", "09:30"],
    ]);
  });
});

describe("summarize", () => {
  test("counts overdue, next item, coverage, next 30 days", () => {
    const doses = [
      dose({ given: true, givenDate: "2025-01-01", dueDate: "2025-01-01" }),
      dose({ given: true, givenDateUnknown: true, dueDate: "2025-03-01" }),
      dose({ given: true, givenDate: "2025-05-01", dueDate: "2025-05-01" }),
      dose({ dueDate: "2026-09-01" }), // overdue
      dose({ dueDate: T }), // due today: not overdue, not in coverage denominator
      dose({ dueDate: "2026-10-31" }), // in 30 days (diff 31? no: 31 days) -> excluded
      dose({ dueDate: "2026-10-30" }), // diff 30 -> included
    ];
    const s = summarize(doses, [appt({ date: "2026-10-01", childId: "c2", purpose: "ตรวจ" })], T);
    expect(s.overdueCount).toBe(1);
    expect(s.coveragePct).toBe(75);
    expect(s.next).toEqual({ date: T, daysAway: 0, childId: "c1", title: "OPV เข็ม 1" });
    expect(s.next30Count).toBe(3); // today dose, 2026-10-01 appt, 2026-10-30 dose
  });
  test("empty data", () => {
    expect(summarize([], [], T)).toEqual({ overdueCount: 0, next: null, coveragePct: null, next30Count: 0 });
  });
  test("next ignores past items and orders same-day by time (untimed first)", () => {
    const s = summarize([dose({ dueDate: "2026-09-01" })], [appt({ date: "2026-10-02", time: "13:00", purpose: "บ่าย" }), appt({ date: "2026-10-02", purpose: "ไม่ระบุเวลา" })], T);
    expect(s.next?.title).toBe("ไม่ระบุเวลา");
    expect(s.next?.daysAway).toBe(2);
  });
});

describe("childProgress", () => {
  test("given / overdue / upcoming and next dose", () => {
    const p = childProgress(
      [
        dose({ given: true, givenDate: "2025-01-01", dueDate: "2025-01-01" }),
        dose({ dueDate: "2026-01-01" }),
        dose({ dueDate: "2027-06-26", vaccineName: "JE", doseNo: 2 }),
        dose({ dueDate: "2026-12-26", vaccineName: "DTP", doseNo: 5 }),
        dose({ dueDate: null }),
      ],
      T,
    );
    expect([p.given, p.overdue, p.upcoming]).toEqual([1, 1, 3]);
    expect(p.next && [p.next.vaccineName, p.next.doseNo]).toEqual(["DTP", 5]);
  });
  test("no doses", () => {
    expect(childProgress([], T)).toEqual({ given: 0, overdue: 0, upcoming: 0, next: null });
  });
});

describe("monthlyUpcoming", () => {
  test("12 buckets from current month, counts per child, excludes past and out-of-range", () => {
    const items = toUpcomingItems(
      [
        dose({ dueDate: "2026-09-15" }), // past this month -> excluded (date < today)
        dose({ dueDate: T }), // today -> Sep bucket
        dose({ dueDate: "2026-12-26", childId: "c2" }),
        dose({ dueDate: "2027-08-31" }), // last bucket (Aug 2027)
        dose({ dueDate: "2027-09-01" }), // out of range
      ],
      [appt({ date: "2026-12-01", childId: "c2" })],
    );
    const b = monthlyUpcoming(items, T);
    expect(b).toHaveLength(12);
    expect(b[0]).toMatchObject({ key: "2026-09", label: "ก.ย.", yearBE: 2569, total: 1, counts: { c1: 1 } });
    expect(b[3]).toMatchObject({ key: "2026-12", label: "ธ.ค.", total: 2, counts: { c2: 2 } });
    expect(b[11]).toMatchObject({ key: "2027-08", yearBE: 2570, total: 1 });
    expect(b.reduce((s, x) => s + x.total, 0)).toBe(4);
  });
});

describe("ageTimeline", () => {
  const birth = "2024-12-26";
  test("places given at givenDate, pending at dueDate, skips unknown/no-date, computes max", () => {
    const t = ageTimeline(
      birth,
      [
        dose({ id: "g", given: true, givenDate: "2024-12-26", dueDate: "2024-12-26" }),
        dose({ id: "u", given: true, givenDateUnknown: true, dueDate: "2025-02-26" }),
        dose({ id: "o", dueDate: "2025-06-26" }),
        dose({ id: "f", dueDate: "2028-12-26" }),
        dose({ id: "x", dueDate: null }),
      ],
      T,
    );
    expect(t.points.map((p) => [p.doseId, p.status])).toEqual([["g", "given"], ["o", "overdue"], ["f", "upcoming"]]);
    expect(t.points[0].ageMonths).toBeCloseTo(0, 5);
    expect(t.points[1].ageMonths).toBeCloseTo(6, 0);
    expect(t.points[2].ageMonths).toBeCloseTo(48, 0);
    expect(t.todayAgeMonths).toBeCloseTo(21.1, 0);
    expect(t.maxAgeMonths).toBe(60);
  });
  test("maxAge grows in whole years past 60 months", () => {
    const t = ageTimeline(birth, [dose({ dueDate: "2031-01-26" })], T); // ~73 months
    expect(t.maxAgeMonths).toBe(84);
  });
});

test("childColor is fixed by index", () => {
  expect(childColor(0)).toBe("#3987e5");
  expect(childColor(1)).toBe("#d95926");
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/domain/dashboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** — `src/domain/dashboard.ts`

```ts
import { parseISO } from "date-fns";
import type { Appointment, ISODate, VaccineDose } from "@/types";
import { diffDays, thaiMonthShort } from "./dates";
import type { UpcomingItem } from "./upcoming";

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

const byDateTime = (a: UpcomingItem, b: UpcomingItem) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");

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

// re-exported for components that format bucket years
export const isoYear = (iso: ISODate) => parseISO(iso).getFullYear();
```

Note: remove `isoYear` and the `parseISO` import if nothing uses them after Task 3 (keep the module lean).

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/dashboard.test.ts`
Expected: PASS. If an age assertion is off by rounding, fix the implementation — do not loosen expectations beyond the `toBeCloseTo` precision shown.

- [ ] **Step 6: Replace the hook** — in `src/hooks/data.ts` rename `usePendingDoses` to `useFamilyDoses`, drop the `where("given", "==", false)` clause (query the whole `vaccineDoses` collection per child), keep all loading/error semantics. In `src/pages/Home.tsx` replace the import/call with `useFamilyDoses` and derive `const pending = allDoses.filter((d) => !d.given)` where the old pending array was used, so the current home keeps working until Task 3.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc -b && npm test && npm run build` — all clean.

```bash
git add src/domain/dashboard.ts src/domain/dashboard.test.ts src/domain/dates.ts src/hooks/data.ts src/pages/Home.tsx
git commit -m "feat(dashboard): summary/progress/monthly/timeline domain logic and family doses hook"
```

---

### Task 2: Chart components (monthly stacked columns, vaccine-by-age timeline)

**Files:**
- Create: `src/components/dashboard/MonthlyChart.tsx`, `src/components/dashboard/AgeTimeline.tsx`

**Interfaces:**
- Consumes: `MonthBucket`, `AgeTimelineData`, `TimelineStatus` (Task 1); `formatThaiDate`.
- Produces:
  - `<MonthlyChart buckets: MonthBucket[] kids: { id: string; name: string; color: string }[] />`
  - `<AgeTimeline rows: { id: string; name: string; data: AgeTimelineData }[] />`

**MonthlyChart spec**
- Card: `rounded-lg border bg-card p-3`; heading `h3` "นัดวัคซีนและนัดหมอ 12 เดือนข้างหน้า" (`text-sm font-semibold`).
- Legend row above the plot (only when ≥ 2 kids): 10×10 rounded swatch + name in `text-xs text-muted-foreground`.
- If every bucket total is 0: render only the heading + "ไม่มีนัดใน 12 เดือนข้างหน้า" (muted) — no empty axes.
- SVG `viewBox="0 0 360 180"`, `width="100%"`. Plot area: left 24, right 8, top 8, bottom 28. Y max = max(total, 1), ticks at 0, ceil(max/2), max (integers, deduplicated), labels `fontSize 10` `fill="currentColor"` inside a `text-muted-foreground` group; faint horizontal grid lines `stroke="currentColor" opacity 0.15` at the ticks; baseline `opacity 0.4`.
- 12 columns, band width = plotWidth/12, bar width = 60% of band (≤ 18px), centered. Stack segments in kid order (bottom = first kid), each `rect` with the kid color; 2px gap between stacked segments (shrink each segment height by 2 except the lowest, never below 1px); top segment `rx=3` (round only the top by drawing the top rect with rx and overlaying a square rect for its lower half, or simply rx=2 on all segments — keep it simple and visually clean).
- X labels: `label` under each band (`fontSize 10`); under the first band and wherever the year changes add a second line with the BE year (`fontSize 9`).
- Hover/tap: a transparent full-height `rect` per band (hit target) sets the active index; show a tooltip `div` absolutely positioned above the plot (container `relative`) with `${label} ${yearBE}` and one line per kid with count > 0 (`• name count`), or "ไม่มีนัด". Mouse leave or tap outside (document `pointerdown` listener) clears it. Keyboard: bands are `tabIndex={0}` with `onFocus` setting active and `aria-label` like "ต.ค. 2569: ต้นกล้า 1 นัด, วินเทจ 2 นัด".
- `role="img"` + `aria-label="จำนวนนัดใน 12 เดือนข้างหน้า รวม N นัด"` on the SVG; plus `<table className="sr-only">` with columns เดือน / each kid / รวม.

**AgeTimeline spec**
- Card like above; heading "ไทม์ไลน์วัคซีนตามอายุ".
- Legend row: shape swatches rendered as tiny inline SVGs + text: "ฉีดแล้ว" (filled circle `#0ca30c`), "เลยกำหนด" (diamond `#d03b3b`), "ยังไม่ถึงวัย" (hollow circle stroke `#6b7280` width 2), and "│ อายุวันนี้".
- SVG `viewBox="0 0 360 {28 + rows*40}"`, width 100%. Left label column 56px (child name, `fontSize 11`, truncate with `…` if > 8 chars). x scale: `x(age) = 60 + age / maxAge * (360 - 60 - 12)` using the **largest** `maxAgeMonths` across rows so rows share one axis.
- Each row: faint track line; points: given → `circle r=5 fill #0ca30c`; overdue → diamond (`rect` 8×8 rotated 45°, fill `#d03b3b`); upcoming → `circle r=5 fill none stroke #6b7280 strokeWidth 2`. Surface ring: stroke `hsl(var(--card))` width 1.5 around filled marks so overlapping points stay distinguishable. "Today" tick: vertical line `stroke="currentColor"` width 2, height 24 centered on the row.
- Bottom axis ticks every 12 months: "แรกเกิด", "1 ปี", "2 ปี", … (`fontSize 10`, muted).
- Hover/tap on a point (invisible `circle r=12` hit target, `tabIndex={0}`) → tooltip `${label} · ${formatThaiDate(date)} · ${statusText}` where statusText is ฉีดแล้ว / เลยกำหนด / ยังไม่ถึงวัย; same dismiss rules as MonthlyChart.
- `role="img"` + `aria-label` "ไทม์ไลน์วัคซีนของลูก N คน"; `sr-only` table: ลูก / วัคซีน / วันที่ / สถานะ.
- A row with no points shows the track and a muted "ยังไม่มีข้อมูลวัคซีน" text at the start of the row.

- [ ] **Step 1:** Implement both components exactly to the specs above (plain React + SVG + Tailwind classes; share nothing new unless a tiny `useDismissOnOutside(ref, onClose)` hook in `src/components/dashboard/useDismiss.ts` avoids duplicating the document listener — allowed).
- [ ] **Step 2:** `npx tsc -b && npm test && npm run build` clean.
- [ ] **Step 3:** Commit `feat(dashboard): monthly appointments chart and vaccine age timeline` (only the new files).

---

### Task 3: Dashboard home, child summary cards, appointments page

**Files:**
- Create: `src/components/dashboard/StatTiles.tsx`, `src/components/dashboard/ChildSummaryCard.tsx`, `src/pages/Appointments.tsx`
- Modify: `src/pages/Home.tsx` (rewrite), `src/App.tsx` (route `/appointments`), `src/domain/dashboard.ts` (drop unused `isoYear` if still unused)
- Delete: `src/components/ChildCard.tsx` if no longer used

**Interfaces:**
- Consumes: Task 1 domain + `useFamilyDoses`; Task 2 charts; existing `useChildren`, `useOpenAppointments`, `useAllergies`, `UpcomingList`, `ageText`, `formatThaiDate`, `todayISO`.
- Produces: `<StatTiles summary kidsById />`, `<ChildSummaryCard fid child doses today />`, route `/appointments`.

**StatTiles:** grid `grid-cols-2 gap-3`; each tile `rounded-lg bg-muted p-3`: label `text-xs text-muted-foreground`, value `text-2xl font-bold`.
- เลยกำหนด: `{overdueCount} เข็ม` with `AlertTriangle` icon; value text red (`text-red-300`) only when > 0.
- นัดถัดไป: `daysAway` 0 → "วันนี้", 1 → "พรุ่งนี้", else `อีก ${d} วัน`; second line `text-xs text-muted-foreground`: `${formatThaiDate(date)} · ${kidName} · ${title}` (truncate); null → "—".
- ฉีดครบตามวัย: `${coveragePct}%` or "—".
- นัด 30 วันข้างหน้า: `${next30Count} นัด`.

**ChildSummaryCard:** whole card is a `Link` to `/children/:id` (`rounded-lg border bg-card p-3 block`), `aria-label` "ดูรายละเอียด {name}".
- Row 1: name (`nickname || name`, bold) + age (`ageText`) under it; right side allergy badge via `useAllergies(fid, child.id)`: > 0 → red "แพ้ N" with `AlertTriangle`; 0 → muted "ไม่มีประวัติแพ้"; loading → nothing; error → amber "โหลดข้อมูลแพ้ไม่ได้".
- Progress bar (`childProgress`): label `text-xs text-muted-foreground` "วัคซีน"; a 10px-high flex row with `gap-[2px]`: segments with `flex-grow` = counts (skip zero segments), given `#0ca30c`, overdue `#d03b3b` with a 45° hatch (`background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 2px, transparent 2px 5px)`), upcoming `#6b7280`; first segment rounded-l, last rounded-r (4px). Below: `text-xs` "ฉีดแล้ว {g} · เลยกำหนด {o} · รอถึงวัย {u}". No doses → muted "ยังไม่มีข้อมูลวัคซีน" instead of the bar.
- Next line `text-sm`: `ถัดไป: {vaccineName} เข็ม {doseNo} · {formatThaiDate(dueDate)}`; if no next but overdue > 0 → red "มีเข็มเลยกำหนด {o} เข็ม"; else nothing. Trailing `ChevronRight` icon.

**Home layout:** keep existing no-children empty state. Otherwise, while `childrenLoading || dosesLoading || apptsLoading` → "กำลังโหลด…". Then:
1. `<StatTiles>`
2. Section "ลูก" with the "+ เพิ่ม" link (as today) and a `grid gap-3 sm:grid-cols-2` of `ChildSummaryCard` (children in `useChildren` order = birth-date order; color index = position).
3. `<MonthlyChart>` with `monthlyUpcoming(toUpcomingItems(doses, appts), today)` and kids `{ id, name: nickname||name, color: childColor(i) }`.
4. `<AgeTimeline>` rows per child from `ageTimeline(child.birthDate, dosesOfChild, today)`.
5. Section "นัดที่รออยู่" header with "นัดหมอ" button (as today) and `UpcomingList` fed with the first 5 items after sorting overdue-first then by date/time (i.e. pass `toUpcomingItems(...)` sorted by date/time, sliced to 5 — `UpcomingList` groups them), then a link button "ดูทั้งหมด ({total})" → `/appointments` when total > 5.

**Appointments page (`/appointments`):** title "นัดหมายทั้งหมด", "นัดหมอ" button → `/appointments/new`, loading/error states, full `UpcomingList` (all items), empty text from UpcomingList. Add the route inside the protected layout in `App.tsx` **before** `/appointments/new` is irrelevant (exact paths) — just add `<Route path="/appointments" element={<Appointments />} />`.

- [ ] **Step 1:** Implement StatTiles, ChildSummaryCard, Appointments page, rewrite Home, add route; remove `ChildCard.tsx` and `isoYear` if unused.
- [ ] **Step 2:** `npx tsc -b && npm test && npm run build` clean.
- [ ] **Step 3:** Commit `feat(dashboard): dashboard home with child progress cards and appointments page`.
- [ ] **Step 4 (controller):** browser check with real data at desktop and 375px width: tiles correct vs the data, card tap navigates, charts render without overlap, tooltips on hover/tap, no console errors; then deploy after user confirmation.

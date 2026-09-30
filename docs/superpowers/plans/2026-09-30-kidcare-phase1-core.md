# KidCare Phase 1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first PWA where two parents record their children's profiles, allergies, vaccine series (Thai EPI + custom such as rabies PEP) and appointments, see what is due/overdue, and add reminders to their phone calendar.

**Architecture:** React + Vite SPA on Firebase Hosting, Firestore (Spark plan, offline cache) as the only backend. All data lives under `families/{familyId}` so a second parent can be added later. Pure business logic (dates, dose status, schedule generation, .ics) lives in `src/domain/` and is unit-tested with Vitest; Firestore access is in thin `src/lib/repo/*` modules; UI reads via `onSnapshot` hooks.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind 3, Radix UI (copied shadcn-style kit from ot-tracker), zod, zustand, date-fns 3, lucide-react, Firebase JS SDK 10, vite-plugin-pwa, Vitest, @firebase/rules-unit-testing.

**Spec:** `docs/superpowers/specs/2026-09-30-kidcare-phase1-design.md` (sections 1–5, 7–11). Section 6 (pink-book import) is **Plan 2**: `docs/superpowers/plans/2026-09-30-kidcare-phase1-pinkbook-import.md`.

## Global Constraints

- Project root: `C:\xampp\htdocs\KidCare` (git repo, remote `origin` = https://github.com/somrak-programing/kidcare.git, branch `main`).
- Firebase: **new project** (not `money-flow-28a5c`), Spark plan — no Cloud Functions, no Cloud Storage.
- UI text in Thai. Dates shown as Buddhist Era (`2 ต.ค. 2569`), stored as ISO `YYYY-MM-DD` (Gregorian) strings.
- Firestore writes are **never awaited in UI code** (offline writes only resolve on server ack) — use `fire()` from `src/lib/fire.ts`.
- Dose status is computed, never stored: `given | overdue | dueSoon (≤7 days) | scheduled | unscheduled`.
- Calendar text contains only child nickname + vaccine/purpose + place — never HN or allergy data.
- Allergy banner is always the first thing on the child page.
- Do not log health data in production code (`console.error(err)` of error objects is fine).
- Shell: Windows. Commands below are for Git Bash; run from the project root.

## File Structure

```
KidCare/
  package.json, vite.config.ts, vitest.config.ts, vitest.rules.config.ts, tsconfig.json,
  tsconfig.node.json, tailwind.config.js, postcss.config.js, index.html, .env.example,
  firebase.json, .firebaserc, firestore.rules, firestore.indexes.json
  public/icon.svg (+ generated PNG icons)
  src/
    main.tsx, App.tsx, vite-env.d.ts, styles/globals.css
    types/index.ts                 all shared domain types
    domain/                        pure logic, no Firebase/React
      dates.ts                     ISO date math + Thai formatting + age
      doseStatus.ts                doseStatus(), status labels
      upcoming.ts                  groupUpcoming()
      schedule.ts                  generateEpiSeries(), generateCustomDoses(), shiftRemainingDoses()
      ics.ts                       buildIcs(), googleCalendarUrl()
      validation.ts                zod schemas for forms
      *.test.ts                    co-located unit tests
    data/
      epi.ts                       Thai EPI template (verified against DDC)
      customTemplates.ts           rabies PEP IM/ID + blank
    lib/
      firebase.ts, auth.ts, fire.ts, paths.ts, utils.ts (cn), download.ts
      repo/family.ts, repo/children.ts, repo/allergies.ts, repo/vaccines.ts, repo/appointments.ts
    hooks/
      useAuth.ts, useFamilyId.ts, useCollection.ts, data.ts, useOnline.ts
    components/
      ui/*                         copied from ot-tracker
      Layout.tsx, RequireFamily.tsx, ErrorState.tsx, StatusBadge.tsx, CalendarButtons.tsx,
      AllergyBanner.tsx, UpcomingList.tsx, ChildCard.tsx,
      VaccineTimeline.tsx, RecordDoseDialog.tsx, BulkGivenDialog.tsx
    pages/
      Login.tsx, Home.tsx, ChildForm.tsx, ChildDetail.tsx, Allergies.tsx,
      NewSeries.tsx, AppointmentForm.tsx, Settings.tsx
  tests/rules/firestore.rules.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/styles/globals.css`, `src/lib/utils.ts`, `src/components/ui/*` (copied), `src/domain/smoke.test.ts` (deleted at end of task)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `cn(...classes)` in `@/lib/utils`; UI kit `@/components/ui/{button,card,checkbox,dialog,input,label,select,tabs}`; `@/` path alias; `npm test` runs Vitest on `src/**/*.test.ts`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "kidcare",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:rules": "firebase emulators:exec --project demo-kidcare --only firestore \"vitest run --config vitest.rules.config.ts\"",
    "deploy": "npm run build && firebase deploy --only hosting,firestore:rules,firestore:indexes"
  },
  "dependencies": {
    "@radix-ui/react-checkbox": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "firebase": "^10.12.2",
    "lucide-react": "^0.408.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.1",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.4",
    "@types/node": "^20.14.10",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vite-pwa/assets-generator": "^0.2.4",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "firebase-tools": "^13.13.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.0.3"
  }
}
```

- [ ] **Step 2: Copy config + UI kit from ot-tracker**

```bash
OT=/c/xampp/htdocs/ot-tracker
cp $OT/tsconfig.json $OT/tsconfig.node.json $OT/tailwind.config.js $OT/postcss.config.js .
mkdir -p src/components/ui src/lib src/styles
cp $OT/src/components/ui/*.tsx src/components/ui/
cp $OT/src/styles/globals.css src/styles/globals.css
cp $OT/src/vite-env.d.ts src/vite-env.d.ts
```

Check `tsconfig.node.json` includes `vite.config.ts`; add `"vitest.config.ts", "vitest.rules.config.ts"` to its `include` array.

- [ ] **Step 3: Write `src/lib/utils.ts`** (only `cn`; ot-tracker's OT helpers are not copied)

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Write `vite.config.ts`** (PWA manifest filled in Task 13; plugin present now)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "KidCare — สมุดสุขภาพลูก",
        short_name: "KidCare",
        description: "บันทึกวัคซีน การแพ้ยา และนัดหมอของลูก",
        theme_color: "#101522",
        background_color: "#101522",
        display: "standalone",
        orientation: "portrait",
        lang: "th",
        start_url: "/",
        icons: [],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"] },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist" },
});
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 6: Write `index.html`, `src/main.tsx`, `src/App.tsx`**

`index.html`:
```html
<!doctype html>
<html lang="th" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#101522" />
    <title>KidCare</title>
  </head>
  <body class="bg-background text-foreground">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

`src/App.tsx` (temporary, replaced in Task 8):
```tsx
export default function App() {
  return <div className="p-6">KidCare</div>;
}
```

- [ ] **Step 7: Write `.env.example` and extend `.gitignore`**

`.env.example`:
```
VITE_FB_API_KEY=
VITE_FB_AUTH_DOMAIN=
VITE_FB_PROJECT_ID=
VITE_FB_APP_ID=
```

Append to `.gitignore`:
```
dev-dist
*.tsbuildinfo
firebase-debug.log
firestore-debug.log
```

- [ ] **Step 8: Smoke test**

`src/domain/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("vitest runs", () => expect(1 + 1).toBe(2));
```

Run: `npm install && npm test`
Expected: `1 passed`.

Run: `npm run build`
Expected: build succeeds, `dist/` created. If `tsc` complains about a copied UI component importing something missing, install that Radix package (only those listed in package.json should be needed).

- [ ] **Step 9: Remove smoke test and commit**

```bash
rm src/domain/smoke.test.ts
git add -A
git commit -m "chore: scaffold KidCare (Vite + React + TS + Tailwind + PWA)"
```

---

### Task 2: Types and date utilities

**Files:**
- Create: `src/types/index.ts`, `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Produces (types): `ISODate`, `Sex`, `Hospital`, `Family`, `Child`, `ChildInput`, `AllergyType`, `Severity`, `Allergy`, `AllergyInput`, `SeriesSource`, `VaccineSeries`, `VaccineDose`, `DoseStatus`, `Appointment`, `AppointmentInput`.
- Produces (functions): `addDaysISO(iso, n): ISODate`, `addMonthsISO(iso, n): ISODate`, `diffDays(a, b): number` (a − b in calendar days), `todayISO(now?: Date): ISODate`, `formatThaiDate(iso): string`, `ageText(birth, today): string`.

- [ ] **Step 1: Write types** — `src/types/index.ts`

```ts
export type ISODate = string; // "YYYY-MM-DD", Gregorian

export type Sex = "M" | "F";

export interface Hospital {
  name: string;
  hn: string;
}

export interface Family {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
}

export interface Child {
  id: string;
  name: string;
  nickname?: string;
  birthDate: ISODate;
  sex: Sex;
  bloodType?: string;
  hospitals: Hospital[];
}
export type ChildInput = Omit<Child, "id">;

export type AllergyType = "drug" | "food" | "other";
export type Severity = "mild" | "moderate" | "severe";

export interface Allergy {
  id: string;
  type: AllergyType;
  substance: string;
  reaction: string;
  severity: Severity;
  notes?: string;
}
export type AllergyInput = Omit<Allergy, "id">;

export type SeriesSource = "epi" | "custom";

export interface VaccineSeries {
  id: string;
  name: string;
  source: SeriesSource;
  templateKey?: string;
  reason?: string;
}

export interface VaccineDose {
  id: string;
  familyId: string;
  childId: string;
  seriesId: string;
  vaccineName: string;
  vaccineCode?: string | null;
  doseNo: number;
  dueDate: ISODate | null;
  given: boolean;
  givenDate: ISODate | null;
  givenDateUnknown: boolean;
  brand?: string;
  lotNo?: string;
  amount?: string;
  site?: string;
  givenBy?: string;
  place?: string;
  notes?: string;
  source: "manual" | "import";
  importConfidence?: "high" | "medium" | "low";
}

export type DoseStatus = "given" | "overdue" | "dueSoon" | "scheduled" | "unscheduled";

export interface Appointment {
  id: string;
  familyId: string;
  childId: string;
  date: ISODate;
  time?: string; // "HH:mm"
  place: string;
  purpose: string;
  linkedDoseId?: string;
  notes?: string;
  done: boolean;
}
export type AppointmentInput = Omit<Appointment, "id" | "familyId">;
```

- [ ] **Step 2: Write failing tests** — `src/domain/dates.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { addDaysISO, addMonthsISO, ageText, diffDays, formatThaiDate, todayISO } from "./dates";

describe("dates", () => {
  test("addDaysISO crosses month and year", () => {
    expect(addDaysISO("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDaysISO("2026-12-30", 5)).toBe("2027-01-04");
    expect(addDaysISO("2026-10-02", -3)).toBe("2026-09-29");
  });

  test("addMonthsISO clamps to month end", () => {
    expect(addMonthsISO("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsISO("2023-01-31", 1)).toBe("2023-02-28");
    expect(addMonthsISO("2023-05-15", 18)).toBe("2024-11-15");
  });

  test("diffDays is a minus b", () => {
    expect(diffDays("2026-10-02", "2026-09-30")).toBe(2);
    expect(diffDays("2026-09-30", "2026-10-02")).toBe(-2);
    expect(diffDays("2026-09-30", "2026-09-30")).toBe(0);
  });

  test("todayISO formats local date", () => {
    expect(todayISO(new Date(2026, 8, 30, 23, 59))).toBe("2026-09-30");
  });

  test("formatThaiDate uses Buddhist era and short Thai month", () => {
    expect(formatThaiDate("2026-10-02")).toBe("2 ต.ค. 2569");
    expect(formatThaiDate("2025-01-15")).toBe("15 ม.ค. 2568");
  });

  test("ageText", () => {
    expect(ageText("2023-07-01", "2026-09-30")).toBe("3 ปี 2 เดือน");
    expect(ageText("2025-08-01", "2026-08-01")).toBe("1 ปี");
    expect(ageText("2026-06-15", "2026-09-30")).toBe("3 เดือน");
    expect(ageText("2026-09-20", "2026-09-30")).toBe("0 เดือน");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/domain/dates.test.ts`
Expected: FAIL — cannot resolve `./dates`.

- [ ] **Step 4: Implement** — `src/domain/dates.ts`

```ts
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
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/dates.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types src/domain
git commit -m "feat(domain): shared types and ISO date utilities"
```

---

### Task 3: Dose status and upcoming grouping

**Files:**
- Create: `src/domain/doseStatus.ts`, `src/domain/upcoming.ts`
- Test: `src/domain/doseStatus.test.ts`, `src/domain/upcoming.test.ts`

**Interfaces:**
- Consumes: `diffDays` (Task 2), `VaccineDose`, `DoseStatus`, `ISODate`.
- Produces: `doseStatus(d: Pick<VaccineDose,"given"|"dueDate">, today): DoseStatus`; `STATUS_LABEL: Record<DoseStatus,string>`; `DUE_SOON_DAYS = 7`; `interface UpcomingItem { kind: "dose"|"appointment"; id: string; childId: string; date: ISODate; time?: string; title: string; place?: string }`; `groupUpcoming(items, today): { overdue: UpcomingItem[]; soon: UpcomingItem[]; later: UpcomingItem[] }`.

- [ ] **Step 1: Write failing tests**

`src/domain/doseStatus.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { doseStatus } from "./doseStatus";

const T = "2026-09-30";

describe("doseStatus", () => {
  test("given wins over everything", () => {
    expect(doseStatus({ given: true, dueDate: "2026-01-01" }, T)).toBe("given");
    expect(doseStatus({ given: true, dueDate: null }, T)).toBe("given");
  });
  test("no due date → unscheduled", () => {
    expect(doseStatus({ given: false, dueDate: null }, T)).toBe("unscheduled");
  });
  test("past due → overdue", () => {
    expect(doseStatus({ given: false, dueDate: "2026-09-29" }, T)).toBe("overdue");
  });
  test("today through +7 days → dueSoon", () => {
    expect(doseStatus({ given: false, dueDate: T }, T)).toBe("dueSoon");
    expect(doseStatus({ given: false, dueDate: "2026-10-07" }, T)).toBe("dueSoon");
  });
  test("beyond 7 days → scheduled", () => {
    expect(doseStatus({ given: false, dueDate: "2026-10-08" }, T)).toBe("scheduled");
  });
});
```

`src/domain/upcoming.test.ts`:
```ts
import { expect, test } from "vitest";
import { groupUpcoming, type UpcomingItem } from "./upcoming";

const item = (id: string, date: string): UpcomingItem => ({ kind: "dose", id, childId: "c", date, title: id });

test("groups by overdue / next 7 days / later and sorts ascending", () => {
  const g = groupUpcoming(
    [item("later", "2026-11-01"), item("soon2", "2026-10-07"), item("od", "2026-09-01"), item("soon1", "2026-09-30"), item("l0", "2026-10-08")],
    "2026-09-30",
  );
  expect(g.overdue.map((i) => i.id)).toEqual(["od"]);
  expect(g.soon.map((i) => i.id)).toEqual(["soon1", "soon2"]);
  expect(g.later.map((i) => i.id)).toEqual(["l0", "later"]);
});

test("same day sorted by time, untimed first", () => {
  const a = { ...item("a", "2026-10-01"), time: "13:00" };
  const b = { ...item("b", "2026-10-01"), time: "09:00" };
  const c = item("c", "2026-10-01");
  expect(groupUpcoming([a, b, c], "2026-09-30").soon.map((i) => i.id)).toEqual(["c", "b", "a"]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/doseStatus.test.ts src/domain/upcoming.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/domain/doseStatus.ts`:
```ts
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
```

`src/domain/upcoming.ts`:
```ts
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

const byDateTime = (a: UpcomingItem, b: UpcomingItem) =>
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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(domain): dose status and upcoming grouping"
```

---

### Task 4: Schedule generation + vaccine templates

**Files:**
- Create: `src/domain/schedule.ts`, `src/data/epi.ts`, `src/data/customTemplates.ts`
- Test: `src/domain/schedule.test.ts`

**Interfaces:**
- Consumes: `addDaysISO`, `addMonthsISO`, `VaccineDose`, `SeriesSource`, `ISODate`.
- Produces:
  - `interface EpiTemplateItem { vaccineCode: string; vaccineName: string; doseNo: number; ageMonths: number }`
  - `interface DoseDraft { vaccineName: string; vaccineCode?: string; doseNo: number; dueDate: ISODate | null; given?: boolean; givenDate?: ISODate | null; givenDateUnknown?: boolean }`
  - `interface SeriesDraft { name: string; source: SeriesSource; templateKey?: string; reason?: string; doses: DoseDraft[] }`
  - `interface CustomTemplate { key: string; name: string; vaccineCode?: string; dayOffsets: number[] }`
  - `generateEpiSeries(items: EpiTemplateItem[], birthDate: ISODate): SeriesDraft[]` — one series per `vaccineCode`, in first-appearance order, `templateKey = "epi:<code>"`.
  - `generateCustomDoses(tpl: Pick<CustomTemplate,"name"|"vaccineCode"|"dayOffsets">, anchor: { doseNo: number; date: ISODate }): DoseDraft[]` — doses before the anchor are returned with `given: true, givenDate: <computed>, givenDateUnknown: false`; the anchor and later doses are pending with computed `dueDate`.
  - `shiftRemainingDoses(doses: Pick<VaccineDose,"id"|"doseNo"|"given"|"dueDate">[], fromDoseNo: number, days: number): { id: string; dueDate: ISODate }[]`
  - `EPI_TEMPLATE: EpiTemplateItem[]` from `@/data/epi`; `CUSTOM_TEMPLATES: CustomTemplate[]` from `@/data/customTemplates`.

- [ ] **Step 1: Write failing tests** — `src/domain/schedule.test.ts`

Tests use a small fixture, not the real EPI table, so they don't depend on it.

```ts
import { describe, expect, test } from "vitest";
import { generateCustomDoses, generateEpiSeries, shiftRemainingDoses, type EpiTemplateItem } from "./schedule";

const FIXTURE: EpiTemplateItem[] = [
  { vaccineCode: "BCG", vaccineName: "BCG", doseNo: 1, ageMonths: 0 },
  { vaccineCode: "OPV", vaccineName: "OPV", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "MMR", vaccineName: "MMR", doseNo: 1, ageMonths: 9 },
  { vaccineCode: "OPV", vaccineName: "OPV", doseNo: 2, ageMonths: 4 },
];

describe("generateEpiSeries", () => {
  test("groups by vaccineCode in first-appearance order with due dates from birth", () => {
    const s = generateEpiSeries(FIXTURE, "2025-01-31");
    expect(s.map((x) => x.name)).toEqual(["BCG", "OPV", "MMR"]);
    expect(s[1]).toMatchObject({ source: "epi", templateKey: "epi:OPV" });
    expect(s[1].doses).toEqual([
      { vaccineName: "OPV", vaccineCode: "OPV", doseNo: 1, dueDate: "2025-03-31" },
      { vaccineName: "OPV", vaccineCode: "OPV", doseNo: 2, dueDate: "2025-05-31" },
    ]);
    expect(s[0].doses[0].dueDate).toBe("2025-01-31");
  });
});

describe("generateCustomDoses", () => {
  const rabiesIM = { name: "พิษสุนัขบ้า", vaccineCode: "RABIES", dayOffsets: [0, 3, 7, 14, 28] };

  test("anchor on dose 1 schedules all doses", () => {
    const d = generateCustomDoses(rabiesIM, { doseNo: 1, date: "2026-09-29" });
    expect(d.map((x) => x.dueDate)).toEqual(["2026-09-29", "2026-10-02", "2026-10-06", "2026-10-13", "2026-10-27"]);
    expect(d.every((x) => !x.given)).toBe(true);
    expect(d[0]).toMatchObject({ vaccineName: "พิษสุนัขบ้า", vaccineCode: "RABIES", doseNo: 1 });
  });

  test("anchor on dose 2 marks dose 1 given with back-computed date", () => {
    const d = generateCustomDoses(rabiesIM, { doseNo: 2, date: "2026-10-02" });
    expect(d[0]).toMatchObject({ doseNo: 1, given: true, givenDate: "2026-09-29", givenDateUnknown: false, dueDate: "2026-09-29" });
    expect(d[1]).toMatchObject({ doseNo: 2, dueDate: "2026-10-02" });
    expect(d[1].given).toBeFalsy();
    expect(d[4].dueDate).toBe("2026-10-27");
  });
});

describe("shiftRemainingDoses", () => {
  test("shifts only later, pending, scheduled doses", () => {
    const doses = [
      { id: "a", doseNo: 1, given: true, dueDate: "2026-09-29" },
      { id: "b", doseNo: 2, given: true, dueDate: "2026-10-02" },
      { id: "c", doseNo: 3, given: false, dueDate: "2026-10-06" },
      { id: "d", doseNo: 4, given: false, dueDate: null },
      { id: "e", doseNo: 5, given: false, dueDate: "2026-10-27" },
    ];
    expect(shiftRemainingDoses(doses, 2, 2)).toEqual([
      { id: "c", dueDate: "2026-10-08" },
      { id: "e", dueDate: "2026-10-29" },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/schedule.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/domain/schedule.ts`

```ts
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
  const base = tpl.dayOffsets[anchor.doseNo - 1] ?? 0;
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/schedule.test.ts`
Expected: all PASS.

- [ ] **Step 5: Verify the Thai EPI schedule**

Look up the current schedule on the Department of Disease Control site (กรมควบคุมโรค, "ตารางการให้วัคซีนตามแผนงานสร้างเสริมภูมิคุ้มกันโรค" ฉบับล่าสุด, e.g. search `ddc.moph.go.th ตารางวัคซีน EPI 2568`). Compare with the draft below. Pay special attention to: IPV dose count, rotavirus dose count, the age for JE dose 1, and whether HPV/dT (school-age) should be included — **exclude anything given after 7 years** (out of scope for these children for now). Change the draft to match the source and record the source URL + edition in the file header comment. If the source can't be reached, keep the draft, write `// UNVERIFIED — check with the pink book / DDC` in the header, and tell the user.

- [ ] **Step 6: Write `src/data/epi.ts`** (draft — adjust per Step 5)

```ts
import type { EpiTemplateItem } from "@/domain/schedule";

// ตารางวัคซีนพื้นฐาน (EPI) กระทรวงสาธารณสุข — ถึงอายุ 7 ปี
// Source: <URL + ฉบับ/ปี ที่ตรวจแล้วใน Step 5>
// vaccineCode ใช้จับคู่กับผลอ่านสมุดชมพู (Plan 2) — ห้ามเปลี่ยนรหัสโดยไม่แก้ schema ใน worker
export const EPI_TEMPLATE: EpiTemplateItem[] = [
  { vaccineCode: "BCG", vaccineName: "วัณโรค (BCG)", doseNo: 1, ageMonths: 0 },
  { vaccineCode: "HB", vaccineName: "ตับอักเสบบี แรกเกิด (HB)", doseNo: 1, ageMonths: 0 },
  { vaccineCode: "DTP-HB-Hib", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ (DTP-HB-Hib)", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "DTP-HB-Hib", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ (DTP-HB-Hib)", doseNo: 2, ageMonths: 4 },
  { vaccineCode: "DTP-HB-Hib", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ (DTP-HB-Hib)", doseNo: 3, ageMonths: 6 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดหยอด (OPV)", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดหยอด (OPV)", doseNo: 2, ageMonths: 4 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดหยอด (OPV)", doseNo: 3, ageMonths: 6 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดหยอด (OPV)", doseNo: 4, ageMonths: 18 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดหยอด (OPV)", doseNo: 5, ageMonths: 48 },
  { vaccineCode: "IPV", vaccineName: "โปลิโอชนิดฉีด (IPV)", doseNo: 1, ageMonths: 4 },
  { vaccineCode: "ROTA", vaccineName: "โรต้า (Rota)", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "ROTA", vaccineName: "โรต้า (Rota)", doseNo: 2, ageMonths: 4 },
  { vaccineCode: "MMR", vaccineName: "หัด-คางทูม-หัดเยอรมัน (MMR)", doseNo: 1, ageMonths: 9 },
  { vaccineCode: "MMR", vaccineName: "หัด-คางทูม-หัดเยอรมัน (MMR)", doseNo: 2, ageMonths: 30 },
  { vaccineCode: "JE", vaccineName: "ไข้สมองอักเสบเจอี (LAJE)", doseNo: 1, ageMonths: 12 },
  { vaccineCode: "JE", vaccineName: "ไข้สมองอักเสบเจอี (LAJE)", doseNo: 2, ageMonths: 30 },
  { vaccineCode: "DTP", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน กระตุ้น (DTP)", doseNo: 1, ageMonths: 18 },
  { vaccineCode: "DTP", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน กระตุ้น (DTP)", doseNo: 2, ageMonths: 48 },
];
```

- [ ] **Step 7: Write `src/data/customTemplates.ts`**

```ts
import type { CustomTemplate } from "@/domain/schedule";

export const CUSTOM_TEMPLATES: CustomTemplate[] = [
  { key: "rabies-pep-im", name: "พิษสุนัขบ้า หลังสัมผัส (ฉีดเข้ากล้าม)", vaccineCode: "RABIES", dayOffsets: [0, 3, 7, 14, 28] },
  { key: "rabies-pep-id", name: "พิษสุนัขบ้า หลังสัมผัส (ฉีดเข้าผิวหนัง)", vaccineCode: "RABIES", dayOffsets: [0, 3, 7, 28] },
  { key: "flu", name: "ไข้หวัดใหญ่", vaccineCode: "FLU", dayOffsets: [0] },
  { key: "blank", name: "", dayOffsets: [0] },
];
```

- [ ] **Step 8: Typecheck + tests, commit**

Run: `npx tsc -b && npm test`
Expected: no type errors, all PASS.

```bash
git add src/domain src/data
git commit -m "feat(domain): EPI/custom schedule generation and vaccine templates"
```

---

### Task 5: Calendar export (.ics + Google Calendar link)

**Files:**
- Create: `src/domain/ics.ts`, `src/lib/download.ts`
- Test: `src/domain/ics.test.ts`

**Interfaces:**
- Consumes: `addDaysISO`, `ISODate`.
- Produces: `interface CalendarEvent { uid: string; title: string; date: ISODate; time?: string; location?: string; description?: string }`; `buildIcs(e: CalendarEvent, now?: Date): string`; `googleCalendarUrl(e: CalendarEvent): string`; `downloadText(filename: string, text: string, mime: string): void` (browser only, `src/lib/download.ts`).
- Timezone: Asia/Bangkok is fixed UTC+7 (no DST). Timed events are written in UTC (`...Z`), 1 hour long.

- [ ] **Step 1: Write failing tests** — `src/domain/ics.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { buildIcs, googleCalendarUrl } from "./ics";

const NOW = new Date(Date.UTC(2026, 8, 30, 2, 0, 0));

const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("buildIcs", () => {
  test("all-day event with two alarms", () => {
    const ics = buildIcs({ uid: "dose-abc", title: "น้องมะลิ: พิษสุนัขบ้า เข็ม 2", date: "2026-10-02", location: "รพ.เมือง" }, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const u = unfold(ics);
    expect(u).toContain("UID:dose-abc@kidcare");
    expect(u).toContain("DTSTAMP:20260930T020000Z");
    expect(u).toContain("DTSTART;VALUE=DATE:20261002");
    expect(u).toContain("DTEND;VALUE=DATE:20261003");
    expect(u).toContain("SUMMARY:น้องมะลิ: พิษสุนัขบ้า เข็ม 2");
    expect(u).toContain("TRIGGER:-P1D");
    expect(u).toContain("TRIGGER:PT7H");
    expect(u.match(/BEGIN:VALARM/g)).toHaveLength(2);
  });

  test("timed event converts Bangkok to UTC and alarms at 07:00 local", () => {
    const u = unfold(buildIcs({ uid: "appt-1", title: "นัดหมอ", date: "2026-10-02", time: "09:30" }, NOW));
    expect(u).toContain("DTSTART:20261002T023000Z");
    expect(u).toContain("DTEND:20261002T033000Z");
    expect(u).toContain("TRIGGER;VALUE=DATE-TIME:20261002T000000Z");
  });

  test("escapes special characters", () => {
    const u = unfold(buildIcs({ uid: "x", title: "a,b;c\\d", date: "2026-10-02", description: "l1\nl2" }, NOW));
    expect(u).toContain("SUMMARY:a\\,b\\;c\\\\d");
    expect(u).toContain("DESCRIPTION:l1\\nl2");
  });

  test("folds lines longer than 75 bytes", () => {
    const ics = buildIcs({ uid: "x", title: "ก".repeat(60), date: "2026-10-02" }, NOW);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain("SUMMARY:" + "ก".repeat(60));
  });
});

describe("googleCalendarUrl", () => {
  test("all-day uses date range with exclusive end", () => {
    const url = new URL(googleCalendarUrl({ uid: "x", title: "นัด", date: "2026-10-02", location: "รพ." }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("นัด");
    expect(url.searchParams.get("dates")).toBe("20261002/20261003");
    expect(url.searchParams.get("location")).toBe("รพ.");
  });
  test("timed uses UTC range", () => {
    const url = new URL(googleCalendarUrl({ uid: "x", title: "นัด", date: "2026-10-02", time: "09:30" }));
    expect(url.searchParams.get("dates")).toBe("20261002T023000Z/20261002T033000Z");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/ics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/domain/ics.ts`

```ts
import type { ISODate } from "@/types";
import { addDaysISO } from "./dates";

export interface CalendarEvent {
  uid: string;
  title: string;
  date: ISODate;
  time?: string; // "HH:mm" Asia/Bangkok
  location?: string;
  description?: string;
}

const BKK_OFFSET_H = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const compactDate = (iso: ISODate) => iso.replace(/-/g, "");

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function bangkokToUtc(date: ISODate, time: string, addHours = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - BKK_OFFSET_H + addHours, mm));
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  const enc = new TextEncoder();
  let out = "";
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) {
      out += cur + "\r\n ";
      cur = "";
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  return out + cur;
}

export function buildIcs(e: CalendarEvent, now: Date = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KidCare//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@kidcare`,
    `DTSTAMP:${utcStamp(now)}`,
  ];
  if (e.time) {
    lines.push(`DTSTART:${utcStamp(bangkokToUtc(e.date, e.time))}`);
    lines.push(`DTEND:${utcStamp(bangkokToUtc(e.date, e.time, 1))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDaysISO(e.date, 1))}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc("พรุ่งนี้: " + e.title)}`, "TRIGGER:-P1D", "END:VALARM");
  const morning = e.time ? `TRIGGER;VALUE=DATE-TIME:${utcStamp(bangkokToUtc(e.date, "07:00"))}` : "TRIGGER:PT7H";
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc("วันนี้: " + e.title)}`, morning, "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const dates = e.time
    ? `${utcStamp(bangkokToUtc(e.date, e.time))}/${utcStamp(bangkokToUtc(e.date, e.time, 1))}`
    : `${compactDate(e.date)}/${compactDate(addDaysISO(e.date, 1))}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates });
  if (e.location) params.set("location", e.location);
  if (e.description) params.set("details", e.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

- [ ] **Step 4: Write `src/lib/download.ts`**

```ts
export function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain src/lib
git commit -m "feat(domain): .ics builder and Google Calendar link"
```

---

### Task 6: Form validation schemas

**Files:**
- Create: `src/domain/validation.ts`
- Test: `src/domain/validation.test.ts`

**Interfaces:**
- Consumes: `ChildInput`, `AllergyInput`, `ISODate`.
- Produces: `childSchema(today: ISODate)` (zod object → `ChildInput`), `allergySchema` (→ `AllergyInput`), `appointmentSchema` (→ `{ childId, date, time?, place, purpose, notes? }`), `validateGivenDate(givenDate: ISODate, birthDate: ISODate, today: ISODate): string | null` (Thai error text or null), `firstError(result: z.SafeParseReturnType<unknown, unknown>): string | null`.

- [ ] **Step 1: Write failing tests** — `src/domain/validation.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { allergySchema, appointmentSchema, childSchema, firstError, validateGivenDate } from "./validation";

const T = "2026-09-30";

describe("childSchema", () => {
  const ok = { name: "มะลิ", nickname: "", birthDate: "2023-07-01", sex: "F", bloodType: "", hospitals: [{ name: "รพ.เมือง", hn: "6918843" }] };
  test("accepts valid input and trims", () => {
    const r = childSchema(T).safeParse({ ...ok, name: "  มะลิ " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("มะลิ");
  });
  test("rejects future birth date", () => {
    const r = childSchema(T).safeParse({ ...ok, birthDate: "2026-10-01" });
    expect(firstError(r)).toBe("วันเกิดต้องไม่อยู่ในอนาคต");
  });
  test("rejects empty name and bad date format", () => {
    expect(firstError(childSchema(T).safeParse({ ...ok, name: " " }))).toBe("กรุณาใส่ชื่อ");
    expect(childSchema(T).safeParse({ ...ok, birthDate: "1/7/2566" }).success).toBe(false);
  });
  test("rejects hospital row missing HN", () => {
    expect(childSchema(T).safeParse({ ...ok, hospitals: [{ name: "รพ.", hn: "" }] }).success).toBe(false);
  });
});

test("allergySchema requires substance", () => {
  expect(firstError(allergySchema.safeParse({ type: "drug", substance: "", reaction: "ผื่น", severity: "mild" }))).toBe("กรุณาใส่ชื่อยา/อาหารที่แพ้");
  expect(allergySchema.safeParse({ type: "drug", substance: "Amoxicillin", reaction: "ผื่น", severity: "severe" }).success).toBe(true);
});

test("appointmentSchema validates time format", () => {
  const base = { childId: "c1", date: "2026-10-02", place: "รพ.", purpose: "ตรวจตามนัด" };
  expect(appointmentSchema.safeParse(base).success).toBe(true);
  expect(appointmentSchema.safeParse({ ...base, time: "09:30" }).success).toBe(true);
  expect(appointmentSchema.safeParse({ ...base, time: "9.30" }).success).toBe(false);
});

describe("validateGivenDate", () => {
  test("before birth", () => expect(validateGivenDate("2023-06-30", "2023-07-01", T)).toBe("วันที่ฉีดต้องไม่ก่อนวันเกิด"));
  test("in future", () => expect(validateGivenDate("2026-10-01", "2023-07-01", T)).toBe("วันที่ฉีดต้องไม่อยู่ในอนาคต"));
  test("ok", () => expect(validateGivenDate("2026-09-30", "2023-07-01", T)).toBeNull());
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/domain/validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/domain/validation.ts`

```ts
import { z } from "zod";
import type { ISODate } from "@/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const optText = z.string().trim().optional().transform((v) => (v ? v : undefined));

export const childSchema = (today: ISODate) =>
  z.object({
    name: z.string().trim().min(1, "กรุณาใส่ชื่อ"),
    nickname: optText,
    birthDate: isoDate.refine((d) => d <= today, "วันเกิดต้องไม่อยู่ในอนาคต"),
    sex: z.enum(["M", "F"]),
    bloodType: optText,
    hospitals: z.array(
      z.object({
        name: z.string().trim().min(1, "กรุณาใส่ชื่อโรงพยาบาล"),
        hn: z.string().trim().min(1, "กรุณาใส่ HN"),
      }),
    ),
  });

export const allergySchema = z.object({
  type: z.enum(["drug", "food", "other"]),
  substance: z.string().trim().min(1, "กรุณาใส่ชื่อยา/อาหารที่แพ้"),
  reaction: z.string().trim().min(1, "กรุณาใส่อาการที่แพ้"),
  severity: z.enum(["mild", "moderate", "severe"]),
  notes: optText,
});

export const appointmentSchema = z.object({
  childId: z.string().min(1, "กรุณาเลือกลูก"),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง").optional(),
  place: z.string().trim().min(1, "กรุณาใส่สถานที่"),
  purpose: z.string().trim().min(1, "กรุณาใส่เรื่องที่นัด"),
  notes: optText,
});

export function validateGivenDate(givenDate: ISODate, birthDate: ISODate, today: ISODate): string | null {
  if (givenDate < birthDate) return "วันที่ฉีดต้องไม่ก่อนวันเกิด";
  if (givenDate > today) return "วันที่ฉีดต้องไม่อยู่ในอนาคต";
  return null;
}

export function firstError(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : result.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat(domain): zod form validation"
```

---

### Task 7: Firebase project, security rules and rules tests

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `vitest.rules.config.ts`, `tests/rules/firestore.rules.test.ts`, `.env.local` (not committed)

**Interfaces:**
- Produces: deployed-ready rules implementing spec §8; `npm run test:rules`.

- [ ] **Step 1: Create the Firebase project (needs the user)**

Ask the user to do this in the Firebase console (it needs their Google account), or run it with them:
1. Create a project, e.g. `kidcare-<suffix>` (Spark plan, Analytics off).
2. Build → Firestore Database → Create database → production mode → region `asia-southeast1`.
3. Build → Authentication → Get started → enable **Google**.
4. Project settings → Your apps → Web app "KidCare" → copy the config into `.env.local` (keys from `.env.example`).
5. Tell you the project id.

- [ ] **Step 2: Write Firebase config files**

`.firebaserc` (replace with real id):
```json
{ "projects": { "default": "kidcare-xxxx" } }
```

`firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "emulators": { "firestore": { "port": 8080 } }
}
```

`firestore.indexes.json`:
```json
{ "indexes": [], "fieldOverrides": [] }
```

- [ ] **Step 3: Write the failing rules tests**

`vitest.rules.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["tests/rules/**/*.test.ts"], testTimeout: 20000, fileParallelism: false },
});
```

`tests/rules/firestore.rules.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";

let env: RulesTestEnvironment;
const FID = "fam1";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-kidcare",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "families", FID), { name: "F", ownerUid: "alice", memberUids: ["alice", "bob"] });
    await setDoc(doc(db, "families", FID, "children", "c1"), { name: "มะลิ" });
    await setDoc(doc(db, "families", FID, "children", "c1", "vaccineDoses", "d1"), { familyId: FID, childId: "c1", given: false });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("users", () => {
  test("own doc only", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users", "alice"), { familyId: FID }));
    await assertFails(getDoc(doc(as("alice"), "users", "bob")));
  });
});

describe("families", () => {
  test("create own family as sole member (batched with user doc)", async () => {
    const db = as("carol");
    const b = writeBatch(db);
    b.set(doc(db, "families", "fam2"), { name: "C", ownerUid: "carol", memberUids: ["carol"] });
    b.set(doc(db, "users", "carol"), { familyId: "fam2" });
    await assertSucceeds(b.commit());
  });
  test("cannot create family listing other members", async () => {
    await assertFails(setDoc(doc(as("carol"), "families", "fam3"), { name: "C", ownerUid: "carol", memberUids: ["carol", "alice"] }));
  });
  test("members read, outsiders cannot", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "families", FID)));
    await assertFails(getDoc(doc(as("mallory"), "families", FID)));
  });
  test("only owner changes memberUids; nobody changes ownerUid", async () => {
    await assertFails(updateDoc(doc(as("bob"), "families", FID), { memberUids: ["bob"] }));
    await assertSucceeds(updateDoc(doc(as("bob"), "families", FID), { name: "ใหม่" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "families", FID), { memberUids: ["alice", "bob", "dan"] }));
    await assertFails(updateDoc(doc(as("alice"), "families", FID), { ownerUid: "bob" }));
  });
});

describe("children subtree", () => {
  test("members read/write, outsiders cannot", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "families", FID, "children", "c1")));
    await assertSucceeds(setDoc(doc(as("bob"), "families", FID, "children", "c1", "allergies", "a1"), { substance: "x" }));
    await assertFails(getDoc(doc(as("mallory"), "families", FID, "children", "c1")));
    await assertFails(getDocs(collection(as("mallory"), "families", FID, "children", "c1", "allergies")));
  });
  test("dose writes must carry matching familyId and childId", async () => {
    const col = ["families", FID, "children", "c1", "vaccineDoses"] as const;
    await assertSucceeds(setDoc(doc(as("alice"), ...col, "d2"), { familyId: FID, childId: "c1", given: false }));
    await assertFails(setDoc(doc(as("alice"), ...col, "d3"), { familyId: "other", childId: "c1", given: false }));
    await assertFails(setDoc(doc(as("alice"), ...col, "d4"), { familyId: FID, childId: "c9", given: false }));
  });
  test("pending-dose query per child works for members", async () => {
    const q = query(collection(as("bob"), "families", FID, "children", "c1", "vaccineDoses"), where("given", "==", false));
    await assertSucceeds(getDocs(q));
  });
  test("appointments need matching familyId", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "families", FID, "appointments", "p1"), { familyId: FID, childId: "c1" }));
    await assertFails(setDoc(doc(as("alice"), "families", FID, "appointments", "p2"), { familyId: "x", childId: "c1" }));
    await assertFails(getDoc(doc(as("mallory"), "families", FID, "appointments", "p1")));
  });
});
```

- [ ] **Step 4: Run to verify failure**

Prereq: Java 11+ (`java -version`). If missing, ask the user to install a JDK (e.g. Temurin 21) — don't install it silently.

Create an empty placeholder so the emulator starts: `printf "rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents { match /{d=**} { allow read, write: if false; } } }\n" > firestore.rules`

Run: `npm run test:rules` (uses the offline `demo-kidcare` emulator project — no real Firebase project needed)
Expected: FAIL (the `assertSucceeds` cases fail against deny-all rules).

- [ ] **Step 5: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isMember(fid) {
      return signedIn()
        && request.auth.uid in get(/databases/$(database)/documents/families/$(fid)).data.memberUids;
    }

    match /users/{uid} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }

    match /families/{fid} {
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.memberUids == [request.auth.uid];
      allow read: if signedIn() && request.auth.uid in resource.data.memberUids;
      allow update: if signedIn()
        && request.auth.uid in resource.data.memberUids
        && request.resource.data.ownerUid == resource.data.ownerUid
        && (request.resource.data.memberUids == resource.data.memberUids
            || request.auth.uid == resource.data.ownerUid);
      allow delete: if false;

      match /appointments/{id} {
        allow read, delete: if isMember(fid);
        allow create, update: if isMember(fid) && request.resource.data.familyId == fid;
      }

      match /children/{cid} {
        allow read, write: if isMember(fid);

        match /allergies/{id} {
          allow read, write: if isMember(fid);
        }
        match /vaccineSeries/{id} {
          allow read, write: if isMember(fid);
        }
        match /vaccineDoses/{id} {
          allow read, delete: if isMember(fid);
          allow create, update: if isMember(fid)
            && request.resource.data.familyId == fid
            && request.resource.data.childId == cid;
        }
      }
    }
  }
}
```

- [ ] **Step 6: Run rules tests**

Run: `npm run test:rules`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add firebase.json .firebaserc firestore.rules firestore.indexes.json vitest.rules.config.ts tests package.json
git commit -m "feat: Firestore security rules with emulator tests"
```

---

### Task 8: Firebase client, auth, family bootstrap, data hooks, app shell

**Files:**
- Create: `src/lib/firebase.ts`, `src/lib/auth.ts`, `src/lib/fire.ts`, `src/lib/paths.ts`, `src/lib/repo/family.ts`, `src/hooks/useAuth.ts`, `src/hooks/useFamilyId.ts`, `src/hooks/useCollection.ts`, `src/hooks/useOnline.ts`, `src/components/Layout.tsx`, `src/components/RequireFamily.tsx`, `src/components/ErrorState.tsx`, `src/pages/Login.tsx`, `src/pages/Settings.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  - `db`, `auth`, `googleProvider` from `@/lib/firebase`
  - `loginGoogle(): Promise<void>`, `logout(): Promise<void>` from `@/lib/auth`
  - `fire(p: Promise<unknown>, msg?: string): void` from `@/lib/fire`
  - `familyDoc(fid)`, `childrenCol(fid)`, `childDoc(fid, cid)`, `childSub(fid, cid, name: "allergies" | "vaccineSeries" | "vaccineDoses")`, `appointmentsCol(fid)` from `@/lib/paths`
  - `ensureFamily(user: User): Promise<string>`, `renameFamily(fid, name): void` from `@/lib/repo/family`
  - `useAuth(): { user: User | null; loading: boolean }`
  - `useFamilyId(): string` (only valid inside `<RequireFamily>`), `useFamilyStore` (zustand: `{ familyId: string | null; setFamilyId(id: string | null) }`)
  - `useCollection<T>(q: Query | null, key: string): { data: T[]; loading: boolean; error: FirestoreError | null }`, `useDocument<T>(ref: DocumentReference | null, key: string): { data: T | null; loading: boolean; error: FirestoreError | null }`
  - `useOnline(): boolean`
  - `<ErrorState error={FirestoreError} />`

- [ ] **Step 1: Write `src/lib/firebase.ts`**

```ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// offline cache — ใช้งานได้ตอนสัญญาณไม่ดีใน รพ.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

- [ ] **Step 2: Write `src/lib/auth.ts`, `src/lib/fire.ts`, `src/lib/paths.ts`**

`src/lib/auth.ts`:
```ts
import { browserLocalPersistence, setPersistence, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

setPersistence(auth, browserLocalPersistence).catch(() => {});

export async function loginGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export const logout = () => signOut(auth);
```

`src/lib/fire.ts`:
```ts
/** ยิง write แบบไม่รอ (offline write จะ resolve ตอน server ตอบรับเท่านั้น) — แจ้งเตือนเมื่อพลาด */
export function fire(p: Promise<unknown>, msg = "บันทึกไม่สำเร็จ") {
  p.catch((err: { code?: string; message?: string }) => {
    console.error(err);
    alert(`${msg}: ${err?.code ?? err?.message ?? "unknown"}`);
  });
}
```

`src/lib/paths.ts`:
```ts
import { collection, doc } from "firebase/firestore";
import { db } from "./firebase";

export const familyDoc = (fid: string) => doc(db, "families", fid);
export const childrenCol = (fid: string) => collection(db, "families", fid, "children");
export const childDoc = (fid: string, cid: string) => doc(db, "families", fid, "children", cid);
export const childSub = (fid: string, cid: string, name: "allergies" | "vaccineSeries" | "vaccineDoses") =>
  collection(db, "families", fid, "children", cid, name);
export const appointmentsCol = (fid: string) => collection(db, "families", fid, "appointments");
```

- [ ] **Step 3: Write `src/lib/repo/family.ts`**

```ts
import type { User } from "firebase/auth";
import { collection, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { fire } from "../fire";
import { familyDoc } from "../paths";

/** คืน familyId ของผู้ใช้ ถ้ายังไม่มีจะสร้าง family ใหม่ที่มีผู้ใช้เป็น owner (ต้องออนไลน์ครั้งแรก) */
export async function ensureFamily(user: User): Promise<string> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? (snap.data().familyId as string | undefined) : undefined;
  if (existing) return existing;

  const famRef = doc(collection(db, "families"));
  const batch = writeBatch(db);
  batch.set(famRef, { name: "ครอบครัวของฉัน", ownerUid: user.uid, memberUids: [user.uid], createdAt: serverTimestamp() });
  batch.set(userRef, { familyId: famRef.id, displayName: user.displayName ?? "", email: user.email ?? "" }, { merge: true });
  await batch.commit();
  return famRef.id;
}

export function renameFamily(fid: string, name: string) {
  fire(updateDoc(familyDoc(fid), { name }));
}
```

- [ ] **Step 4: Write hooks**

`src/hooks/useAuth.ts`:
```ts
import { useEffect } from "react";
import { create } from "zustand";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  set: (u: User | null) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  set: (user) => set({ user, loading: false }),
}));

let initialized = false;

export function useAuth() {
  const { user, loading, set } = useAuthStore();
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    onAuthStateChanged(auth, (u) => set(u));
  }, [set]);
  return { user, loading };
}
```

`src/hooks/useFamilyId.ts`:
```ts
import { create } from "zustand";

interface FamilyState {
  familyId: string | null;
  setFamilyId: (id: string | null) => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  familyId: null,
  setFamilyId: (familyId) => set({ familyId }),
}));

/** ใช้ได้เฉพาะภายใต้ <RequireFamily> */
export function useFamilyId(): string {
  const id = useFamilyStore((s) => s.familyId);
  if (!id) throw new Error("useFamilyId used outside <RequireFamily>");
  return id;
}

export const familyCacheKey = (uid: string) => `kidcare.familyId.${uid}`;
```

`src/hooks/useCollection.ts`:
```ts
import { useEffect, useState } from "react";
import { onSnapshot, type DocumentReference, type FirestoreError, type Query } from "firebase/firestore";

export function useCollection<T>(q: Query | null, key: string) {
  const [state, setState] = useState<{ data: T[]; loading: boolean; error: FirestoreError | null }>({
    data: [],
    loading: q !== null,
    error: null,
  });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useDocument<T>(ref: DocumentReference | null, key: string) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: FirestoreError | null }>({
    data: null,
    loading: ref !== null,
    error: null,
  });
  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      ref,
      (snap) => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
```

`src/hooks/useOnline.ts`:
```ts
import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
```

- [ ] **Step 5: Write shell components**

`src/components/ErrorState.tsx`:
```tsx
import type { FirestoreError } from "firebase/firestore";
import { Link } from "react-router-dom";

export default function ErrorState({ error }: { error: FirestoreError }) {
  const denied = error.code === "permission-denied";
  return (
    <div className="rounded-lg border border-destructive/50 p-4 text-sm">
      <p className="font-semibold">{denied ? "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" : "โหลดข้อมูลไม่สำเร็จ"}</p>
      <p className="text-muted-foreground">{error.code}</p>
      <Link to="/" className="mt-2 inline-block underline">กลับหน้าแรก</Link>
    </div>
  );
}
```

`src/components/RequireFamily.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { familyCacheKey, useFamilyStore } from "@/hooks/useFamilyId";
import { ensureFamily } from "@/lib/repo/family";

export default function RequireFamily({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { familyId, setFamilyId } = useFamilyStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || familyId) return;
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(familyCacheKey(user.uid));
    } catch {
      /* private mode */
    }
    if (cached) {
      setFamilyId(cached);
      return;
    }
    ensureFamily(user)
      .then((id) => {
        try {
          localStorage.setItem(familyCacheKey(user.uid), id);
        } catch {
          /* ignore */
        }
        setFamilyId(id);
      })
      .catch((e) => setError(e?.code ?? String(e)));
  }, [user, familyId, setFamilyId]);

  if (loading) return <p className="p-6 text-muted-foreground">กำลังโหลด…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) return <p className="p-6">ตั้งค่าครอบครัวไม่สำเร็จ ({error}) — ต้องต่ออินเทอร์เน็ตในการเข้าใช้ครั้งแรก</p>;
  if (!familyId) return <p className="p-6 text-muted-foreground">กำลังเตรียมข้อมูลครอบครัว…</p>;
  return <>{children}</>;
}
```

`src/components/Layout.tsx`:
```tsx
import { Link, Outlet } from "react-router-dom";
import { Settings, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

export default function Layout() {
  const online = useOnline();
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-lg font-bold">KidCare</Link>
        <div className="flex items-center gap-3">
          {!online && (
            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              <WifiOff size={14} /> ออฟไลน์ — รอซิงก์
            </span>
          )}
          <Link to="/settings" aria-label="ตั้งค่า"><Settings size={20} /></Link>
        </div>
      </header>
      <main className="space-y-4 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/pages/Login.tsx` and `src/pages/Settings.tsx`**

`src/pages/Login.tsx`:
```tsx
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { loginGoogle } from "@/lib/auth";

export default function Login() {
  const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-3xl font-bold">KidCare</h1>
        <p className="text-muted-foreground">สมุดสุขภาพลูก — วัคซีน การแพ้ยา นัดหมอ</p>
      </div>
      <Button onClick={() => loginGoogle().catch((e) => setErr(e?.code ?? String(e)))}>เข้าสู่ระบบด้วย Google</Button>
      {err && <p className="text-sm text-destructive">เข้าสู่ระบบไม่สำเร็จ: {err}</p>}
    </div>
  );
}
```

`src/pages/Settings.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { useDocument } from "@/hooks/useCollection";
import { familyCacheKey, useFamilyId, useFamilyStore } from "@/hooks/useFamilyId";
import { logout } from "@/lib/auth";
import { familyDoc } from "@/lib/paths";
import { renameFamily } from "@/lib/repo/family";
import type { Family } from "@/types";

export default function Settings() {
  const fid = useFamilyId();
  const { user } = useAuth();
  const setFamilyId = useFamilyStore((s) => s.setFamilyId);
  const { data: family, error } = useDocument<Family>(familyDoc(fid), `family/${fid}`);
  const [name, setName] = useState("");
  useEffect(() => setName(family?.name ?? ""), [family?.name]);

  if (error) return <ErrorState error={error} />;

  async function onLogout() {
    try {
      if (user) localStorage.removeItem(familyCacheKey(user.uid));
    } catch {
      /* ignore */
    }
    setFamilyId(null);
    await logout();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ตั้งค่า</h1>
      <div className="space-y-2">
        <Label htmlFor="fname">ชื่อครอบครัว</Label>
        <div className="flex gap-2">
          <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || name === family?.name} onClick={() => renameFamily(fid, name.trim())}>บันทึก</Button>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-semibold">สมาชิก ({family?.memberUids.length ?? 0})</p>
        <p className="text-muted-foreground">คุณ: {user?.email}</p>
        <p className="text-muted-foreground">การเชิญสมาชิกเพิ่มจะมาในเวอร์ชันถัดไป</p>
      </div>
      <Button variant="outline" onClick={onLogout}>ออกจากระบบ</Button>
    </div>
  );
}
```

- [ ] **Step 7: Replace `src/App.tsx`** (routes for later tasks are added as those pages are created; start with these)

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import RequireFamily from "@/components/RequireFamily";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";

function HomePlaceholder() {
  return <p>ยังไม่มีข้อมูล</p>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireFamily>
            <Layout />
          </RequireFamily>
        }
      >
        <Route path="/" element={<HomePlaceholder />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 8: Verify in browser**

Run `npx tsc -b` (expect no errors). Start the dev server via the preview tool (add `.claude/launch.json` config `{ "name": "kidcare", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }`). Check: `/` redirects to `/login`; after the **user** signs in with Google, the header shows and `/settings` shows family name "ครอบครัวของฉัน" and 1 member. In the Firebase console, `families/<id>` and `users/<uid>` exist. No console errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Firebase client, Google login, family bootstrap, app shell"
```

---

### Task 9: Repositories and data hooks

**Files:**
- Create: `src/lib/repo/children.ts`, `src/lib/repo/allergies.ts`, `src/lib/repo/vaccines.ts`, `src/lib/repo/appointments.ts`, `src/hooks/data.ts`

**Interfaces:**
- Consumes: `fire`, paths (Task 8); `SeriesDraft`, `DoseDraft`, `generateEpiSeries` (Task 4); `EPI_TEMPLATE`; types (Task 2).
- Produces:
  - `createChild(fid, input: ChildInput): string` (returns new id), `updateChild(fid, cid, input: ChildInput): void`
  - `saveAllergy(fid, cid, input: AllergyInput, id?: string): void`, `deleteAllergy(fid, cid, id): void`
  - `createSeriesWithDoses(fid, cid, s: SeriesDraft): string`, `createEpiSeries(fid, cid, birthDate): void`, `updateDose(fid, cid, doseId, patch: Partial<Omit<VaccineDose,"id"|"familyId"|"childId">>): void`, `applyDueDates(fid, cid, updates: {id: string; dueDate: ISODate}[]): void`, `markDosesGiven(fid, cid, items: {id: string; givenDate: ISODate | null}[]): void`, `deleteSeries(fid, cid, seriesId, doseIds: string[]): void`
  - `saveAppointment(fid, input: AppointmentInput, id?: string): void`, `setAppointmentDone(fid, id, done: boolean): void`, `deleteAppointment(fid, id): void`
  - Hooks: `useChildren(fid)`, `useChild(fid, cid)`, `useAllergies(fid, cid)`, `useSeries(fid, cid)`, `useDoses(fid, cid)` (sorted by doseNo), `useOpenAppointments(fid)` (done == false), `usePendingDoses(fid, childIds: string[]): { data: VaccineDose[]; error: FirestoreError | null }`

- [ ] **Step 1: Write repos**

`src/lib/repo/children.ts`:
```ts
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { ChildInput } from "@/types";
import { fire } from "../fire";
import { childDoc, childrenCol } from "../paths";

export function createChild(fid: string, input: ChildInput): string {
  const ref = doc(childrenCol(fid));
  fire(setDoc(ref, { ...input, createdAt: serverTimestamp() }));
  return ref.id;
}

export function updateChild(fid: string, cid: string, input: ChildInput) {
  fire(updateDoc(childDoc(fid, cid), { ...input }));
}
```

`src/lib/repo/allergies.ts`:
```ts
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import type { AllergyInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function saveAllergy(fid: string, cid: string, input: AllergyInput, id?: string) {
  const col = childSub(fid, cid, "allergies");
  const ref = id ? doc(col, id) : doc(col);
  fire(setDoc(ref, input));
}

export function deleteAllergy(fid: string, cid: string, id: string) {
  fire(deleteDoc(doc(childSub(fid, cid, "allergies"), id)), "ลบไม่สำเร็จ");
}
```

`src/lib/repo/vaccines.ts`:
```ts
import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { EPI_TEMPLATE } from "@/data/epi";
import { generateEpiSeries, type DoseDraft, type SeriesDraft } from "@/domain/schedule";
import type { ISODate, VaccineDose } from "@/types";
import { db } from "../firebase";
import { fire } from "../fire";
import { childSub } from "../paths";

function newDoseDoc(fid: string, cid: string, seriesId: string, d: DoseDraft): Omit<VaccineDose, "id"> {
  return {
    familyId: fid,
    childId: cid,
    seriesId,
    vaccineName: d.vaccineName,
    vaccineCode: d.vaccineCode ?? null,
    doseNo: d.doseNo,
    dueDate: d.dueDate,
    given: d.given ?? false,
    givenDate: d.givenDate ?? null,
    givenDateUnknown: d.givenDateUnknown ?? false,
    source: "manual",
  };
}

export function createSeriesWithDoses(fid: string, cid: string, s: SeriesDraft): string {
  const batch = writeBatch(db);
  const seriesRef = doc(childSub(fid, cid, "vaccineSeries"));
  batch.set(seriesRef, { name: s.name, source: s.source, templateKey: s.templateKey, reason: s.reason, createdAt: serverTimestamp() });
  for (const d of s.doses) {
    batch.set(doc(childSub(fid, cid, "vaccineDoses")), newDoseDoc(fid, cid, seriesRef.id, d));
  }
  fire(batch.commit());
  return seriesRef.id;
}

export function createEpiSeries(fid: string, cid: string, birthDate: ISODate) {
  for (const s of generateEpiSeries(EPI_TEMPLATE, birthDate)) createSeriesWithDoses(fid, cid, s);
}

export function updateDose(
  fid: string,
  cid: string,
  doseId: string,
  patch: Partial<Omit<VaccineDose, "id" | "familyId" | "childId">>,
) {
  // familyId/childId ส่งซ้ำเพื่อให้ผ่าน rules (request.resource.data ต้องมี)
  fire(updateDoc(doc(childSub(fid, cid, "vaccineDoses"), doseId), { ...patch, familyId: fid, childId: cid }));
}

export function applyDueDates(fid: string, cid: string, updates: { id: string; dueDate: ISODate }[]) {
  if (!updates.length) return;
  const batch = writeBatch(db);
  for (const u of updates) batch.update(doc(childSub(fid, cid, "vaccineDoses"), u.id), { dueDate: u.dueDate });
  fire(batch.commit());
}

export function markDosesGiven(fid: string, cid: string, items: { id: string; givenDate: ISODate | null }[]) {
  if (!items.length) return;
  const batch = writeBatch(db);
  for (const it of items) {
    batch.update(doc(childSub(fid, cid, "vaccineDoses"), it.id), {
      given: true,
      givenDate: it.givenDate,
      givenDateUnknown: it.givenDate === null,
    });
  }
  fire(batch.commit());
}

export function deleteSeries(fid: string, cid: string, seriesId: string, doseIds: string[]) {
  const batch = writeBatch(db);
  for (const id of doseIds) batch.delete(doc(childSub(fid, cid, "vaccineDoses"), id));
  batch.delete(doc(childSub(fid, cid, "vaccineSeries"), seriesId));
  fire(batch.commit(), "ลบไม่สำเร็จ");
}
```

Note: `batch.update` merges into the existing doc, so `request.resource.data` still contains `familyId`/`childId` and passes the rules; `updateDoc` in `updateDose` passes them explicitly for clarity.

`src/lib/repo/appointments.ts`:
```ts
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import type { AppointmentInput } from "@/types";
import { fire } from "../fire";
import { appointmentsCol } from "../paths";

export function saveAppointment(fid: string, input: AppointmentInput, id?: string) {
  const col = appointmentsCol(fid);
  const ref = id ? doc(col, id) : doc(col);
  fire(setDoc(ref, { ...input, familyId: fid }));
}

export function setAppointmentDone(fid: string, id: string, done: boolean) {
  fire(updateDoc(doc(appointmentsCol(fid), id), { done, familyId: fid }));
}

export function deleteAppointment(fid: string, id: string) {
  fire(deleteDoc(doc(appointmentsCol(fid), id)), "ลบไม่สำเร็จ");
}
```

- [ ] **Step 2: Write `src/hooks/data.ts`**

```ts
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, where, type FirestoreError } from "firebase/firestore";
import type { Allergy, Appointment, Child, VaccineDose, VaccineSeries } from "@/types";
import { appointmentsCol, childDoc, childSub, childrenCol } from "@/lib/paths";
import { useCollection, useDocument } from "./useCollection";

export function useChildren(fid: string) {
  return useCollection<Child>(query(childrenCol(fid), orderBy("birthDate")), `children/${fid}`);
}

export function useChild(fid: string, cid: string) {
  return useDocument<Child>(childDoc(fid, cid), `child/${fid}/${cid}`);
}

export function useAllergies(fid: string, cid: string) {
  return useCollection<Allergy>(childSub(fid, cid, "allergies"), `allergies/${fid}/${cid}`);
}

export function useSeries(fid: string, cid: string) {
  return useCollection<VaccineSeries>(childSub(fid, cid, "vaccineSeries"), `series/${fid}/${cid}`);
}

export function useDoses(fid: string, cid: string) {
  const r = useCollection<VaccineDose>(childSub(fid, cid, "vaccineDoses"), `doses/${fid}/${cid}`);
  const data = useMemo(() => [...r.data].sort((a, b) => a.doseNo - b.doseNo), [r.data]);
  return { ...r, data };
}

export function useOpenAppointments(fid: string) {
  return useCollection<Appointment>(query(appointmentsCol(fid), where("done", "==", false)), `appts/${fid}`);
}

/** เข็มที่ยังไม่ฉีดของลูกทุกคน (query ต่อเด็ก 1 คน) */
export function usePendingDoses(fid: string, childIds: string[]) {
  const key = childIds.join(",");
  const [byChild, setByChild] = useState<Record<string, VaccineDose[]>>({});
  const [error, setError] = useState<FirestoreError | null>(null);
  useEffect(() => {
    setByChild({});
    const unsubs = childIds.map((cid) =>
      onSnapshot(
        query(childSub(fid, cid, "vaccineDoses"), where("given", "==", false)),
        (snap) => setByChild((m) => ({ ...m, [cid]: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VaccineDose) })),
        setError,
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, key]);
  const data = useMemo(() => Object.values(byChild).flat(), [byChild]);
  return { data, error };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b && npm test`
Expected: no errors; unit tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repo src/hooks/data.ts
git commit -m "feat: Firestore repositories and live data hooks"
```

---

### Task 10: Child form, child page with allergy banner, allergies page

**Files:**
- Create: `src/pages/ChildForm.tsx`, `src/pages/ChildDetail.tsx`, `src/pages/Allergies.tsx`, `src/components/AllergyBanner.tsx`
- Modify: `src/App.tsx` (routes)

**Interfaces:**
- Consumes: `childSchema`, `allergySchema`, `firstError` (Task 6); `createChild`, `updateChild`, `createEpiSeries`, `saveAllergy`, `deleteAllergy`; `useChild`, `useAllergies`; `ageText`, `todayISO`, `formatThaiDate`.
- Produces: routes `/children/new`, `/children/:id`, `/children/:id/edit`, `/children/:id/allergies`; `<AllergyBanner fid cid />`. `ChildDetail` renders a placeholder `<section id="vaccines">` that Task 11 fills with `<VaccineTimeline>` and an appointments section Task 12 fills.

- [ ] **Step 1: Write `src/components/AllergyBanner.tsx`**

```tsx
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAllergies } from "@/hooks/data";
import type { Severity } from "@/types";

const SEV: Record<Severity, string> = { mild: "เล็กน้อย", moderate: "ปานกลาง", severe: "รุนแรง" };

export default function AllergyBanner({ fid, cid }: { fid: string; cid: string }) {
  const { data, loading } = useAllergies(fid, cid);
  if (loading) return null;
  if (!data.length)
    return (
      <Link to={`/children/${cid}/allergies`} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck size={16} /> ไม่มีประวัติแพ้ยา/อาหาร (แตะเพื่อเพิ่ม)
      </Link>
    );
  return (
    <Link to={`/children/${cid}/allergies`} className="block rounded-lg border-2 border-red-500 bg-red-500/15 px-3 py-2">
      <p className="flex items-center gap-2 font-bold text-red-300"><AlertTriangle size={18} /> แพ้</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {data.map((a) => (
          <li key={a.id}>
            <b>{a.substance}</b> — {a.reaction} ({SEV[a.severity]})
          </li>
        ))}
      </ul>
    </Link>
  );
}
```

- [ ] **Step 2: Write `src/pages/ChildForm.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { todayISO } from "@/domain/dates";
import { childSchema, firstError } from "@/domain/validation";
import { createChild, updateChild } from "@/lib/repo/children";
import { createEpiSeries } from "@/lib/repo/vaccines";
import type { Hospital, Sex } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function ChildForm() {
  const { id } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const editing = Boolean(id);
  const { data: existing } = useChild(fid, id ?? "__none__");

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<Sex>("F");
  const [bloodType, setBloodType] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [withEpi, setWithEpi] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setNickname(existing.nickname ?? "");
    setBirthDate(existing.birthDate);
    setSex(existing.sex);
    setBloodType(existing.bloodType ?? "");
    setHospitals(existing.hospitals ?? []);
  }, [existing]);

  function onSave() {
    const r = childSchema(todayISO()).safeParse({ name, nickname, birthDate, sex, bloodType, hospitals });
    const msg = firstError(r);
    if (msg || !r.success) return setError(msg);
    if (editing && id) {
      updateChild(fid, id, r.data);
      nav(`/children/${id}`);
    } else {
      const cid = createChild(fid, r.data);
      if (withEpi) createEpiSeries(fid, cid, r.data.birthDate);
      nav(`/children/${cid}`);
    }
  }

  const setHospital = (i: number, patch: Partial<Hospital>) =>
    setHospitals((hs) => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{editing ? "แก้ไขข้อมูลลูก" : "เพิ่มลูก"}</h1>
      <div className="space-y-1"><Label>ชื่อ</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1"><Label>ชื่อเล่น</Label><Input value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
      <div className="space-y-1"><Label>วันเกิด</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>เพศ</Label>
          <select className={selectCls} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="F">หญิง</option>
            <option value="M">ชาย</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>กรุ๊ปเลือด</Label>
          <select className={selectCls} value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
            <option value="">ไม่ทราบ</option>
            {["A", "B", "AB", "O", "A Rh-", "B Rh-", "AB Rh-", "O Rh-"].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>HN โรงพยาบาล</Label>
        {hospitals.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="โรงพยาบาล" value={h.name} onChange={(e) => setHospital(i, { name: e.target.value })} />
            <Input placeholder="HN" className="w-32" value={h.hn} onChange={(e) => setHospital(i, { hn: e.target.value })} />
            <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => setHospitals((hs) => hs.filter((_, j) => j !== i))}><Trash2 size={16} /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setHospitals((hs) => [...hs, { name: "", hn: "" }])}><Plus size={16} /> เพิ่มโรงพยาบาล</Button>
      </div>

      {!editing && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withEpi} onChange={(e) => setWithEpi(e.target.checked)} />
          สร้างตารางวัคซีนพื้นฐาน (EPI) จากวันเกิด
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={onSave}>บันทึก</Button>
        <Button variant="ghost" onClick={() => nav(-1)}>ยกเลิก</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/pages/Allergies.tsx`**

```tsx
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { useAllergies, useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { allergySchema, firstError } from "@/domain/validation";
import { deleteAllergy, saveAllergy } from "@/lib/repo/allergies";
import type { Allergy, AllergyType, Severity } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const EMPTY = { type: "drug" as AllergyType, substance: "", reaction: "", severity: "moderate" as Severity, notes: "" };

export default function Allergies() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child } = useChild(fid, cid);
  const { data, error } = useAllergies(fid, cid);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);

  if (error) return <ErrorState error={error} />;

  function onSave() {
    const r = allergySchema.safeParse(form);
    const m = firstError(r);
    if (m || !r.success) return setMsg(m);
    saveAllergy(fid, cid, r.data, editId);
    setForm(EMPTY);
    setEditId(undefined);
    setMsg(null);
  }

  function onEdit(a: Allergy) {
    setForm({ type: a.type, substance: a.substance, reaction: a.reaction, severity: a.severity, notes: a.notes ?? "" });
    setEditId(a.id);
  }

  return (
    <div className="space-y-4">
      <Link to={`/children/${cid}`} className="text-sm underline">← {child?.nickname || child?.name}</Link>
      <h1 className="text-xl font-bold">การแพ้ยา/อาหาร</h1>
      <ul className="space-y-2">
        {data.map((a) => (
          <li key={a.id} className="flex items-start justify-between rounded-lg border p-3">
            <div className="text-sm">
              <p className="font-semibold">{a.substance}</p>
              <p className="text-muted-foreground">{a.reaction}{a.notes ? ` · ${a.notes}` : ""}</p>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="แก้ไข" onClick={() => onEdit(a)}><Pencil size={16} /></Button>
              <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => confirm(`ลบ "${a.substance}"?`) && deleteAllergy(fid, cid, a.id)}><Trash2 size={16} /></Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="font-semibold">{editId ? "แก้ไข" : "เพิ่มรายการ"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>ประเภท</Label>
            <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AllergyType })}>
              <option value="drug">ยา</option><option value="food">อาหาร</option><option value="other">อื่น ๆ</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>ความรุนแรง</Label>
            <select className={selectCls} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}>
              <option value="mild">เล็กน้อย</option><option value="moderate">ปานกลาง</option><option value="severe">รุนแรง</option>
            </select>
          </div>
        </div>
        <div className="space-y-1"><Label>แพ้อะไร</Label><Input value={form.substance} onChange={(e) => setForm({ ...form, substance: e.target.value })} /></div>
        <div className="space-y-1"><Label>อาการ</Label><Input value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} /></div>
        <div className="space-y-1"><Label>หมายเหตุ</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <div className="flex gap-2">
          <Button onClick={onSave}>บันทึก</Button>
          {editId && <Button variant="ghost" onClick={() => { setForm(EMPTY); setEditId(undefined); }}>ยกเลิก</Button>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/pages/ChildDetail.tsx`**

```tsx
import { Link, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import AllergyBanner from "@/components/AllergyBanner";
import ErrorState from "@/components/ErrorState";
import { useChild } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { ageText, formatThaiDate, todayISO } from "@/domain/dates";

export default function ChildDetail() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const { data: child, loading, error } = useChild(fid, cid);

  if (error) return <ErrorState error={error} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!child) return <p>ไม่พบข้อมูล</p>;

  return (
    <div className="space-y-4">
      <AllergyBanner fid={fid} cid={cid} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{child.nickname ? `${child.nickname} (${child.name})` : child.name}</h1>
          <p className="text-sm text-muted-foreground">
            {ageText(child.birthDate, todayISO())} · เกิด {formatThaiDate(child.birthDate)}
            {child.bloodType ? ` · กรุ๊ป ${child.bloodType}` : ""}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="แก้ไข"><Link to={`/children/${cid}/edit`}><Pencil size={16} /></Link></Button>
      </div>

      {(child.hospitals?.length ?? 0) > 0 && (
        <ul className="rounded-lg border p-3 text-sm">
          {child.hospitals.map((h, i) => (
            <li key={i} className="flex justify-between"><span>{h.name}</span><span className="font-mono">HN {h.hn}</span></li>
          ))}
        </ul>
      )}

      <section id="vaccines" className="space-y-2">
        <h2 className="font-semibold">วัคซีน</h2>
        {/* Task 11: <VaccineTimeline fid={fid} child={child} /> */}
      </section>

      <section id="appointments" className="space-y-2">
        <h2 className="font-semibold">นัดหมาย</h2>
        {/* Task 12: child appointments */}
      </section>
    </div>
  );
}
```

If the copied `Button` doesn't support `asChild`, check `src/components/ui/button.tsx` — the shadcn version uses `@radix-ui/react-slot` and does. Otherwise use a styled `<Link>`.

- [ ] **Step 5: Add routes to `src/App.tsx`**

Add imports and, inside the protected layout route:
```tsx
import ChildForm from "@/pages/ChildForm";
import ChildDetail from "@/pages/ChildDetail";
import Allergies from "@/pages/Allergies";
// ...
<Route path="/children/new" element={<ChildForm />} />
<Route path="/children/:id" element={<ChildDetail />} />
<Route path="/children/:id/edit" element={<ChildForm />} />
<Route path="/children/:id/allergies" element={<Allergies />} />
```

Temporarily make `HomePlaceholder` render `<Link to="/children/new">เพิ่มลูก</Link>` so you can navigate (replaced in Task 12).

- [ ] **Step 6: Verify in browser**

`npx tsc -b` passes. In the preview: add a child with 1 hospital row and EPI checked → lands on child page; grey "ไม่มีประวัติแพ้" banner is the first element; tap it → add "Amoxicillin / ผื่นลมพิษ / รุนแรง" → back to child page → red banner lists it at the top. Edit child → fields prefilled → save. Firestore console shows `vaccineSeries` and `vaccineDoses` created for EPI (familyId/childId set). Validation: future birth date shows "วันเกิดต้องไม่อยู่ในอนาคต".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: child profile form, child page with allergy banner, allergies"
```

---

### Task 11: Vaccine timeline, record dose, bulk mark given, new series

**Files:**
- Create: `src/components/StatusBadge.tsx`, `src/components/CalendarButtons.tsx`, `src/components/VaccineTimeline.tsx`, `src/components/RecordDoseDialog.tsx`, `src/components/BulkGivenDialog.tsx`, `src/pages/NewSeries.tsx`
- Modify: `src/pages/ChildDetail.tsx` (render timeline), `src/App.tsx` (route `/children/:id/series/new`)

**Interfaces:**
- Consumes: `useSeries`, `useDoses`; `doseStatus`, `STATUS_LABEL`; `shiftRemainingDoses`, `generateCustomDoses`; `CUSTOM_TEMPLATES`; `updateDose`, `applyDueDates`, `markDosesGiven`, `deleteSeries`, `createSeriesWithDoses`; `validateGivenDate`; `buildIcs`, `googleCalendarUrl`, `downloadText`; `diffDays`, `formatThaiDate`, `todayISO`.
- Produces: `<StatusBadge status />`, `<CalendarButtons event: CalendarEvent />`, `<VaccineTimeline fid child />`, `<RecordDoseDialog fid child dose doses open onOpenChange />`, `<BulkGivenDialog fid child doses open onOpenChange />`; route `/children/:id/series/new`.
- Calendar title format: `${child.nickname || child.name}: ${dose.vaccineName} เข็ม ${dose.doseNo}`; uid `dose-${dose.id}`.

- [ ] **Step 1: Write `src/components/StatusBadge.tsx` and `src/components/CalendarButtons.tsx`**

`src/components/StatusBadge.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/domain/doseStatus";
import type { DoseStatus } from "@/types";

const CLS: Record<DoseStatus, string> = {
  given: "bg-emerald-500/20 text-emerald-300",
  overdue: "bg-red-500/20 text-red-300",
  dueSoon: "bg-amber-500/20 text-amber-300",
  scheduled: "bg-sky-500/20 text-sky-300",
  unscheduled: "bg-muted text-muted-foreground",
};

export default function StatusBadge({ status }: { status: DoseStatus }) {
  return <span className={cn("rounded px-2 py-0.5 text-xs", CLS[status])}>{STATUS_LABEL[status]}</span>;
}
```

`src/components/CalendarButtons.tsx`:
```tsx
import { CalendarPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/domain/ics";
import { downloadText } from "@/lib/download";

export default function CalendarButtons({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex gap-1">
      <Button asChild variant="outline" size="sm">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer"><CalendarPlus size={14} /> Google</a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadText(`${event.uid}.ics`, buildIcs(event), "text/calendar")}>
        <Download size={14} /> .ics
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/RecordDoseDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { diffDays, todayISO } from "@/domain/dates";
import { shiftRemainingDoses } from "@/domain/schedule";
import { validateGivenDate } from "@/domain/validation";
import { applyDueDates, updateDose } from "@/lib/repo/vaccines";
import type { Child, VaccineDose } from "@/types";

interface Props {
  fid: string;
  child: Child;
  dose: VaccineDose | null;
  doses: VaccineDose[]; // doses of the same series
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const FIELDS = [
  ["brand", "ยี่ห้อ"],
  ["lotNo", "Lot No."],
  ["amount", "ขนาด (เช่น 0.5 ml)"],
  ["site", "ตำแหน่งที่ฉีด"],
  ["givenBy", "ผู้ฉีด"],
  ["place", "สถานที่"],
  ["notes", "หมายเหตุ"],
] as const;
type Extra = Record<(typeof FIELDS)[number][0], string>;

export default function RecordDoseDialog({ fid, child, dose, doses, open, onOpenChange }: Props) {
  const [given, setGiven] = useState(true);
  const [givenDate, setGivenDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [extra, setExtra] = useState<Extra>({ brand: "", lotNo: "", amount: "", site: "", givenBy: "", place: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dose) return;
    setGiven(true);
    setGivenDate(dose.givenDate ?? todayISO());
    setDueDate(dose.dueDate ?? "");
    setExtra({
      brand: dose.brand ?? "", lotNo: dose.lotNo ?? "", amount: dose.amount ?? "", site: dose.site ?? "",
      givenBy: dose.givenBy ?? "", place: dose.place ?? "", notes: dose.notes ?? "",
    });
    setError(null);
  }, [dose]);

  if (!dose) return null;

  function onSave() {
    if (!dose) return;
    const trimmed = Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.trim() || undefined])) as Partial<Extra>;
    if (!given) {
      updateDose(fid, child.id, dose.id, { dueDate: dueDate || null, ...trimmed });
      onOpenChange(false);
      return;
    }
    const err = validateGivenDate(givenDate, child.birthDate, todayISO());
    if (err) return setError(err);
    updateDose(fid, child.id, dose.id, {
      given: true, givenDate, givenDateUnknown: false, dueDate: dueDate || dose.dueDate, ...trimmed,
    });
    const late = dose.dueDate ? diffDays(givenDate, dose.dueDate) : 0;
    if (late > 0) {
      const updates = shiftRemainingDoses(doses, dose.doseNo, late);
      if (updates.length && confirm(`ฉีดช้ากว่านัด ${late} วัน — เลื่อนนัดเข็มที่เหลือ (${updates.length} เข็ม) ออกไป ${late} วันไหม?`)) {
        applyDueDates(fid, child.id, updates);
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dose.vaccineName} เข็ม {dose.doseNo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={given} onChange={(e) => setGiven(e.target.checked)} /> ฉีดแล้ว
          </label>
          {given && (
            <div className="space-y-1"><Label>วันที่ฉีด</Label><Input type="date" value={givenDate} onChange={(e) => setGivenDate(e.target.value)} /></div>
          )}
          <div className="space-y-1"><Label>วันนัด</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          {FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label>{label}</Label>
              <Input value={extra[k]} onChange={(e) => setExtra({ ...extra, [k]: e.target.value })} />
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={onSave}>บันทึก</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Write `src/components/BulkGivenDialog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { validateGivenDate } from "@/domain/validation";
import { markDosesGiven } from "@/lib/repo/vaccines";
import type { Child, VaccineDose } from "@/types";

interface Row { checked: boolean; date: string } // date "" = ไม่ทราบวันที่

export default function BulkGivenDialog({ fid, child, doses, open, onOpenChange }: {
  fid: string; child: Child; doses: VaccineDose[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const today = todayISO();
  const candidates = doses.filter((d) => !d.given && d.dueDate && d.dueDate <= today);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setRows(Object.fromEntries(candidates.map((d) => [d.id, { checked: false, date: "" }])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSave() {
    const items = candidates.filter((d) => rows[d.id]?.checked).map((d) => ({ id: d.id, givenDate: rows[d.id].date || null }));
    for (const it of items) {
      const err = it.givenDate ? validateGivenDate(it.givenDate, child.birthDate, today) : null;
      if (err) return setError(err);
    }
    markDosesGiven(fid, child.id, items);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ติ๊กเข็มที่ฉีดไปแล้ว</DialogTitle></DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีเข็มที่ถึงกำหนดแล้วและยังไม่บันทึก</p>
        ) : (
          <ul className="space-y-2">
            {candidates.map((d) => (
              <li key={d.id} className="space-y-1 rounded border p-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rows[d.id]?.checked ?? false}
                    onChange={(e) => setRows({ ...rows, [d.id]: { ...rows[d.id], checked: e.target.checked } })} />
                  {d.vaccineName} เข็ม {d.doseNo} <span className="text-muted-foreground">(กำหนด {formatThaiDate(d.dueDate!)})</span>
                </label>
                {rows[d.id]?.checked && (
                  <div className="flex items-center gap-2 pl-6">
                    <Input type="date" className="h-8" value={rows[d.id].date}
                      onChange={(e) => setRows({ ...rows, [d.id]: { ...rows[d.id], date: e.target.value } })} />
                    <span className="text-xs text-muted-foreground">เว้นว่าง = ไม่ทราบวันที่</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={!candidates.length} onClick={onSave}>บันทึก</Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Write `src/components/VaccineTimeline.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BulkGivenDialog from "@/components/BulkGivenDialog";
import CalendarButtons from "@/components/CalendarButtons";
import ErrorState from "@/components/ErrorState";
import RecordDoseDialog from "@/components/RecordDoseDialog";
import StatusBadge from "@/components/StatusBadge";
import { useDoses, useSeries } from "@/hooks/data";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { doseStatus } from "@/domain/doseStatus";
import { deleteSeries } from "@/lib/repo/vaccines";
import type { Child, VaccineDose } from "@/types";

export default function VaccineTimeline({ fid, child }: { fid: string; child: Child }) {
  const { data: series, error: e1 } = useSeries(fid, child.id);
  const { data: doses, error: e2 } = useDoses(fid, child.id);
  const [active, setActive] = useState<VaccineDose | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const today = todayISO();
  const who = child.nickname || child.name;

  const bySeries = useMemo(() => {
    const m = new Map<string, VaccineDose[]>();
    for (const d of doses) m.set(d.seriesId, [...(m.get(d.seriesId) ?? []), d]);
    return m;
  }, [doses]);

  // เรียง series ตามวันนัดเข็มแรกที่ยังไม่ฉีด (series ที่ฉีดครบไปท้ายสุด)
  const ordered = useMemo(() => {
    const nextDue = (sid: string) => bySeries.get(sid)?.find((d) => !d.given)?.dueDate ?? "9999";
    return [...series].sort((a, b) => nextDue(a.id).localeCompare(nextDue(b.id)));
  }, [series, bySeries]);

  if (e1 || e2) return <ErrorState error={(e1 ?? e2)!} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><Link to={`/children/${child.id}/series/new`}><Plus size={14} /> เพิ่มชุดวัคซีน</Link></Button>
        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><CheckSquare size={14} /> ติ๊กเข็มที่ฉีดแล้ว</Button>
      </div>

      {ordered.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลวัคซีน</p>}

      {ordered.map((s) => {
        const list = bySeries.get(s.id) ?? [];
        return (
          <div key={s.id} className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-semibold">{s.name}</p>
              <Button variant="ghost" size="icon" aria-label="ลบชุด"
                onClick={() => confirm(`ลบชุด "${s.name}" และทุกเข็ม?`) && deleteSeries(fid, child.id, s.id, list.map((d) => d.id))}>
                <Trash2 size={14} />
              </Button>
            </div>
            <ul className="divide-y">
              {list.map((d) => {
                const st = doseStatus(d, today);
                return (
                  <li key={d.id} className="space-y-1 px-3 py-2 text-sm">
                    <button className="flex w-full items-center justify-between text-left" onClick={() => setActive(d)}>
                      <span>เข็ม {d.doseNo}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {d.given
                            ? d.givenDateUnknown ? "ไม่ทราบวันที่" : formatThaiDate(d.givenDate!)
                            : d.dueDate ? formatThaiDate(d.dueDate) : "—"}
                        </span>
                        <StatusBadge status={st} />
                      </span>
                    </button>
                    {!d.given && d.dueDate && (st === "dueSoon" || st === "scheduled" || st === "overdue") && (
                      <CalendarButtons event={{ uid: `dose-${d.id}`, title: `${who}: ${d.vaccineName} เข็ม ${d.doseNo}`, date: d.dueDate, location: d.place }} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <RecordDoseDialog fid={fid} child={child} dose={active} doses={active ? bySeries.get(active.seriesId) ?? [] : []}
        open={active !== null} onOpenChange={(o) => !o && setActive(null)} />
      <BulkGivenDialog fid={fid} child={child} doses={doses} open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}
```

- [ ] **Step 5: Write `src/pages/NewSeries.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOM_TEMPLATES } from "@/data/customTemplates";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { generateCustomDoses } from "@/domain/schedule";
import { useFamilyId } from "@/hooks/useFamilyId";
import { createSeriesWithDoses } from "@/lib/repo/vaccines";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function NewSeries() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const [tplKey, setTplKey] = useState(CUSTOM_TEMPLATES[0].key);
  const tpl = CUSTOM_TEMPLATES.find((t) => t.key === tplKey)!;
  const [name, setName] = useState(tpl.name);
  const [offsetsText, setOffsetsText] = useState(tpl.dayOffsets.join(", "));
  const [anchorDose, setAnchorDose] = useState(1);
  const [anchorDate, setAnchorDate] = useState(todayISO());
  const [reason, setReason] = useState("");

  function pickTemplate(key: string) {
    const t = CUSTOM_TEMPLATES.find((x) => x.key === key)!;
    setTplKey(key);
    setName(t.name);
    setOffsetsText(t.dayOffsets.join(", "));
    setAnchorDose(1);
  }

  const offsets = useMemo(
    () => offsetsText.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0),
    [offsetsText],
  );
  const valid = name.trim() && offsets.length > 0 && anchorDose >= 1 && anchorDose <= offsets.length && anchorDate;
  const preview = valid ? generateCustomDoses({ name: name.trim(), vaccineCode: tpl.vaccineCode, dayOffsets: offsets }, { doseNo: anchorDose, date: anchorDate }) : [];

  function onSave() {
    if (!valid) return;
    createSeriesWithDoses(fid, cid, { name: name.trim(), source: "custom", templateKey: tpl.key, reason: reason.trim() || undefined, doses: preview });
    nav(`/children/${cid}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เพิ่มชุดวัคซีน</h1>
      <div className="space-y-1">
        <Label>แม่แบบ</Label>
        <select className={selectCls} value={tplKey} onChange={(e) => pickTemplate(e.target.value)}>
          {CUSTOM_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name || "กำหนดเอง"}</option>)}
        </select>
      </div>
      <div className="space-y-1"><Label>ชื่อวัคซีน</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1">
        <Label>วันที่ของแต่ละเข็ม นับจากเข็มแรก (วัน, คั่นด้วยจุลภาค)</Label>
        <Input value={offsetsText} onChange={(e) => setOffsetsText(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>เข็มที่ทราบวันที่</Label>
          <select className={selectCls} value={anchorDose} onChange={(e) => setAnchorDose(Number(e.target.value))}>
            {offsets.map((_, i) => <option key={i} value={i + 1}>เข็ม {i + 1}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>วันที่ของเข็มนั้น</Label><Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label>เหตุผล (เช่น ถูกสุนัขกัด)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>

      {preview.length > 0 && (
        <ul className="rounded-lg border p-3 text-sm">
          {preview.map((d) => (
            <li key={d.doseNo} className="flex justify-between">
              <span>เข็ม {d.doseNo}</span>
              <span>{formatThaiDate(d.dueDate!)} {d.given ? "· ฉีดแล้ว" : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">เข็มก่อน "เข็มที่ทราบวันที่" จะถูกบันทึกว่าฉีดแล้วตามวันที่คำนวณ — แก้ไขได้ภายหลัง</p>
      <div className="flex gap-2">
        <Button disabled={!valid} onClick={onSave}>บันทึก</Button>
        <Button variant="ghost" onClick={() => nav(-1)}>ยกเลิก</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire into `ChildDetail.tsx` and `App.tsx`**

In `ChildDetail.tsx` replace the Task 11 comment with `<VaccineTimeline fid={fid} child={child} />` and add `import VaccineTimeline from "@/components/VaccineTimeline";`.

In `App.tsx` add `import NewSeries from "@/pages/NewSeries";` and `<Route path="/children/:id/series/new" element={<NewSeries />} />`.

- [ ] **Step 7: Verify in browser**

`npx tsc -b` passes. In preview, on the child created in Task 10:
- EPI series listed; past-due doses show "เลยกำหนด".
- "ติ๊กเข็มที่ฉีดแล้ว" → check 2 doses, one with a date, one blank → both show "ฉีดแล้ว", blank one shows "ไม่ทราบวันที่".
- "เพิ่มชุดวัคซีน" → rabies IM, anchor เข็ม 2 = 2026-10-02 → preview shows dose 1 = 29 ก.ย. 2569 ฉีดแล้ว, dose 5 = 27 ต.ค. 2569 → save.
- Open dose 2 → given date 2026-10-04 (2 days late) → confirm prompt to shift 3 doses → accept → doses 3–5 move by 2 days.
- Calendar: ".ics" downloads a file; "Google" opens a prefilled event.
- Delete a series asks for confirmation and removes its doses.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: vaccine timeline, record/bulk-mark doses, custom series with shift"
```

---

### Task 12: Home (upcoming + children) and appointments

**Files:**
- Create: `src/components/UpcomingList.tsx`, `src/components/ChildCard.tsx`, `src/pages/Home.tsx`, `src/pages/AppointmentForm.tsx`
- Modify: `src/App.tsx` (replace placeholder, add `/appointments/new`, `/appointments/:apptId/edit`), `src/pages/ChildDetail.tsx` (appointments section)

**Interfaces:**
- Consumes: `useChildren`, `usePendingDoses`, `useOpenAppointments`, `useAllergies`; `groupUpcoming`, `UpcomingItem`; `CalendarButtons`; `saveAppointment`, `setAppointmentDone`, `deleteAppointment`; `appointmentSchema`, `firstError`; `formatThaiDate`, `todayISO`, `ageText`.
- Produces: `<UpcomingList fid items kids />`; `<ChildCard fid child pendingCount />`; routes `/`, `/appointments/new?child=<cid>`, `/appointments/:apptId/edit`.
- Appointment calendar uid: `appt-${id}`; title `${nickname||name}: ${purpose}`.

- [ ] **Step 1: Write `src/components/UpcomingList.tsx`**

```tsx
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarButtons from "@/components/CalendarButtons";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { groupUpcoming, type UpcomingItem } from "@/domain/upcoming";
import { setAppointmentDone } from "@/lib/repo/appointments";
import type { Child } from "@/types";

export default function UpcomingList({ fid, items, kids }: { fid: string; items: UpcomingItem[]; kids: Child[] }) {
  const g = groupUpcoming(items, todayISO());
  const who = (cid: string) => {
    const c = kids.find((x) => x.id === cid);
    return c ? c.nickname || c.name : "";
  };
  const sections: [string, UpcomingItem[], string][] = [
    ["เลยกำหนด", g.overdue, "border-red-500/60"],
    ["7 วันข้างหน้า", g.soon, "border-amber-500/60"],
    ["ถัดไป", g.later.slice(0, 5), "border-border"],
  ];
  if (!items.length) return <p className="text-sm text-muted-foreground">ไม่มีนัดที่รออยู่</p>;
  return (
    <div className="space-y-4">
      {sections.map(([label, list, border]) =>
        list.length ? (
          <div key={label} className="space-y-2">
            <h3 className="text-sm font-semibold">{label}</h3>
            {list.map((it) => (
              <div key={`${it.kind}-${it.id}`} className={`space-y-2 rounded-lg border-l-4 ${border} bg-card p-3`}>
                <Link to={it.kind === "dose" ? `/children/${it.childId}` : `/appointments/${it.id}/edit`} className="block text-sm">
                  <p className="font-semibold">{who(it.childId)} · {it.title}</p>
                  <p className="text-muted-foreground">{formatThaiDate(it.date)}{it.time ? ` ${it.time} น.` : ""}{it.place ? ` · ${it.place}` : ""}</p>
                </Link>
                <div className="flex flex-wrap gap-1">
                  <CalendarButtons event={{ uid: `${it.kind === "dose" ? "dose" : "appt"}-${it.id}`, title: `${who(it.childId)}: ${it.title}`, date: it.date, time: it.time, location: it.place }} />
                  {it.kind === "appointment" && (
                    <Button variant="ghost" size="sm" onClick={() => setAppointmentDone(fid, it.id, true)}><Check size={14} /> ไปแล้ว</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/ChildCard.tsx`**

```tsx
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAllergies } from "@/hooks/data";
import { ageText, todayISO } from "@/domain/dates";
import type { Child } from "@/types";

export default function ChildCard({ fid, child, overdueCount }: { fid: string; child: Child; overdueCount: number }) {
  const { data: allergies } = useAllergies(fid, child.id);
  return (
    <Link to={`/children/${child.id}`} className="block rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{child.nickname || child.name}</p>
        {allergies.length > 0 && <span className="flex items-center gap-1 text-xs text-red-300"><AlertTriangle size={14} /> แพ้ {allergies.length}</span>}
      </div>
      <p className="text-sm text-muted-foreground">{ageText(child.birthDate, todayISO())}</p>
      {overdueCount > 0 && <p className="text-xs text-red-300">วัคซีนเลยกำหนด {overdueCount} เข็ม</p>}
    </Link>
  );
}
```

- [ ] **Step 3: Write `src/pages/Home.tsx`**

```tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChildCard from "@/components/ChildCard";
import ErrorState from "@/components/ErrorState";
import UpcomingList from "@/components/UpcomingList";
import { useChildren, useOpenAppointments, usePendingDoses } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { todayISO } from "@/domain/dates";
import type { UpcomingItem } from "@/domain/upcoming";

export default function Home() {
  const fid = useFamilyId();
  const { data: children, loading, error } = useChildren(fid);
  const childIds = useMemo(() => children.map((c) => c.id), [children]);
  const { data: pending, error: e2 } = usePendingDoses(fid, childIds);
  const { data: appts, error: e3 } = useOpenAppointments(fid);
  const today = todayISO();

  const items: UpcomingItem[] = useMemo(
    () => [
      ...pending
        .filter((d) => d.dueDate)
        .map((d) => ({ kind: "dose" as const, id: d.id, childId: d.childId, date: d.dueDate!, title: `${d.vaccineName} เข็ม ${d.doseNo}`, place: d.place })),
      ...appts.map((a) => ({ kind: "appointment" as const, id: a.id, childId: a.childId, date: a.date, time: a.time, title: a.purpose, place: a.place })),
    ],
    [pending, appts],
  );

  const err = error ?? e2 ?? e3;
  if (err) return <ErrorState error={err} />;
  if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  if (!children.length)
    return (
      <div className="space-y-3 py-10 text-center">
        <p>เริ่มจากเพิ่มข้อมูลลูก</p>
        <Button asChild><Link to="/children/new"><UserPlus size={16} /> เพิ่มลูก</Link></Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">นัดที่รออยู่</h2>
          <Button asChild size="sm" variant="outline"><Link to="/appointments/new"><CalendarPlus size={14} /> นัดหมอ</Link></Button>
        </div>
        <UpcomingList fid={fid} items={items} kids={children} />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ลูก</h2>
          <Button asChild size="sm" variant="ghost"><Link to="/children/new"><UserPlus size={14} /> เพิ่ม</Link></Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {children.map((c) => (
            <ChildCard key={c.id} fid={fid} child={c}
              overdueCount={pending.filter((d) => d.childId === c.id && d.dueDate && d.dueDate < today).length} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/pages/AppointmentForm.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChildren } from "@/hooks/data";
import { useDocument } from "@/hooks/useCollection";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appointmentSchema, firstError } from "@/domain/validation";
import { appointmentsCol } from "@/lib/paths";
import { deleteAppointment, saveAppointment } from "@/lib/repo/appointments";
import { doc } from "firebase/firestore";
import type { Appointment } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function AppointmentForm() {
  const { apptId } = useParams();
  const [sp] = useSearchParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: children } = useChildren(fid);
  const { data: existing } = useDocument<Appointment>(apptId ? doc(appointmentsCol(fid), apptId) : null, `appt/${fid}/${apptId ?? ""}`);

  const [childId, setChildId] = useState(sp.get("child") ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId && children.length === 1) setChildId(children[0].id);
  }, [children, childId]);

  useEffect(() => {
    if (!existing) return;
    setChildId(existing.childId);
    setDate(existing.date);
    setTime(existing.time ?? "");
    setPlace(existing.place);
    setPurpose(existing.purpose);
    setNotes(existing.notes ?? "");
  }, [existing]);

  function onSave() {
    const r = appointmentSchema.safeParse({ childId, date, time: time || undefined, place, purpose, notes });
    const m = firstError(r);
    if (m || !r.success) return setError(m);
    saveAppointment(fid, { ...r.data, done: existing?.done ?? false }, apptId);
    nav(-1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{apptId ? "แก้ไขนัด" : "เพิ่มนัดหมอ"}</h1>
      <div className="space-y-1">
        <Label>ลูก</Label>
        <select className={selectCls} value={childId} onChange={(e) => setChildId(e.target.value)}>
          <option value="">เลือก…</option>
          {children.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>วันที่</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1"><Label>เวลา (ถ้ามี)</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label>สถานที่</Label><Input value={place} onChange={(e) => setPlace(e.target.value)} /></div>
      <div className="space-y-1"><Label>เรื่องที่นัด</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
      <div className="space-y-1"><Label>หมายเหตุ</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={onSave}>บันทึก</Button>
        <Button variant="ghost" onClick={() => nav(-1)}>ยกเลิก</Button>
        {apptId && (
          <Button variant="destructive" className="ml-auto" onClick={() => { if (confirm("ลบนัดนี้?")) { deleteAppointment(fid, apptId); nav("/"); } }}>ลบ</Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Appointments section on the child page**

In `ChildDetail.tsx` add imports `useOpenAppointments`, `CalendarButtons`, `formatThaiDate` (already imported), and replace the Task 12 comment with:

```tsx
<ChildAppointments fid={fid} cid={cid} who={child.nickname || child.name} />
```

and add at the bottom of the file:

```tsx
function ChildAppointments({ fid, cid, who }: { fid: string; cid: string; who: string }) {
  const { data } = useOpenAppointments(fid);
  const mine = data.filter((a) => a.childId === cid).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="space-y-2">
      {mine.map((a) => (
        <div key={a.id} className="space-y-1 rounded-lg border p-3 text-sm">
          <Link to={`/appointments/${a.id}/edit`} className="block">
            <p className="font-semibold">{a.purpose}</p>
            <p className="text-muted-foreground">{formatThaiDate(a.date)}{a.time ? ` ${a.time} น.` : ""} · {a.place}</p>
          </Link>
          <CalendarButtons event={{ uid: `appt-${a.id}`, title: `${who}: ${a.purpose}`, date: a.date, time: a.time, location: a.place }} />
        </div>
      ))}
      <Button asChild size="sm" variant="outline"><Link to={`/appointments/new?child=${cid}`}>เพิ่มนัด</Link></Button>
    </div>
  );
}
```

- [ ] **Step 6: Update `src/App.tsx`**

Remove `HomePlaceholder`; import `Home` and `AppointmentForm`; routes:
```tsx
<Route path="/" element={<Home />} />
<Route path="/appointments/new" element={<AppointmentForm />} />
<Route path="/appointments/:apptId/edit" element={<AppointmentForm />} />
```

- [ ] **Step 7: Verify in browser**

`npx tsc -b && npm test` pass. In preview: Home shows overdue/7-day/later groups, including the rabies doses and the EPI overdue doses; add a second child → both appear; add an appointment with time 09:30 → appears under the right group with Google/.ics buttons; "ไปแล้ว" removes it from Home; the appointment also shows on the child page; edit/delete works. Check the downloaded .ics opens on a phone (manual, see Task 13).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: home dashboard with upcoming doses/appointments and appointment form"
```

---

### Task 13: PWA icons, deploy, mobile verification

**Files:**
- Create: `public/icon.svg`, generated `public/pwa-*.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico`
- Modify: `vite.config.ts` (icons), `index.html` (apple-touch-icon)

**Interfaces:**
- Produces: installable PWA deployed to `https://<projectId>.web.app`.

- [ ] **Step 1: Write `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#101522"/>
  <path d="M256 400s-136-80-136-176a76 76 0 0 1 136-46 76 76 0 0 1 136 46c0 96-136 176-136 176z" fill="#34d399"/>
  <rect x="236" y="200" width="40" height="120" rx="8" fill="#101522"/>
  <rect x="196" y="240" width="120" height="40" rx="8" fill="#101522"/>
</svg>
```

- [ ] **Step 2: Generate icons**

Run: `npx pwa-assets-generator --preset minimal-2023 public/icon.svg`
Expected: creates `public/pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`.

- [ ] **Step 3: Reference icons**

In `vite.config.ts`, set `includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"]` and replace `icons: []` with:
```ts
icons: [
  { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
  { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
  { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
],
```

In `index.html` `<head>` add: `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />`

- [ ] **Step 4: Full check and build**

Run: `npm test && npm run test:rules && npm run build`
Expected: all unit + rules tests pass; build succeeds and `dist/manifest.webmanifest` + `dist/sw.js` exist.

- [ ] **Step 5: Deploy (confirm with the user first — this publishes the app)**

Ask the user before deploying. Then:
Run: `npx firebase deploy --only hosting,firestore:rules,firestore:indexes`
Expected: `Deploy complete!` with Hosting URL `https://<projectId>.web.app`. Add that domain under Firebase Console → Authentication → Settings → Authorized domains if it isn't there already (the `.web.app` / `.firebaseapp.com` domains normally are).

- [ ] **Step 6: Mobile verification checklist (with the user)**

- [ ] Open the Hosting URL on the phone, sign in with Google, "Add to Home Screen" → opens standalone with icon.
- [ ] Turn on airplane mode → open app → data is visible; add an allergy → "ออฟไลน์ — รอซิงก์" shows; turn airplane mode off → the entry appears in the Firestore console.
- [ ] iPhone: tap ".ics" on a dose → Calendar offers to add → event has 2 alerts (1 day before, 07:00).
- [ ] Android: "Google" button → Google Calendar opens prefilled.
- [ ] Record the current rabies series for real (next dose: Fri 2 Oct 2026) and add it to the calendar.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat: PWA icons and deploy config"
git push
```

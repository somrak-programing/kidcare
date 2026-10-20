import { describe, expect, test } from "vitest";
import type { Child } from "@/types";
import {
  filterAppointments,
  formatThaiMonthYear,
  getFilterOptions,
  INITIAL_APPOINTMENT_FILTERS,
} from "./appointmentFilters";
import type { UpcomingItem } from "./upcoming";

const sampleKids: Child[] = [
  { id: "k1", name: "ลูกหว้า", nickname: "ลูกหว้า", birthDate: "2023-05-01", sex: "F", hospitals: [] },
  { id: "k2", name: "วินเทจ", nickname: "วินเทจ", birthDate: "2024-10-01", sex: "M", hospitals: [] },
];

const sampleItems: UpcomingItem[] = [
  {
    kind: "dose",
    id: "d1",
    childId: "k1",
    date: "2023-07-03",
    title: "ตับอักเสบบี แรกเกิด (HB) เข็ม 1",
    vaccineCode: "HB",
    vaccineName: "ตับอักเสบบี",
  },
  {
    kind: "dose",
    id: "d2",
    childId: "k1",
    date: "2023-09-03",
    title: "โปลิโอชนิดฉีด (IPV) เข็ม 1",
    vaccineCode: "IPV",
    vaccineName: "โปลิโอ",
  },
  {
    kind: "dose",
    id: "d3",
    childId: "k1",
    date: "2023-09-03",
    title: "โรต้า (Rota) เข็ม 1",
    vaccineCode: "ROTA",
    vaccineName: "โรต้า",
  },
  {
    kind: "dose",
    id: "d4",
    childId: "k2",
    date: "2026-10-29",
    title: "พิษสุนัขบ้า หลังสัมผัส (ฉีดเข้ากล้าม) เข็ม 5",
    vaccineCode: "RABIES",
    vaccineName: "พิษสุนัขบ้า",
  },
  {
    kind: "appointment",
    id: "a1",
    childId: "parent:dad",
    date: "2026-10-12",
    title: "นัดพบแพทย์ตรวจสุขภาพ",
    place: "โรงพยาบาลเมือง",
  },
];

describe("formatThaiMonthYear", () => {
  test("formats YYYY-MM into Thai Month and Buddhist Year", () => {
    expect(formatThaiMonthYear("2026-10")).toBe("ต.ค. 2569");
    expect(formatThaiMonthYear("2023-07-03")).toBe("ก.ค. 2566");
    expect(formatThaiMonthYear("2024-01")).toBe("ม.ค. 2567");
  });
});

describe("filterAppointments", () => {
  const TODAY = "2026-10-20";

  test("returns all items when filters are initial (all)", () => {
    const res = filterAppointments(sampleItems, INITIAL_APPOINTMENT_FILTERS, TODAY);
    expect(res).toHaveLength(5);
  });

  test("filters by person (รายคน)", () => {
    const lukwa = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, person: "k1" },
      TODAY,
    );
    expect(lukwa.map((i) => i.id)).toEqual(["d1", "d2", "d3"]);

    const vintage = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, person: "k2" },
      TODAY,
    );
    expect(vintage.map((i) => i.id)).toEqual(["d4"]);

    const dad = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, person: "parent:dad" },
      TODAY,
    );
    expect(dad.map((i) => i.id)).toEqual(["a1"]);
  });

  test("filters by month (รายเดือน)", () => {
    const sep2023 = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, month: "2023-09" },
      TODAY,
    );
    expect(sep2023.map((i) => i.id)).toEqual(["d2", "d3"]);

    const oct2026 = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, month: "2026-10" },
      TODAY,
    );
    expect(oct2026.map((i) => i.id)).toEqual(["d4", "a1"]);
  });

  test("filters by disease / vaccine category (รายโรคภัย)", () => {
    const rabies = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, disease: "rabies" },
      TODAY,
    );
    expect(rabies.map((i) => i.id)).toEqual(["d4"]);

    const polio = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, disease: "polio" },
      TODAY,
    );
    expect(polio.map((i) => i.id)).toEqual(["d2"]);

    const doctor = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, disease: "doctor" },
      TODAY,
    );
    expect(doctor.map((i) => i.id)).toEqual(["a1"]);
  });

  test("filters by search keyword", () => {
    const search = filterAppointments(
      sampleItems,
      { ...INITIAL_APPOINTMENT_FILTERS, search: "เข็ม 5" },
      TODAY,
    );
    expect(search.map((i) => i.id)).toEqual(["d4"]);
  });

  test("combines multiple filters simultaneously", () => {
    const combined = filterAppointments(
      sampleItems,
      {
        ...INITIAL_APPOINTMENT_FILTERS,
        person: "k2",
        month: "2026-10",
        disease: "rabies",
      },
      TODAY,
    );
    expect(combined.map((i) => i.id)).toEqual(["d4"]);

    // If month doesn't match k2's appointment
    const noMatch = filterAppointments(
      sampleItems,
      {
        ...INITIAL_APPOINTMENT_FILTERS,
        person: "k2",
        month: "2023-07",
      },
      TODAY,
    );
    expect(noMatch).toEqual([]);
  });
});

describe("getFilterOptions", () => {
  test("generates options with counts from current items and kids", () => {
    const { personOptions, monthOptions, diseaseOptions } = getFilterOptions(sampleItems, sampleKids);

    expect(personOptions).toContainEqual(expect.objectContaining({ value: "k1", count: 3 }));
    expect(personOptions).toContainEqual(expect.objectContaining({ value: "k2", count: 1 }));
    expect(personOptions).toContainEqual(expect.objectContaining({ value: "parent:dad", count: 1 }));

    expect(monthOptions).toContainEqual(expect.objectContaining({ value: "2023-07", count: 1 }));
    expect(monthOptions).toContainEqual(expect.objectContaining({ value: "2023-09", count: 2 }));
    expect(monthOptions).toContainEqual(expect.objectContaining({ value: "2026-10", count: 2 }));

    expect(diseaseOptions).toContainEqual(expect.objectContaining({ value: "hb", count: 1 }));
    expect(diseaseOptions).toContainEqual(expect.objectContaining({ value: "polio", count: 1 }));
    expect(diseaseOptions).toContainEqual(expect.objectContaining({ value: "rota", count: 1 }));
    expect(diseaseOptions).toContainEqual(expect.objectContaining({ value: "rabies", count: 1 }));
    expect(diseaseOptions).toContainEqual(expect.objectContaining({ value: "doctor", count: 1 }));
  });
});

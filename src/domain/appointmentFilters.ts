import type { Child } from "@/types";
import { diffDays } from "./dates";
import { DUE_SOON_DAYS } from "./doseStatus";
import type { UpcomingItem } from "./upcoming";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatThaiMonthYear(isoOrYm: string): string {
  const parts = isoOrYm.slice(0, 7).split("-");
  if (parts.length < 2) return isoOrYm;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return isoOrYm;
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

export interface DiseaseCategoryDef {
  key: string;
  label: string;
  badge: string;
  matches: (item: UpcomingItem) => boolean;
}

export const DISEASE_CATEGORIES: DiseaseCategoryDef[] = [
  {
    key: "hb",
    label: "ตับอักเสบบี (Hepatitis B)",
    badge: "ตับอักเสบบี",
    matches: (it) =>
      it.vaccineCode === "HB" ||
      /ตับอักเสบ|hb/i.test(it.title) ||
      /ตับอักเสบ|hb/i.test(it.vaccineName ?? ""),
  },
  {
    key: "polio",
    label: "โปลิโอ (Polio / OPV / IPV)",
    badge: "โปลิโอ",
    matches: (it) =>
      it.vaccineCode === "IPV" ||
      it.vaccineCode === "OPV" ||
      /โปลิโอ|ipv|opv/i.test(it.title) ||
      /โปลิโอ|ipv|opv/i.test(it.vaccineName ?? ""),
  },
  {
    key: "dtp",
    label: "คอตีบ-บาดทะยัก-ไอกรน (DTP)",
    badge: "คอตีบ-บาดทะยัก-ไอกรน",
    matches: (it) =>
      it.vaccineCode === "DTP" ||
      it.vaccineCode === "DTP-HB-Hib" ||
      it.vaccineCode === "dT" ||
      /คอตีบ|บาดทะยัก|ไอกรน|dtp|dt/i.test(it.title) ||
      /คอตีบ|บาดทะยัก|ไอกรน|dtp|dt/i.test(it.vaccineName ?? ""),
  },
  {
    key: "rota",
    label: "โรต้า (Rotavirus)",
    badge: "โรต้า",
    matches: (it) =>
      it.vaccineCode === "ROTA" ||
      /โรต้า|rota/i.test(it.title) ||
      /โรต้า|rota/i.test(it.vaccineName ?? ""),
  },
  {
    key: "bcg",
    label: "วัณโรค (BCG)",
    badge: "วัณโรค",
    matches: (it) =>
      it.vaccineCode === "BCG" ||
      /วัณโรค|bcg/i.test(it.title) ||
      /วัณโรค|bcg/i.test(it.vaccineName ?? ""),
  },
  {
    key: "mmr",
    label: "หัด-คางทูม-หัดเยอรมัน (MMR)",
    badge: "หัด-คางทูม-หัดเยอรมัน",
    matches: (it) =>
      it.vaccineCode === "MMR" ||
      /หัด|คางทูม|หัดเยอรมัน|mmr/i.test(it.title) ||
      /หัด|คางทูม|หัดเยอรมัน|mmr/i.test(it.vaccineName ?? ""),
  },
  {
    key: "je",
    label: "ไข้สมองอักเสบเจอี (JE)",
    badge: "ไข้สมองอักเสบเจอี",
    matches: (it) =>
      it.vaccineCode === "JE" ||
      /สมองอักเสบ|เจอี|je/i.test(it.title) ||
      /สมองอักเสบ|เจอี|je/i.test(it.vaccineName ?? ""),
  },
  {
    key: "rabies",
    label: "พิษสุนัขบ้า (Rabies)",
    badge: "พิษสุนัขบ้า",
    matches: (it) =>
      it.vaccineCode === "RABIES" ||
      /พิษสุนัขบ้า|rabies/i.test(it.title) ||
      /พิษสุนัขบ้า|rabies/i.test(it.vaccineName ?? ""),
  },
  {
    key: "flu",
    label: "ไข้หวัดใหญ่ (Influenza)",
    badge: "ไข้หวัดใหญ่",
    matches: (it) =>
      it.vaccineCode === "FLU" ||
      /ไข้หวัดใหญ่|flu/i.test(it.title) ||
      /ไข้หวัดใหญ่|flu/i.test(it.vaccineName ?? ""),
  },
  {
    key: "hpv",
    label: "มะเร็งปากมดลูก (HPV)",
    badge: "HPV",
    matches: (it) =>
      it.vaccineCode === "HPV" ||
      /hpv|ปากมดลูก/i.test(it.title) ||
      /hpv|ปากมดลูก/i.test(it.vaccineName ?? ""),
  },
  {
    key: "doctor",
    label: "นัดพบแพทย์ / ทันตกรรม / ตรวจสุขภาพ",
    badge: "พบแพทย์",
    matches: (it) =>
      it.kind === "appointment" ||
      /หมอ|แพทย์|ตรวจ|ทันตกรรม|ฟัน|คลินิก|โรงพยาบาล/i.test(it.title),
  },
];

export interface AppointmentFilters {
  person: string; // "all" | childId | "parent:dad" | "parent:mom" | "family"
  month: string; // "all" | "YYYY-MM"
  disease: string; // "all" | categoryKey
  status: string; // "all" | "overdue" | "soon" | "later"
  search: string;
}

export const INITIAL_APPOINTMENT_FILTERS: AppointmentFilters = {
  person: "all",
  month: "all",
  disease: "all",
  status: "all",
  search: "",
};

export function filterAppointments(
  items: UpcomingItem[],
  filters: AppointmentFilters,
  today: string,
): UpcomingItem[] {
  return items.filter((it) => {
    // 1. Person filter
    if (filters.person !== "all") {
      if (filters.person === "parent:dad") {
        if (it.childId !== "parent:dad" && it.childId !== "dad") return false;
      } else if (filters.person === "parent:mom") {
        if (it.childId !== "parent:mom" && it.childId !== "mom") return false;
      } else {
        if (it.childId !== filters.person) return false;
      }
    }

    // 2. Month filter (YYYY-MM)
    if (filters.month !== "all") {
      const itYm = it.date.slice(0, 7);
      if (itYm !== filters.month) return false;
    }

    // 3. Disease / Vaccine category filter
    if (filters.disease !== "all") {
      const cat = DISEASE_CATEGORIES.find((c) => c.key === filters.disease);
      if (cat) {
        if (!cat.matches(it)) return false;
      } else if (filters.disease === "other") {
        const matchesAnyKnown = DISEASE_CATEGORIES.some((c) => c.matches(it));
        if (matchesAnyKnown) return false;
      }
    }

    // 4. Status filter
    if (filters.status !== "all") {
      const diff = diffDays(it.date, today);
      if (filters.status === "overdue" && diff >= 0) return false;
      if (filters.status === "soon" && (diff < 0 || diff > DUE_SOON_DAYS)) return false;
      if (filters.status === "later" && diff <= DUE_SOON_DAYS) return false;
    }

    // 5. Search query
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const matchTitle = it.title.toLowerCase().includes(q);
      const matchPlace = it.place?.toLowerCase().includes(q) ?? false;
      const matchVaccine = it.vaccineName?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchPlace && !matchVaccine) return false;
    }

    return true;
  });
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export function getFilterOptions(items: UpcomingItem[], kids: Child[]) {
  // 1. Person options
  const personCountMap = new Map<string, number>();
  for (const it of items) {
    const cid = it.childId === "dad" ? "parent:dad" : it.childId === "mom" ? "parent:mom" : it.childId;
    personCountMap.set(cid, (personCountMap.get(cid) ?? 0) + 1);
  }

  const personOptions: FilterOption[] = [];
  for (const k of kids) {
    const count = personCountMap.get(k.id) ?? 0;
    personOptions.push({
      value: k.id,
      label: `👶 น้อง${k.nickname || k.name}`,
      count,
    });
  }

  if (personCountMap.has("parent:dad")) {
    personOptions.push({ value: "parent:dad", label: "👨 คุณพ่อ", count: personCountMap.get("parent:dad")! });
  }
  if (personCountMap.has("parent:mom")) {
    personOptions.push({ value: "parent:mom", label: "👩 คุณแม่", count: personCountMap.get("parent:mom")! });
  }
  if (personCountMap.has("family")) {
    personOptions.push({ value: "family", label: "🏠 ครอบครัว", count: personCountMap.get("family")! });
  }

  // 2. Month options (sorted YYYY-MM)
  const monthCountMap = new Map<string, number>();
  for (const it of items) {
    const ym = it.date.slice(0, 7);
    monthCountMap.set(ym, (monthCountMap.get(ym) ?? 0) + 1);
  }
  const sortedYms = Array.from(monthCountMap.keys()).sort();
  const monthOptions: FilterOption[] = sortedYms.map((ym) => ({
    value: ym,
    label: formatThaiMonthYear(ym),
    count: monthCountMap.get(ym) ?? 0,
  }));

  // 3. Disease options
  const diseaseOptions: FilterOption[] = [];
  for (const cat of DISEASE_CATEGORIES) {
    const count = items.filter((it) => cat.matches(it)).length;
    if (count > 0) {
      diseaseOptions.push({
        value: cat.key,
        label: cat.label,
        count,
      });
    }
  }

  const otherCount = items.filter((it) => !DISEASE_CATEGORIES.some((c) => c.matches(it))).length;
  if (otherCount > 0) {
    diseaseOptions.push({
      value: "other",
      label: "อื่นๆ / ไม่ระบุกลุ่ม",
      count: otherCount,
    });
  }

  return { personOptions, monthOptions, diseaseOptions };
}

import {
  BOY_HEIGHT_STANDARDS,
  BOY_WEIGHT_STANDARDS,
  GIRL_HEIGHT_STANDARDS,
  GIRL_WEIGHT_STANDARDS,
  type GrowthPoint,
} from "@/data/growthStandards";
import type { Sex } from "@/types";

export interface EvaluationResult {
  status: "low" | "slightly_low" | "normal" | "slightly_high" | "high";
  label: string;
  colorClass: string;
  badgeClass: string;
}

/** คำนวณอายุเป็นเดือน */
export function calculateAgeInMonths(birthDateStr: string, dateStr: string): number {
  const b = new Date(birthDateStr);
  const d = new Date(dateStr);
  let months = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  if (d.getDate() < b.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/** หาจุดมาตรฐานที่ใกล้เคียงที่สุด */
function findNearestStandard(standards: GrowthPoint[], ageMonths: number): GrowthPoint {
  const clamped = Math.min(60, Math.max(0, ageMonths));
  let closest = standards[0];
  let minDiff = Math.abs(closest.month - clamped);

  for (const s of standards) {
    const diff = Math.abs(s.month - clamped);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest;
}

export function evaluateWeightForAge(
  weightKg: number,
  ageMonths: number,
  sex: Sex = "M",
): EvaluationResult {
  const standards = sex === "F" ? GIRL_WEIGHT_STANDARDS : BOY_WEIGHT_STANDARDS;
  const std = findNearestStandard(standards, ageMonths);

  if (weightKg < std.p3) {
    return {
      status: "low",
      label: "น้ำหนักน้อยกว่าเกณฑ์",
      colorClass: "text-amber-600",
      badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    };
  }
  if (weightKg < std.p15) {
    return {
      status: "slightly_low",
      label: "ค่อนข้างน้อย",
      colorClass: "text-amber-500",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
  }
  if (weightKg <= std.p85) {
    return {
      status: "normal",
      label: "ตามเกณฑ์ปกติ",
      colorClass: "text-emerald-600",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };
  }
  if (weightKg <= std.p97) {
    return {
      status: "slightly_high",
      label: "ค่อนข้างมาก",
      colorClass: "text-amber-500",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
  }
  return {
    status: "high",
    label: "น้ำหนักเกินเกณฑ์",
    colorClass: "text-rose-600",
    badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  };
}

export function evaluateHeightForAge(
  heightCm: number,
  ageMonths: number,
  sex: Sex = "M",
): EvaluationResult {
  const standards = sex === "F" ? GIRL_HEIGHT_STANDARDS : BOY_HEIGHT_STANDARDS;
  const std = findNearestStandard(standards, ageMonths);

  if (heightCm < std.p3) {
    return {
      status: "low",
      label: "เตี้ยกว่าเกณฑ์",
      colorClass: "text-amber-600",
      badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    };
  }
  if (heightCm < std.p15) {
    return {
      status: "slightly_low",
      label: "ค่อนข้างเตี้ย",
      colorClass: "text-amber-500",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
  }
  if (heightCm <= std.p85) {
    return {
      status: "normal",
      label: "สูงตามเกณฑ์ปกติ",
      colorClass: "text-emerald-600",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };
  }
  return {
    status: "high",
    label: "สูงกว่าเกณฑ์",
    colorClass: "text-emerald-700",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  };
}

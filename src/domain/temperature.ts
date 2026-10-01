export type FeverLevel = "normal" | "low" | "high" | "very_high";

export interface FeverInfo {
  level: FeverLevel;
  label: string;
  colorClass: string;
  badgeClass: string;
  description: string;
}

export function classifyFever(temp: number): FeverInfo {
  if (temp < 37.5) {
    return {
      level: "normal",
      label: "อุณหภูมิปกติ",
      colorClass: "text-emerald-500",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      description: "อุณหภูมิกายปกติ",
    };
  }
  if (temp < 38.5) {
    return {
      level: "low",
      label: "ไข้ต่ำ",
      colorClass: "text-amber-500",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      description: "มีไข้ต่ำ ควรดื่มน้ำมากๆ และเช็ดตัวระบายความร้อน",
    };
  }
  if (temp < 39.5) {
    return {
      level: "high",
      label: "ไข้สูง",
      colorClass: "text-rose-500",
      badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      description: "ไข้สูง ควรเช็ดตัวลดไข้ และพิจารณาให้ยาลดไข้ตามคำแนะนำ",
    };
  }
  return {
    level: "very_high",
    label: "ไข้สูงมาก",
    colorClass: "text-rose-700 font-bold",
    badgeClass: "bg-rose-700/15 text-rose-700 border-rose-700/30",
    description: "⚠️ ไข้สูงมาก ระวังภาวะชักจากไข้สูงในเด็กเล็ก ควรเช็ดตัวลดไข้ทันทีและพบแพทย์หากไม่ลด",
  };
}

export interface AntipyreticSafety {
  severity: "danger" | "warning" | "safe" | "none";
  minutesSinceLast: number | null;
  timeText: string;
  message: string;
  canGiveSafely: boolean;
}

/**
 * ตรวจสอบความปลอดภัยในการให้ยาลดไข้ซ้ำ
 * @param lastGivenTime ISO string หรือ Date ของครั้งล่าสุดที่ให้ยาลดไข้
 * @param now เวลาปัจจุบัน (default = new Date())
 */
export function checkAntipyreticSafety(
  lastGivenTime: string | Date | null | undefined,
  now: Date = new Date(),
): AntipyreticSafety {
  if (!lastGivenTime) {
    return {
      severity: "none",
      minutesSinceLast: null,
      timeText: "",
      message: "ยังไม่มีประวัติการให้ยาลดไข้ก่อนหน้า",
      canGiveSafely: true,
    };
  }

  const lastDate = typeof lastGivenTime === "string" ? new Date(lastGivenTime) : lastGivenTime;
  const diffMs = now.getTime() - lastDate.getTime();
  if (isNaN(diffMs) || diffMs < 0) {
    return {
      severity: "none",
      minutesSinceLast: null,
      timeText: "",
      message: "เวลาก่อนหน้าไม่ถูกต้อง",
      canGiveSafely: true,
    };
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeText = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`;

  // น้อยกว่า 4 ชั่วโมง = อันตราย
  if (totalMinutes < 240) {
    return {
      severity: "danger",
      minutesSinceLast: totalMinutes,
      timeText,
      message: `เพิ่งให้ยาลดไข้ไปเมื่อ ${timeText} ที่แล้ว (ยังไม่ถึง 4 ชม.) ห้ามให้ยาซ้ำเด็ดขาด เพราะอาจเกิดพิษต่อตับ ควรใช้วิธีเช็ดตัวลดไข้แทน`,
      canGiveSafely: false,
    };
  }

  // 4 ถึง 6 ชั่วโมง = เฝ้าระวัง ให้ได้เฉพาะเมื่อมีไข้สูง
  if (totalMinutes < 360) {
    return {
      severity: "warning",
      minutesSinceLast: totalMinutes,
      timeText,
      message: `ให้ยาลดไข้ไปเมื่อ ${timeText} ที่แล้ว (อยู่ในช่วง 4–6 ชม.) แนะนำให้เช็ดตัวก่อน และให้ยาได้เฉพาะเมื่อยังมีไข้สูง (>38.5°C)`,
      canGiveSafely: true,
    };
  }

  // 6 ชั่วโมงขึ้นไป = ปลอดภัย
  return {
    severity: "safe",
    minutesSinceLast: totalMinutes,
    timeText,
    message: `ให้ยาลดไข้ไปเมื่อ ${timeText} ที่แล้ว (พ้นระยะ 6 ชม. แล้ว) สามารถให้ยาได้ตามขนาดยาปกติ`,
    canGiveSafely: true,
  };
}

/**
 * คำนวณขนาดยาพาราเซตามอลมาตรฐานตามน้ำหนักตัว (10 - 15 มก./กก./ครั้ง)
 * สำหรับยาน้ำ 120 มก. / 5 มล.
 */
export function calculateParacetamolDose(weightKg: number): {
  minMl: number;
  maxMl: number;
  displayText: string;
} {
  const minMg = weightKg * 10;
  const maxMg = weightKg * 15;
  // ยาน้ำมาตรฐาน 120mg / 5ml -> 1ml = 24mg
  const minMl = Math.round((minMg / 24) * 10) / 10;
  const maxMl = Math.round((maxMg / 24) * 10) / 10;
  return {
    minMl,
    maxMl,
    displayText: `${minMl} - ${maxMl} มล. (สำหรับยาน้ำ 120 มก./5 มล.)`,
  };
}

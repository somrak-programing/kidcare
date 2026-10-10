import type { ExtractedEvent } from "./schema";

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1,
  "ม.ค.": 1,
  "ม.ค": 1,
  กุมภาพันธ์: 2,
  "ก.พ.": 2,
  "ก.พ": 2,
  มีนาคม: 3,
  "มี.ค.": 3,
  "มี.ค": 3,
  เมษายน: 4,
  "เม.ย.": 4,
  "เม.ย": 4,
  พฤษภาคม: 5,
  "พ.ค.": 5,
  "พ.ค": 5,
  มิถุนายน: 6,
  "มิ.ย.": 6,
  "มิ.ย": 6,
  กรกฎาคม: 7,
  "ก.ค.": 7,
  "ก.ค": 7,
  สิงหาคม: 8,
  "ส.ค.": 8,
  "ส.ค": 8,
  กันยายน: 9,
  "ก.ย.": 9,
  "ก.ย": 9,
  ตุลาคม: 10,
  "ต.ค.": 10,
  "ต.ค": 10,
  พฤศจิกายน: 11,
  "พ.ย.": 11,
  "พ.ย": 11,
  ธันวาคม: 12,
  "ธ.ค.": 12,
  "ธ.ค": 12,
};

const WEEKDAY_NAMES: Record<string, number> = {
  อาทิตย์: 0,
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัส: 4,
  พฤหัสบดี: 4,
  ศุกร์: 5,
  เสาร์: 6,
};

// Regex to find explicit dates like "วันพุธ ที่ 7 ตุลาคมนี้", "29 ตุลาคม", "15 พ.ย. 69", "วันที่ 5 มี.ค."
const DATE_REGEX =
  /(?:วัน(?:ที่|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)?)?\s*(?:ที่\s*:?\s*)?(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.?|ก\.พ\.?|มี\.ค\.?|เม\.ย\.?|พ\.ค\.?|มิ\.ย\.?|ก\.ค\.?|ส\.ค\.?|ก\.ย\.?|ต\.ค\.?|พ\.ย\.?|ธ\.ค\.?)(?:\s*(?:พ\.?ศ\.?|ค\.?ศ\.?)?\s*(\d{2,4}))?/i;

// Regex for slash dates like "07/10/2026" or "7/10/69"
const SLASH_DATE_REGEX = /(?:วัน(?:ที่)?\s*:?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

// Regex for relative dates like "ในวันพรุ่งนี้", "พรุ่งนี้", "มะรืนนี้", "วันนี้"
const RELATIVE_DATE_REGEX = /(?:ใน\s*)?(?:วัน\s*)?(พรุ่งนี้|มะรืนนี้|มะรืน|วันนี้)/i;

// Regex for relative weekdays like "วันศุกร์นี้", "ศุกร์นี้", "วันจันทร์หน้า", "เสาร์นี้"
const RELATIVE_WEEKDAY_REGEX =
  /(?:ใน\s*)?(?:วัน\s*)?(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)\s*(นี้|หน้า)/i;

const TIME_REGEX = /(?:เวลา\s*)?(\d{1,2})[.:](\d{2})\s*(?:น\.|นาฬิกา)?/i;

function addDaysToIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function extractThaiTime(text: string): { time: string | null; matchedText: string | null } {
  // 1. Standard colon/dot time: 14:00, 14.00 น., 09:30, เวลา 14.00 น., ตอน 18.00 น.
  const stdMatch = text.match(/(?:เวลา\s*|ตอน\s*|ช่วง\s*)?(\d{1,2})[.:](\d{2})\s*(?:น\.|นาฬิกา)?/i);
  if (stdMatch) {
    const h = String(Number(stdMatch[1])).padStart(2, "0");
    const m = stdMatch[2];
    return { time: `${h}:${m}`, matchedText: stdMatch[0] };
  }

  // 2. Whole hour with น. / นาฬิกา: 14 น., 9 นาฬิกา, เวลา 10 น.
  const hourMatch = text.match(/(?:เวลา\s*|ตอน\s*|ช่วง\s*)?(\d{1,2})\s*(?:น\.|นาฬิกา)/i);
  if (hourMatch) {
    const h = String(Number(hourMatch[1])).padStart(2, "0");
    return { time: `${h}:00`, matchedText: hourMatch[0] };
  }

  // 3. Noon: เที่ยง / เที่ยงตรง / เที่ยงครึ่ง
  if (/เที่ยงครึ่ง/i.test(text)) return { time: "12:30", matchedText: "เที่ยงครึ่ง" };
  if (/เที่ยง(?:ตรง)?/i.test(text)) {
    const m = text.match(/เที่ยง(?:ตรง)?/i)!;
    return { time: "12:00", matchedText: m[0] };
  }

  // 4. Afternoon: บ่ายโมง, บ่ายโมงครึ่ง, บ่าย 1, บ่าย 2, บ่ายสอง, บ่ายสองครึ่ง, บ่าย 3, บ่ายสาม, บ่าย 4, บ่ายสี่
  const afternoonMatch = text.match(/บ่าย\s*(โมง|1|หนึ่ง|2|สอง|3|สาม|4|สี่|5|ห้า)?\s*(ครึ่ง)?/i);
  if (afternoonMatch && afternoonMatch[0].trim() !== "บ่าย") {
    const digitOrWord = afternoonMatch[1] || "โมง";
    let hour = 13;
    if (digitOrWord === "2" || digitOrWord === "สอง") hour = 14;
    else if (digitOrWord === "3" || digitOrWord === "สาม") hour = 15;
    else if (digitOrWord === "4" || digitOrWord === "สี่") hour = 16;
    else if (digitOrWord === "5" || digitOrWord === "ห้า") hour = 17;
    const minute = afternoonMatch[2] ? "30" : "00";
    return { time: `${hour}:${minute}`, matchedText: afternoonMatch[0] };
  }

  // 5. Late afternoon: 4 โมงเย็น, 5 โมงเย็น, 6 โมงเย็น
  const eveningHourMatch = text.match(/(\d{1,2})\s*โมงเย็น\s*(ครึ่ง)?/i);
  if (eveningHourMatch) {
    let hour = Number(eveningHourMatch[1]);
    if (hour <= 6) hour += 12;
    const minute = eveningHourMatch[2] ? "30" : "00";
    return { time: `${String(hour).padStart(2, "0")}:${minute}`, matchedText: eveningHourMatch[0] };
  }

  // 6. Night: 1 ทุ่ม, ทุ่มนึง, 2 ทุ่ม, 3 ทุ่ม, 4 ทุ่ม, ทุ่มครึ่ง
  const nightMatch = text.match(/(?:(\d{1,2})\s*ทุ่ม|ทุ่ม(?:นึง|ตรง)?)\s*(ครึ่ง)?/i);
  if (nightMatch) {
    const digit = nightMatch[1] ? Number(nightMatch[1]) : 1;
    const hour = 18 + digit;
    const minute = nightMatch[2] ? "30" : "00";
    return { time: `${String(hour).padStart(2, "0")}:${minute}`, matchedText: nightMatch[0] };
  }

  // 7. Morning: 6 โมง, 7 โมง, 8 โมง, 9 โมง, 10 โมง, 11 โมง, 9 โมงเช้า, 9 โมงครึ่ง
  const morningMatch = text.match(/(\d{1,2})\s*โมง(?:เช้า)?\s*(ครึ่ง)?/i);
  if (morningMatch) {
    const hour = String(Number(morningMatch[1])).padStart(2, "0");
    const minute = morningMatch[2] ? "30" : "00";
    return { time: `${hour}:${minute}`, matchedText: morningMatch[0] };
  }

  return { time: null, matchedText: null };
}

function inferPlace(text: string): string {
  if (/พนักงาน|บริษัท|ออฟฟิศ|ที่ทำงาน|HR|ประชุมบริษัท/i.test(text)) return "ที่ทำงาน";
  if (/โรงเรียน|อนุบาล|ครู|นักเรียน/i.test(text)) return "โรงเรียน";
  if (/โรงพยาบาล|รพ\.|คลินิก|แพทย์|หมอ/i.test(text)) return "โรงพยาบาล";
  const matches = text.matchAll(/ที่\s*([^\s,()\n]{2,30})/g);
  for (const m of matches) {
    if (!/ที่ทำงาน|ที่รัก|ที่มี|ที่ทำ|ที่จะ|ที่ได้|ที่นัด|ที่ไหน|ที่สุด|ที่แล้ว|ที่พัก|ที่\s*\d/i.test(m[0])) {
      return m[1].trim();
    }
  }
  return "สถานที่ตามนัด";
}

function cleanTitle(raw: string): string {
  let s = raw
    .replace(/^[@#]\w+/g, "") // remove @All
    .replace(/^[✅✔️❌📌📢🗓️📅👉🏻👉>\-•*]+\s*/g, "") // remove leading icons/bullets
    .replace(/เรียน\s*พนักงานทุกท่าน/gi, "")
    .replace(/ขอเรียนเชิญพนักงานทุกท่านมาร่วมทำบุญด้วยกันนะครับ/gi, "")
    .replace(/ขอเรียนเชิญ\S+/gi, "")
    .replace(/แจ้งเตือนเกี่ยวกับ/gi, "")
    .replace(/แจ้งเตือน/gi, "")
    .replace(/ที่จะมาถึง(?:ใน)?(?:วัน)?(?:พรุ่งนี้|วันนี้|มะรืนนี้)?/gi, "")
    .replace(/(?:ใน)?(?:วัน)?(?:พรุ่งนี้|วันนี้|มะรืนนี้)/gi, "")
    .replace(/(?:ใน)?(?:วัน)?(?:อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)\s*(?:นี้|หน้า)/gi, "")
    .replace(/[>]{2,}/g, " ")
    .replace(/วัดสุดท้าย/g, "วันสุดท้าย") // fix common typo
    .trim();

  // If title ends with weekday or connector, strip it
  s = s.replace(/\s*(?:วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์|ที่)?|คือ|ใน|ณ|ตรงกับ|ตอน|ช่วง)\s*$/g, "").trim();
  s = s.replace(/^[:\-\s]+/, "").trim();
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

export function parseThaiEvents(text: string, todayIso: string): ExtractedEvent[] {
  const [currentY, currentM] = todayIso.split("-").map(Number);
  const normalized = text.replace(/\r\n/g, "\n");
  const defaultPlace = inferPlace(text);

  // Step 1: Split into candidate items by bullet markers, newlines, or "และ"
  let rawSections: string[] = [];
  if (/[✅✔️📌📢🗓️📅•]/.test(normalized)) {
    rawSections = normalized
      .split(/(?=[✅✔️📌📢🗓️📅•])/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    rawSections = normalized
      .split(/(?:\n\s*\n|\n(?=[0-9]+[.)])|(?<=\S)\s+และ\s*)/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // If any section contains multiple dates, sub-split it by \n or "และ"
  const finalSections: string[] = [];
  for (const sec of rawSections) {
    const datesFound = [...sec.matchAll(new RegExp(DATE_REGEX.source, "gi"))];
    if (datesFound.length > 1) {
      const sub = sec.split(/(?:\n|(?<=\S)\s+และ\s*)/).map((s) => s.trim()).filter(Boolean);
      finalSections.push(...sub);
    } else {
      finalSections.push(sec);
    }
  }

  const events: ExtractedEvent[] = [];

  for (const sec of finalSections) {
    const dateMatch = sec.match(DATE_REGEX);
    const slashMatch = !dateMatch ? sec.match(SLASH_DATE_REGEX) : null;
    const relMatch = !dateMatch && !slashMatch ? sec.match(RELATIVE_DATE_REGEX) : null;
    const relWeekdayMatch = !dateMatch && !slashMatch && !relMatch ? sec.match(RELATIVE_WEEKDAY_REGEX) : null;

    if (!dateMatch && !slashMatch && !relMatch && !relWeekdayMatch) continue;

    let isoDate = "";
    let matchedDateText = "";

    if (dateMatch) {
      matchedDateText = dateMatch[0];
      const day = Number(dateMatch[1]);
      const monthName = dateMatch[2].replace(/\s+/g, "");
      const month = THAI_MONTHS[monthName];
      if (!month || day < 1 || day > 31) continue;

      let year = currentY;
      if (dateMatch[3]) {
        let rawY = Number(dateMatch[3]);
        if (rawY < 100) rawY += 2500;
        if (rawY > 2400) year = rawY - 543;
        else year = rawY;
      } else {
        if (month < currentM - 2) year = currentY + 1;
      }
      isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else if (slashMatch) {
      matchedDateText = slashMatch[0];
      const day = Number(slashMatch[1]);
      const month = Number(slashMatch[2]);
      let rawY = Number(slashMatch[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      if (rawY < 100) rawY += 2500;
      let year = rawY > 2400 ? rawY - 543 : rawY;
      isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else if (relMatch) {
      matchedDateText = relMatch[0];
      const relWord = relMatch[1];
      let offset = 0;
      if (relWord.includes("พรุ่งนี้")) offset = 1;
      else if (relWord.includes("มะรืน")) offset = 2;
      else if (relWord.includes("วันนี้")) offset = 0;
      isoDate = addDaysToIso(todayIso, offset);
    } else if (relWeekdayMatch) {
      matchedDateText = relWeekdayMatch[0];
      const weekdayName = relWeekdayMatch[1];
      const modifier = relWeekdayMatch[2]; // "นี้" หรือ "หน้า"
      const targetDOW = WEEKDAY_NAMES[weekdayName] ?? 0;
      const todayDOW = new Date(todayIso + "T00:00:00Z").getUTCDay();
      let diff = (targetDOW - todayDOW + 7) % 7;
      if (modifier === "หน้า") {
        diff = diff === 0 ? 7 : diff + 7;
      } else if (diff === 0 && todayDOW === targetDOW) {
        diff = 0;
      }
      isoDate = addDaysToIso(todayIso, diff);
    }

    if (!isoDate) continue;

    // Extract time using enhanced extractor
    const { time, matchedText: matchedTimeText } = extractThaiTime(sec);

    // Extract title
    let title = "";
    if (dateMatch) {
      const dateIdx = sec.indexOf(dateMatch[0]);
      const beforeDate = sec.slice(0, dateIdx).trim();
      if (beforeDate && cleanTitle(beforeDate).length >= 3) {
        title = cleanTitle(beforeDate);
      }
    } else if (slashMatch) {
      const dateIdx = sec.indexOf(slashMatch[0]);
      const beforeDate = sec.slice(0, dateIdx).trim();
      if (beforeDate && cleanTitle(beforeDate).length >= 3) {
        title = cleanTitle(beforeDate);
      }
    }

    if (!title) {
      let titleCandidate = sec;
      if (matchedDateText) {
        titleCandidate = titleCandidate.replace(matchedDateText, " ");
      }
      if (matchedTimeText) {
        titleCandidate = titleCandidate.replace(matchedTimeText, " ");
      }
      title = cleanTitle(titleCandidate);
    }

    if (!title || title.length < 3) {
      title = cleanTitle(sec);
    }

    if (!title || title.length < 3) {
      const parts = sec.split(/[>\n]/).map((p) => cleanTitle(p)).filter(Boolean);
      for (const p of parts) {
        if (!p.match(DATE_REGEX) && p.length >= 3) {
          title = p;
          break;
        }
      }
    }

    // If still no title, inspect other meaningful lines from the entire text
    if (!title || title.length < 3) {
      const candidateLines = normalized
        .split("\n")
        .map(cleanTitle)
        .filter((l) => l.length >= 3 && !/^(?:เรียน|ขอเรียน|แจ้งเตือน|สวัสดี|ขอบคุณ)/.test(l));
      if (candidateLines.length > 0) {
        title = candidateLines[0];
      }
    }

    if (!title || title.length < 3) {
      title = "นัดหมาย / กิจกรรม";
    }

    title = title.replace(/[>:]+$/g, "").trim();

    events.push({
      title,
      date: isoDate,
      time,
      place: defaultPlace,
      notes: null,
    });
  }

  // Deduplicate by title + date
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.title}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

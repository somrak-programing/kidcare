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

// Regex to find explicit dates like "วันพุธ ที่ 7 ตุลาคมนี้", "29 ตุลาคม", "15 พ.ย. 69", "วันที่ 5 มี.ค."
const DATE_REGEX =
  /(?:วัน(?:ที่|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)?)?\s*(?:ที่\s*:?\s*)?(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.?|ก\.พ\.?|มี\.ค\.?|เม\.ย\.?|พ\.ค\.?|มิ\.ย\.?|ก\.ค\.?|ส\.ค\.?|ก\.ย\.?|ต\.ค\.?|พ\.ย\.?|ธ\.ค\.?)(?:\s*(?:พ\.?ศ\.?|ค\.?ศ\.?)?\s*(\d{2,4}))?/i;

// Regex for slash dates like "07/10/2026" or "7/10/69"
const SLASH_DATE_REGEX = /(?:วัน(?:ที่)?\s*:?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;

// Regex for relative dates like "ในวันพรุ่งนี้", "พรุ่งนี้", "มะรืนนี้", "วันนี้"
const RELATIVE_DATE_REGEX = /(?:ใน\s*)?(?:วัน\s*)?(พรุ่งนี้|มะรืนนี้|มะรืน|วันนี้)/i;

const TIME_REGEX = /(?:เวลา\s*)?(\d{1,2})[.:](\d{2})\s*(?:น\.|นาฬิกา)?/i;

function addDaysToIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function inferPlace(text: string): string {
  if (/พนักงาน|บริษัท|ออฟฟิศ|ที่ทำงาน|HR|ประชุมบริษัท/i.test(text)) return "ที่ทำงาน";
  if (/โรงเรียน|อนุบาล|ครู|นักเรียน/i.test(text)) return "โรงเรียน";
  if (/โรงพยาบาล|รพ\.|คลินิก|แพทย์|หมอ/i.test(text)) return "โรงพยาบาล";
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
    .replace(/[>]{2,}/g, " ")
    .replace(/วัดสุดท้าย/g, "วันสุดท้าย") // fix common typo
    .trim();

  // If title ends with weekday or connector, strip it
  s = s.replace(/\s*(?:วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์|ที่)?|คือ|ใน|ณ|ตรงกับ)\s*$/g, "").trim();
  s = s.replace(/^[:\-\s]+/, "").trim();
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

    if (!dateMatch && !slashMatch && !relMatch) continue;

    let isoDate = "";

    if (dateMatch) {
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
      const day = Number(slashMatch[1]);
      const month = Number(slashMatch[2]);
      let rawY = Number(slashMatch[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      if (rawY < 100) rawY += 2500;
      let year = rawY > 2400 ? rawY - 543 : rawY;
      isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else if (relMatch) {
      const relWord = relMatch[1];
      let offset = 0;
      if (relWord.includes("พรุ่งนี้")) offset = 1;
      else if (relWord.includes("มะรืน")) offset = 2;
      else if (relWord.includes("วันนี้")) offset = 0;
      isoDate = addDaysToIso(todayIso, offset);
    }

    if (!isoDate) continue;

    // Extract time if any
    let time: string | null = null;
    const timeMatch = sec.match(TIME_REGEX);
    if (timeMatch) {
      const h = String(Number(timeMatch[1])).padStart(2, "0");
      const m = timeMatch[2];
      time = `${h}:${m}`;
    }

    // Extract title
    let title = "";
    if (dateMatch) {
      const dateIdx = sec.indexOf(dateMatch[0]);
      const beforeDate = sec.slice(0, dateIdx).trim();
      if (beforeDate) title = cleanTitle(beforeDate);
    } else if (slashMatch) {
      const dateIdx = sec.indexOf(slashMatch[0]);
      const beforeDate = sec.slice(0, dateIdx).trim();
      if (beforeDate) title = cleanTitle(beforeDate);
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

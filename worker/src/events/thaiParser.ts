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

// Regex to find dates like "วันพุธ ที่ 7 ตุลาคมนี้", "29 ตุลาคม", "15 พ.ย. 69", "วันที่ 5 มี.ค."
const DATE_REGEX =
  /(?:วัน(?:ที่|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)?)?\s*(?:ที่)?\s*(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.?|ก\.พ\.?|มี\.ค\.?|เม\.ย\.?|พ\.ค\.?|มิ\.ย\.?|ก\.ค\.?|ส\.ค\.?|ก\.ย\.?|ต\.ค\.?|พ\.ย\.?|ธ\.ค\.?)(?:\s*(?:พ\.?ศ\.?|ค\.?ศ\.?)?\s*(\d{2,4}))?/i;

const TIME_REGEX = /(?:เวลา\s*)?(\d{1,2})[.:](\d{2})\s*(?:น\.|นาฬิกา)?/i;

function cleanTitle(raw: string): string {
  let s = raw
    .replace(/^[@#]\w+/g, "") // remove @All
    .replace(/^[✅✔️❌📌📢🗓️📅👉🏻👉>\-•*]+\s*/g, "") // remove leading icons/bullets
    .replace(/[>]{2,}/g, " ")
    .replace(/วัดสุดท้าย/g, "วันสุดท้าย") // fix common typo
    .trim();

  // If title ends with weekday or connector, strip it
  s = s.replace(/\s*(?:วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์|ที่)?|คือ|ใน|ณ|ตรงกับ)\s*$/g, "").trim();
  return s;
}

export function parseThaiEvents(text: string, todayIso: string): ExtractedEvent[] {
  const [currentY, currentM] = todayIso.split("-").map(Number);
  const normalized = text.replace(/\r\n/g, "\n");

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
    if (!dateMatch) continue;

    const day = Number(dateMatch[1]);
    const monthName = dateMatch[2].replace(/\s+/g, "");
    const month = THAI_MONTHS[monthName];
    if (!month || day < 1 || day > 31) continue;

    let year = currentY;
    if (dateMatch[3]) {
      let rawY = Number(dateMatch[3]);
      if (rawY < 100) {
        rawY += 2500;
      }
      if (rawY > 2400) {
        year = rawY - 543;
      } else {
        year = rawY;
      }
    } else {
      if (month < currentM - 2) {
        year = currentY + 1;
      }
    }

    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Extract time if any
    let time: string | null = null;
    const timeMatch = sec.match(TIME_REGEX);
    if (timeMatch) {
      const h = String(Number(timeMatch[1])).padStart(2, "0");
      const m = timeMatch[2];
      time = `${h}:${m}`;
    }

    // Extract title from section before the date match
    let title = "";
    const dateIdx = sec.indexOf(dateMatch[0]);
    const beforeDate = sec.slice(0, dateIdx).trim();

    if (beforeDate) {
      title = cleanTitle(beforeDate);
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

    if (!title || title.length < 3) {
      title = "กิจกรรมโรงเรียน";
    }

    title = title.replace(/[>:]+$/g, "").trim();

    events.push({
      title,
      date: isoDate,
      time,
      place: "โรงเรียน",
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

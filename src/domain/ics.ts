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

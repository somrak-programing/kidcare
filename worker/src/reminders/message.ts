const BKK_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export interface ReminderItem {
  date: string;
  childName: string;
  title: string;
  time?: string;
  place?: string;
  remindTiming?: "normal" | "special";
}

export function bangkokDate(now: Date, addDays = 0): string {
  return new Date(now.getTime() + BKK_OFFSET_MS + addDays * DAY_MS).toISOString().slice(0, 10);
}

export function bangkokHour(now: Date): number {
  return new Date(now.getTime() + BKK_OFFSET_MS).getUTCHours();
}

export function thaiDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}`;
}

function dedupeItems(items: ReminderItem[]): ReminderItem[] {
  const seen = new Set<string>();
  const out: ReminderItem[] = [];
  for (const it of items) {
    // Normalize spaces and lowercase for dedupe key
    const cleanTitle = it.title.trim().toLowerCase();
    const key = `${it.date}|${it.childName}|${cleanTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function section(label: string, date: string, items: ReminderItem[]): string | null {
  const list = dedupeItems(items)
    .filter((i) => i.date === date)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.childName.localeCompare(b.childName));
  if (!list.length) return null;
  const lines = list.map((i) => `• ${i.childName}: ${i.title}${i.time ? ` ${i.time} น.` : ""}${i.place ? ` · ${i.place}` : ""}`);
  return [`${label} (${thaiDay(date)})`, ...lines].join("\n");
}

export function buildReminderText(items: ReminderItem[], today: string, tomorrow: string): string | null {
  const parts = [section("วันนี้", today, items), section("พรุ่งนี้", tomorrow, items)].filter((p): p is string => p !== null);
  if (!parts.length) return null;
  return `🔔 KidCare — แจ้งเตือนนัดหมาย\n${parts.join("\n\n")}`;
}

export function buildEveningReminderText(items: ReminderItem[], tomorrow: string): string | null {
  // Only items for tomorrow that have special timing
  const specialTomorrow = dedupeItems(items)
    .filter((i) => i.date === tomorrow && i.remindTiming === "special")
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.childName.localeCompare(b.childName));
  if (!specialTomorrow.length) return null;
  const lines = specialTomorrow.map((i) => `• ${i.childName}: ${i.title}${i.time ? ` ${i.time} น.` : ""}${i.place ? ` · ${i.place}` : ""}`);
  return `🔔 KidCare — เตือนเตรียมตัวช่วงเย็น (นัดพรุ่งนี้ ${thaiDay(tomorrow)})\n${lines.join("\n")}\n\n💡 เตือนล่วงหน้าช่วงเย็นเผื่อแวะซื้อของ/เตรียมอุปกรณ์ล่วงหน้าครับ`;
}

export function formatUpcomingSummary(items: ReminderItem[], max = 5): string {
  const deduped = dedupeItems(items).slice(0, max);
  if (!deduped.length) return "ยังไม่มีนัดหมายอื่นที่รออยู่ครับ";
  const lines = deduped.map((i) => `• ${i.childName ? `${i.childName}: ` : ""}${i.title} (${thaiDay(i.date)}${i.time ? ` ${i.time} น.` : ""}${i.place ? ` · ${i.place}` : ""})`);
  return lines.join("\n");
}

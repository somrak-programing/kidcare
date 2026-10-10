import type { LineFlexMessage } from "../line/api";

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

export function formatUpcomingTableText(items: ReminderItem[], max = 10): string {
  const deduped = dedupeItems(items).slice(0, max);
  if (!deduped.length) return "📋 ขณะนี้ยังไม่มีรายการนัดหมายที่รออยู่ครับ 🎉";
  const lines = deduped.map((i, idx) => {
    const timeStr = i.time ? ` ⏰ ${i.time} น.` : "";
    const placeStr = i.place && i.place !== "สถานที่ตามนัด" ? `\n   📍 ${i.place}` : "";
    const personStr = i.childName ? `👤 ${i.childName}: ` : "";
    return `${idx + 1}. 🗓️ ${thaiDay(i.date)}${timeStr}\n   ${personStr}${i.title}${placeStr}`;
  });
  return `🗓️ ตารางนัดหมายที่รออยู่ (${deduped.length} รายการ)\n━━━━━━━━━━━━━━━━━━━━\n${lines.join("\n────────────────────\n")}\n━━━━━━━━━━━━━━━━━━━━`;
}

export function buildUpcomingTableFlex(items: ReminderItem[], max = 10): LineFlexMessage {
  const deduped = dedupeItems(items).slice(0, max);
  const total = deduped.length;
  const altText = `ตารางนัดหมาย KidCare (${total} รายการ):\n${deduped.map((d, i) => `${i + 1}. ${thaiDay(d.date)}${d.time ? ` ${d.time}` : ""} - ${d.childName ? `${d.childName}: ` : ""}${d.title}`).join("\n")}`;

  const tableHeader = {
    type: "box",
    layout: "horizontal",
    backgroundColor: "#F1F5F9",
    paddingTop: "8px",
    paddingBottom: "8px",
    paddingStart: "12px",
    paddingEnd: "12px",
    contents: [
      { type: "text", text: "วัน/เวลา", weight: "bold", size: "xs", color: "#475569", flex: 3 },
      { type: "text", text: "สำหรับ", weight: "bold", size: "xs", color: "#475569", flex: 2 },
      { type: "text", text: "รายการนัดหมาย", weight: "bold", size: "xs", color: "#475569", flex: 5 },
    ],
  };

  const rows: any[] = [];
  deduped.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    const dateFormatted = thaiDay(item.date);
    const timeFormatted = item.time ? `${item.time} น.` : "-";
    const personName = item.childName || "ทุกคน";
    const personColor =
      personName.includes("พ่อ") ? "#2563EB" :
      personName.includes("แม่") ? "#DB2777" :
      personName.includes("วินเทจ") ? "#059669" : "#4F46E5";

    const rowBox = {
      type: "box",
      layout: "horizontal",
      backgroundColor: isEven ? "#FFFFFF" : "#F8FAFC",
      paddingTop: "10px",
      paddingBottom: "10px",
      paddingStart: "12px",
      paddingEnd: "12px",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 3,
          contents: [
            { type: "text", text: dateFormatted, weight: "bold", size: "xs", color: "#1E293B" },
            { type: "text", text: timeFormatted, size: "xxs", color: "#64748B", margin: "xs" },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          flex: 2,
          contents: [
            { type: "text", text: personName, weight: "bold", size: "xs", color: personColor },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          flex: 5,
          contents: [
            { type: "text", text: item.title, size: "xs", color: "#0F172A", weight: "bold", wrap: true },
            ...(item.place && item.place !== "สถานที่ตามนัด"
              ? [{ type: "text", text: `📍 ${item.place}`, size: "xxs", color: "#64748B", wrap: true, margin: "xs" }]
              : []),
          ],
        },
      ],
    };

    rows.push(rowBox);
    if (idx < deduped.length - 1) {
      rows.push({ type: "separator", color: "#E2E8F0" });
    }
  });

  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1E3A8A",
        paddingTop: "14px",
        paddingBottom: "14px",
        paddingStart: "16px",
        paddingEnd: "16px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "🗓️ ตารางนัดหมายที่รออยู่",
                weight: "bold",
                size: "md",
                color: "#FFFFFF",
                flex: 1,
              },
              {
                type: "text",
                text: `${total} รายการ`,
                size: "xs",
                color: "#93C5FD",
                align: "end",
                gravity: "center",
              },
            ],
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [tableHeader, { type: "separator", color: "#CBD5E1" }, ...rows],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingTop: "10px",
        paddingBottom: "10px",
        paddingStart: "16px",
        paddingEnd: "16px",
        backgroundColor: "#F8FAFC",
        contents: [
          {
            type: "text",
            text: "💡 พิมพ์เพิ่มนัดใหม่ เช่น 'พรุ่งนี้ 14:00 เอารถไปตั้งศูนย์' ได้ตลอดเวลาครับ",
            size: "xxs",
            color: "#64748B",
            align: "center",
            wrap: true,
          },
        ],
      },
    },
  };
}

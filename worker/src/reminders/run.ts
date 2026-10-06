import type { LineApi } from "../line/api";
import type { RecipientStore } from "../line/recipients";
import { bangkokDate, bangkokHour, buildEveningReminderText, buildReminderText, type ReminderItem } from "./message";

export type ReminderSlot = "morning" | "evening";

export async function runDailyReminders(deps: {
  now: Date;
  familyId: string;
  reader: { loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> };
  store: RecipientStore;
  api: LineApi;
  slot?: ReminderSlot;
}): Promise<{ sent: number; items: number; recipients: number }> {
  const recipients = (await deps.store.list()).filter((r) => r.status === "approved");
  if (!recipients.length) return { sent: 0, items: 0, recipients: 0 };

  const slot: ReminderSlot = deps.slot ?? (bangkokHour(deps.now) >= 15 ? "evening" : "morning");
  const today = bangkokDate(deps.now);
  const tomorrow = bangkokDate(deps.now, 1);

  if (slot === "evening") {
    // Evening reminder: check tomorrow's items that have remindTiming === "special"
    const items = await deps.reader.loadReminderItems(deps.familyId, [tomorrow]);
    const text = buildEveningReminderText(items, tomorrow);
    if (!text) return { sent: 0, items: items.length, recipients: recipients.length };
    await deps.api.multicast(recipients.map((r) => r.userId), text);
    return { sent: recipients.length, items: items.length, recipients: recipients.length };
  }

  // Morning reminder: check today and tomorrow
  const items = await deps.reader.loadReminderItems(deps.familyId, [today, tomorrow]);
  const text = buildReminderText(items, today, tomorrow);
  if (!text) return { sent: 0, items: items.length, recipients: recipients.length };
  await deps.api.multicast(recipients.map((r) => r.userId), text);
  return { sent: recipients.length, items: items.length, recipients: recipients.length };
}

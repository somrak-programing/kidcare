import type { LineApi } from "../line/api";
import type { RecipientStore } from "../line/recipients";
import { bangkokDate, buildReminderText, type ReminderItem } from "./message";

export async function runDailyReminders(deps: {
  now: Date;
  familyId: string;
  reader: { loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> };
  store: RecipientStore;
  api: LineApi;
}): Promise<{ sent: number; items: number; recipients: number }> {
  const recipients = (await deps.store.list()).filter((r) => r.status === "approved");
  if (!recipients.length) return { sent: 0, items: 0, recipients: 0 };
  const today = bangkokDate(deps.now);
  const tomorrow = bangkokDate(deps.now, 1);
  const items = await deps.reader.loadReminderItems(deps.familyId, [today, tomorrow]);
  const text = buildReminderText(items, today, tomorrow);
  if (!text) return { sent: 0, items: items.length, recipients: recipients.length };
  await deps.api.multicast(recipients.map((r) => r.userId), text);
  return { sent: recipients.length, items: items.length, recipients: recipients.length };
}

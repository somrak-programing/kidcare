import { expect, test, vi } from "vitest";
import { kvRecipientStore } from "../src/line/recipients";
import { runDailyReminders } from "../src/reminders/run";
import { memoryKV } from "./helpers";

const NOW = new Date("2026-10-02T00:00:00Z"); // 07:00 BKK, Fri 2 Oct
const api = () => ({ profile: vi.fn(), reply: vi.fn(), multicast: vi.fn(async () => {}) });

async function storeWith(...rs: [string, "pending" | "approved"][]) {
  const s = kvRecipientStore(memoryKV());
  for (const [userId, status] of rs) await s.put({ userId, displayName: "", status, addedAt: "x" });
  return s;
}

test("multicasts to approved recipients only, asks for today+tomorrow", async () => {
  const reader = { loadReminderItems: vi.fn(async () => [{ date: "2026-10-02", childName: "มะลิ", title: "พิษสุนัขบ้า เข็ม 2" }]) };
  const a = api();
  const r = await runDailyReminders({ now: NOW, familyId: "F", reader, store: await storeWith(["U1", "approved"], ["U2", "pending"], ["U3", "approved"]), api: a });
  expect(r).toEqual({ sent: 2 });
  expect(reader.loadReminderItems).toHaveBeenCalledWith("F", ["2026-10-02", "2026-10-03"]);
  expect(a.multicast).toHaveBeenCalledWith(["U1", "U3"], expect.stringContaining("• มะลิ: พิษสุนัขบ้า เข็ม 2"));
});

test("no items → no message", async () => {
  const a = api();
  const r = await runDailyReminders({ now: NOW, familyId: "F", reader: { loadReminderItems: async () => [] }, store: await storeWith(["U1", "approved"]), api: a });
  expect(r).toEqual({ sent: 0 });
  expect(a.multicast).not.toHaveBeenCalled();
});

test("no approved recipients → does not even read Firestore", async () => {
  const reader = { loadReminderItems: vi.fn(async () => []) };
  expect(await runDailyReminders({ now: NOW, familyId: "F", reader, store: await storeWith(["U2", "pending"]), api: api() })).toEqual({ sent: 0 });
  expect(reader.loadReminderItems).not.toHaveBeenCalled();
});

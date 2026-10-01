import type { LineApi } from "./api";
import type { RecipientStore } from "./recipients";

export const REPLY_PENDING = "ขอบคุณที่เพิ่มเพื่อน KidCare 🙏 รอผู้ดูแลกดอนุมัติในแอปก่อน แล้วจะเริ่มได้รับแจ้งเตือนนัดของลูกทุกเช้า 7 โมง";
export const REPLY_WELCOME_BACK = "ยินดีต้อนรับกลับ จะได้รับแจ้งเตือนนัดของลูกตามเดิม";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
}

export async function handleLineWebhook(
  body: string,
  deps: { store: RecipientStore; api: LineApi; now?: () => Date },
): Promise<void> {
  const payload = JSON.parse(body) as { events?: LineEvent[] };
  const now = deps.now ?? (() => new Date());
  for (const ev of payload.events ?? []) {
    const userId = ev.source?.type === "user" ? ev.source.userId : undefined;
    if (!userId) continue;
    if (ev.type === "follow") {
      const existing = await deps.store.get(userId);
      if (!existing) {
        const { displayName } = await deps.api.profile(userId).catch(() => ({ displayName: "" }));
        await deps.store.put({ userId, displayName, status: "pending", addedAt: now().toISOString() });
      }
      if (ev.replyToken) {
        await deps.api.reply(ev.replyToken, existing?.status === "approved" ? REPLY_WELCOME_BACK : REPLY_PENDING).catch(() => {});
      }
    } else if (ev.type === "unfollow") {
      await deps.store.delete(userId);
    }
  }
}

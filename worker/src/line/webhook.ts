import type { ClaudeLike } from "../extract";
import { extractEvents } from "../events/extract";
import type { ExtractedEvent } from "../events/schema";
import type { FirestoreClient } from "../reminders/firestore";
import { bangkokDate, formatUpcomingSummary, thaiDay } from "../reminders/message";
import type { LineApi, LineMessage, LineQuickReplyItem } from "./api";
import type { KVLike, RecipientStore } from "./recipients";

export const REPLY_PENDING = "ขอบคุณที่เพิ่มเพื่อน KidCare 🙏 รอผู้ดูแลกดอนุมัติในแอปก่อน แล้วจะเริ่มได้รับแจ้งเตือนนัดของลูกทุกเช้า 7 โมง";
export const REPLY_WELCOME_BACK = "ยินดีต้อนรับกลับ จะได้รับแจ้งเตือนนัดของลูกตามเดิม";
export const REPLY_NOT_APPROVED = "ขออภัยครับ บัญชี LINE นี้ยังไม่ได้รับอนุมัติในระบบ KidCare กรุณาให้ผู้ดูแลกดยืนยันในแอปก่อนนะครับ 🙏";
export const REPLY_NO_EVENTS = "ไม่พบวันนัดหมายหรือกิจกรรมในข้อความนี้ครับ 💬\n(สามารถส่งต่อข้อความแจ้งเตือน เช่น วันเปิดเทอม, กิจกรรมโรงเรียน, วันสอบ, หรือนัดหมอ มาได้เลยครับ)";
export const REPLY_DRAFT_EXPIRED = "ขออภัยครับ รายการนี้หมดอายุแล้ว (เกิน 10 นาที) กรุณาส่งข้อความใหม่อีกครั้งนะครับ";
export const REPLY_CANCELLED = "ยกเลิกการบันทึกเรียบร้อยครับ 👌";

export function isUpcomingQuery(text: string): boolean {
  const clean = text.trim().toLowerCase();
  if (
    /(สรุป|ดู|เช็ค|ตรวจ|ขอ|แสดง|ตาราง).*(นัด|นัดหมาย|ค้าง)/i.test(clean) ||
    /(นัด|นัดหมาย).*(อะไร|บ้าง|ไหน|ทั้งหมด|ค้าง|ปัจจุบัน|เร็วๆ)/i.test(clean) ||
    /มีนัด/i.test(clean) ||
    clean === "นัด" ||
    clean === "นัดหมาย" ||
    clean === "สรุป" ||
    clean === "ตาราง" ||
    clean.includes("ค้างนัด") ||
    clean.includes("สรุปนัด") ||
    clean.includes("ดูนัด") ||
    clean.includes("วันนัดหมาย") ||
    clean.includes("สรุปวันนัด")
  ) {
    // Exclude if it looks like adding a new appointment (contains dates or times)
    if (!/พรุ่งนี้|มะรืน|เมื่อวาน|\d{1,2}\s*(?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)|\d{1,2}\/\d{1,2}|เวลา\s*\d|\d{1,2}[.:]\d{2}|\d{1,2}\s*โมง/i.test(clean)) {
      return true;
    }
  }
  return false;
}

export interface DraftEvents {
  events: ExtractedEvent[];
  familyId: string;
  createdAt: string;
  targetChildId?: string;
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data?: string };
}

export interface WebhookDeps {
  store: RecipientStore;
  api: LineApi;
  kv?: KVLike;
  client?: ClaudeLike;
  firestore?: FirestoreClient;
  familyId?: string;
  now?: () => Date;
}

async function replyOrPush(
  deps: WebhookDeps,
  userId: string,
  replyToken: string | undefined,
  message: LineMessage,
): Promise<void> {
  let sent = false;
  if (replyToken) {
    try {
      await deps.api.reply(replyToken, message);
      sent = true;
    } catch {
      console.error("line reply failed");
    }
  }
  if (!sent && userId) {
    if (deps.api.push) {
      try {
        await deps.api.push(userId, message);
        sent = true;
      } catch (err) {
        console.error("line push failed:", err instanceof Error ? err.message : String(err));
        if (typeof message !== "string" && message.quickReply) {
          try {
            await deps.api.push(userId, message.text);
            sent = true;
          } catch {
            // ignore
          }
        }
      }
    }
    if (!sent) {
      const text = typeof message === "string" ? message : message.text;
      await deps.api.multicast([userId], text).catch(() => {
        console.error("line multicast failed");
      });
    }
  }
}

export async function handleLineWebhook(body: string, deps: WebhookDeps): Promise<void> {
  const payload = JSON.parse(body) as { events?: LineEvent[] };
  const now = deps.now ?? (() => new Date());

  for (const ev of payload.events ?? []) {
    const userId = ev.source?.type === "user" ? ev.source.userId : undefined;
    if (!userId) continue;

    if (ev.type === "follow") {
      const existing = await deps.store.get(userId);
      if (!existing) {
        const { displayName } = await deps.api.profile(userId).catch(() => {
          console.error("line profile failed");
          return { displayName: "" };
        });
        await deps.store.put({ userId, displayName, status: "pending", addedAt: now().toISOString() });
      }
      await replyOrPush(deps, userId, ev.replyToken, existing?.status === "approved" ? REPLY_WELCOME_BACK : REPLY_PENDING);
      continue;
    }

    if (ev.type === "unfollow") {
      await deps.store.delete(userId);
      continue;
    }

    if (ev.type === "message" && ev.message?.type === "text") {
      const user = await deps.store.get(userId);
      if (!user || user.status !== "approved") {
        await replyOrPush(deps, userId, ev.replyToken, REPLY_NOT_APPROVED);
        continue;
      }

      if (!deps.client || !deps.kv || !deps.firestore || !deps.familyId) {
        continue;
      }

      const text = ev.message?.text?.trim() ?? "";
      if (!text || text.length > 5000) {
        await replyOrPush(deps, userId, ev.replyToken, REPLY_NO_EVENTS);
        continue;
      }

      // Check if user has an active pending draft and sent a response (e.g. "เตือนแบบพิเศษ", "พิเศษ", "ปกติ", "บันทึกให้พ่อ")
      const pendingDraftId = await deps.kv.get(`user_draft:${userId}`);
      if (pendingDraftId) {
        const rawDraft = await deps.kv.get(`draft:${pendingDraftId}`);
        if (rawDraft) {
          const lower = text.toLowerCase();

          // 1. ตอบรูปแบบการเตือน: พิเศษ / ปกติ
          if (lower.includes("พิเศษ")) {
            await executeConfirmation(pendingDraftId, undefined, "special", ev.replyToken, deps, now, userId);
            await deps.kv.delete(`user_draft:${userId}`);
            continue;
          }
          if (lower.includes("ปกติ")) {
            await executeConfirmation(pendingDraftId, undefined, "normal", ev.replyToken, deps, now, userId);
            await deps.kv.delete(`user_draft:${userId}`);
            continue;
          }
          if (lower === "ยกเลิก" || lower === "cancel") {
            await deps.kv.delete(`draft:${pendingDraftId}`);
            await deps.kv.delete(`user_draft:${userId}`);
            await replyOrPush(deps, userId, ev.replyToken, REPLY_CANCELLED);
            continue;
          }

          // 2. ตอบเลือกบุคคล: พ่อ / แม่ / ลูก (เฉพาะข้อความสั้นๆ ที่ไม่ใช่ข้อความสร้างนัดใหม่)
          const isTargetSelection = text.length <= 20 && !/พรุ่งนี้|มะรืน|วันที่|\d{1,2}[.:]\d{2}|\d{1,2}\s*โมง/i.test(text);
          let chosenTarget: string | null = null;
          if (isTargetSelection) {
            if (lower.includes("พ่อ")) chosenTarget = "parent:dad";
            else if (lower.includes("แม่")) chosenTarget = "parent:mom";
            else if (lower.includes("ทุกคน")) chosenTarget = "all";
          }

          if (chosenTarget) {
            let parsed: DraftEvents;
            try {
              parsed = JSON.parse(rawDraft);
              parsed.targetChildId = chosenTarget;
              await deps.kv.put(`draft:${pendingDraftId}`, JSON.stringify(parsed), { expirationTtl: 600 });
            } catch {
              // ignore
            }

            const targetLabel = chosenTarget === "parent:dad" ? "คุณพ่อ" : chosenTarget === "parent:mom" ? "คุณแม่" : "ทุกคนในบ้าน";
            const timingItems: LineQuickReplyItem[] = [
              {
                type: "action",
                action: {
                  type: "postback",
                  label: "🔔 ปกติ (เช้า 07:00)",
                  data: `action=confirm&id=${pendingDraftId}&childId=${chosenTarget}&timing=normal`,
                  displayText: "เตือนแบบปกติ",
                },
              },
              {
                type: "action",
                action: {
                  type: "postback",
                  label: "⭐ พิเศษ (+เตือนเย็น)",
                  data: `action=confirm&id=${pendingDraftId}&childId=${chosenTarget}&timing=special`,
                  displayText: "เตือนแบบพิเศษ (+เย็นก่อนวันนัด)",
                },
              },
              {
                type: "action",
                action: {
                  type: "postback",
                  label: "❌ ยกเลิก",
                  data: `action=cancel&id=${pendingDraftId}`,
                  displayText: "ยกเลิก",
                },
              },
            ];

            await replyOrPush(deps, userId, ev.replyToken, {
              type: "text",
              text: `ต้องการตั้งเวลาแจ้งเตือนสำหรับ${targetLabel}แบบไหนดีครับ?\n\n1. 🔔 ปกติ: เตือนเช้า 07:00 น. ก่อนวันนัด 1 วัน และเช้าวันนัด\n2. ⭐ พิเศษ: เพิ่มเตือนตอนเย็น 18:00 น. ก่อนวันนัด (สำหรับเตรียมของ/ซื้อของ)\n\n(กดปุ่มหรือพิมพ์ 'ปกติ' / 'พิเศษ' ได้เลยครับ)`,
              quickReply: { items: timingItems },
            });
            continue;
          }
        } else {
          await deps.kv.delete(`user_draft:${userId}`);
        }
      }

      // Check if user is asking to view pending/upcoming appointments
      if (isUpcomingQuery(text)) {
        if (deps.firestore?.loadUpcomingSummary) {
          const today = bangkokDate(now());
          const upcoming = await deps.firestore.loadUpcomingSummary(deps.familyId, today, 10).catch(() => []);
          const summaryText = formatUpcomingSummary(upcoming, 10);
          const replyMsg = upcoming.length > 0
            ? `📋 รายการนัดหมายที่รออยู่เร็วๆ นี้ (${upcoming.length} รายการ):\n\n${summaryText}\n\n💡 สามารถพิมพ์เพิ่มนัดหมายใหม่ เช่น 'พรุ่งนี้ 14:00 เอารถไปตั้งศูนย์' ได้ตลอดเวลาครับ`
            : "📋 ขณะนี้ยังไม่มีรายการนัดหมายที่รออยู่ครับ 🎉\n\n(หากต้องการเพิ่มนัดหมาย สามารถพิมพ์รายละเอียด เช่น 'พรุ่งนี้ 10:00 ไปหาหมอ' หรือส่งข้อความจากโรงเรียนมาได้เลยครับ)";

          await replyOrPush(deps, userId, ev.replyToken, replyMsg);
          continue;
        }
      }

      let events: ExtractedEvent[] = [];
      try {
        events = await extractEvents(deps.client, text, now().toISOString().slice(0, 10));
      } catch (err) {
        console.error("event extraction failed", err instanceof Error ? err.name : "unknown");
        await replyOrPush(deps, userId, ev.replyToken, "ขออภัยครับ เกิดข้อผิดพลาดในการวิเคราะห์ข้อความ กรุณาลองใหม่อีกครั้งครับ");
        continue;
      }

      if (!events.length) {
        await replyOrPush(deps, userId, ev.replyToken, REPLY_NO_EVENTS);
        continue;
      }

      const draftId = crypto.randomUUID().slice(0, 8);
      await deps.kv.put(
        `draft:${draftId}`,
        JSON.stringify({ events, familyId: deps.familyId, createdAt: now().toISOString() }),
        { expirationTtl: 600 },
      );
      await deps.kv.put(`user_draft:${userId}`, draftId, { expirationTtl: 600 });

      let children: Array<{ id: string; name: string; nickname?: string }> = [];
      if (deps.kv) {
        const cached = await deps.kv.get(`family_children:${deps.familyId}`);
        if (cached) {
          try {
            children = JSON.parse(cached);
          } catch {
            // ignore
          }
        }
      }

      if (!children.length && deps.firestore) {
        try {
          const fetchPromise = deps.firestore.loadChildren(deps.familyId);
          const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 400));
          children = await Promise.race([fetchPromise, timeoutPromise]);
          if (children.length > 0 && deps.kv) {
            await deps.kv.put(`family_children:${deps.familyId}`, JSON.stringify(children), {
              expirationTtl: 86400,
            }).catch(() => {});
          }
        } catch {
          if (deps.familyId === "XqMb4retoBTkO7feIQkS") {
            children = [{ id: "vintage", name: "วินเทจ", nickname: "วินเทจ" }];
          } else {
            children = [{ id: "child", name: "ลูก", nickname: "ลูก" }];
          }
          if (deps.kv) {
            await deps.kv.put(`family_children:${deps.familyId}`, JSON.stringify(children), {
              expirationTtl: 300,
            }).catch(() => {});
          }
        }
      } else if (!children.length) {
        if (deps.familyId === "XqMb4retoBTkO7feIQkS") {
          children = [{ id: "vintage", name: "วินเทจ", nickname: "วินเทจ" }];
        } else {
          children = [{ id: "child", name: "ลูก", nickname: "ลูก" }];
        }
      }

      const eventLines = events.map((e, idx) => {
        const dateStr = thaiDay(e.date);
        const timeStr = e.time ? ` เวลา ${e.time} น.` : "";
        const placeStr = e.place ? ` (${e.place})` : "";
        return `${idx + 1}. ${e.title}\n🗓️ ${dateStr}${timeStr}${placeStr}`;
      });

      const header = `📅 ตรวจพบ ${events.length} กิจกรรมจากข้อความ:\n\n${eventLines.join("\n\n")}`;
      const items: LineQuickReplyItem[] = [];

      if (children.length === 1) {
        const child = children[0];
        const name = child.nickname || child.name || "ลูก";
        items.push({
          type: "action",
          action: {
            type: "postback",
            label: `✅ บันทึกให้${name}`.slice(0, 20),
            data: `action=select_target&id=${draftId}&childId=${child.id}`,
            displayText: `บันทึกให้${name}`,
          },
        });
      } else if (children.length > 1) {
        for (const child of children) {
          const name = child.nickname || child.name;
          items.push({
            type: "action",
            action: {
              type: "postback",
              label: `บันทึกให้${name}`.slice(0, 20),
              data: `action=select_target&id=${draftId}&childId=${child.id}`,
              displayText: `บันทึกให้${name}`,
            },
          });
        }
        items.push({
          type: "action",
          action: {
            type: "postback",
            label: "👨‍👩‍👧‍👦 ให้เด็กทุกคน",
            data: `action=select_target&id=${draftId}&childId=all`,
            displayText: "บันทึกให้เด็กทุกคน",
          },
        });
      } else {
        items.push({
          type: "action",
          action: {
            type: "postback",
            label: "✅ บันทึกนัดหมาย",
            data: `action=select_target&id=${draftId}&childId=`,
            displayText: "บันทึกนัดหมาย",
          },
        });
      }

      // Option for Dad and Mom
      items.push({
        type: "action",
        action: {
          type: "postback",
          label: "👨 บันทึกให้พ่อ",
          data: `action=select_target&id=${draftId}&childId=parent:dad`,
          displayText: "บันทึกให้พ่อ",
        },
      });
      items.push({
        type: "action",
        action: {
          type: "postback",
          label: "👩 บันทึกให้แม่",
          data: `action=select_target&id=${draftId}&childId=parent:mom`,
          displayText: "บันทึกให้แม่",
        },
      });

      items.push({
        type: "action",
        action: {
          type: "postback",
          label: "❌ ยกเลิก",
          data: `action=cancel&id=${draftId}`,
          displayText: "ยกเลิก",
        },
      });

      const question = "\n\nต้องการบันทึกให้น้องคนไหน หรือคุณพ่อ/คุณแม่ดีครับ?";
      await replyOrPush(deps, userId, ev.replyToken, {
        type: "text",
        text: header + question,
        quickReply: { items },
      });
      continue;
    }

    if (ev.type === "postback" && ev.postback?.data) {
      const params = new URLSearchParams(ev.postback.data);
      const action = params.get("action");
      const draftId = params.get("id");
      const targetChildId = params.get("childId");

      if (!draftId && action !== "view_upcoming") continue;

      if (action === "cancel") {
        if (draftId && deps.kv) await deps.kv.delete(`draft:${draftId}`);
        await replyOrPush(deps, userId, ev.replyToken, REPLY_CANCELLED);
        continue;
      }

      if (action === "select_target") {
        if (!draftId || !deps.kv) continue;
        const raw = await deps.kv.get(`draft:${draftId}`);
        if (!raw) {
          await replyOrPush(deps, userId, ev.replyToken, REPLY_DRAFT_EXPIRED);
          continue;
        }

        let parsedDraft: DraftEvents;
        try {
          parsedDraft = JSON.parse(raw);
          parsedDraft.targetChildId = targetChildId ?? "";
          await deps.kv.put(`draft:${draftId}`, JSON.stringify(parsedDraft), { expirationTtl: 600 });
          await deps.kv.put(`user_draft:${userId}`, draftId, { expirationTtl: 600 });
        } catch {
          // ignore parse error
        }

        let targetLabel = "นัดหมายนี้";
        if (targetChildId === "parent:dad") targetLabel = "คุณพ่อ";
        else if (targetChildId === "parent:mom") targetLabel = "คุณแม่";
        else if (targetChildId === "all") targetLabel = "ทุกคนในบ้าน";
        else if (targetChildId) {
          let cachedList: Array<{ id: string; name: string; nickname?: string }> = [];
          if (deps.kv) {
            const cachedStr = await deps.kv.get(`family_children:${deps.familyId}`);
            if (cachedStr) {
              try { cachedList = JSON.parse(cachedStr); } catch {}
            }
          }
          let matched = cachedList.find((c) => c.id === targetChildId);
          if (!matched && (targetChildId === "vintage" || targetChildId === "child")) {
            matched = { id: targetChildId, name: "วินเทจ", nickname: "วินเทจ" };
          }
          if (matched) {
            targetLabel = `น้อง${matched.nickname || matched.name}`;
          } else if (deps.firestore) {
            const children = await deps.firestore.loadChildren(deps.familyId ?? "").catch(() => []);
            const found = children.find((c) => c.id === targetChildId);
            if (found) targetLabel = `น้อง${found.nickname || found.name}`;
          }
        }

        const items: LineQuickReplyItem[] = [
          {
            type: "action",
            action: {
              type: "postback",
              label: "🔔 ปกติ (เช้า 07:00)",
              data: `action=confirm&id=${draftId}&childId=${targetChildId ?? ""}&timing=normal`,
              displayText: "เตือนแบบปกติ",
            },
          },
          {
            type: "action",
            action: {
              type: "postback",
              label: "⭐ พิเศษ (+เตือนเย็น)",
              data: `action=confirm&id=${draftId}&childId=${targetChildId ?? ""}&timing=special`,
              displayText: "เตือนแบบพิเศษ (+เย็นก่อนวันนัด)",
            },
          },
          {
            type: "action",
            action: {
              type: "postback",
              label: "❌ ยกเลิก",
              data: `action=cancel&id=${draftId}`,
              displayText: "ยกเลิก",
            },
          },
        ];

        await replyOrPush(deps, userId, ev.replyToken, {
          type: "text",
          text: `ต้องการตั้งเวลาแจ้งเตือนสำหรับ${targetLabel}แบบไหนดีครับ?\n\n1. 🔔 ปกติ: เตือนเช้า 07:00 น. ก่อนวันนัด 1 วัน และเช้าวันนัด\n2. ⭐ พิเศษ: เพิ่มเตือนตอนเย็น 18:00 น. ก่อนวันนัด (สำหรับเตรียมของ/ซื้อของ)`,
          quickReply: { items },
        });
        continue;
      }

      if (action === "confirm") {
        if (!draftId || !deps.kv) continue;
        const timing = params.get("timing") === "special" ? "special" : "normal";
        await executeConfirmation(draftId, targetChildId, timing, ev.replyToken, deps, now, userId);
        continue;
      }

      if (action === "view_upcoming") {
        if (deps.firestore?.loadUpcomingSummary && deps.familyId) {
          const today = bangkokDate(now());
          const upcoming = await deps.firestore.loadUpcomingSummary(deps.familyId, today, 10).catch(() => []);
          const summaryText = formatUpcomingSummary(upcoming, 10);
          const replyMsg = upcoming.length > 0
            ? `📋 รายการนัดหมายที่รออยู่เร็วๆ นี้ (${upcoming.length} รายการ):\n\n${summaryText}`
            : "📋 ขณะนี้ยังไม่มีรายการนัดหมายที่รออยู่ครับ 🎉";

          await replyOrPush(deps, userId, ev.replyToken, replyMsg);
        }
        continue;
      }
    }
  }
}

async function executeConfirmation(
  draftId: string,
  targetChildId: string | undefined | null,
  timing: "normal" | "special",
  replyToken: string | undefined,
  deps: WebhookDeps,
  now: () => Date,
  userId?: string,
): Promise<void> {
  if (!deps.kv || !deps.firestore) return;
  const raw = await deps.kv.get(`draft:${draftId}`);
  if (!raw) {
    await replyOrPush(deps, userId || "", replyToken, REPLY_DRAFT_EXPIRED);
    return;
  }

  let draft: DraftEvents;
  try {
    draft = JSON.parse(raw);
  } catch {
    await deps.kv.delete(`draft:${draftId}`);
    if (userId) await deps.kv.delete(`user_draft:${userId}`).catch(() => {});
    return;
  }

  const childIdToUse = targetChildId || draft.targetChildId;
  let children: Array<{ id: string; name: string; nickname?: string }> = [];
  if (deps.kv) {
    const cached = await deps.kv.get(`family_children:${draft.familyId}`);
    if (cached) {
      try {
        children = JSON.parse(cached);
      } catch {}
    }
  }
  if (!children.length && deps.firestore) {
    children = await deps.firestore.loadChildren(draft.familyId).catch(() => []);
    if (children.length > 0 && deps.kv) {
      await deps.kv.put(`family_children:${draft.familyId}`, JSON.stringify(children), { expirationTtl: 86400 }).catch(() => {});
    }
  }
  let resolvedChildId = childIdToUse;
  if (childIdToUse === "vintage" || childIdToUse === "child" || !childIdToUse) {
    const matched = children.find((c) => c.nickname?.includes("วินเทจ") || c.name?.includes("วินเทจ")) || children[0];
    resolvedChildId = matched?.id || childIdToUse;
  }
  const childrenToAssign =
    resolvedChildId === "all"
      ? children.map((c) => c.id)
      : resolvedChildId
        ? [resolvedChildId]
        : children.length
          ? [children[0].id]
          : [""];

  let updatedCount = 0;
  let createdCount = 0;

  try {
    for (const cId of childrenToAssign) {
      for (const event of draft.events) {
        const existing = deps.firestore.findMatchingAppointment
          ? await deps.firestore.findMatchingAppointment(draft.familyId, cId, event.date, event.title)
          : null;

        if (existing && deps.firestore.updateAppointment) {
          await deps.firestore.updateAppointment(draft.familyId, existing.id, {
            time: event.time,
            place: event.place,
            purpose: event.title,
            notes: event.notes,
            remindTiming: timing,
          });
          updatedCount++;
        } else {
          await deps.firestore.createAppointment(draft.familyId, {
            childId: cId,
            date: event.date,
            time: event.time,
            place: event.place,
            purpose: event.title,
            notes: event.notes,
            remindTiming: timing,
          });
          createdCount++;
        }
      }
    }
  } catch (err) {
    console.error("executeConfirmation save error:", err instanceof Error ? err.message : String(err));
    await deps.kv.delete(`draft:${draftId}`);
    if (userId) await deps.kv.delete(`user_draft:${userId}`).catch(() => {});
    await replyOrPush(deps, userId || "", replyToken, "ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกนัดหมายลงระบบ กรุณาลองใหม่อีกครั้งครับ");
    return;
  }

  await deps.kv.delete(`draft:${draftId}`);
  if (userId) await deps.kv.delete(`user_draft:${userId}`).catch(() => {});

  let targetLabel = "";
  if (childIdToUse === "parent:dad") targetLabel = "ของคุณพ่อ ";
  else if (childIdToUse === "parent:mom") targetLabel = "ของคุณแม่ ";
  else if (childIdToUse === "all") targetLabel = "ของทุกคน ";
  else if (childIdToUse) {
    const matched = children.find((c) => c.id === childIdToUse);
    if (matched) targetLabel = `ของน้อง${matched.nickname || matched.name} `;
  }

  const summaryLines = draft.events.map((e) => `• ${e.title} (${thaiDay(e.date)})`);
  const timingNote =
    timing === "special"
      ? "\n\n🔔 ตั้งค่าเตือนแบบพิเศษ: จะมีแจ้งเตือนตอนเย็น 18:00 น. ก่อนวันนัด (เผื่อเตรียมของ) และเตือนตอน 07:00 น. อีกครั้งครับ"
      : "\n\n🔔 KidCare จะส่งข้อความแจ้งเตือนทาง LINE ให้ตอน 07:00 น. เมื่อถึงวันนัดหมายครับ";

  const countMsg = updatedCount > 0 && createdCount === 0
    ? `(อัปเดตนัดเดิมที่มีอยู่แล้ว ${updatedCount} รายการ)`
    : updatedCount > 0
      ? `(สร้างใหม่ ${createdCount} รายการ, อัปเดตนัดเดิม ${updatedCount} รายการ)`
      : `(${createdCount} รายการ)`;

  let upcomingSection = "";
  if (deps.firestore.loadUpcomingSummary) {
    try {
      const today = bangkokDate(now());
      const summaryPromise = deps.firestore.loadUpcomingSummary(draft.familyId, today, 5, false);
      const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1000));
      const allUpcoming = await Promise.race([summaryPromise, timeoutPromise]);
      if (allUpcoming.length > 0) {
        upcomingSection = `\n\n📋 ภาพรวมนัดหมายที่รออยู่เร็วๆ นี้:\n${formatUpcomingSummary(allUpcoming, 5)}`;
      }
    } catch (err) {
      console.error("upcoming summary in confirmation error:", err);
    }
  }

  const successMsg = `✅ บันทึกนัดหมาย${targetLabel}เรียบร้อยแล้วครับ! ${countMsg}\n\n${summaryLines.join("\n")}${timingNote}${upcomingSection}`;
  await replyOrPush(deps, userId || "", replyToken, successMsg);
}

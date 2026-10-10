import { describe, expect, test, vi } from "vitest";
import type { LineApi } from "../src/line/api";
import { kvRecipientStore } from "../src/line/recipients";
import { REPLY_PENDING, REPLY_WELCOME_BACK, handleLineWebhook, isUpcomingQuery } from "../src/line/webhook";
import { UpstreamError } from "../src/upstream";
import { memoryKV } from "./helpers";

function api(over: Partial<LineApi> = {}): LineApi {
  return {
    profile: vi.fn(async () => ({ displayName: "แม่" })),
    reply: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    multicast: vi.fn(async () => {}),
    ...over,
  };
}
const NOW = () => new Date("2026-09-30T01:00:00Z");
const follow = (userId: string) => JSON.stringify({ events: [{ type: "follow", replyToken: "rt", source: { type: "user", userId } }] });

describe("handleLineWebhook", () => {
  test("follow stores pending recipient with profile name and replies", async () => {
    const store = kvRecipientStore(memoryKV());
    const a = api();
    await handleLineWebhook(follow("U1"), { store, api: a, now: NOW });
    expect(await store.get("U1")).toEqual({ userId: "U1", displayName: "แม่", status: "pending", addedAt: "2026-09-30T01:00:00.000Z" });
    expect(a.reply).toHaveBeenCalledWith("rt", REPLY_PENDING);
  });

  test("re-follow keeps approved status", async () => {
    const store = kvRecipientStore(memoryKV());
    await store.put({ userId: "U1", displayName: "แม่", status: "approved", addedAt: "x" });
    const a = api();
    await handleLineWebhook(follow("U1"), { store, api: a, now: NOW });
    expect((await store.get("U1"))?.status).toBe("approved");
    expect(a.reply).toHaveBeenCalledWith("rt", REPLY_WELCOME_BACK);
  });

  test("profile failure still stores recipient with empty name", async () => {
    const store = kvRecipientStore(memoryKV());
    await handleLineWebhook(follow("U1"), { store, api: api({ profile: vi.fn(async () => { throw new Error("x"); }) }), now: NOW });
    expect((await store.get("U1"))?.displayName).toBe("");
  });

  test("profile and reply failures log only fixed labels (no userId, no message)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = kvRecipientStore(memoryKV());
    const boom = async () => { throw new UpstreamError("line /v2/bot/profile/U1 500"); };
    await handleLineWebhook(follow("U1"), { store, api: api({ profile: vi.fn(boom), reply: vi.fn(boom) }), now: NOW });
    expect(spy.mock.calls).toEqual([["line profile failed"], ["line reply failed"]]);
    spy.mockRestore();
  });

  test("unfollow deletes; non-user sources and empty payloads are ignored", async () => {
    const store = kvRecipientStore(memoryKV());
    await store.put({ userId: "U1", displayName: "", status: "approved", addedAt: "x" });
    await handleLineWebhook(JSON.stringify({ events: [{ type: "unfollow", source: { type: "user", userId: "U1" } }] }), { store, api: api() });
    expect(await store.get("U1")).toBeNull();
    await handleLineWebhook(JSON.stringify({ events: [{ type: "follow", source: { type: "group", groupId: "G" } }] }), { store, api: api() });
    await handleLineWebhook(JSON.stringify({ events: [] }), { store, api: api() });
    expect(await store.list()).toEqual([]);
  });

  test("text message from unapproved user replies with rejection", async () => {
    const store = kvRecipientStore(memoryKV());
    await store.put({ userId: "U1", displayName: "", status: "pending", addedAt: "x" });
    const a = api();
    await handleLineWebhook(
      JSON.stringify({ events: [{ type: "message", replyToken: "rt", message: { type: "text", text: "วันเปิดเทอม" }, source: { type: "user", userId: "U1" } }] }),
      { store, api: a },
    );
    expect(a.reply).toHaveBeenCalledWith("rt", expect.stringContaining("ยังไม่ได้รับอนุมัติ"));
  });

  test("forwarded text message extracts events and replies with quick reply buttons", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    const mockClaude = {
      beta: {
        messages: {
          create: vi.fn().mockResolvedValue({
            stop_reason: "end_turn",
            content: [{
              type: "text",
              text: JSON.stringify({
                events: [
                  { title: "วันสุดท้ายของภาคเรียน", date: "2026-10-07", time: null, place: "โรงเรียน", notes: null },
                  { title: "เปิดเทอมภาคเรียนที่ 2", date: "2026-10-29", time: null, place: "โรงเรียน", notes: null },
                ],
              }),
            }],
          }),
        },
      },
    };

    const mockFirestore = {
      loadReminderItems: vi.fn(),
      loadChildren: vi.fn().mockResolvedValue([{ id: "c1", name: "มะลิ", nickname: "มะลิ" }]),
      createAppointment: vi.fn(),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "message",
          replyToken: "rt",
          message: { type: "text", text: "เด็กๆ มาโรงเรียนวันสุดท้ายพุธ 7 ต.ค. และเปิดเทอม 29 ต.ค." },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, client: mockClaude as any, firestore: mockFirestore as any, familyId: "fam1" },
    );

    expect(a.reply).toHaveBeenCalledWith(
      "rt",
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("ตรวจพบ 2 กิจกรรม"),
        quickReply: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              action: expect.objectContaining({
                type: "postback",
                label: "✅ บันทึกให้มะลิ",
                data: expect.stringMatching(/action=select_target&id=\w+&childId=c1/),
              }),
            }),
            expect.objectContaining({
              action: expect.objectContaining({
                type: "postback",
                label: "❌ ยกเลิก",
              }),
            }),
          ]),
        }),
      }),
    );
  });

  test("postback confirm creates appointment in firestore and confirms to user", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    // Store sample draft
    await kv.put("draft:d123", JSON.stringify({
      events: [{ title: "เปิดเทอม", date: "2026-10-29", time: null, place: "โรงเรียน", notes: null }],
      familyId: "fam1",
      createdAt: "x",
    }));

    const mockFirestore = {
      loadReminderItems: vi.fn(),
      loadChildren: vi.fn().mockResolvedValue([{ id: "c1", name: "มะลิ" }]),
      createAppointment: vi.fn().mockResolvedValue("newApptId"),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "postback",
          replyToken: "rt",
          postback: { data: "action=confirm&id=d123&childId=c1" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1" },
    );

    expect(mockFirestore.createAppointment).toHaveBeenCalledWith("fam1", {
      childId: "c1",
      date: "2026-10-29",
      time: null,
      place: "โรงเรียน",
      purpose: "เปิดเทอม",
      notes: null,
      remindTiming: "normal",
    });
    expect(await kv.get("draft:d123")).toBeNull();
    expect(a.reply).toHaveBeenCalledWith("rt", expect.stringContaining("บันทึกนัดหมาย"));
  });

  test("postback confirm updates existing appointment when duplicate exists", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    await kv.put("draft:d123", JSON.stringify({
      events: [{ title: "เปิดเทอม", date: "2026-10-29", time: "08:00", place: "โรงเรียน", notes: null }],
      familyId: "fam1",
      createdAt: "x",
    }));

    const mockFirestore = {
      loadChildren: vi.fn().mockResolvedValue([{ id: "c1", name: "มะลิ" }]),
      findMatchingAppointment: vi.fn().mockResolvedValue({ id: "existingAppt1", purpose: "เปิดเทอม", date: "2026-10-29" }),
      updateAppointment: vi.fn().mockResolvedValue(undefined),
      createAppointment: vi.fn(),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "postback",
          replyToken: "rt",
          postback: { data: "action=confirm&id=d123&childId=c1&timing=special" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1" },
    );

    expect(mockFirestore.updateAppointment).toHaveBeenCalledWith("fam1", "existingAppt1", {
      time: "08:00",
      place: "โรงเรียน",
      purpose: "เปิดเทอม",
      notes: null,
      remindTiming: "special",
    });
    expect(mockFirestore.createAppointment).not.toHaveBeenCalled();
    expect(a.reply).toHaveBeenCalledWith("rt", expect.stringContaining("อัปเดตนัดเดิมที่มีอยู่แล้ว"));
  });

  test("postback select_target asks user for normal vs special timing", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    await kv.put("draft:d123", JSON.stringify({
      events: [{ title: "ทำบุญ", date: "2026-10-07", time: null, place: "วัด", notes: null }],
      familyId: "fam1",
      createdAt: "x",
    }));

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "postback",
          replyToken: "rt",
          postback: { data: "action=select_target&id=d123&childId=parent:dad" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, familyId: "fam1" },
    );

    expect(a.reply).toHaveBeenCalledWith(
      "rt",
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("ต้องการตั้งเวลาแจ้งเตือน"),
        quickReply: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              action: expect.objectContaining({
                data: expect.stringContaining("timing=normal"),
              }),
            }),
            expect.objectContaining({
              action: expect.objectContaining({
                data: expect.stringContaining("timing=special"),
              }),
            }),
          ]),
        }),
      }),
    );
  });

  test("postback cancel deletes draft and confirms cancelation", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    await kv.put("draft:d999", "some draft");

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "postback",
          replyToken: "rt",
          postback: { data: "action=cancel&id=d999" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, familyId: "fam1" },
    );

    expect(await kv.get("draft:d999")).toBeNull();
    expect(a.reply).toHaveBeenCalledWith("rt", expect.stringContaining("ยกเลิกการบันทึก"));
  });

  test("user can type text 'เตือนแบบพิเศษ' to confirm active draft", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    await kv.put("draft:d555", JSON.stringify({
      events: [{ title: "กิจกรรมทำบุญ", date: "2026-10-08", time: null, place: "ที่ทำงาน", notes: null }],
      familyId: "fam1",
      createdAt: "x",
      targetChildId: "parent:dad",
    }));
    await kv.put("user_draft:U1", "d555");

    const mockFirestore = {
      loadChildren: vi.fn().mockResolvedValue([{ id: "c1", name: "มะลิ" }]),
      createAppointment: vi.fn().mockResolvedValue("newAppt"),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "message",
          replyToken: "rt",
          message: { type: "text", text: "เตือนแบบพิเศษ (+เย็นก่อนวันนัด)" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1", client: {} as any },
    );

    expect(mockFirestore.createAppointment).toHaveBeenCalledWith("fam1", expect.objectContaining({
      childId: "parent:dad",
      purpose: "กิจกรรมทำบุญ",
      remindTiming: "special",
    }));
    expect(await kv.get("user_draft:U1")).toBeNull();
    expect(a.reply).toHaveBeenCalledWith("rt", expect.stringContaining("บันทึกนัดหมายของคุณพ่อ"));
  });

  test("user querying upcoming appointments with 'ดูนัดหมาย' or 'สรุปนัด' replies with upcoming list", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    const mockFirestore = {
      loadUpcomingSummary: vi.fn().mockResolvedValue([
        { date: "2026-10-09", childName: "คุณพ่อ", title: "เอารถยอมตั้งศูนย์ที่ปลวกแดง", time: "14:00" },
      ]),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "message",
          replyToken: "rt",
          message: { type: "text", text: "ไม่เห็นมีสรุปรายการค้างนัดหมายเลย" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1", client: {} as any },
    );

    expect(mockFirestore.loadUpcomingSummary).toHaveBeenCalledWith("fam1", expect.any(String), 10);
    expect(a.reply).toHaveBeenCalledWith("rt", expect.objectContaining({
      type: "flex",
      altText: expect.stringContaining("ตารางนัดหมาย"),
    }));
  });

  test("isUpcomingQuery correctly identifies query intents versus new appointments", () => {
    expect(isUpcomingQuery("สรุปวันนัดหมาย")).toBe(true);
    expect(isUpcomingQuery("สรุปนัดหมาย")).toBe(true);
    expect(isUpcomingQuery("ดูวันนัด")).toBe(true);
    expect(isUpcomingQuery("ตารางนัด")).toBe(true);
    expect(isUpcomingQuery("มีนัดอะไรบ้าง")).toBe(true);
    expect(isUpcomingQuery("นัดหมายมีอะไรบ้าง")).toBe(true);
    expect(isUpcomingQuery("นัดหมาย")).toBe(true);
    expect(isUpcomingQuery("สรุป")).toBe(true);

    // Should NOT match new appointment creation
    expect(isUpcomingQuery("พรุ่งนี้ 14:30 เอารถไปตั้งศูนย์ที่ปลวกแดง")).toBe(false);
    expect(isUpcomingQuery("วันจันทร์ ที่ 12 ตุลาคม 2026 นัดไปรับรถกระบะตอน 18.00 น.")).toBe(false);
  });

  test("user typing 'สรุปวันนัดหมาย' triggers loadUpcomingSummary and returns list", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    const mockFirestore = {
      loadUpcomingSummary: vi.fn().mockResolvedValue([
        { date: "2026-10-12", childName: "คุณพ่อ", title: "นัดไปรับรถกระบะ", time: "18:00", place: "อาร์ทการาจ" },
      ]),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "message",
          replyToken: "rt",
          message: { type: "text", text: "สรุปวันนัดหมาย" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1", client: {} as any },
    );

    expect(mockFirestore.loadUpcomingSummary).toHaveBeenCalledWith("fam1", expect.any(String), 10);
    expect(a.reply).toHaveBeenCalledWith("rt", expect.objectContaining({
      type: "flex",
      altText: expect.stringContaining("นัดไปรับรถกระบะ"),
    }));
  });

  test("executeConfirmation catches Firestore errors and replies with friendly message", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    await kv.put("draft:dErr", JSON.stringify({
      events: [{ title: "นัดพบครู", date: "2026-10-10", time: null, place: null, notes: null }],
      familyId: "fam1",
      createdAt: "x",
      targetChildId: "parent:dad",
    }));

    const mockFirestore = {
      loadChildren: vi.fn().mockResolvedValue([]),
      createAppointment: vi.fn().mockRejectedValue(new Error("Firestore database connection failed")),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "postback",
          replyToken: "rt",
          postback: { data: "action=confirm&id=dErr&childId=parent:dad&timing=normal" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1" },
    );

    expect(a.reply).toHaveBeenCalledWith("rt", expect.stringContaining("ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกนัดหมายลงระบบ"));
  });

  test("direct appointment message 'พรุ่งนี้ 14:30 เอารถไปตั้งศูนย์ที่ปลวกแดง' replies immediately with target options", async () => {
    const kv = memoryKV();
    const store = kvRecipientStore(kv);
    await store.put({ userId: "U1", displayName: "พ่อ", status: "approved", addedAt: "x" });
    const a = api();

    const mockFirestore = {
      loadChildren: vi.fn().mockResolvedValue([{ id: "child1", name: "วินเทจ", nickname: "วินเทจ" }]),
    };

    await handleLineWebhook(
      JSON.stringify({
        events: [{
          type: "message",
          replyToken: "rt",
          message: { type: "text", text: "พรุ่งนี้ 14:30 เอารถไปตั้งศูนย์ที่ปลวกแดง" },
          source: { type: "user", userId: "U1" },
        }],
      }),
      { store, api: a, kv, firestore: mockFirestore as any, familyId: "fam1", client: {} as any },
    );

    expect(a.reply).toHaveBeenCalledWith(
      "rt",
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("เอารถไปตั้งศูนย์ที่ปลวกแดง"),
        quickReply: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              action: expect.objectContaining({ label: "✅ บันทึกให้วินเทจ" }),
            }),
            expect.objectContaining({
              action: expect.objectContaining({ label: "👨 บันทึกให้พ่อ" }),
            }),
          ]),
        }),
      }),
    );
  });
});


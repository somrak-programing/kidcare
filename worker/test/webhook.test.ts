import { describe, expect, test, vi } from "vitest";
import type { LineApi } from "../src/line/api";
import { kvRecipientStore } from "../src/line/recipients";
import { REPLY_PENDING, REPLY_WELCOME_BACK, handleLineWebhook } from "../src/line/webhook";
import { UpstreamError } from "../src/upstream";
import { memoryKV } from "./helpers";

function api(over: Partial<LineApi> = {}): LineApi {
  return {
    profile: vi.fn(async () => ({ displayName: "แม่" })),
    reply: vi.fn(async () => {}),
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
});

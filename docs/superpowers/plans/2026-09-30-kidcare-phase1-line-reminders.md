# KidCare LINE Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every morning at 07:00 (Bangkok) the three caregivers (the user, their partner, the user's mother) get one LINE message listing today's and tomorrow's vaccine doses and doctor appointments for the children, without installing KidCare.

**Architecture:** Extends the Cloudflare Worker from Plan 2. A LINE Official Account (Messaging API) sends follow/unfollow webhooks to the Worker, which stores followers in Cloudflare KV as `pending`; a parent approves them from KidCare's Settings page (Worker endpoints guarded by Firebase ID token + `ALLOWED_UIDS`). A cron trigger reads Firestore through the REST API with a read-only service account, builds the message with a pure function, and multicasts it to approved recipients.

**Tech Stack:** Cloudflare Workers (cron triggers, KV), LINE Messaging API, Firestore REST v1 + Google OAuth2 JWT bearer (`jose`), Vitest; web: React + `qrcode`.

**Spec:** `docs/superpowers/specs/2026-09-30-kidcare-phase1-design.md` §12.

**Depends on:** Plan 1 complete; Plan 2 complete (Worker in `worker/` with `handle()`, `verifyFirebaseToken`, `HttpError`, deployed; web `VITE_WORKER_URL` set).

## Global Constraints

- Cron `0 0 * * *` (UTC) = 07:00 Asia/Bangkok (UTC+7, no DST). "Today"/"tomorrow" are Bangkok calendar dates.
- A reminder item is: a dose with `given == false` and `dueDate` ∈ {today, tomorrow}, or an appointment with `done == false` and `date` ∈ {today, tomorrow}, for family `FAMILY_ID`.
- One message per recipient per day, only if there is at least one item. Message text contains only child nickname (or name), vaccine/purpose, time, place — never HN or allergy data.
- Followers are always stored `pending`; only `approved` recipients receive reminders or test messages.
- Webhook requests must pass `X-Line-Signature` verification (HMAC-SHA256, base64, constant-time compare) → otherwise 401.
- Service account role: **Cloud Datastore Viewer** only (read-only).
- Never log message text or recipient names; log counts and error messages only.
- New Worker error code: `no_recipients` (400). LINE/Google/Firestore HTTP failures → `UpstreamError` → 502 `upstream`.
- Secrets (`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_TOKEN`, `GCP_SA_KEY`) are entered by the user with `wrangler secret put`; never typed or echoed by the agent.

## File Structure

```
worker/
  wrangler.toml                  + cron trigger, KV binding, FAMILY_ID, LINE_ADD_FRIEND_URL
  src/
    upstream.ts                  UpstreamError
    line/signature.ts            verifyLineSignature()
    line/api.ts                  LineApi, createLineApi()
    line/recipients.ts           Recipient, RecipientStore, KVLike, kvRecipientStore()
    line/webhook.ts              handleLineWebhook()
    reminders/message.ts         bangkokDate(), thaiDay(), ReminderItem, buildReminderText()
    reminders/firestore.ts       ServiceAccount, decodeDoc(), getAccessToken(), createFirestoreReader()
    reminders/run.ts             runDailyReminders()
    index.ts                     routing for /line/*, scheduled() handler
  test/
    helpers.ts                   memoryKV(), fakeFetch()
    signature.test.ts, line-api.test.ts, recipients.test.ts, webhook.test.ts,
    message.test.ts, firestore.test.ts, run.test.ts, index.test.ts (extended)
src/ (web)
  lib/workerFetch.ts             shared authenticated fetch to the Worker
  lib/extractClient.ts           refactored to use workerFetch
  components/LineSettings.tsx    add-friend QR, pending/approved lists, test button
  pages/Settings.tsx             + <LineSettings />
```

---

### Task 1: LINE signature, API client, recipient store

**Files:**
- Create: `worker/src/upstream.ts`, `worker/src/line/signature.ts`, `worker/src/line/api.ts`, `worker/src/line/recipients.ts`, `worker/test/helpers.ts`
- Test: `worker/test/signature.test.ts`, `worker/test/line-api.test.ts`, `worker/test/recipients.test.ts`

**Interfaces:**
- Produces:
  - `class UpstreamError extends Error`
  - `verifyLineSignature(body: string, signature: string | null, secret: string): Promise<boolean>`
  - `interface LineApi { profile(userId: string): Promise<{ displayName: string }>; reply(replyToken: string, text: string): Promise<void>; multicast(to: string[], text: string): Promise<void> }`
  - `createLineApi(token: string, fetchFn?: FetchFn): LineApi` where `type FetchFn = (input: string, init?: RequestInit) => Promise<Response>`
  - `interface Recipient { userId: string; displayName: string; status: "pending" | "approved"; addedAt: string }`
  - `interface RecipientStore { list(): Promise<Recipient[]>; get(userId: string): Promise<Recipient | null>; put(r: Recipient): Promise<void>; delete(userId: string): Promise<void> }`
  - `interface KVLike { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void>; delete(key: string): Promise<void>; list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> }`
  - `kvRecipientStore(kv: KVLike): RecipientStore`
  - test helpers: `memoryKV(): KVLike`, `fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): FetchFn & { calls: { url: string; init?: RequestInit }[] }`

- [ ] **Step 1: Write test helpers** — `worker/test/helpers.ts`

```ts
import type { KVLike } from "../src/line/recipients";
import type { FetchFn } from "../src/line/api";

export function memoryKV(): KVLike {
  const m = new Map<string, string>();
  return {
    async get(k) { return m.get(k) ?? null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true };
    },
  };
}

export function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as FetchFn & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}
```

- [ ] **Step 2: Write failing tests**

`worker/test/signature.test.ts`:
```ts
import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { verifyLineSignature } from "../src/line/signature";

const secret = "s3cret";
const body = JSON.stringify({ events: [{ type: "follow" }], x: "ไทย" });
const good = createHmac("sha256", secret).update(body).digest("base64");

test("accepts a valid signature", async () => expect(await verifyLineSignature(body, good, secret)).toBe(true));
test("rejects wrong / missing / tampered", async () => {
  expect(await verifyLineSignature(body, good, "other")).toBe(false);
  expect(await verifyLineSignature(body, null, secret)).toBe(false);
  expect(await verifyLineSignature(body + " ", good, secret)).toBe(false);
});
```

`worker/test/line-api.test.ts`:
```ts
import { expect, test } from "vitest";
import { createLineApi } from "../src/line/api";
import { UpstreamError } from "../src/upstream";
import { fakeFetch } from "./helpers";

const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });

test("profile GETs with bearer token", async () => {
  const f = fakeFetch(() => ok({ displayName: "แม่", userId: "U1" }));
  expect(await createLineApi("tok", f).profile("U1")).toEqual({ displayName: "แม่" });
  expect(f.calls[0].url).toBe("https://api.line.me/v2/bot/profile/U1");
  expect((f.calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
});

test("reply and multicast send text messages", async () => {
  const f = fakeFetch(() => ok());
  const api = createLineApi("tok", f);
  await api.reply("rt", "hi");
  await api.multicast(["U1", "U2"], "นัด");
  expect(f.calls[0].url).toBe("https://api.line.me/v2/bot/message/reply");
  expect(JSON.parse(f.calls[0].init!.body as string)).toEqual({ replyToken: "rt", messages: [{ type: "text", text: "hi" }] });
  expect(f.calls[1].url).toBe("https://api.line.me/v2/bot/message/multicast");
  expect(JSON.parse(f.calls[1].init!.body as string)).toEqual({ to: ["U1", "U2"], messages: [{ type: "text", text: "นัด" }] });
});

test("multicast with no recipients makes no call", async () => {
  const f = fakeFetch(() => ok());
  await createLineApi("tok", f).multicast([], "x");
  expect(f.calls).toHaveLength(0);
});

test("non-2xx throws UpstreamError", async () => {
  const f = fakeFetch(() => new Response("no", { status: 429 }));
  await expect(createLineApi("tok", f).multicast(["U1"], "x")).rejects.toBeInstanceOf(UpstreamError);
});
```

`worker/test/recipients.test.ts`:
```ts
import { expect, test } from "vitest";
import { kvRecipientStore } from "../src/line/recipients";
import { memoryKV } from "./helpers";

test("put / get / list / delete", async () => {
  const s = kvRecipientStore(memoryKV());
  const a = { userId: "U1", displayName: "แม่", status: "pending" as const, addedAt: "2026-09-30T00:00:00Z" };
  const b = { ...a, userId: "U2", displayName: "แฟน", status: "approved" as const };
  await s.put(a);
  await s.put(b);
  expect(await s.get("U1")).toEqual(a);
  expect(await s.get("U9")).toBeNull();
  expect(await s.list()).toEqual([a, b]);
  await s.delete("U1");
  expect(await s.list()).toEqual([b]);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd worker && npm test -- test/signature.test.ts test/line-api.test.ts test/recipients.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`worker/src/upstream.ts`:
```ts
/** บริการภายนอก (LINE, Google OAuth, Firestore) ตอบกลับไม่สำเร็จ */
export class UpstreamError extends Error {}
```

`worker/src/line/signature.ts`:
```ts
const enc = new TextEncoder();

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyLineSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  return constantTimeEqual(btoa(bin), signature);
}
```

`worker/src/line/api.ts`:
```ts
import { UpstreamError } from "../upstream";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface LineApi {
  profile(userId: string): Promise<{ displayName: string }>;
  reply(replyToken: string, text: string): Promise<void>;
  multicast(to: string[], text: string): Promise<void>;
}

const BASE = "https://api.line.me/v2/bot";
const MULTICAST_MAX = 500;

export function createLineApi(token: string, fetchFn: FetchFn = (i, init) => fetch(i, init)): LineApi {
  async function call(path: string, init: { method: string; body?: unknown }): Promise<Response> {
    const res = await fetchFn(`${BASE}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!res.ok) throw new UpstreamError(`LINE ${path} ${res.status}`);
    return res;
  }
  return {
    async profile(userId) {
      const res = await call(`/profile/${encodeURIComponent(userId)}`, { method: "GET" });
      const j = (await res.json()) as { displayName?: string };
      return { displayName: j.displayName ?? "" };
    },
    async reply(replyToken, text) {
      await call("/message/reply", { method: "POST", body: { replyToken, messages: [{ type: "text", text }] } });
    },
    async multicast(to, text) {
      for (let i = 0; i < to.length; i += MULTICAST_MAX) {
        await call("/message/multicast", { method: "POST", body: { to: to.slice(i, i + MULTICAST_MAX), messages: [{ type: "text", text }] } });
      }
    },
  };
}
```

`worker/src/line/recipients.ts`:
```ts
export interface Recipient {
  userId: string;
  displayName: string;
  status: "pending" | "approved";
  addedAt: string;
}

export interface RecipientStore {
  list(): Promise<Recipient[]>;
  get(userId: string): Promise<Recipient | null>;
  put(r: Recipient): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

const PREFIX = "recipient:";

export function kvRecipientStore(kv: KVLike): RecipientStore {
  const get = async (userId: string) => {
    const raw = await kv.get(PREFIX + userId);
    return raw ? (JSON.parse(raw) as Recipient) : null;
  };
  return {
    get,
    async put(r) {
      await kv.put(PREFIX + r.userId, JSON.stringify(r));
    },
    async delete(userId) {
      await kv.delete(PREFIX + userId);
    },
    async list() {
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({ prefix: PREFIX, cursor });
        names.push(...page.keys.map((k) => k.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      const all = await Promise.all(names.map((n) => get(n.slice(PREFIX.length))));
      return all.filter((r): r is Recipient => r !== null);
    },
  };
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: all PASS (Plan 2 tests included).

- [ ] **Step 6: Commit**

```bash
git add worker
git commit -m "feat(worker): LINE signature check, API client and recipient store"
```

---

### Task 2: Webhook handling (follow / unfollow)

**Files:**
- Create: `worker/src/line/webhook.ts`
- Test: `worker/test/webhook.test.ts`

**Interfaces:**
- Consumes: `LineApi`, `RecipientStore`, `Recipient`.
- Produces: `handleLineWebhook(body: string, deps: { store: RecipientStore; api: LineApi; now?: () => Date }): Promise<void>`; reply texts `REPLY_PENDING`, `REPLY_WELCOME_BACK` (exported constants).

- [ ] **Step 1: Write failing tests** — `worker/test/webhook.test.ts`

```ts
import { describe, expect, test, vi } from "vitest";
import type { LineApi } from "../src/line/api";
import { kvRecipientStore } from "../src/line/recipients";
import { REPLY_PENDING, REPLY_WELCOME_BACK, handleLineWebhook } from "../src/line/webhook";
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd worker && npm test -- test/webhook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `worker/src/line/webhook.ts`

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `cd worker && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker
git commit -m "feat(worker): LINE follow/unfollow webhook handling"
```

---

### Task 3: Reminder message builder

**Files:**
- Create: `worker/src/reminders/message.ts`
- Test: `worker/test/message.test.ts`

**Interfaces:**
- Produces: `bangkokDate(now: Date, addDays?: number): string` (YYYY-MM-DD); `thaiDay(iso: string): string` (e.g. `"ศ. 2 ต.ค."`); `interface ReminderItem { date: string; childName: string; title: string; time?: string; place?: string }`; `buildReminderText(items: ReminderItem[], today: string, tomorrow: string): string | null`.

- [ ] **Step 1: Write failing tests** — `worker/test/message.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { bangkokDate, buildReminderText, thaiDay } from "../src/reminders/message";

describe("bangkokDate", () => {
  test("00:00 UTC is 07:00 same day in Bangkok", () => {
    expect(bangkokDate(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
    expect(bangkokDate(new Date("2026-10-01T00:00:00Z"), 1)).toBe("2026-10-02");
  });
  test("17:00 UTC is already next day in Bangkok", () => {
    expect(bangkokDate(new Date("2026-09-30T17:00:00Z"))).toBe("2026-10-01");
  });
  test("crosses month end", () => expect(bangkokDate(new Date("2026-10-31T00:00:00Z"), 1)).toBe("2026-11-01"));
});

test("thaiDay", () => {
  expect(thaiDay("2026-10-02")).toBe("ศ. 2 ต.ค.");
  expect(thaiDay("2026-10-04")).toBe("อา. 4 ต.ค.");
});

describe("buildReminderText", () => {
  const T = "2026-10-02";
  const M = "2026-10-03";
  test("null when nothing today or tomorrow", () => {
    expect(buildReminderText([{ date: "2026-10-09", childName: "มะลิ", title: "x" }], T, M)).toBeNull();
    expect(buildReminderText([], T, M)).toBeNull();
  });
  test("formats sections, sorts by time (untimed first)", () => {
    const text = buildReminderText(
      [
        { date: M, childName: "ต้นกล้า", title: "นัดหมอ", time: "09:30", place: "คลินิกเด็ก" },
        { date: T, childName: "มะลิ", title: "พิษสุนัขบ้า เข็ม 2", place: "รพ.เมืองสมุทรปากน้ำ" },
        { date: M, childName: "มะลิ", title: "OPV เข็ม 4" },
      ],
      T,
      M,
    );
    expect(text).toBe(
      [
        "🔔 KidCare — นัดของลูก",
        "วันนี้ (ศ. 2 ต.ค.)",
        "• มะลิ: พิษสุนัขบ้า เข็ม 2 · รพ.เมืองสมุทรปากน้ำ",
        "",
        "พรุ่งนี้ (ส. 3 ต.ค.)",
        "• มะลิ: OPV เข็ม 4",
        "• ต้นกล้า: นัดหมอ 09:30 น. · คลินิกเด็ก",
      ].join("\n"),
    );
  });
  test("only tomorrow section when nothing today", () => {
    const text = buildReminderText([{ date: M, childName: "มะลิ", title: "x" }], T, M)!;
    expect(text).not.toContain("วันนี้");
    expect(text).toContain("พรุ่งนี้ (ส. 3 ต.ค.)");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd worker && npm test -- test/message.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `worker/src/reminders/message.ts`

```ts
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
}

export function bangkokDate(now: Date, addDays = 0): string {
  return new Date(now.getTime() + BKK_OFFSET_MS + addDays * DAY_MS).toISOString().slice(0, 10);
}

export function thaiDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}`;
}

function section(label: string, date: string, items: ReminderItem[]): string | null {
  const list = items
    .filter((i) => i.date === date)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.childName.localeCompare(b.childName));
  if (!list.length) return null;
  const lines = list.map((i) => `• ${i.childName}: ${i.title}${i.time ? ` ${i.time} น.` : ""}${i.place ? ` · ${i.place}` : ""}`);
  return [`${label} (${thaiDay(date)})`, ...lines].join("\n");
}

export function buildReminderText(items: ReminderItem[], today: string, tomorrow: string): string | null {
  const parts = [section("วันนี้", today, items), section("พรุ่งนี้", tomorrow, items)].filter((p): p is string => p !== null);
  if (!parts.length) return null;
  return `🔔 KidCare — นัดของลูก\n${parts.join("\n\n")}`;
}
```

- [ ] **Step 4: Run tests**

Run: `cd worker && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker
git commit -m "feat(worker): daily reminder message builder (Bangkok dates)"
```

---

### Task 4: Firestore reader (service account → REST)

**Files:**
- Create: `worker/src/reminders/firestore.ts`
- Test: `worker/test/firestore.test.ts`

**Interfaces:**
- Consumes: `FetchFn`, `UpstreamError`, `ReminderItem`.
- Produces: `interface ServiceAccount { client_email: string; private_key: string; project_id: string }`; `decodeDoc(doc: { name: string; fields?: Record<string, FsValue> }): { id: string } & Record<string, unknown>`; `getAccessToken(sa: ServiceAccount, fetchFn: FetchFn, now?: Date): Promise<string>`; `createFirestoreReader(sa: ServiceAccount, fetchFn?: FetchFn): { loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> }`.
- REST: token `POST https://oauth2.googleapis.com/token` (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, scope `https://www.googleapis.com/auth/datastore`); queries `POST https://firestore.googleapis.com/v1/projects/{p}/databases/(default)/documents/{parent}:runQuery`. Queries per child (collection scope) — no collection-group index needed.

- [ ] **Step 1: Write failing tests** — `worker/test/firestore.test.ts`

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify, type KeyLike } from "jose";
import { createFirestoreReader, decodeDoc, getAccessToken, type ServiceAccount } from "../src/reminders/firestore";
import { UpstreamError } from "../src/upstream";
import { fakeFetch } from "./helpers";

let sa: ServiceAccount;
let pub: KeyLike;

beforeAll(async () => {
  const kp = await generateKeyPair("RS256", { extractable: true });
  pub = kp.publicKey;
  sa = { client_email: "rem@p.iam.gserviceaccount.com", private_key: await exportPKCS8(kp.privateKey), project_id: "p" };
});

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const doc = (path: string, fields: Record<string, unknown>) => ({ document: { name: `projects/p/databases/(default)/documents/${path}`, fields } });
const S = (v: string) => ({ stringValue: v });
const I = (v: number) => ({ integerValue: String(v) });
const Bo = (v: boolean) => ({ booleanValue: v });

test("decodeDoc maps REST values", () => {
  expect(decodeDoc({ name: "a/b/c/d1", fields: { s: S("x"), n: I(2), b: Bo(false), z: { nullValue: null }, t: { timestampValue: "2026-01-01T00:00:00Z" } } }))
    .toEqual({ id: "d1", s: "x", n: 2, b: false, z: null, t: "2026-01-01T00:00:00Z" });
});

test("getAccessToken signs a JWT bearer assertion", async () => {
  const f = fakeFetch(() => json({ access_token: "at", expires_in: 3600 }));
  expect(await getAccessToken(sa, f, new Date("2026-09-30T00:00:00Z"))).toBe("at");
  const body = new URLSearchParams(f.calls[0].init!.body as string);
  expect(f.calls[0].url).toBe("https://oauth2.googleapis.com/token");
  expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
  const { payload } = await jwtVerify(body.get("assertion")!, pub, { currentDate: new Date("2026-09-30T00:00:10Z") });
  expect(payload).toMatchObject({ iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/datastore" });
});

describe("loadReminderItems", () => {
  const base = "https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents";

  function server() {
    return fakeFetch((url, init) => {
      if (url.startsWith("https://oauth2")) return json({ access_token: "at" });
      const q = JSON.parse(init!.body as string).structuredQuery;
      const coll = q.from[0].collectionId;
      if (url === `${base}/families/F:runQuery` && coll === "children")
        return json([doc("families/F/children/c1", { name: S("มะลิ ใจดี"), nickname: S("มะลิ") }), doc("families/F/children/c2", { name: S("ต้นกล้า") })]);
      if (url === `${base}/families/F/children/c1:runQuery`)
        return json([
          doc("families/F/children/c1/vaccineDoses/d1", { vaccineName: S("พิษสุนัขบ้า"), doseNo: I(2), dueDate: S("2026-10-02"), given: Bo(false), place: S("รพ.เมือง") }),
          doc("families/F/children/c1/vaccineDoses/d2", { vaccineName: S("MMR"), doseNo: I(2), dueDate: S("2026-12-01"), given: Bo(false) }),
          doc("families/F/children/c1/vaccineDoses/d3", { vaccineName: S("OPV"), doseNo: I(4), dueDate: { nullValue: null }, given: Bo(false) }),
        ]);
      if (url === `${base}/families/F/children/c2:runQuery`) return json([{ readTime: "x" }]);
      if (url === `${base}/families/F:runQuery` && coll === "appointments")
        return json([
          doc("families/F/appointments/a1", { childId: S("c2"), date: S("2026-10-03"), time: S("09:30"), place: S("คลินิกเด็ก"), purpose: S("นัดหมอ"), done: Bo(false) }),
          doc("families/F/appointments/a2", { childId: S("c1"), date: S("2026-10-20"), place: S("x"), purpose: S("y"), done: Bo(false) }),
        ]);
      return new Response("unexpected " + url, { status: 500 });
    });
  }

  test("collects doses and appointments on the given dates with child nickname", async () => {
    const f = server();
    const items = await createFirestoreReader(sa, f).loadReminderItems("F", ["2026-10-02", "2026-10-03"]);
    expect(items).toEqual([
      { date: "2026-10-02", childName: "มะลิ", title: "พิษสุนัขบ้า เข็ม 2", place: "รพ.เมือง" },
      { date: "2026-10-03", childName: "ต้นกล้า", title: "นัดหมอ", time: "09:30", place: "คลินิกเด็ก" },
    ]);
    const doseQuery = JSON.parse(f.calls.find((c) => c.url.endsWith("c1:runQuery"))!.init!.body as string).structuredQuery;
    expect(doseQuery.where).toEqual({ fieldFilter: { field: { fieldPath: "given" }, op: "EQUAL", value: { booleanValue: false } } });
    expect((f.calls[1].init!.headers as Record<string, string>).Authorization).toBe("Bearer at");
    expect(f.calls.filter((c) => c.url.startsWith("https://oauth2"))).toHaveLength(1);
  });

  test("HTTP errors become UpstreamError", async () => {
    const f = fakeFetch((url) => (url.startsWith("https://oauth2") ? json({ access_token: "at" }) : new Response("x", { status: 403 })));
    await expect(createFirestoreReader(sa, f).loadReminderItems("F", ["2026-10-02"])).rejects.toBeInstanceOf(UpstreamError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd worker && npm test -- test/firestore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `worker/src/reminders/firestore.ts`

```ts
import { SignJWT, importPKCS8 } from "jose";
import type { FetchFn } from "../line/api";
import { UpstreamError } from "../upstream";
import type { ReminderItem } from "./message";

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

type FsValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  nullValue?: null;
};

function decodeValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  return null;
}

export function decodeDoc(doc: { name: string; fields?: Record<string, FsValue> }): { id: string } & Record<string, unknown> {
  const out: { id: string } & Record<string, unknown> = { id: doc.name.split("/").pop()! };
  for (const [k, v] of Object.entries(doc.fields ?? {})) out[k] = decodeValue(v);
  return out;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

export async function getAccessToken(sa: ServiceAccount, fetchFn: FetchFn, now: Date = new Date()): Promise<string> {
  const key = await importPKCS8(sa.private_key, "RS256");
  const iat = Math.floor(now.getTime() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 3600)
    .sign(key);
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  if (!res.ok) throw new UpstreamError(`google token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const eq = (field: string, value: FsValue) => ({ fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value } });
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function createFirestoreReader(sa: ServiceAccount, fetchFn: FetchFn = (i, init) => fetch(i, init)) {
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  let token: Promise<string> | null = null;

  async function runQuery(parent: string, collectionId: string, where?: object) {
    token ??= getAccessToken(sa, fetchFn);
    const res = await fetchFn(`${base}/${parent}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...(where ? { where } : {}) } }),
    });
    if (!res.ok) throw new UpstreamError(`firestore ${res.status}`);
    const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
    return rows.filter((r) => r.document).map((r) => decodeDoc(r.document!));
  }

  return {
    async loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> {
      const fam = `families/${familyId}`;
      const children = await runQuery(fam, "children");
      const nameOf = new Map(children.map((c) => [c.id, str(c.nickname) ?? str(c.name) ?? ""]));
      const items: ReminderItem[] = [];

      for (const c of children) {
        const doses = await runQuery(`${fam}/children/${c.id}`, "vaccineDoses", eq("given", { booleanValue: false }));
        for (const d of doses) {
          const due = str(d.dueDate);
          if (!due || !dates.includes(due)) continue;
          const item: ReminderItem = { date: due, childName: nameOf.get(c.id)!, title: `${d.vaccineName} เข็ม ${d.doseNo}` };
          if (str(d.place)) item.place = str(d.place);
          items.push(item);
        }
      }

      const appts = await runQuery(fam, "appointments", eq("done", { booleanValue: false }));
      for (const a of appts) {
        const date = str(a.date);
        if (!date || !dates.includes(date)) continue;
        const item: ReminderItem = { date, childName: nameOf.get(String(a.childId)) ?? "", title: String(a.purpose ?? "") };
        if (str(a.time)) item.time = str(a.time);
        if (str(a.place)) item.place = str(a.place);
        items.push(item);
      }
      return items;
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker
git commit -m "feat(worker): read upcoming doses/appointments from Firestore via service account"
```

---

### Task 5: Daily run, routes, cron wiring

**Files:**
- Create: `worker/src/reminders/run.ts`
- Test: `worker/test/run.test.ts`
- Modify: `worker/src/index.ts`, `worker/test/index.test.ts`, `worker/wrangler.toml`

**Interfaces:**
- Consumes: everything above; Plan 2's `handle`, `Deps`, `verifyFirebaseToken`, `HttpError`, `extractVaccines`, `ExtractError`.
- Produces:
  - `runDailyReminders(deps: { now: Date; familyId: string; reader: { loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> }; store: RecipientStore; api: LineApi }): Promise<{ sent: number }>`
  - `Env` gains `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_TOKEN`, `LINE_ADD_FRIEND_URL`, `FAMILY_ID`, `GCP_SA_KEY`, `LINE_KV: KVNamespace`
  - `Deps` gains `line?: { store: RecipientStore; api: LineApi }`
  - Routes: `POST /line/webhook` (signature), `GET /line/recipients` → `{ recipients: Recipient[]; addFriendUrl: string }`, `POST /line/recipients/:userId/approve` → `{ ok: true }`, `DELETE /line/recipients/:userId` → `{ ok: true }`, `POST /line/test` → `{ sent: number }` (400 `no_recipients` if none approved). All except the webhook require Firebase token + allowed uid.
  - `TEST_MESSAGE` constant.
  - default export gains `scheduled()`.

- [ ] **Step 1: Write failing run tests** — `worker/test/run.test.ts`

```ts
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
```

- [ ] **Step 2: Implement** — `worker/src/reminders/run.ts`

```ts
import type { LineApi } from "../line/api";
import type { RecipientStore } from "../line/recipients";
import { bangkokDate, buildReminderText, type ReminderItem } from "./message";

export async function runDailyReminders(deps: {
  now: Date;
  familyId: string;
  reader: { loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> };
  store: RecipientStore;
  api: LineApi;
}): Promise<{ sent: number }> {
  const recipients = (await deps.store.list()).filter((r) => r.status === "approved");
  if (!recipients.length) return { sent: 0 };
  const today = bangkokDate(deps.now);
  const tomorrow = bangkokDate(deps.now, 1);
  const items = await deps.reader.loadReminderItems(deps.familyId, [today, tomorrow]);
  const text = buildReminderText(items, today, tomorrow);
  if (!text) return { sent: 0 };
  await deps.api.multicast(recipients.map((r) => r.userId), text);
  return { sent: recipients.length };
}
```

Run: `cd worker && npm test -- test/run.test.ts`
Expected: PASS.

- [ ] **Step 3: Extend the handler tests** — edit `worker/test/index.test.ts`

Change the `env` constant to include the new fields:
```ts
const env: Env = {
  ANTHROPIC_API_KEY: "k",
  FIREBASE_PROJECT_ID: "p",
  ALLOWED_UIDS: "uid-alice, uid-bob",
  ALLOWED_ORIGIN: "https://kid.web.app,http://localhost:5173",
  LINE_CHANNEL_SECRET: "line-secret",
  LINE_CHANNEL_TOKEN: "line-token",
  LINE_ADD_FRIEND_URL: "https://line.me/R/ti/p/@kidcare",
  FAMILY_ID: "F",
  GCP_SA_KEY: "{}",
  LINE_KV: {} as never,
};
```

Add these imports at the top of the file (merge `TEST_MESSAGE` into the existing `../src/index` import):
```ts
import { createHmac } from "node:crypto";
import { kvRecipientStore } from "../src/line/recipients";
import { TEST_MESSAGE } from "../src/index";
import { memoryKV } from "./helpers";
```

Append:
```ts
function lineDeps() {
  const store = kvRecipientStore(memoryKV());
  const api = { profile: vi.fn(async () => ({ displayName: "แม่" })), reply: vi.fn(async () => {}), multicast: vi.fn(async () => {}) };
  return { store, api };
}

describe("line routes", () => {
  const followBody = JSON.stringify({ events: [{ type: "follow", replyToken: "rt", source: { type: "user", userId: "U1" } }] });
  const sign = (b: string) => createHmac("sha256", env.LINE_CHANNEL_SECRET).update(b).digest("base64");

  test("webhook requires a valid signature and needs no Firebase token", async () => {
    const line = lineDeps();
    const bad = new Request("https://w.example/line/webhook", { method: "POST", body: followBody, headers: { "x-line-signature": "nope" } });
    expect((await handle(bad, env, { ...deps(), line })).status).toBe(401);
    const good = new Request("https://w.example/line/webhook", { method: "POST", body: followBody, headers: { "x-line-signature": sign(followBody) } });
    expect((await handle(good, env, { ...deps(), line })).status).toBe(200);
    expect((await line.store.get("U1"))?.status).toBe("pending");
  });

  test("recipients list / approve / delete require an allowed user", async () => {
    const line = lineDeps();
    await line.store.put({ userId: "U1", displayName: "แม่", status: "pending", addedAt: "x" });
    const r0 = await handle(req({ method: "GET", path: "/line/recipients" }), env, { ...deps({ uid: "uid-mallory" }), line });
    expect(r0.status).toBe(403);

    const r1 = await handle(req({ method: "GET", path: "/line/recipients" }), env, { ...deps(), line });
    expect(await r1.json()).toEqual({ recipients: [{ userId: "U1", displayName: "แม่", status: "pending", addedAt: "x" }], addFriendUrl: env.LINE_ADD_FRIEND_URL });

    expect((await handle(req({ path: "/line/recipients/U1/approve", body: "" }), env, { ...deps(), line })).status).toBe(200);
    expect((await line.store.get("U1"))?.status).toBe("approved");
    expect((await handle(req({ path: "/line/recipients/U9/approve", body: "" }), env, { ...deps(), line })).status).toBe(404);

    expect((await handle(req({ method: "DELETE", path: "/line/recipients/U1" }), env, { ...deps(), line })).status).toBe(200);
    expect(await line.store.get("U1")).toBeNull();
  });

  test("test message goes to approved only; 400 when none", async () => {
    const line = lineDeps();
    const r0 = await handle(req({ path: "/line/test", body: "" }), env, { ...deps(), line });
    expect([r0.status, await r0.json()]).toEqual([400, { error: "no_recipients" }]);
    await line.store.put({ userId: "U1", displayName: "", status: "approved", addedAt: "x" });
    await line.store.put({ userId: "U2", displayName: "", status: "pending", addedAt: "x" });
    const r1 = await handle(req({ path: "/line/test", body: "" }), env, { ...deps(), line });
    expect(await r1.json()).toEqual({ sent: 1 });
    expect(line.api.multicast).toHaveBeenCalledWith(["U1"], TEST_MESSAGE);
  });
});
```

Note: the `req()` helper sends `Content-Type: application/json` and a body for non-GET/OPTIONS methods; for `DELETE` add `init.method === "DELETE"` to the "no body" condition in `req()` (`body: init.method === "OPTIONS" || init.method === "GET" || init.method === "DELETE" ? undefined : ...`).

Run: `cd worker && npm test -- test/index.test.ts`
Expected: FAIL — new routes return 404 / `TEST_MESSAGE` not exported.

- [ ] **Step 4: Rewrite `worker/src/index.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { createRemoteJWKSet } from "jose";
import { GOOGLE_JWKS_URL, verifyFirebaseToken } from "./auth";
import { ExtractError, extractVaccines, type ClaudeLike } from "./extract";
import { createLineApi, type LineApi } from "./line/api";
import { kvRecipientStore, type KVLike, type RecipientStore } from "./line/recipients";
import { verifyLineSignature } from "./line/signature";
import { handleLineWebhook } from "./line/webhook";
import { createFirestoreReader, type ServiceAccount } from "./reminders/firestore";
import { runDailyReminders } from "./reminders/run";
import { HttpError, parseExtractRequest } from "./request";
import { UpstreamError } from "./upstream";

export interface Env {
  ANTHROPIC_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_UIDS: string;
  ALLOWED_ORIGIN: string;
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_TOKEN: string;
  LINE_ADD_FRIEND_URL: string;
  FAMILY_ID: string;
  GCP_SA_KEY: string;
  LINE_KV: KVNamespace;
}

export interface LineDeps {
  store: RecipientStore;
  api: LineApi;
}

export interface Deps {
  verify(token: string): Promise<string>;
  client: ClaudeLike;
  line?: LineDeps;
}

export const TEST_MESSAGE = "✅ ทดสอบแจ้งเตือนจาก KidCare — ถ้าเห็นข้อความนี้ แปลว่าตั้งค่าเรียบร้อย ทุกเช้า 7 โมงจะมีแจ้งเตือนนัดของวันนี้และพรุ่งนี้";

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin");
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && list(env.ALLOWED_ORIGIN).includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

const json = (status: number, data: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

async function requireUser(req: Request, env: Env, deps: Deps): Promise<string> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new HttpError(401, "unauthorized");
  const uid = await deps.verify(token);
  if (!list(env.ALLOWED_UIDS).includes(uid)) throw new HttpError(403, "forbidden");
  return uid;
}

function needLine(deps: Deps): LineDeps {
  if (!deps.line) throw new Error("line deps missing");
  return deps.line;
}

export async function handle(req: Request, env: Env, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const path = new URL(req.url).pathname;
  const method = (m: string) => {
    if (req.method !== m) throw new HttpError(405, "method_not_allowed");
  };
  try {
    if (path === "/line/webhook") {
      method("POST");
      const body = await req.text();
      if (!(await verifyLineSignature(body, req.headers.get("x-line-signature"), env.LINE_CHANNEL_SECRET))) {
        throw new HttpError(401, "unauthorized");
      }
      await handleLineWebhook(body, needLine(deps));
      return json(200, {}, cors);
    }

    if (path === "/extract-vaccines") {
      method("POST");
      await requireUser(req, env, deps);
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new HttpError(400, "bad_request");
      }
      const { images, birthDate } = parseExtractRequest(body);
      return json(200, { records: await extractVaccines(deps.client, images, birthDate) }, cors);
    }

    if (path === "/line/recipients") {
      method("GET");
      await requireUser(req, env, deps);
      return json(200, { recipients: await needLine(deps).store.list(), addFriendUrl: env.LINE_ADD_FRIEND_URL }, cors);
    }

    const m = path.match(/^\/line\/recipients\/([^/]+)(\/approve)?$/);
    if (m) {
      const userId = decodeURIComponent(m[1]);
      const { store } = needLine(deps);
      if (m[2]) {
        method("POST");
        await requireUser(req, env, deps);
        const r = await store.get(userId);
        if (!r) throw new HttpError(404, "not_found");
        await store.put({ ...r, status: "approved" });
      } else {
        method("DELETE");
        await requireUser(req, env, deps);
        await store.delete(userId);
      }
      return json(200, { ok: true }, cors);
    }

    if (path === "/line/test") {
      method("POST");
      await requireUser(req, env, deps);
      const { store, api } = needLine(deps);
      const ids = (await store.list()).filter((r) => r.status === "approved").map((r) => r.userId);
      if (!ids.length) throw new HttpError(400, "no_recipients");
      await api.multicast(ids, TEST_MESSAGE);
      return json(200, { sent: ids.length }, cors);
    }

    throw new HttpError(404, "not_found");
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code }, cors);
    if (err instanceof ExtractError) return json(502, { error: err.code }, cors);
    if (err instanceof UpstreamError) return json(502, { error: "upstream" }, cors);
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "rate_limited" }, cors);
    if (err instanceof Anthropic.APIError) return json(502, { error: "upstream" }, cors);
    console.error("internal error", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "internal" }, cors);
  }
}

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

function lineDeps(env: Env): LineDeps {
  return { store: kvRecipientStore(env.LINE_KV as unknown as KVLike), api: createLineApi(env.LINE_CHANNEL_TOKEN) };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, {
      verify: (token) => verifyFirebaseToken(token, { projectId: env.FIREBASE_PROJECT_ID, jwks }),
      client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) as unknown as ClaudeLike,
      line: lineDeps(env),
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const { store, api } = lineDeps(env);
    const reader = createFirestoreReader(JSON.parse(env.GCP_SA_KEY) as ServiceAccount);
    ctx.waitUntil(
      runDailyReminders({ now: new Date(), familyId: env.FAMILY_ID, reader, store, api })
        .then((r) => console.log(`reminders: sent to ${r.sent} recipient(s)`))
        .catch((e) => console.error("reminders failed", e instanceof Error ? e.message : "unknown")),
    );
  },
};
```

Note the ordering change from Plan 2: unknown paths now return 404 before auth, and `/extract-vaccines` with GET returns 405 before auth — Plan 2's existing tests still hold (404 for `/other`, 405 for GET).

- [ ] **Step 5: Update `worker/wrangler.toml`**

Append:
```toml
[triggers]
crons = ["0 0 * * *"] # 07:00 Asia/Bangkok

[[kv_namespaces]]
binding = "LINE_KV"
id = "REPLACE_WITH_KV_ID"
```
and add to `[vars]`:
```toml
FAMILY_ID = "REPLACE_WITH_FAMILY_ID"
LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/@REPLACE"
```

- [ ] **Step 6: Run all worker tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: all PASS (Plan 2 + Plan 3 tests).

- [ ] **Step 7: Commit**

```bash
git add worker
git commit -m "feat(worker): LINE recipient routes, webhook route and daily 07:00 reminder cron"
```

---

### Task 6: Web — shared Worker fetch and LINE settings UI

**Files:**
- Create: `src/lib/workerFetch.ts`, `src/components/LineSettings.tsx`
- Modify: `src/lib/extractClient.ts` (use `workerFetch`), `src/pages/Settings.tsx`, `package.json` (+ `qrcode`, `@types/qrcode`)

**Interfaces:**
- Consumes: `auth` (Plan 1), `ImportedRecord` (Plan 2).
- Produces: `class WorkerError extends Error { code: string }`; `workerFetch<T>(path: string, init?: { method?: string; body?: unknown }, messages?: Record<string, string>): Promise<T>`; `<LineSettings />`. `callExtract` and `ExtractClientError` keep their Plan 2 signatures (`ExtractClientError` becomes an alias of `WorkerError`).

- [ ] **Step 1: Install QR library**

Run: `npm install qrcode && npm install -D @types/qrcode`
Expected: added to `package.json`.

- [ ] **Step 2: Write `src/lib/workerFetch.ts`**

```ts
import { auth } from "./firebase";

export class WorkerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const COMMON: Record<string, string> = {
  unauthorized: "กรุณาออกจากระบบแล้วเข้าใหม่",
  forbidden: "บัญชีนี้ยังไม่ได้รับสิทธิ์",
  not_found: "ไม่พบรายการ",
  bad_request: "ข้อมูลที่ส่งไม่ถูกต้อง",
  rate_limited: "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่",
  upstream: "บริการภายนอกขัดข้อง ลองใหม่ภายหลัง",
  no_recipients: "ยังไม่มีผู้รับที่อนุมัติ",
};

export async function workerFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  messages: Record<string, string> = {},
): Promise<T> {
  const msg = (code: string, fallback: string) => new WorkerError(code, messages[code] ?? COMMON[code] ?? fallback);
  if (!navigator.onLine) throw msg("offline", "ต้องต่ออินเทอร์เน็ต");
  const base = import.meta.env.VITE_WORKER_URL as string | undefined;
  if (!base) throw msg("config", "ยังไม่ได้ตั้งค่า VITE_WORKER_URL");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw msg("unauthorized", "กรุณาเข้าสู่ระบบ");
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw msg("network", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw msg(body.error ?? "unknown", `เกิดข้อผิดพลาด (${res.status})`);
  return body;
}
```

- [ ] **Step 3: Refactor `src/lib/extractClient.ts`**

```ts
import type { ImportedRecord } from "@/domain/importMatch";
import { WorkerError, workerFetch } from "./workerFetch";

export { WorkerError as ExtractClientError };

const MESSAGES: Record<string, string> = {
  forbidden: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้การอ่านสมุด",
  too_large: "รูปใหญ่หรือเยอะเกินไป (สูงสุด 6 รูป)",
  refusal: "AI อ่านรูปนี้ไม่ได้ ลองถ่ายใหม่ หรือติ๊กเข็มเอง",
  truncated: "รายการยาวเกินไป ลองส่งทีละน้อยรูปลง",
  invalid_output: "อ่านผลไม่สำเร็จ ลองอีกครั้ง",
  upstream: "บริการ AI ขัดข้อง หรือเครดิตหมด",
  offline: "ต้องต่ออินเทอร์เน็ตเพื่ออ่านรูป",
  network: "เชื่อมต่อบริการอ่านรูปไม่ได้",
};

export async function callExtract(images: { mediaType: string; data: string }[], birthDate: string): Promise<ImportedRecord[]> {
  const r = await workerFetch<{ records?: ImportedRecord[] }>("/extract-vaccines", { method: "POST", body: { images, birthDate } }, MESSAGES);
  return r.records ?? [];
}
```

Run: `npx tsc -b && npm test`
Expected: pass (ImportPinkBook still compiles; it only uses `callExtract`).

- [ ] **Step 4: Write `src/components/LineSettings.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workerFetch } from "@/lib/workerFetch";

interface Recipient {
  userId: string;
  displayName: string;
  status: "pending" | "approved";
  addedAt: string;
}

export default function LineSettings() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [addUrl, setAddUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await workerFetch<{ recipients: Recipient[]; addFriendUrl: string }>("/line/recipients");
      setRecipients(r.recipients);
      setAddUrl(r.addFriendUrl);
      setQr(await QRCode.toDataURL(r.addFriendUrl, { margin: 1, width: 180 }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await load();
      if (done) setMsg(done);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const pending = recipients.filter((r) => r.status === "pending");
  const approved = recipients.filter((r) => r.status === "approved");
  const label = (r: Recipient) => r.displayName || `ผู้ใช้ LINE …${r.userId.slice(-4)}`;

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">แจ้งเตือนทาง LINE</h2>
        <Button variant="ghost" size="icon" aria-label="รีเฟรช" disabled={busy} onClick={load}><RefreshCw size={16} /></Button>
      </div>
      <p className="text-sm text-muted-foreground">ทุกเช้า 7 โมง ระบบส่งนัดของวันนี้และพรุ่งนี้ให้ผู้รับที่อนุมัติแล้ว ให้แต่ละคนสแกน QR เพื่อเพิ่มเพื่อน แล้วกดอนุมัติที่นี่</p>
      {qr && (
        <div className="flex items-center gap-3">
          <img src={qr} alt="QR เพิ่มเพื่อน LINE" className="h-32 w-32 rounded bg-white p-1" />
          <Button asChild variant="outline" size="sm"><a href={addUrl} target="_blank" rel="noreferrer">เปิดใน LINE</a></Button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">รออนุมัติ</p>
          {pending.map((r) => (
            <div key={r.userId} className="flex items-center justify-between rounded border border-amber-500/50 px-2 py-1 text-sm">
              <span>{label(r)}</span>
              <span className="flex gap-1">
                <Button size="sm" disabled={busy} onClick={() => act(() => workerFetch(`/line/recipients/${encodeURIComponent(r.userId)}/approve`, { method: "POST" }))}><Check size={14} /> อนุมัติ</Button>
                <Button size="icon" variant="ghost" aria-label="ลบ" disabled={busy}
                  onClick={() => confirm(`ลบ ${label(r)}?`) && act(() => workerFetch(`/line/recipients/${encodeURIComponent(r.userId)}`, { method: "DELETE" }))}><Trash2 size={14} /></Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-semibold">ผู้รับแจ้งเตือน ({approved.length})</p>
        {approved.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มี</p>}
        {approved.map((r) => (
          <div key={r.userId} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
            <span>{label(r)}</span>
            <Button size="icon" variant="ghost" aria-label="ลบ" disabled={busy}
              onClick={() => confirm(`หยุดส่งแจ้งเตือนให้ ${label(r)}?`) && act(() => workerFetch(`/line/recipients/${encodeURIComponent(r.userId)}`, { method: "DELETE" }))}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" disabled={busy || approved.length === 0}
        onClick={() => act(() => workerFetch("/line/test", { method: "POST" }), "ส่งข้อความทดสอบแล้ว ให้ทุกคนเช็ก LINE")}>
        <Send size={14} /> ส่งข้อความทดสอบ
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  );
}
```

- [ ] **Step 5: Add to Settings**

In `src/pages/Settings.tsx` import `LineSettings` and render `<LineSettings />` above the logout button.

- [ ] **Step 6: Typecheck, tests, browser check**

Run: `npx tsc -b && npm test`
Expected: pass.

In the preview (after Task 7 deploys the worker changes, or against `wrangler dev` with `VITE_WORKER_URL=http://localhost:8787`): Settings shows the LINE section with QR; with no config errors shown. Full end-to-end is Task 7.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: LINE reminder settings (QR, approve recipients, test message)"
```

---

### Task 7: LINE + Google Cloud setup, deploy, end-to-end check (needs the user)

- [ ] **Step 1: LINE Official Account (user)**

Ask the user to:
1. Create a LINE Official Account (LINE Official Account Manager, free plan), e.g. name "KidCare บ้านเรา".
2. In OA Manager → Settings → Messaging API → enable, choose/create a Provider.
3. In OA Manager → Response settings: turn **off** auto-response and greeting message, turn **on** webhooks.
4. In LINE Developers console → the channel → Basic settings: copy **Channel secret**; Messaging API tab: issue a **long-lived channel access token**; note the bot **Basic ID** (`@xxxxxxx`).
5. Run in `worker/`: `npx wrangler secret put LINE_CHANNEL_SECRET` and `npx wrangler secret put LINE_CHANNEL_TOKEN`, pasting the values themselves.

Set `LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/@xxxxxxx"` in `wrangler.toml`.

- [ ] **Step 2: Read-only service account (user)**

Ask the user to, in Google Cloud Console for the Firebase project:
1. IAM & Admin → Service Accounts → Create `kidcare-reminders`, role **Cloud Datastore Viewer** only.
2. Keys → Add key → JSON → download.
3. Run `cd worker && npx wrangler secret put GCP_SA_KEY < path/to/key.json`, then delete the downloaded file.

- [ ] **Step 3: KV + family id**

Run: `cd worker && npx wrangler kv namespace create LINE_KV`
Expected: prints an `id` → put it in `wrangler.toml` `[[kv_namespaces]]`.

Set `FAMILY_ID` in `wrangler.toml` to the family document id (Firebase Console → Firestore → `families`).

- [ ] **Step 4: Deploy worker (confirm with the user first)**

Run: `cd worker && npm test && npx wrangler deploy`
Expected: deploy output lists the cron trigger `0 0 * * *`.

In LINE Developers → Messaging API → Webhook URL: `https://kidcare-extract.<subdomain>.workers.dev/line/webhook` → **Verify** → success.

- [ ] **Step 5: End-to-end with the three recipients**

1. The user, their partner and their mother scan the QR in KidCare Settings and add the OA → each gets the "รออนุมัติ" reply.
2. In Settings, refresh → 3 pending entries → approve all → "ส่งข้อความทดสอบ" → all three confirm they received it.
3. Trigger the cron once without waiting: `cd worker && npx wrangler dev --test-scheduled` then `curl "http://localhost:8787/__scheduled?cron=0+0+*+*+*"` (uses local dev secrets from `.dev.vars` — the user must add `LINE_CHANNEL_TOKEN` and `GCP_SA_KEY` there, or skip this and wait for the next 07:00 run). With an appointment created for tomorrow, all three receive the reminder message.
4. Next morning, check `npx wrangler tail` output or Cloudflare dashboard logs for `reminders: sent to 3 recipient(s)`.

- [ ] **Step 6: Deploy web (confirm first) and push**

```bash
npm run build && npx firebase deploy --only hosting
git add -A
git commit -m "chore: configure LINE reminders"
git push
```

import Anthropic from "@anthropic-ai/sdk";
import { createRemoteJWKSet } from "jose";
import { GOOGLE_JWKS_URL, verifyFirebaseToken } from "./auth";
import { ExtractError, extractVaccines, type ClaudeLike } from "./extract";
import { createLineApi, type LineApi } from "./line/api";
import { kvRecipientStore, type KVLike, type RecipientStore } from "./line/recipients";
import { verifyLineSignature } from "./line/signature";
import { handleLineWebhook } from "./line/webhook";
import { createFirestoreReader, type FirestoreClient, type ServiceAccount } from "./reminders/firestore";
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
  kv?: KVLike;
  client?: ClaudeLike;
  firestore?: FirestoreClient;
  familyId?: string;
}

export interface Deps {
  verify(token: string): Promise<string>;
  client: ClaudeLike;
  line?: LineDeps;
}

export const TEST_MESSAGE = "✅ ทดสอบแจ้งเตือนจาก KidCare — ถ้าเห็นข้อความนี้ แปลว่าตั้งค่าเรียบร้อย ทุกเช้า 7 โมงจะมีแจ้งเตือนนัดของวันนี้และพรุ่งนี้";

const MAX_BODY_BYTES = 13_000_000;
const MAX_WEBHOOK_BYTES = 1_000_000;

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin");
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && list(env.ALLOWED_ORIGIN ?? "").includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

const json = (status: number, data: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

// Today's date in Asia/Bangkok (UTC+7), as YYYY-MM-DD.
const bangkokToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

// Verifies the Firebase ID token and that the uid is on the allow-list.
async function requireUser(req: Request, env: Env, deps: Deps): Promise<string> {
  if (!env.FIREBASE_PROJECT_ID) {
    console.error("config: FIREBASE_PROJECT_ID missing");
    throw new HttpError(500, "internal");
  }
  const auth = req.headers.get("Authorization") ?? "";
  const token = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
  if (!token) throw new HttpError(401, "unauthorized");
  const uid = await deps.verify(token);
  if (!list(env.ALLOWED_UIDS ?? "").includes(uid)) throw new HttpError(403, "forbidden");
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
      if (!env.LINE_CHANNEL_SECRET) {
        console.error("config: LINE_CHANNEL_SECRET missing");
        throw new HttpError(500, "internal");
      }
      if (Number(req.headers.get("Content-Length") ?? 0) > MAX_WEBHOOK_BYTES) throw new HttpError(413, "too_large");
      const body = await req.text();
      if (body.length > MAX_WEBHOOK_BYTES) throw new HttpError(413, "too_large");
      if (!(await verifyLineSignature(body, req.headers.get("x-line-signature"), env.LINE_CHANNEL_SECRET))) {
        throw new HttpError(401, "unauthorized");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new HttpError(400, "bad_request");
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new HttpError(400, "bad_request");
      await handleLineWebhook(body, needLine(deps));
      return json(200, {}, cors);
    }

    if (path === "/extract-vaccines") {
      method("POST");
      await requireUser(req, env, deps);
      if (Number(req.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) throw new HttpError(413, "too_large");
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new HttpError(400, "bad_request");
      }
      const { images, birthDate } = parseExtractRequest(body);
      const records = await extractVaccines(deps.client, images, birthDate, bangkokToday());
      return json(200, { records }, cors);
    }

    if (path === "/line/recipients") {
      method("GET");
      await requireUser(req, env, deps);
      return json(200, { recipients: await needLine(deps).store.list(), addFriendUrl: env.LINE_ADD_FRIEND_URL }, cors);
    }

    const m = path.match(/^\/line\/recipients\/([^/]+)(\/approve)?$/);
    if (m) {
      let userId: string;
      try {
        userId = decodeURIComponent(m[1]);
      } catch {
        throw new HttpError(400, "bad_request");
      }
      method(m[2] ? "POST" : "DELETE");
      await requireUser(req, env, deps);
      const { store } = needLine(deps);
      if (m[2]) {
        const r = await store.get(userId);
        if (!r) throw new HttpError(404, "not_found");
        await store.put({ ...r, status: "approved" });
      } else {
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
    if (err instanceof ExtractError) {
      console.warn("extract", err.code);
      return json(502, { error: err.code }, cors);
    }
    if (err instanceof UpstreamError) {
      console.error("upstream", err.message);
      return json(502, { error: "upstream" }, cors);
    }
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "rate_limited" }, cors);
    if (err instanceof Anthropic.APIError) {
      console.error("upstream", err.status, err.name);
      return json(502, { error: "upstream" }, cors);
    }
    console.error("internal error", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "internal" }, cors);
  }
}

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

function lineDeps(env: Env, client?: ClaudeLike): LineDeps {
  let firestore: FirestoreClient | undefined;
  if (env.GCP_SA_KEY) {
    try {
      const sa = JSON.parse(env.GCP_SA_KEY) as ServiceAccount;
      firestore = createFirestoreReader(sa);
    } catch {
      // ignore invalid sa
    }
  }
  return {
    store: kvRecipientStore(env.LINE_KV as unknown as KVLike),
    api: createLineApi(env.LINE_CHANNEL_TOKEN),
    kv: env.LINE_KV as unknown as KVLike,
    client,
    firestore,
    familyId: env.FAMILY_ID,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) as unknown as ClaudeLike;
    return handle(req, env, {
      verify: (token) => verifyFirebaseToken(token, { projectId: env.FIREBASE_PROJECT_ID, jwks }),
      client,
      line: lineDeps(env, client),
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        let sa: ServiceAccount;
        try {
          sa = JSON.parse(env.GCP_SA_KEY) as ServiceAccount;
        } catch {
          // JSON.parse errors embed the input text; never log them.
          console.error("reminders failed", "GCP_SA_KEY invalid");
          return;
        }
        const { store, api } = lineDeps(env);
        // A fresh reader per run: its cached OAuth token must not outlive this invocation.
        const reader = createFirestoreReader(sa);
        const r = await runDailyReminders({ now: new Date(), familyId: env.FAMILY_ID, reader, store, api });
        console.log(`reminders: recipients=${r.recipients} items=${r.items} sent=${r.sent}`);
      })().catch((e) => console.error("reminders failed", e instanceof UpstreamError ? e.message : e instanceof Error ? e.name : "unknown")),
    );
  },
};

import { describe, expect, test, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { handle, type Deps, type Env } from "../src/index";
import { HttpError } from "../src/request";
import { ExtractError } from "../src/extract";

const env: Env = {
  ANTHROPIC_API_KEY: "k",
  FIREBASE_PROJECT_ID: "p",
  ALLOWED_UIDS: "uid-alice, uid-bob",
  ALLOWED_ORIGIN: "https://kid.web.app,http://localhost:5173",
};
const body = JSON.stringify({ images: [{ mediaType: "image/jpeg", data: "AAAA" }], birthDate: "2023-07-01" });

function deps(over: Partial<{ uid: string | Error; result: unknown }> = {}): Deps {
  return {
    verify: vi.fn(async () => {
      const u = over.uid ?? "uid-alice";
      if (u instanceof Error) throw u;
      return u;
    }),
    client: {
      beta: {
        messages: {
          create: vi.fn(async () => {
            if (over.result instanceof Error) throw over.result;
            return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(over.result ?? { records: [] }) }] };
          }),
        },
      },
    },
  };
}

const req = (init: RequestInit & { path?: string; origin?: string } = {}) =>
  new Request(`https://w.example${init.path ?? "/extract-vaccines"}`, {
    method: init.method ?? "POST",
    headers: { Origin: init.origin ?? "https://kid.web.app", Authorization: "Bearer t", "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: init.method === "OPTIONS" || init.method === "GET" ? undefined : (init.body ?? body),
  });

describe("handle", () => {
  test("preflight returns 204 with CORS for allowed origin", async () => {
    const r = await handle(req({ method: "OPTIONS" }), env, deps());
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("https://kid.web.app");
    expect(r.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });
  test("disallowed origin gets no CORS header", async () => {
    const r = await handle(req({ method: "OPTIONS", origin: "https://evil.example" }), env, deps());
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
  test("404 / 405", async () => {
    expect((await handle(req({ path: "/other" }), env, deps())).status).toBe(404);
    expect((await handle(req({ method: "GET" }), env, deps())).status).toBe(405);
  });
  test("401 without bearer token or invalid token", async () => {
    const noAuth = new Request("https://w.example/extract-vaccines", { method: "POST", body });
    expect((await handle(noAuth, env, deps())).status).toBe(401);
    expect((await handle(req(), env, deps({ uid: new HttpError(401, "unauthorized") }))).status).toBe(401);
  });
  test("403 when uid not allowed", async () => {
    const r = await handle(req(), env, deps({ uid: "uid-mallory" }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "forbidden" });
  });
  test("400 on invalid JSON, 413 on too many images", async () => {
    expect((await handle(req({ body: "{" }), env, deps())).status).toBe(400);
    const many = JSON.stringify({ images: Array.from({ length: 7 }, () => ({ mediaType: "image/jpeg", data: "A" })), birthDate: "2023-07-01" });
    expect((await handle(req({ body: many }), env, deps())).status).toBe(413);
  });
  test("200 with records and CORS header", async () => {
    const records = [{ pageIndex: 0, vaccineRaw: "BCG", vaccineCode: "BCG", doseNo: 1, dateRaw: null, dateGiven: "2023-07-01", lotNo: null, place: null, confidence: "high", note: null }];
    const r = await handle(req(), env, deps({ result: { records } }));
    expect(r.status).toBe(200);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("https://kid.web.app");
    expect(await r.json()).toEqual({ records });
  });
  test("maps extraction and upstream errors", async () => {
    const refusal = { beta: { messages: { create: vi.fn(async () => ({ stop_reason: "refusal", content: [] })) } } };
    const r1 = await handle(req(), env, { ...deps(), client: refusal });
    expect([r1.status, await r1.json()]).toEqual([502, { error: "refusal" }]);

    const rl = new Anthropic.RateLimitError(429, { type: "error" }, "rate", new Headers());
    expect((await handle(req(), env, deps({ result: rl }))).status).toBe(429);

    const up = new Anthropic.InternalServerError(500, { type: "error" }, "boom", new Headers());
    const r3 = await handle(req(), env, deps({ result: up }));
    expect([r3.status, await r3.json()]).toEqual([502, { error: "upstream" }]);

    expect(new ExtractError("truncated").code).toBe("truncated");
  });
  test("500 internal on unexpected error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await handle(req(), env, deps({ uid: new Error("kaboom") }));
    expect([r.status, await r.json()]).toEqual([500, { error: "internal" }]);
    spy.mockRestore();
  });
  test("500 internal when FIREBASE_PROJECT_ID is missing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps();
    const r = await handle(req(), { ...env, FIREBASE_PROJECT_ID: "" }, d);
    expect([r.status, await r.json()]).toEqual([500, { error: "internal" }]);
    expect(spy).toHaveBeenCalledWith("config: FIREBASE_PROJECT_ID missing");
    expect(d.verify).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  test("passes today (Asia/Bangkok) to extraction", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T20:00:00Z")); // 03:00 on 2026-10-02 in Bangkok
    try {
      const d = deps();
      await handle(req(), env, d);
      const create = d.client.beta.messages.create as ReturnType<typeof vi.fn>;
      expect(JSON.stringify(create.mock.calls[0][0])).toContain("2026-10-02");
    } finally {
      vi.useRealTimers();
    }
  });
});

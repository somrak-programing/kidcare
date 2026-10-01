import Anthropic from "@anthropic-ai/sdk";
import { createRemoteJWKSet } from "jose";
import { GOOGLE_JWKS_URL, verifyFirebaseToken } from "./auth";
import { ExtractError, extractVaccines, type ClaudeLike } from "./extract";
import { HttpError, parseExtractRequest } from "./request";

export interface Env {
  ANTHROPIC_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_UIDS: string;
  ALLOWED_ORIGIN: string;
}

export interface Deps {
  verify(token: string): Promise<string>;
  client: ClaudeLike;
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin");
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && list(env.ALLOWED_ORIGIN).includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

const json = (status: number, data: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

// Today's date in Asia/Bangkok (UTC+7), as YYYY-MM-DD.
const bangkokToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export async function handle(req: Request, env: Env, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (new URL(req.url).pathname !== "/extract-vaccines") throw new HttpError(404, "not_found");
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");

    if (!env.FIREBASE_PROJECT_ID) {
      console.error("config: FIREBASE_PROJECT_ID missing");
      return json(500, { error: "internal" }, cors);
    }

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) throw new HttpError(401, "unauthorized");
    const uid = await deps.verify(token);
    if (!list(env.ALLOWED_UIDS).includes(uid)) throw new HttpError(403, "forbidden");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "bad_request");
    }
    const { images, birthDate } = parseExtractRequest(body);
    const records = await extractVaccines(deps.client, images, birthDate, bangkokToday());
    return json(200, { records }, cors);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code }, cors);
    if (err instanceof ExtractError) return json(502, { error: err.code }, cors);
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "rate_limited" }, cors);
    if (err instanceof Anthropic.APIError) return json(502, { error: "upstream" }, cors);
    console.error("internal error", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "internal" }, cors);
  }
}

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, {
      verify: (token) => verifyFirebaseToken(token, { projectId: env.FIREBASE_PROJECT_ID, jwks }),
      client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) as unknown as ClaudeLike,
    });
  },
};

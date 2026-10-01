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
    let res: Response;
    try {
      res = await fetchFn(`${BASE}${path}`, {
        method: init.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new UpstreamError(`LINE ${path} network error`);
    }
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

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

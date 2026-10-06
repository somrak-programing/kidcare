import { beforeAll, describe, expect, test, vi } from "vitest";
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
    const apptQuery = JSON.parse(f.calls.find((c) => c.url === `${base}/families/F:runQuery` && JSON.parse(c.init!.body as string).structuredQuery.from[0].collectionId === "appointments")!.init!.body as string).structuredQuery;
    expect(apptQuery.where).toEqual({ fieldFilter: { field: { fieldPath: "done" }, op: "EQUAL", value: { booleanValue: false } } });
    expect((f.calls[1].init!.headers as Record<string, string>).Authorization).toBe("Bearer at");
    expect(f.calls.filter((c) => c.url.startsWith("https://oauth2"))).toHaveLength(1);
  });

  test("warns when the family has no children (wrong FAMILY_ID)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fakeFetch((url) => (url.startsWith("https://oauth2") ? json({ access_token: "at" }) : json([{ readTime: "x" }])));
    const items = await createFirestoreReader(sa, f).loadReminderItems("F", ["2026-10-02"]);
    expect(items).toEqual([]);
    expect(warn).toHaveBeenCalledWith("reminders: family has no children — check FAMILY_ID");
    warn.mockRestore();
  });

  test("HTTP errors become UpstreamError", async () => {
    const f = fakeFetch((url) => (url.startsWith("https://oauth2") ? json({ access_token: "at" }) : new Response("x", { status: 403 })));
    await expect(createFirestoreReader(sa, f).loadReminderItems("F", ["2026-10-02"])).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("network failures", () => {
  test("token fetch rejection becomes UpstreamError", async () => {
    const f = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(getAccessToken(sa, f)).rejects.toBeInstanceOf(UpstreamError);
  });

  test("runQuery fetch rejection becomes UpstreamError", async () => {
    const f = fakeFetch((url) => {
      if (url.startsWith("https://oauth2")) return json({ access_token: "at" });
      throw new TypeError("fetch failed");
    });
    await expect(createFirestoreReader(sa, f).loadReminderItems("F", ["2026-10-02"])).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("loadChildren and createAppointment", () => {
  const base = "https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents";

  test("loadChildren maps child records", async () => {
    const f = fakeFetch((url) => {
      if (url.startsWith("https://oauth2")) return json({ access_token: "at" });
      return json([
        doc("families/F/children/c1", { name: S("มะลิ ใจดี"), nickname: S("มะลิ") }),
        doc("families/F/children/c2", { name: S("ต้นกล้า") }),
      ]);
    });
    const children = await createFirestoreReader(sa, f).loadChildren("F");
    expect(children).toEqual([
      { id: "c1", name: "มะลิ ใจดี", nickname: "มะลิ" },
      { id: "c2", name: "ต้นกล้า", nickname: undefined },
    ]);
  });

  test("createAppointment POSTs to firestore and returns doc id", async () => {
    let postedBody: any;
    const f = fakeFetch((url, init) => {
      if (url.startsWith("https://oauth2")) return json({ access_token: "at" });
      if (url === `${base}/families/F/appointments` && init?.method === "POST") {
        postedBody = JSON.parse(init.body as string);
        return json({ name: "projects/p/databases/(default)/documents/families/F/appointments/newApptId" });
      }
      return new Response("not found", { status: 404 });
    });

    const id = await createFirestoreReader(sa, f).createAppointment("F", {
      childId: "c1",
      date: "2026-10-07",
      place: "โรงเรียน",
      purpose: "วันสุดท้ายของภาคเรียน",
    });

    expect(id).toBe("newApptId");
    expect(postedBody.fields.purpose).toEqual({ stringValue: "วันสุดท้ายของภาคเรียน" });
    expect(postedBody.fields.done).toEqual({ booleanValue: false });
  });

  test("findMatchingAppointment finds duplicate by childId, date and purpose match", async () => {
    const f = fakeFetch((url, init) => {
      if (url.startsWith("https://oauth2")) return json({ access_token: "at" });
      if (url === `${base}/families/F:runQuery`) {
        return json([
          doc("families/F/appointments/a1", { childId: S("c1"), date: S("2026-10-07"), purpose: S("เปิดเทอมภาคเรียนที่ 2"), done: Bo(false) }),
        ]);
      }
      return new Response("not found", { status: 404 });
    });

    const reader = createFirestoreReader(sa, f);
    const match = await reader.findMatchingAppointment("F", "c1", "2026-10-07", "เปิดเทอม");
    expect(match).toEqual({ id: "a1", purpose: "เปิดเทอมภาคเรียนที่ 2", date: "2026-10-07" });

    const noMatch = await reader.findMatchingAppointment("F", "c1", "2026-10-08", "เปิดเทอม");
    expect(noMatch).toBeNull();
  });

  test("updateAppointment PATCHes fields to firestore", async () => {
    let patchedBody: any;
    let requestUrl: string = "";
    const f = fakeFetch((url, init) => {
      if (url.startsWith("https://oauth2")) return json({ access_token: "at" });
      if (init?.method === "PATCH") {
        requestUrl = url;
        patchedBody = JSON.parse(init.body as string);
        return json({ name: "updated" });
      }
      return new Response("not found", { status: 404 });
    });

    const reader = createFirestoreReader(sa, f);
    await reader.updateAppointment("F", "a1", { time: "08:30", remindTiming: "special" });
    expect(requestUrl).toContain("updateMask.fieldPaths=time");
    expect(requestUrl).toContain("updateMask.fieldPaths=remindTiming");
    expect(patchedBody.fields.time).toEqual({ stringValue: "08:30" });
    expect(patchedBody.fields.remindTiming).toEqual({ stringValue: "special" });
  });
});


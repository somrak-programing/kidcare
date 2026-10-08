import { SignJWT, importPKCS8 } from "jose";
import type { FetchFn } from "../line/api";
import type { KVLike } from "../line/recipients";
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

let memoryTokenPromise: Promise<string> | null = null;
let memoryTokenExpiresAt = 0;

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
  let res: Response;
  try {
    res = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    });
  } catch {
    throw new UpstreamError("google token network error");
  }
  if (!res.ok) throw new UpstreamError(`google token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function getCachedAccessToken(
  sa: ServiceAccount,
  fetchFn: FetchFn = (i, init) => fetch(i, init),
  now: Date = new Date(),
  kv?: KVLike,
): Promise<string> {
  const nowSec = Math.floor(now.getTime() / 1000);

  // 1. Check in-memory module cache (valid if > 120s remaining)
  if (memoryTokenPromise && memoryTokenExpiresAt > nowSec + 120) {
    return memoryTokenPromise;
  }

  // 2. Check KV cache if available
  if (kv) {
    try {
      const kvCached = await kv.get(`gcp_token:${sa.client_email}`);
      if (kvCached) {
        const parsed = JSON.parse(kvCached) as { token: string; exp: number };
        if (parsed.token && parsed.exp > nowSec + 120) {
          memoryTokenExpiresAt = parsed.exp;
          memoryTokenPromise = Promise.resolve(parsed.token);
          return parsed.token;
        }
      }
    } catch {
      // ignore kv read errors
    }
  }

  // 3. Generate new OAuth token via JWT
  memoryTokenPromise = (async () => {
    const token = await getAccessToken(sa, fetchFn, now);
    memoryTokenExpiresAt = nowSec + 3300; // 55 mins
    if (kv) {
      await kv.put(
        `gcp_token:${sa.client_email}`,
        JSON.stringify({ token, exp: memoryTokenExpiresAt }),
        { expirationTtl: 3300 },
      ).catch(() => {});
    }
    return token;
  })();

  return memoryTokenPromise;
}

const eq = (field: string, value: FsValue) => ({ fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value } });
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function createFirestoreReader(
  sa: ServiceAccount,
  fetchFn: FetchFn = (i, init) => fetch(i, init),
  kv?: KVLike,
) {
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

  function getToken(): Promise<string> {
    return getCachedAccessToken(sa, fetchFn, new Date(), kv);
  }

  async function runQuery(parent: string, collectionId: string, where?: object) {
    const accessToken = await getToken();
    let res: Response;
    try {
      res = await fetchFn(`${base}/${parent}:runQuery`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...(where ? { where } : {}) } }),
      });
    } catch {
      throw new UpstreamError("firestore network error");
    }
    if (!res.ok) throw new UpstreamError(`firestore ${res.status}`);
    const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
    return rows.filter((r) => r.document).map((r) => decodeDoc(r.document!));
  }

  return {
    async loadReminderItems(familyId: string, dates: string[]): Promise<ReminderItem[]> {
      const fam = `families/${familyId}`;
      const children = await runQuery(fam, "children");
      if (!children.length) console.warn("reminders: family has no children — check FAMILY_ID");
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
        const cId = String(a.childId ?? "");
        let personName = nameOf.get(cId);
        if (!personName) {
          if (cId === "parent:dad" || cId === "dad") personName = "คุณพ่อ";
          else if (cId === "parent:mom" || cId === "mom") personName = "คุณแม่";
          else if (cId === "family") personName = "ครอบครัว";
          else personName = "";
        }
        const item: ReminderItem = { date, childName: personName, title: String(a.purpose ?? "") };
        if (str(a.time)) item.time = str(a.time);
        if (str(a.place)) item.place = str(a.place);
        if (a.remindTiming === "special" || a.remindTiming === "normal") item.remindTiming = a.remindTiming;
        items.push(item);
      }
      return items;
    },

    async loadUpcomingSummary(familyId: string, fromDate: string, limit = 5): Promise<ReminderItem[]> {
      const fam = `families/${familyId}`;
      const items: ReminderItem[] = [];
      const nameOf = new Map<string, string>();

      try {
        // Query children and appointments concurrently for maximum speed
        const [childrenRes, apptsRes] = await Promise.all([
          runQuery(fam, "children").catch(() => []),
          runQuery(fam, "appointments", eq("done", { booleanValue: false })).catch(() => []),
        ]);

        for (const c of childrenRes) {
          nameOf.set(c.id, str(c.nickname) ?? str(c.name) ?? "");
        }

        // Add upcoming appointments first
        for (const a of apptsRes) {
          const date = str(a.date);
          if (!date || date < fromDate) continue;
          const cId = String(a.childId ?? "");
          let personName = nameOf.get(cId);
          if (!personName) {
            if (cId === "parent:dad" || cId === "dad") personName = "คุณพ่อ";
            else if (cId === "parent:mom" || cId === "mom") personName = "คุณแม่";
            else if (cId === "family") personName = "ครอบครัว";
            else personName = "";
          }
          const item: ReminderItem = { date, childName: personName, title: String(a.purpose ?? "") };
          if (str(a.time)) item.time = str(a.time);
          if (str(a.place)) item.place = str(a.place);
          if (a.remindTiming === "special" || a.remindTiming === "normal") item.remindTiming = a.remindTiming;
          items.push(item);
        }

        // Query vaccine doses for all children in parallel with a strict 1.5s timeout
        if (childrenRes.length > 0) {
          const timeoutDoses = new Promise<void>((resolve) => setTimeout(resolve, 1500));
          const fetchDoses = Promise.allSettled(
            childrenRes.map(async (c) => {
              const doses = await runQuery(`${fam}/children/${c.id}`, "vaccineDoses", eq("given", { booleanValue: false }));
              for (const d of doses) {
                const due = str(d.dueDate);
                if (!due || due < fromDate) continue;
                const item: ReminderItem = { date: due, childName: nameOf.get(c.id) || "ลูก", title: `${d.vaccineName} เข็ม ${d.doseNo}` };
                if (str(d.place)) item.place = str(d.place);
                items.push(item);
              }
            }),
          );
          await Promise.race([fetchDoses, timeoutDoses]);
        }
      } catch (err) {
        console.error("loadUpcomingSummary error:", err);
      }

      items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.childName.localeCompare(b.childName));
      return items.slice(0, limit);
    },

    async loadChildren(familyId: string): Promise<Array<{ id: string; name: string; nickname?: string }>> {
      const fam = `families/${familyId}`;
      const children = await runQuery(fam, "children");
      return children.map((c) => ({
        id: c.id,
        name: str(c.name) ?? "",
        nickname: str(c.nickname),
      }));
    },

    async findMatchingAppointment(
      familyId: string,
      childId: string,
      date: string,
      purpose: string,
    ): Promise<{ id: string; purpose: string; date: string } | null> {
      const fam = `families/${familyId}`;
      const appts = await runQuery(fam, "appointments", eq("done", { booleanValue: false }));
      const normPurpose = purpose.trim().toLowerCase();
      for (const a of appts) {
        if (str(a.childId) !== childId || str(a.date) !== date) continue;
        const p = (str(a.purpose) ?? "").trim().toLowerCase();
        // Exact match or one contains the other (e.g. "เปิดเทอม" inside "เปิดเทอมภาคเรียนที่ 2")
        if (p === normPurpose || (p.length >= 3 && normPurpose.includes(p)) || (normPurpose.length >= 3 && p.includes(normPurpose))) {
          return { id: a.id, purpose: str(a.purpose) ?? "", date: str(a.date) ?? "" };
        }
      }
      return null;
    },

    async updateAppointment(
      familyId: string,
      appointmentId: string,
      data: {
        childId?: string;
        date?: string;
        time?: string | null;
        place?: string | null;
        purpose?: string;
        notes?: string | null;
        remindTiming?: "normal" | "special";
      },
    ): Promise<void> {
      const accessToken = await getToken();
      const fields: Record<string, FsValue> = {};
      const updateMask: string[] = [];

      if (data.childId !== undefined) {
        fields.childId = { stringValue: data.childId };
        updateMask.push("childId");
      }
      if (data.date !== undefined) {
        fields.date = { stringValue: data.date };
        updateMask.push("date");
      }
      if (data.place !== undefined && data.place !== null) {
        fields.place = { stringValue: data.place };
        updateMask.push("place");
      }
      if (data.purpose !== undefined) {
        fields.purpose = { stringValue: data.purpose };
        updateMask.push("purpose");
      }
      if (data.time !== undefined) {
        if (data.time) fields.time = { stringValue: data.time };
        else fields.time = { nullValue: null };
        updateMask.push("time");
      }
      if (data.notes !== undefined) {
        if (data.notes) fields.notes = { stringValue: data.notes };
        else fields.notes = { nullValue: null };
        updateMask.push("notes");
      }
      if (data.remindTiming !== undefined) {
        fields.remindTiming = { stringValue: data.remindTiming };
        updateMask.push("remindTiming");
      }

      if (!updateMask.length) return;
      const maskParams = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
      const url = `${base}/families/${familyId}/appointments/${appointmentId}?${maskParams}`;

      let res: Response;
      try {
        res = await fetchFn(url, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
      } catch {
        throw new UpstreamError("firestore network error");
      }
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`firestore updateAppointment failed ${res.status}:`, errBody);
        throw new UpstreamError(`firestore ${res.status}`);
      }
    },

    async createAppointment(
      familyId: string,
      data: {
        childId: string;
        date: string;
        time?: string | null;
        place?: string | null;
        purpose: string;
        notes?: string | null;
        remindTiming?: "normal" | "special";
      },
    ): Promise<string> {
      const accessToken = await getToken();
      const fields: Record<string, FsValue> = {
        familyId: { stringValue: familyId },
        childId: { stringValue: data.childId },
        date: { stringValue: data.date },
        place: { stringValue: data.place || "โรงเรียน" },
        purpose: { stringValue: data.purpose },
        done: { booleanValue: false },
      };
      if (data.time) fields.time = { stringValue: data.time };
      if (data.notes) fields.notes = { stringValue: data.notes };
      if (data.remindTiming) fields.remindTiming = { stringValue: data.remindTiming };

      let res: Response;
      try {
        res = await fetchFn(`${base}/families/${familyId}/appointments`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
      } catch {
        throw new UpstreamError("firestore network error");
      }
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`firestore createAppointment failed ${res.status}:`, errBody);
        throw new UpstreamError(`firestore ${res.status}`);
      }
      const json = (await res.json()) as { name: string };
      return json.name.split("/").pop()!;
    },
  };
}

export type FirestoreClient = ReturnType<typeof createFirestoreReader>;


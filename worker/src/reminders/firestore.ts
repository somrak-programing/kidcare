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

const eq = (field: string, value: FsValue) => ({ fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value } });
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function createFirestoreReader(sa: ServiceAccount, fetchFn: FetchFn = (i, init) => fetch(i, init)) {
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  let token: Promise<string> | null = null;

  async function runQuery(parent: string, collectionId: string, where?: object) {
    token ??= getAccessToken(sa, fetchFn);
    const accessToken = await token;
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
        const children = await runQuery(fam, "children").catch(() => []);
        for (const c of children) {
          nameOf.set(c.id, str(c.nickname) ?? str(c.name) ?? "");
        }

        // Query doses for all children in parallel
        await Promise.allSettled(
          children.map(async (c) => {
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
      } catch (err) {
        console.error("loadUpcomingSummary children/doses error:", err);
      }

      try {
        const appts = await runQuery(fam, "appointments", eq("done", { booleanValue: false })).catch(() => []);
        for (const a of appts) {
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
      } catch (err) {
        console.error("loadUpcomingSummary appointments error:", err);
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
      token ??= getAccessToken(sa, fetchFn);
      const accessToken = await token;
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
      if (!res.ok) throw new UpstreamError(`firestore ${res.status}`);
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
      token ??= getAccessToken(sa, fetchFn);
      const accessToken = await token;
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
      if (!res.ok) throw new UpstreamError(`firestore ${res.status}`);
      const json = (await res.json()) as { name: string };
      return json.name.split("/").pop()!;
    },
  };
}

export type FirestoreClient = ReturnType<typeof createFirestoreReader>;


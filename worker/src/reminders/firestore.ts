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

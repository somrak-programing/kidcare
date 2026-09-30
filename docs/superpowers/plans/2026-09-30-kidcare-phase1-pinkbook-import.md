# KidCare Pink-Book Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parents photograph the vaccine pages of the Thai Maternal & Child Health Handbook (สมุดชมพู); Claude reads them into structured dose records; the parent reviews/corrects them and saves into the child's vaccine timeline without typing.

**Architecture:** A Cloudflare Worker (`worker/`, free plan) holds the Anthropic API key, verifies the caller's Firebase ID token against an allow-list of uids, sends the resized images to Claude (`claude-opus-5-5`, JSON-schema structured output, server-side refusal fallback) and returns validated records. Nothing is stored server-side. The web app resizes photos in the browser, calls the Worker, auto-matches records to existing EPI doses with a pure function, shows a review screen, and writes confirmed rows in one Firestore batch.

**Tech Stack:** Cloudflare Workers + wrangler, `@anthropic-ai/sdk`, `jose` (JWT/JWKS), `zod`, Vitest; web side reuses Plan 1's stack.

**Spec:** `docs/superpowers/specs/2026-09-30-kidcare-phase1-design.md` §6 (plus §8 Worker security, §10 Worker tests).

**Depends on:** Plan 1 (`2026-09-30-kidcare-phase1-core.md`) Tasks 1–11 complete (types, `vaccineCode` on doses, EPI template, repos, child page).

## Global Constraints

- Model `claude-opus-5-5`; `output_config.effort: "medium"`; beta `server-side-fallback-2026-07-01` with `fallbacks: "default"`; always check `stop_reason` (`refusal`, `max_tokens`) before reading content.
- API key only in `wrangler secret` (`ANTHROPIC_API_KEY`) / local `worker/.dev.vars` (git-ignored). Never in the web bundle.
- Every Worker request needs a valid Firebase ID token (RS256, `iss = https://securetoken.google.com/<projectId>`, `aud = <projectId>`) whose `sub` is in `ALLOWED_UIDS`. CORS only for origins in `ALLOWED_ORIGIN` (comma-separated).
- Limits: ≤ 6 images per request, each base64 string ≤ 2 MiB (2,097,152 chars) → otherwise HTTP 413.
- Images are not stored or logged anywhere; do not send child name or HN — only images + birth date.
- Nothing is saved without the review screen. Rows whose date is null, before birth, or in the future are not pre-ticked.
- Vaccine codes are shared between `worker/src/schema.ts` and `src/data/vaccineCodes.ts` and must match (enforced by a test): `BCG, HB, DTP-HB-Hib, DTP, OPV, IPV, ROTA, MMR, JE, HPV, dT, RABIES, FLU, OTHER`. Every `vaccineCode` in `src/data/epi.ts` and `src/data/customTemplates.ts` must be in this list.
- Worker error codes (JSON `{ "error": code }`): `unauthorized` 401, `forbidden` 403, `not_found` 404, `method_not_allowed` 405, `bad_request` 400, `too_large` 413, `rate_limited` 429, `refusal` / `truncated` / `invalid_output` / `upstream` 502, `internal` 500.

## File Structure

```
worker/
  package.json, tsconfig.json, wrangler.toml, vitest.config.ts, .dev.vars (git-ignored)
  src/
    schema.ts        VACCINE_CODES, RECORDS_JSON_SCHEMA, RecordsSchema (zod), ImportedRecord type
    prompt.ts        SYSTEM_PROMPT, userPrompt()
    request.ts       HttpError, parseExtractRequest()
    auth.ts          verifyFirebaseToken()
    extract.ts       ExtractError, buildParams(), extractVaccines()
    index.ts         handle() + default export (routing, CORS, error mapping)
  test/
    request.test.ts, auth.test.ts, extract.test.ts, index.test.ts
src/ (web, additions)
  data/vaccineCodes.ts, data/vaccineCodes.test.ts
  domain/imageResize.ts (+ test), domain/importMatch.ts (+ test)
  lib/resizeImage.ts, lib/extractClient.ts
  lib/repo/vaccines.ts            + saveImport()
  pages/ImportPinkBook.tsx
  components/VaccineTimeline.tsx  + "นำเข้าจากสมุดชมพู" button
  App.tsx                         + route /children/:id/import
```

---

### Task 1: Worker scaffold, output schema, prompt, request validation

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.toml`, `worker/vitest.config.ts`, `worker/src/schema.ts`, `worker/src/prompt.ts`, `worker/src/request.ts`
- Test: `worker/test/request.test.ts`
- Modify: `.gitignore` (already has `worker/.dev.vars`, `worker/node_modules`, `.wrangler` from the spec commit — verify)

**Interfaces:**
- Produces:
  - `VACCINE_CODES` (readonly tuple above), `type VaccineCode`
  - `RecordsSchema` (zod) and `type ImportedRecord = { pageIndex: number; vaccineRaw: string; vaccineCode: VaccineCode; doseNo: number | null; dateRaw: string | null; dateGiven: string | null; lotNo: string | null; place: string | null; confidence: "high" | "medium" | "low"; note: string | null }`
  - `RECORDS_JSON_SCHEMA` (plain JSON Schema object, `additionalProperties: false`, all keys required)
  - `SYSTEM_PROMPT: string`, `userPrompt(imageCount: number, birthDate: string): string`
  - `class HttpError extends Error { status: number; code: string }`
  - `type ExtractImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }`
  - `parseExtractRequest(body: unknown): { images: ExtractImage[]; birthDate: string }` (throws `HttpError`)
  - `MAX_IMAGES = 6`, `MAX_IMAGE_B64 = 2_097_152`

- [ ] **Step 1: Write worker package files**

`worker/package.json`:
```json
{
  "name": "kidcare-extract",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "jose": "^5.6.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240725.0",
    "typescript": "^5.5.3",
    "vitest": "^2.0.3",
    "wrangler": "^3.68.0"
  }
}
```

`worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src", "test"]
}
```

`worker/wrangler.toml` (fill project id / origin after Plan 1 Task 7 and 13):
```toml
name = "kidcare-extract"
main = "src/index.ts"
compatibility_date = "2026-09-01"
compatibility_flags = ["nodejs_compat"]

[vars]
FIREBASE_PROJECT_ID = "kidcare-xxxx"
ALLOWED_UIDS = ""
ALLOWED_ORIGIN = "https://kidcare-xxxx.web.app,http://localhost:5173"
```

`worker/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node", include: ["test/**/*.test.ts"] } });
```

Run: `cd worker && npm install`
Expected: installs without errors. After install, run `npm ls @anthropic-ai/sdk` and pin the installed version in `package.json` (replace `"latest"` with `"^<version>"`).

- [ ] **Step 2: Write `worker/src/schema.ts`**

```ts
import { z } from "zod";

// ต้องตรงกับ src/data/vaccineCodes.ts ของเว็บ (มี test ตรวจ)
export const VACCINE_CODES = [
  "BCG", "HB", "DTP-HB-Hib", "DTP", "OPV", "IPV", "ROTA", "MMR", "JE", "HPV", "dT", "RABIES", "FLU", "OTHER",
] as const;
export type VaccineCode = (typeof VACCINE_CODES)[number];

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

export const RECORDS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["records"],
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pageIndex", "vaccineRaw", "vaccineCode", "doseNo", "dateRaw", "dateGiven", "lotNo", "place", "confidence", "note"],
        properties: {
          pageIndex: { type: "integer" },
          vaccineRaw: { type: "string" },
          vaccineCode: { type: "string", enum: [...VACCINE_CODES] },
          doseNo: { anyOf: [{ type: "integer" }, { type: "null" }] },
          dateRaw: nullableString,
          dateGiven: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
          lotNo: nullableString,
          place: nullableString,
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          note: nullableString,
        },
      },
    },
  },
} as const;

export const RecordSchema = z.object({
  pageIndex: z.number().int().min(0),
  vaccineRaw: z.string(),
  vaccineCode: z.enum(VACCINE_CODES),
  doseNo: z.number().int().min(1).nullable(),
  dateRaw: z.string().nullable(),
  dateGiven: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  lotNo: z.string().nullable(),
  place: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().nullable(),
});
export const RecordsSchema = z.object({ records: z.array(RecordSchema) });
export type ImportedRecord = z.infer<typeof RecordSchema>;
```

- [ ] **Step 3: Write `worker/src/prompt.ts`**

```ts
export const SYSTEM_PROMPT = `You read photos of the vaccination record pages of a Thai Maternal and Child Health Handbook (สมุดบันทึกสุขภาพแม่และเด็ก, "the pink book") and extract every vaccine dose that is recorded as GIVEN.

What counts as a record:
- A row/cell with a date and/or signature/stamp/lot sticker showing the dose was given.
- Rows that are only printed schedule text with no date/signature are NOT records. Do not output them.

For each record:
- pageIndex: 0-based index of the image the record appears in, in the order the images were provided.
- vaccineRaw: the vaccine name exactly as written/printed on that row (Thai or English).
- vaccineCode: map to one code:
  BCG = BCG, วัณโรค
  HB = hepatitis B birth dose, HB, HBV, ตับอักเสบบี (given alone)
  DTP-HB-Hib = DTP-HB-Hib, DTP-HB, DTwP-HB-Hib, คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี(-ฮิบ), 5-in-1/6-in-1 combos
  DTP = DTP/DTaP booster (คอตีบ-บาดทะยัก-ไอกรน without HB)
  OPV = oral polio, OPV, หยอดโปลิโอ
  IPV = injected polio, IPV
  ROTA = rotavirus, Rota, โรต้า
  MMR = MMR, MR, measles, หัด-คางทูม-หัดเยอรมัน
  JE = Japanese encephalitis, JE, LAJE, ไข้สมองอักเสบเจอี
  HPV = HPV
  dT = dT, Td (school-age tetanus-diphtheria)
  RABIES = rabies, พิษสุนัขบ้า
  FLU = influenza, ไข้หวัดใหญ่
  OTHER = anything else (keep the name in vaccineRaw)
- doseNo: the dose number from the row/column label (เข็มที่, ครั้งที่, 1/2/3) if shown, else null.
- dateRaw: the date exactly as written. dateGiven: the same date as YYYY-MM-DD in the Gregorian calendar.
  Thai handbooks usually write Buddhist Era dates, often dd/mm/yy with a 2-digit BE year (15/3/67 = 15 March 2567 BE = 2024-03-15) or with Thai month abbreviations (ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.). Gregorian = Buddhist Era − 543.
  A dose cannot be before the child's birth date or in the future; use that to resolve ambiguous years.
- lotNo: lot/batch number if written or on a sticker, else null. place: clinic/hospital if written, else null.
- confidence: high if every field you filled is clearly legible; medium if some guessing of a single character/digit; low if the row is hard to read.
- note: short Thai note about anything uncertain (e.g. "ปีเลือน อ่านได้ 66 หรือ 68"), else null.

Never guess a value you cannot read — use null, lower the confidence, and explain in note.`;

export function userPrompt(imageCount: number, birthDate: string): string {
  return `There are ${imageCount} image(s) above, pageIndex 0 to ${imageCount - 1}. The child's birth date is ${birthDate} (Gregorian). Extract all given vaccine doses.`;
}
```

- [ ] **Step 4: Write the failing request tests** — `worker/test/request.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { HttpError, MAX_IMAGE_B64, parseExtractRequest } from "../src/request";

const img = (data = "aGVsbG8=") => ({ mediaType: "image/jpeg", data });

describe("parseExtractRequest", () => {
  test("accepts valid body", () => {
    expect(parseExtractRequest({ images: [img()], birthDate: "2023-07-01" })).toEqual({ images: [img()], birthDate: "2023-07-01" });
  });
  test("400 on bad shape", () => {
    for (const body of [null, {}, { images: [], birthDate: "2023-07-01" }, { images: [img()], birthDate: "1/7/66" }, { images: [{ mediaType: "image/gif", data: "x" }], birthDate: "2023-07-01" }]) {
      expect(() => parseExtractRequest(body)).toThrowError(expect.objectContaining({ status: 400, code: "bad_request" }));
    }
  });
  test("413 on too many or too large images", () => {
    const seven = Array.from({ length: 7 }, () => img());
    expect(() => parseExtractRequest({ images: seven, birthDate: "2023-07-01" })).toThrowError(expect.objectContaining({ status: 413, code: "too_large" }));
    const big = img("a".repeat(MAX_IMAGE_B64 + 1));
    expect(() => parseExtractRequest({ images: [big], birthDate: "2023-07-01" })).toThrowError(expect.objectContaining({ status: 413 }));
  });
  test("HttpError carries status and code", () => {
    const e = new HttpError(403, "forbidden");
    expect(e).toBeInstanceOf(Error);
    expect([e.status, e.code]).toEqual([403, "forbidden"]);
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `cd worker && npm test -- test/request.test.ts`
Expected: FAIL — cannot resolve `../src/request`.

- [ ] **Step 6: Implement** — `worker/src/request.ts`

```ts
import { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export const MAX_IMAGES = 6;
export const MAX_IMAGE_B64 = 2_097_152;

const BodySchema = z.object({
  images: z
    .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(1) }))
    .min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ExtractImage = z.infer<typeof BodySchema>["images"][number];

export function parseExtractRequest(body: unknown): { images: ExtractImage[]; birthDate: string } {
  const r = BodySchema.safeParse(body);
  if (!r.success) throw new HttpError(400, "bad_request");
  if (r.data.images.length > MAX_IMAGES || r.data.images.some((i) => i.data.length > MAX_IMAGE_B64)) {
    throw new HttpError(413, "too_large");
  }
  return r.data;
}
```

- [ ] **Step 7: Run tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add worker .gitignore
git commit -m "feat(worker): scaffold, output schema, prompt, request validation"
```

---

### Task 2: Firebase ID token verification

**Files:**
- Create: `worker/src/auth.ts`
- Test: `worker/test/auth.test.ts`

**Interfaces:**
- Produces: `GOOGLE_JWKS_URL`, `type JwksGetter = Parameters<typeof jwtVerify>[1]`, `verifyFirebaseToken(token: string, opts: { projectId: string; jwks: JwksGetter }): Promise<string>` → uid; throws `HttpError(401, "unauthorized")` on any verification failure.

- [ ] **Step 1: Write failing tests** — `worker/test/auth.test.ts`

```ts
import { beforeAll, describe, expect, test } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type KeyLike } from "jose";
import { verifyFirebaseToken } from "../src/auth";

const PROJECT = "kidcare-test";
let priv: KeyLike;
let jwks: ReturnType<typeof createLocalJWKSet>;
let otherPriv: KeyLike;

beforeAll(async () => {
  const kp = await generateKeyPair("RS256");
  priv = kp.privateKey;
  const jwk = { ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  jwks = createLocalJWKSet({ keys: [jwk] });
  otherPriv = (await generateKeyPair("RS256")).privateKey;
});

function token(opts: { key?: KeyLike; aud?: string; iss?: string; exp?: string | number; sub?: string } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject(opts.sub ?? "uid-alice")
    .setAudience(opts.aud ?? PROJECT)
    .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(opts.key ?? priv);
}

describe("verifyFirebaseToken", () => {
  test("returns uid for valid token", async () => {
    expect(await verifyFirebaseToken(await token(), { projectId: PROJECT, jwks })).toBe("uid-alice");
  });
  const cases: [string, () => Promise<string>][] = [
    ["wrong audience", () => token({ aud: "other" })],
    ["wrong issuer", () => token({ iss: "https://evil.example" })],
    ["expired", () => token({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ["bad signature", () => token({ key: otherPriv })],
  ];
  test.each(cases)("401 on %s", async (_name, make) => {
    await expect(verifyFirebaseToken(await make(), { projectId: PROJECT, jwks })).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });
  test("401 on garbage", async () => {
    await expect(verifyFirebaseToken("not-a-jwt", { projectId: PROJECT, jwks })).rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd worker && npm test -- test/auth.test.ts`
Expected: FAIL — cannot resolve `../src/auth`.

- [ ] **Step 3: Implement** — `worker/src/auth.ts`

```ts
import { jwtVerify } from "jose";
import { HttpError } from "./request";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export type JwksGetter = Parameters<typeof jwtVerify>[1];

export async function verifyFirebaseToken(token: string, opts: { projectId: string; jwks: JwksGetter }): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, opts.jwks as never, {
      issuer: `https://securetoken.google.com/${opts.projectId}`,
      audience: opts.projectId,
      algorithms: ["RS256"],
    });
    if (!payload.sub) throw new Error("no sub");
    return payload.sub;
  } catch {
    throw new HttpError(401, "unauthorized");
  }
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/auth.ts worker/test/auth.test.ts
git commit -m "feat(worker): verify Firebase ID tokens"
```

---

### Task 3: Claude extraction

**Files:**
- Create: `worker/src/extract.ts`
- Test: `worker/test/extract.test.ts`

**Interfaces:**
- Consumes: `RECORDS_JSON_SCHEMA`, `RecordsSchema`, `ImportedRecord`, `SYSTEM_PROMPT`, `userPrompt`, `ExtractImage`.
- Produces: `class ExtractError extends Error { code: "refusal" | "truncated" | "invalid_output" }`; `interface ClaudeLike { beta: { messages: { create(params: Record<string, unknown>): Promise<{ stop_reason: string | null; content: Array<{ type: string; text?: string }> }> } } }`; `buildParams(images, birthDate): Record<string, unknown>`; `extractVaccines(client: ClaudeLike, images: ExtractImage[], birthDate: string): Promise<ImportedRecord[]>` (drops records whose `pageIndex >= images.length`).

- [ ] **Step 1: Write failing tests** — `worker/test/extract.test.ts`

```ts
import { describe, expect, test, vi } from "vitest";
import { buildParams, extractVaccines, type ClaudeLike } from "../src/extract";

const images = [{ mediaType: "image/jpeg" as const, data: "AAAA" }];
const rec = {
  pageIndex: 0, vaccineRaw: "BCG", vaccineCode: "BCG", doseNo: 1, dateRaw: "1/7/66", dateGiven: "2023-07-01",
  lotNo: null, place: "รพ.เมือง", confidence: "high", note: null,
};

function fake(res: { stop_reason: string | null; content: Array<{ type: string; text?: string }> }) {
  const create = vi.fn().mockResolvedValue(res);
  return { client: { beta: { messages: { create } } } as ClaudeLike, create };
}

describe("buildParams", () => {
  test("model, fallback, structured output, images before text", () => {
    const p = buildParams(images, "2023-07-01") as any;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.fallbacks).toBe("default");
    expect(p.output_config.effort).toBe("medium");
    expect(p.output_config.format.type).toBe("json_schema");
    const content = p.messages[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
    expect(content.at(-1).type).toBe("text");
    expect(content.at(-1).text).toContain("2023-07-01");
  });
});

describe("extractVaccines", () => {
  test("returns validated records and drops out-of-range pageIndex", async () => {
    const { client, create } = fake({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ records: [rec, { ...rec, pageIndex: 3 }] }) }] });
    expect(await extractVaccines(client, images, "2023-07-01")).toEqual([rec]);
    expect(create).toHaveBeenCalledOnce();
  });
  test("ignores non-text blocks (e.g. fallback/thinking)", async () => {
    const { client } = fake({ stop_reason: "end_turn", content: [{ type: "thinking" }, { type: "text", text: JSON.stringify({ records: [] }) }] });
    expect(await extractVaccines(client, images, "2023-07-01")).toEqual([]);
  });
  test.each([
    ["refusal", { stop_reason: "refusal", content: [] }],
    ["truncated", { stop_reason: "max_tokens", content: [{ type: "text", text: "{\"records\":[" }] }],
    ["invalid_output", { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] }],
    ["invalid_output", { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ records: [{ ...rec, vaccineCode: "XYZ" }] }) }] }],
  ])("throws %s", async (code, res) => {
    const { client } = fake(res);
    await expect(extractVaccines(client, images, "2023-07-01")).rejects.toMatchObject({ code });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd worker && npm test -- test/extract.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `worker/src/extract.ts`

```ts
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
import type { ExtractImage } from "./request";
import { RECORDS_JSON_SCHEMA, RecordsSchema, type ImportedRecord } from "./schema";

export class ExtractError extends Error {
  constructor(public code: "refusal" | "truncated" | "invalid_output") {
    super(code);
  }
}

export interface ClaudeLike {
  beta: {
    messages: {
      create(params: Record<string, unknown>): Promise<{ stop_reason: string | null; content: Array<{ type: string; text?: string }> }>;
    };
  };
}

export function buildParams(images: ExtractImage[], birthDate: string): Record<string, unknown> {
  return {
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: RECORDS_JSON_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
          { type: "text", text: userPrompt(images.length, birthDate) },
        ],
      },
    ],
  };
}

export async function extractVaccines(client: ClaudeLike, images: ExtractImage[], birthDate: string): Promise<ImportedRecord[]> {
  const res = await client.beta.messages.create(buildParams(images, birthDate));
  if (res.stop_reason === "refusal") throw new ExtractError("refusal");
  if (res.stop_reason === "max_tokens") throw new ExtractError("truncated");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ExtractError("invalid_output");
  }
  const parsed = RecordsSchema.safeParse(json);
  if (!parsed.success) throw new ExtractError("invalid_output");
  return parsed.data.records.filter((r) => r.pageIndex < images.length);
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/extract.ts worker/test/extract.test.ts
git commit -m "feat(worker): Claude vision extraction with structured output and refusal handling"
```

---

### Task 4: HTTP handler (routing, auth, CORS, error mapping)

**Files:**
- Create: `worker/src/index.ts`
- Test: `worker/test/index.test.ts`

**Interfaces:**
- Consumes: `parseExtractRequest`, `HttpError`, `verifyFirebaseToken`, `GOOGLE_JWKS_URL`, `JwksGetter`, `extractVaccines`, `ExtractError`, `ClaudeLike`.
- Produces: `interface Env { ANTHROPIC_API_KEY: string; FIREBASE_PROJECT_ID: string; ALLOWED_UIDS: string; ALLOWED_ORIGIN: string }`; `interface Deps { verify(token: string): Promise<string>; client: ClaudeLike }`; `handle(req: Request, env: Env, deps: Deps): Promise<Response>`; default export `{ fetch(req, env) }`.
- API: `POST /extract-vaccines` with `Authorization: Bearer <Firebase ID token>`, body `{ images: [{ mediaType, data }], birthDate }` → `200 { records: ImportedRecord[] }`.

- [ ] **Step 1: Write failing tests** — `worker/test/index.test.ts`

```ts
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
});
```

If the SDK's error constructors have a different signature in the installed version, construct them per the SDK's `src/core/error.ts` (or `error.d.ts`) — only the `instanceof` checks matter.

- [ ] **Step 2: Run to verify failure**

Run: `cd worker && npm test -- test/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `worker/src/index.ts`

```ts
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

export async function handle(req: Request, env: Env, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (new URL(req.url).pathname !== "/extract-vaccines") throw new HttpError(404, "not_found");
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");

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
    const records = await extractVaccines(deps.client, images, birthDate);
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
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd worker && npm test && npm run typecheck`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts worker/test/index.test.ts
git commit -m "feat(worker): HTTP handler with auth allow-list, CORS and error mapping"
```

---

### Task 5: Deploy the Worker (needs the user)

**Files:**
- Modify: `worker/wrangler.toml` (real values)
- Create: `worker/.dev.vars` (git-ignored)

- [ ] **Step 1: User setup** — ask the user to:
  1. Sign up at console.anthropic.com, add credits (min ~$5), create an API key, and set a workspace **spend limit** (e.g. $10/month).
  2. Sign up for Cloudflare (free, no card).
  3. Run `cd worker && npx wrangler login` (opens a browser).
  4. Run `npx wrangler secret put ANTHROPIC_API_KEY` and paste the key themselves. **Do not type or echo the key yourself.**

- [ ] **Step 2: Fill `wrangler.toml` vars**

Get uids from Firebase Console → Authentication → Users (the user's uid now; the partner's uid once they sign in). Set `FIREBASE_PROJECT_ID`, `ALLOWED_UIDS` (comma-separated), `ALLOWED_ORIGIN` = `https://<projectId>.web.app,https://<projectId>.firebaseapp.com,http://localhost:5173`.

- [ ] **Step 3: Deploy (confirm with the user first)**

Run: `cd worker && npm test && npx wrangler deploy`
Expected: prints `https://kidcare-extract.<subdomain>.workers.dev`.

- [ ] **Step 4: Smoke test**

Run: `curl -s -X POST https://kidcare-extract.<subdomain>.workers.dev/extract-vaccines -H "Content-Type: application/json" -d "{}"`
Expected: `{"error":"unauthorized"}` (proves routing + auth gate without spending credits).

- [ ] **Step 5: Commit**

```bash
git add worker/wrangler.toml
git commit -m "chore(worker): configure project, allowed uids and origins"
```

---

### Task 6: Web — vaccine codes, image sizing, import matching (pure logic)

**Files:**
- Create: `src/data/vaccineCodes.ts`, `src/domain/imageResize.ts`, `src/domain/importMatch.ts`
- Test: `src/data/vaccineCodes.test.ts`, `src/domain/imageResize.test.ts`, `src/domain/importMatch.test.ts`
- Modify: `vitest.config.ts` (no change needed if `include` is `src/**/*.test.ts`)

**Interfaces:**
- Consumes: `VaccineDose`, `ISODate` (Plan 1), `EPI_TEMPLATE`, `CUSTOM_TEMPLATES`, worker `VACCINE_CODES` (test only).
- Produces:
  - `VACCINE_CODES`, `type VaccineCode` (web copy)
  - `fitWithin(w: number, h: number, maxEdge: number): { w: number; h: number }`
  - `interface ImportedRecord` (same fields as worker)
  - `interface ImportRow { key: string; record: ImportedRecord; target: string; include: boolean; warnings: string[] }` — `target` is a dose id or `"new"`
  - `matchImportedDoses(records: ImportedRecord[], doses: VaccineDose[], birthDate: ISODate, today: ISODate): ImportRow[]` (output order = input order)
  - `rowWarnings(record: ImportedRecord, target: string, doses: VaccineDose[], birthDate: ISODate, today: ISODate): string[]`
  - `findDuplicateTargets(rows: ImportRow[]): Set<string>` (dose ids chosen by more than one included row)

- [ ] **Step 1: Write failing tests**

`src/data/vaccineCodes.test.ts`:
```ts
import { expect, test } from "vitest";
import { VACCINE_CODES } from "./vaccineCodes";
import { VACCINE_CODES as WORKER_CODES } from "../../worker/src/schema";
import { EPI_TEMPLATE } from "./epi";
import { CUSTOM_TEMPLATES } from "./customTemplates";

test("web and worker vaccine codes are identical", () => {
  expect([...VACCINE_CODES]).toEqual([...WORKER_CODES]);
});

test("every template vaccineCode is a known code", () => {
  const codes = new Set<string>(VACCINE_CODES);
  for (const it of EPI_TEMPLATE) expect(codes.has(it.vaccineCode), it.vaccineCode).toBe(true);
  for (const t of CUSTOM_TEMPLATES) if (t.vaccineCode) expect(codes.has(t.vaccineCode), t.vaccineCode).toBe(true);
});
```

`src/domain/imageResize.test.ts`:
```ts
import { expect, test } from "vitest";
import { fitWithin } from "./imageResize";

test("keeps small images", () => expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 }));
test("scales landscape by width", () => expect(fitWithin(4032, 3024, 1600)).toEqual({ w: 1600, h: 1200 }));
test("scales portrait by height", () => expect(fitWithin(3024, 4032, 1600)).toEqual({ w: 1200, h: 1600 }));
```

`src/domain/importMatch.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import type { VaccineDose } from "@/types";
import { findDuplicateTargets, matchImportedDoses, type ImportedRecord } from "./importMatch";

const B = "2023-07-01";
const T = "2026-09-30";

const dose = (id: string, code: string, doseNo: number, given = false): VaccineDose => ({
  id, familyId: "f", childId: "c", seriesId: `s-${code}`, vaccineName: code, vaccineCode: code, doseNo,
  dueDate: "2024-01-01", given, givenDate: null, givenDateUnknown: false, source: "manual",
});
const rec = (over: Partial<ImportedRecord>): ImportedRecord => ({
  pageIndex: 0, vaccineRaw: "x", vaccineCode: "OPV", doseNo: null, dateRaw: null, dateGiven: "2023-09-01",
  lotNo: null, place: null, confidence: "high", note: null, ...over,
});

const DOSES = [dose("opv1", "OPV", 1), dose("opv2", "OPV", 2), dose("opv3", "OPV", 3), dose("bcg1", "BCG", 1, true)];

describe("matchImportedDoses", () => {
  test("matches by code + doseNo", () => {
    const rows = matchImportedDoses([rec({ doseNo: 2 })], DOSES, B, T);
    expect(rows[0]).toMatchObject({ target: "opv2", include: true, warnings: [] });
  });

  test("null doseNo assigns earliest pending doses in date order, output keeps input order", () => {
    const rows = matchImportedDoses(
      [rec({ dateGiven: "2023-11-01" }), rec({ dateGiven: "2023-09-01" })],
      DOSES, B, T,
    );
    expect(rows.map((r) => r.target)).toEqual(["opv2", "opv1"]);
  });

  test("no candidate → new; OTHER → new", () => {
    const rows = matchImportedDoses([rec({ vaccineCode: "MMR", doseNo: 1 }), rec({ vaccineCode: "OTHER", vaccineRaw: "ไข้เลือดออก" })], DOSES, B, T);
    expect(rows.map((r) => r.target)).toEqual(["new", "new"]);
  });

  test("warns when overwriting an already-given dose", () => {
    const rows = matchImportedDoses([rec({ vaccineCode: "BCG", doseNo: 1 })], DOSES, B, T);
    expect(rows[0].target).toBe("bcg1");
    expect(rows[0].warnings).toContain("เข็มนี้บันทึกว่าฉีดแล้ว — จะเขียนทับ");
  });

  test("date problems are warned and not pre-ticked", () => {
    const rows = matchImportedDoses(
      [rec({ dateGiven: null }), rec({ dateGiven: "2023-06-30" }), rec({ dateGiven: "2026-10-01" })],
      DOSES, B, T,
    );
    expect(rows.map((r) => r.include)).toEqual([false, false, false]);
    expect(rows[0].warnings).toContain("อ่านวันที่ไม่ออก");
    expect(rows[1].warnings).toContain("วันที่ก่อนวันเกิด");
    expect(rows[2].warnings).toContain("วันที่อยู่ในอนาคต");
  });

  test("low confidence is warned but still pre-ticked when the date is valid", () => {
    const rows = matchImportedDoses([rec({ doseNo: 1, confidence: "low" })], DOSES, B, T);
    expect(rows[0].include).toBe(true);
    expect(rows[0].warnings).toContain("AI ไม่มั่นใจ ตรวจกับสมุดอีกครั้ง");
  });

  test("keys are unique", () => {
    const rows = matchImportedDoses([rec({}), rec({})], DOSES, B, T);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });
});

test("findDuplicateTargets ignores new and excluded rows", () => {
  const r = (key: string, target: string, include = true) => ({ key, record: rec({}), target, include, warnings: [] });
  expect(findDuplicateTargets([r("a", "opv1"), r("b", "opv1"), r("c", "new"), r("d", "new"), r("e", "opv2"), r("f", "opv2", false)])).toEqual(new Set(["opv1"]));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/data/vaccineCodes.test.ts src/domain/imageResize.test.ts src/domain/importMatch.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/data/vaccineCodes.ts`:
```ts
// ต้องตรงกับ worker/src/schema.ts (มี test ตรวจ)
export const VACCINE_CODES = [
  "BCG", "HB", "DTP-HB-Hib", "DTP", "OPV", "IPV", "ROTA", "MMR", "JE", "HPV", "dT", "RABIES", "FLU", "OTHER",
] as const;
export type VaccineCode = (typeof VACCINE_CODES)[number];
```

`src/domain/imageResize.ts`:
```ts
export function fitWithin(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { w, h };
  const s = maxEdge / edge;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}
```

`src/domain/importMatch.ts`:
```ts
import type { VaccineCode } from "@/data/vaccineCodes";
import type { ISODate, VaccineDose } from "@/types";

export interface ImportedRecord {
  pageIndex: number;
  vaccineRaw: string;
  vaccineCode: VaccineCode;
  doseNo: number | null;
  dateRaw: string | null;
  dateGiven: ISODate | null;
  lotNo: string | null;
  place: string | null;
  confidence: "high" | "medium" | "low";
  note: string | null;
}

export interface ImportRow {
  key: string;
  record: ImportedRecord;
  target: string; // dose id | "new"
  include: boolean;
  warnings: string[];
}

function dateProblem(r: ImportedRecord, birthDate: ISODate, today: ISODate): string | null {
  if (!r.dateGiven) return "อ่านวันที่ไม่ออก";
  if (r.dateGiven < birthDate) return "วันที่ก่อนวันเกิด";
  if (r.dateGiven > today) return "วันที่อยู่ในอนาคต";
  return null;
}

export function rowWarnings(r: ImportedRecord, target: string, doses: VaccineDose[], birthDate: ISODate, today: ISODate): string[] {
  const w: string[] = [];
  const dp = dateProblem(r, birthDate, today);
  if (dp) w.push(dp);
  if (r.confidence === "low") w.push("AI ไม่มั่นใจ ตรวจกับสมุดอีกครั้ง");
  if (target !== "new" && doses.find((d) => d.id === target)?.given) w.push("เข็มนี้บันทึกว่าฉีดแล้ว — จะเขียนทับ");
  return w;
}

export function matchImportedDoses(records: ImportedRecord[], doses: VaccineDose[], birthDate: ISODate, today: ISODate): ImportRow[] {
  const used = new Set<string>();
  const targets = new Array<string>(records.length).fill("new");
  const order = records
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.dateGiven ?? "9999").localeCompare(b.r.dateGiven ?? "9999"));

  // รอบแรก: มีเลขเข็ม → จับตรงตัว
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo === null) continue;
    const m = doses.find((d) => d.vaccineCode === r.vaccineCode && d.doseNo === r.doseNo && !used.has(d.id));
    if (m) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }
  // รอบสอง: ไม่มีเลขเข็ม → เข็มที่ยังไม่ฉีดลำดับแรกของวัคซีนนั้น ตามลำดับวันที่
  for (const { r, i } of order) {
    if (r.vaccineCode === "OTHER" || r.doseNo !== null) continue;
    const m = doses
      .filter((d) => d.vaccineCode === r.vaccineCode && !d.given && !used.has(d.id))
      .sort((a, b) => a.doseNo - b.doseNo)[0];
    if (m) {
      used.add(m.id);
      targets[i] = m.id;
    }
  }

  return records.map((r, i) => ({
    key: `${i}-${r.pageIndex}-${r.vaccineCode}-${r.doseNo ?? "x"}`,
    record: r,
    target: targets[i],
    include: dateProblem(r, birthDate, today) === null,
    warnings: rowWarnings(r, targets[i], doses, birthDate, today),
  }));
}

export function findDuplicateTargets(rows: ImportRow[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const r of rows) {
    if (!r.include || r.target === "new") continue;
    if (seen.has(r.target)) dup.add(r.target);
    seen.add(r.target);
  }
  return dup;
}
```

Note: the cross-import in `vaccineCodes.test.ts` pulls `worker/src/schema.ts` into the web `tsc -b` check; it only imports `zod`, which the web app also depends on, so it typechecks.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS. If "every template vaccineCode is a known code" fails, fix the template (Plan 1 Task 4) — never loosen the test.

- [ ] **Step 5: Commit**

```bash
git add src/data src/domain
git commit -m "feat(import): vaccine codes, image sizing and dose matching logic"
```

---

### Task 7: Web — extract client, resize, save, review page

**Files:**
- Create: `src/lib/resizeImage.ts`, `src/lib/extractClient.ts`, `src/pages/ImportPinkBook.tsx`
- Modify: `src/lib/repo/vaccines.ts` (add `saveImport`), `src/components/VaccineTimeline.tsx` (button), `src/App.tsx` (route), `.env.example` (+ `VITE_WORKER_URL=`), `.env.local` (real URL)

**Interfaces:**
- Consumes: `fitWithin`, `matchImportedDoses`, `rowWarnings`, `findDuplicateTargets`, `ImportedRecord`, `ImportRow`; `auth` (Plan 1); `useChild`, `useDoses`; `fire`, `childSub`, `db`.
- Produces:
  - `resizeToJpegBase64(file: File, maxEdge?: number, quality?: number): Promise<{ mediaType: "image/jpeg"; data: string }>`
  - `class ExtractClientError extends Error`; `callExtract(images: { mediaType: string; data: string }[], birthDate: string): Promise<ImportedRecord[]>`
  - `saveImport(fid: string, cid: string, rows: { target: string; record: ImportedRecord }[]): void`
  - route `/children/:id/import`

- [ ] **Step 1: Write `src/lib/resizeImage.ts`**

```ts
import { fitWithin } from "@/domain/imageResize";

export async function resizeToJpegBase64(file: File, maxEdge = 1600, quality = 0.85): Promise<{ mediaType: "image/jpeg"; data: string }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { w, h } = fitWithin(bmp.width, bmp.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { mediaType: "image/jpeg", data: btoa(bin) };
}
```

- [ ] **Step 2: Write `src/lib/extractClient.ts`**

```ts
import type { ImportedRecord } from "@/domain/importMatch";
import { auth } from "./firebase";

export class ExtractClientError extends Error {}

const MESSAGES: Record<string, string> = {
  unauthorized: "กรุณาออกจากระบบแล้วเข้าใหม่",
  forbidden: "บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้การอ่านสมุด",
  too_large: "รูปใหญ่หรือเยอะเกินไป (สูงสุด 6 รูป)",
  bad_request: "ข้อมูลที่ส่งไม่ถูกต้อง",
  refusal: "AI อ่านรูปนี้ไม่ได้ ลองถ่ายใหม่ หรือติ๊กเข็มเอง",
  truncated: "รายการยาวเกินไป ลองส่งทีละน้อยรูปลง",
  invalid_output: "อ่านผลไม่สำเร็จ ลองอีกครั้ง",
  rate_limited: "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่",
  upstream: "บริการ AI ขัดข้อง หรือเครดิตหมด",
};

export async function callExtract(images: { mediaType: string; data: string }[], birthDate: string): Promise<ImportedRecord[]> {
  if (!navigator.onLine) throw new ExtractClientError("ต้องต่ออินเทอร์เน็ตเพื่ออ่านรูป");
  const base = import.meta.env.VITE_WORKER_URL as string | undefined;
  if (!base) throw new ExtractClientError("ยังไม่ได้ตั้งค่า VITE_WORKER_URL");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ExtractClientError(MESSAGES.unauthorized);
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/extract-vaccines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ images, birthDate }),
    });
  } catch {
    throw new ExtractClientError("เชื่อมต่อบริการอ่านรูปไม่ได้");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; records?: ImportedRecord[] };
  if (!res.ok) throw new ExtractClientError(MESSAGES[body.error ?? ""] ?? `เกิดข้อผิดพลาด (${res.status})`);
  return body.records ?? [];
}
```

- [ ] **Step 3: Add `saveImport` to `src/lib/repo/vaccines.ts`**

Append (the file already imports `doc`, `serverTimestamp`, `writeBatch`, `db`, `fire`, `childSub`):
```ts
import type { ImportedRecord } from "@/domain/importMatch";

export function saveImport(fid: string, cid: string, rows: { target: string; record: ImportedRecord }[]) {
  if (!rows.length) return;
  const batch = writeBatch(db);
  const doseCol = childSub(fid, cid, "vaccineDoses");

  for (const { target, record: r } of rows) {
    if (target === "new") continue;
    batch.update(doc(doseCol, target), {
      given: true,
      givenDate: r.dateGiven,
      givenDateUnknown: r.dateGiven === null,
      lotNo: r.lotNo ?? undefined,
      place: r.place ?? undefined,
      source: "import",
      importConfidence: r.confidence,
    });
  }

  // รายการที่ไม่มีเข็มให้จับคู่ → สร้างชุดใหม่ ต่อวัคซีน 1 ชุด
  const groups = new Map<string, ImportedRecord[]>();
  for (const { target, record: r } of rows) {
    if (target !== "new") continue;
    const k = r.vaccineCode === "OTHER" ? `OTHER|${r.vaccineRaw.trim()}` : r.vaccineCode;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const recs of groups.values()) {
    recs.sort((a, b) => (a.dateGiven ?? "9999").localeCompare(b.dateGiven ?? "9999"));
    const name = recs[0].vaccineRaw.trim() || recs[0].vaccineCode;
    const seriesRef = doc(childSub(fid, cid, "vaccineSeries"));
    batch.set(seriesRef, { name, source: "custom", templateKey: "import", createdAt: serverTimestamp() });
    recs.forEach((r, i) => {
      batch.set(doc(doseCol), {
        familyId: fid,
        childId: cid,
        seriesId: seriesRef.id,
        vaccineName: name,
        vaccineCode: r.vaccineCode === "OTHER" ? null : r.vaccineCode,
        doseNo: r.doseNo ?? i + 1,
        dueDate: r.dateGiven,
        given: true,
        givenDate: r.dateGiven,
        givenDateUnknown: r.dateGiven === null,
        lotNo: r.lotNo ?? undefined,
        place: r.place ?? undefined,
        source: "import",
        importConfidence: r.confidence,
      });
    });
  }
  fire(batch.commit());
}
```

(Move the new `import type` line to the top of the file with the other imports.)

- [ ] **Step 4: Write `src/pages/ImportPinkBook.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ErrorState from "@/components/ErrorState";
import { useChild, useDoses } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { findDuplicateTargets, matchImportedDoses, rowWarnings, type ImportRow } from "@/domain/importMatch";
import { callExtract } from "@/lib/extractClient";
import { resizeToJpegBase64 } from "@/lib/resizeImage";
import { saveImport } from "@/lib/repo/vaccines";

const MAX_FILES = 6;
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export default function ImportPinkBook() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: child, error } = useChild(fid, cid);
  const { data: doses } = useDoses(fid, cid);
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"pick" | "reading" | "review">("pick");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const today = todayISO();

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const dups = findDuplicateTargets(rows);
  const doseLabel = (id: string) => {
    const d = doses.find((x) => x.id === id);
    return d ? `${d.vaccineName} เข็ม ${d.doseNo}${d.given ? " (บันทึกแล้ว)" : ""}` : id;
  };

  if (error) return <ErrorState error={error} />;
  if (!child) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  async function onRead() {
    if (!child) return;
    setMsg(null);
    setPhase("reading");
    try {
      const images = await Promise.all(files.map((f) => resizeToJpegBase64(f)));
      const records = await callExtract(images, child.birthDate);
      setRows(matchImportedDoses(records, doses, child.birthDate, today));
      setPhase("review");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setPhase("pick");
    }
  }

  function update(key: string, patch: { target?: string; include?: boolean; dateGiven?: string | null; lotNo?: string | null; place?: string | null }) {
    if (!child) return;
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const record = {
          ...r.record,
          ...("dateGiven" in patch ? { dateGiven: patch.dateGiven ?? null } : {}),
          ...("lotNo" in patch ? { lotNo: patch.lotNo ?? null } : {}),
          ...("place" in patch ? { place: patch.place ?? null } : {}),
        };
        const target = patch.target ?? r.target;
        return { ...r, record, target, include: patch.include ?? r.include, warnings: rowWarnings(record, target, doses, child.birthDate, today) };
      }),
    );
  }

  function onSave() {
    const chosen = rows.filter((r) => r.include);
    saveImport(fid, cid, chosen.map((r) => ({ target: r.target, record: r.record })));
    nav(`/children/${cid}`);
  }

  return (
    <div className="space-y-4">
      <Link to={`/children/${cid}`} className="text-sm underline">← {child.nickname || child.name}</Link>
      <h1 className="text-xl font-bold">นำเข้าวัคซีนจากสมุดชมพู</h1>

      {phase !== "review" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">ถ่ายรูปหน้าบันทึกวัคซีนให้ชัด เห็นวันที่ครบ ได้สูงสุด {MAX_FILES} รูป รูปจะถูกส่งไปให้ AI อ่านแล้วทิ้ง ไม่ถูกเก็บไว้</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm">
            <Camera size={18} /> เลือก/ถ่ายรูป
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_FILES))} />
          </label>
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((u, i) => <img key={u} src={u} alt={`หน้า ${i + 1}`} className="aspect-[3/4] w-full rounded object-cover" />)}
            </div>
          )}
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <Button className="w-full" disabled={!files.length || phase === "reading"} onClick={onRead}>
            {phase === "reading" ? <><Loader2 size={16} className="animate-spin" /> กำลังอ่าน… (อาจใช้เวลาเกือบนาที)</> : "อ่านด้วย AI"}
          </Button>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">ตรวจกับสมุดทีละแถว แก้ได้ทุกช่อง แถวสีเหลืองควรดูให้ละเอียด</p>
          {rows.length === 0 && <p>ไม่พบรายการวัคซีนในรูป</p>}
          {rows.map((r) => {
            const warn = r.warnings.length > 0 || dups.has(r.target);
            const sameCode = doses.filter((d) => d.vaccineCode === r.record.vaccineCode);
            const others = doses.filter((d) => d.vaccineCode !== r.record.vaccineCode);
            return (
              <div key={r.key} className={`space-y-2 rounded-lg border p-3 text-sm ${warn ? "border-amber-500 bg-amber-500/10" : ""}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                  <div className="flex-1">
                    <p className="font-semibold">{r.record.vaccineRaw} {r.record.doseNo ? `เข็ม ${r.record.doseNo}` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      หน้า {r.record.pageIndex + 1} · ในสมุด: {r.record.dateRaw ?? "—"}
                      {r.record.dateGiven ? ` → ${formatThaiDate(r.record.dateGiven)}` : ""}
                    </p>
                  </div>
                  {previews[r.record.pageIndex] && (
                    <a href={previews[r.record.pageIndex]} target="_blank" rel="noreferrer">
                      <img src={previews[r.record.pageIndex]} alt="" className="h-12 w-9 rounded object-cover" />
                    </a>
                  )}
                </div>
                <select className={selectCls} value={r.target} onChange={(e) => update(r.key, { target: e.target.value })}>
                  <option value="new">สร้างเป็นชุดใหม่</option>
                  {sameCode.map((d) => <option key={d.id} value={d.id}>{doseLabel(d.id)}</option>)}
                  {others.length > 0 && (
                    <optgroup label="วัคซีนอื่น">
                      {others.map((d) => <option key={d.id} value={d.id}>{doseLabel(d.id)}</option>)}
                    </optgroup>
                  )}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="date" className="h-9" value={r.record.dateGiven ?? ""} onChange={(e) => update(r.key, { dateGiven: e.target.value || null })} />
                  <Input className="h-9" placeholder="Lot" value={r.record.lotNo ?? ""} onChange={(e) => update(r.key, { lotNo: e.target.value || null })} />
                  <Input className="h-9" placeholder="สถานที่" value={r.record.place ?? ""} onChange={(e) => update(r.key, { place: e.target.value || null })} />
                </div>
                {(r.warnings.length > 0 || dups.has(r.target)) && (
                  <ul className="text-xs text-amber-300">
                    {r.warnings.map((w) => <li key={w}>• {w}</li>)}
                    {dups.has(r.target) && <li>• เลือกเข็มนี้ซ้ำกับแถวอื่น</li>}
                    {r.record.note && <li>• AI: {r.record.note}</li>}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button disabled={dups.size > 0 || !rows.some((r) => r.include)} onClick={onSave}>
              บันทึก {rows.filter((r) => r.include).length} รายการ
            </Button>
            <Button variant="ghost" onClick={() => { setRows([]); setPhase("pick"); }}>อ่านใหม่</Button>
          </div>
          <p className="text-xs text-muted-foreground">ถ้าอ่านไม่ได้ ยังใช้ "ติ๊กเข็มที่ฉีดแล้ว" ในหน้าลูกได้เสมอ</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire route, button, env**

`src/App.tsx`: `import ImportPinkBook from "@/pages/ImportPinkBook";` and `<Route path="/children/:id/import" element={<ImportPinkBook />} />`.

`src/components/VaccineTimeline.tsx`: next to the "ติ๊กเข็มที่ฉีดแล้ว" button add
```tsx
<Button asChild size="sm" variant="outline"><Link to={`/children/${child.id}/import`}><Camera size={14} /> นำเข้าจากสมุดชมพู</Link></Button>
```
and add `Camera` to the `lucide-react` import.

`.env.example`: add `VITE_WORKER_URL=`. `.env.local`: `VITE_WORKER_URL=https://kidcare-extract.<subdomain>.workers.dev`.

- [ ] **Step 6: Typecheck, tests, browser check**

Run: `npx tsc -b && npm test`
Expected: pass.

In the preview (dev server on `http://localhost:5173`, which must be in `ALLOWED_ORIGIN`): open a child → "นำเข้าจากสมุดชมพู" → pick 1 real photo of a pink-book vaccine page (ask the user for one) → "อ่านด้วย AI" → review rows appear, matched to EPI doses; low-confidence/invalid rows are yellow; change a target to create a duplicate → Save is disabled with a duplicate warning; fix → save → child timeline shows the doses as ฉีดแล้ว with lot/place. Check the network tab: request goes only to the Worker URL; the response has only `records`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(import): pink-book photo import with AI extraction and review screen"
```

---

### Task 8: Real-photo accuracy pass and release

- [ ] **Step 1: Accuracy check with the user**

With the user, import all vaccine pages of both children's pink books. For each child, compare the review screen against the book row by row and note: missed rows, wrong codes, wrong dates (especially BE 2-digit years), wrong dose numbers. If there are systematic errors, adjust `SYSTEM_PROMPT` in `worker/src/prompt.ts` with a specific rule for that pattern (e.g. how this book lays out its columns), re-run `cd worker && npm test && npx wrangler deploy`, and re-read the same photos. Do not save until the review looks right.

- [ ] **Step 2: Add partner uid**

Once the partner has signed in to the web app, add their uid to `ALLOWED_UIDS` in `worker/wrangler.toml` and redeploy (confirm with the user).

- [ ] **Step 3: Deploy web**

Confirm with the user, then: `npm run build && npx firebase deploy --only hosting`. Verify import works from the phone on the Hosting URL.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "chore(import): tune prompt from real pink-book pages"
git push
```

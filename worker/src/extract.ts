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

export function buildParams(
  images: ExtractImage[],
  birthDate: string,
  today: string = new Date().toISOString().slice(0, 10),
): Record<string, unknown> {
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
          { type: "text", text: userPrompt(images.length, birthDate, today) },
        ],
      },
    ],
  };
}

export async function extractVaccines(
  client: ClaudeLike,
  images: ExtractImage[],
  birthDate: string,
  today?: string,
): Promise<ImportedRecord[]> {
  const res = await client.beta.messages.create(buildParams(images, birthDate, today));
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

import type { ClaudeLike } from "../extract";
import { ExtractError } from "../extract";
import { EVENT_EXTRACTION_SYSTEM_PROMPT, userEventPrompt } from "./prompt";
import { EVENTS_JSON_SCHEMA, EventsResultSchema, type ExtractedEvent } from "./schema";

export function buildEventParams(text: string, today: string): Record<string, unknown> {
  return {
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: EVENTS_JSON_SCHEMA } },
    system: EVENT_EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userEventPrompt(text, today) }],
      },
    ],
  };
}

export async function extractEvents(
  client: ClaudeLike,
  text: string,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<ExtractedEvent[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const res = await client.beta.messages.create(buildEventParams(trimmed, today));
  if (res.stop_reason === "refusal") throw new ExtractError("refusal");
  if (res.stop_reason === "max_tokens") throw new ExtractError("truncated");

  const outputText = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  let json: unknown;
  try {
    json = JSON.parse(outputText);
  } catch {
    throw new ExtractError("invalid_output");
  }

  const parsed = EventsResultSchema.safeParse(json);
  if (!parsed.success) throw new ExtractError("invalid_output");

  return parsed.data.events;
}

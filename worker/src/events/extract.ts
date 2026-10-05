import type { ClaudeLike } from "../extract";
import { ExtractError } from "../extract";
import { EVENT_EXTRACTION_SYSTEM_PROMPT, userEventPrompt } from "./prompt";
import { EVENTS_JSON_SCHEMA, EventsResultSchema, type ExtractedEvent } from "./schema";
import { parseThaiEvents } from "./thaiParser";

export function buildEventParams(text: string, today: string): Record<string, unknown> {
  return {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 4000,
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
  client: ClaudeLike | undefined,
  text: string,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<ExtractedEvent[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Try rule-based parser first (instant, free, resilient to network/API quota issues)
  const localEvents = parseThaiEvents(trimmed, today);
  if (localEvents.length > 0) {
    return localEvents;
  }

  // 2. If rule-based didn't catch anything and AI client is available, try AI
  if (!client) return [];

  try {
    const res = await client.beta.messages.create(buildEventParams(trimmed, today));
    if (res.stop_reason === "refusal") throw new ExtractError("refusal");
    if (res.stop_reason === "max_tokens") throw new ExtractError("truncated");

    const outputText = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    const jsonMatch = outputText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const json = JSON.parse(jsonMatch[0]);
    const parsed = EventsResultSchema.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.events;
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    console.error("claude event extraction error", err instanceof Error ? err.message : String(err));
    return [];
  }
}

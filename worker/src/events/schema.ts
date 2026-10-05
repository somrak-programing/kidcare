import { z } from "zod";

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  place?: string | null;
  notes?: string | null;
}

export const ExtractedEventSchema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  place: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const EventsResultSchema = z.object({
  events: z.array(ExtractedEventSchema),
});

export const EVENTS_JSON_SCHEMA = {
  name: "extracted_events",
  schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short Thai title of the school or clinic event (e.g. วันสุดท้ายของภาคเรียน, เปิดเทอมภาคเรียนที่ 2, ประชุมผู้ปกครอง)",
            },
            date: {
              type: "string",
              description: "Event date in Gregorian YYYY-MM-DD format",
            },
            time: {
              type: ["string", "null"],
              description: "Time in 24-hr HH:mm format if specified, else null",
            },
            place: {
              type: ["string", "null"],
              description: "Location if specified or inferable (e.g. โรงเรียน), else null",
            },
            notes: {
              type: ["string", "null"],
              description: "Brief note or special instructions from announcement, else null",
            },
          },
          required: ["title", "date", "time", "place", "notes"],
          additionalProperties: false,
        },
      },
    },
    required: ["events"],
    additionalProperties: false,
  },
};

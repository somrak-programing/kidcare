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

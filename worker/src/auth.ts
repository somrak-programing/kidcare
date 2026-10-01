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

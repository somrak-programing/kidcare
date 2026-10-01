import { jwtVerify } from "jose";
import { HttpError } from "./request";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export type JwksGetter = Parameters<typeof jwtVerify>[1];

// jose errors that simply mean "this token is not acceptable" (expected, not worth logging).
const EXPECTED_JOSE_ERRORS = new Set([
  "JWTExpired",
  "JWTClaimValidationFailed",
  "JWSSignatureVerificationFailed",
  "JWSInvalid",
  "JWTInvalid",
  "JOSEAlgNotAllowed",
]);

export async function verifyFirebaseToken(token: string, opts: { projectId: string; jwks: JwksGetter }): Promise<string> {
  let sub: string | undefined;
  try {
    const { payload } = await jwtVerify(token, opts.jwks as never, {
      issuer: `https://securetoken.google.com/${opts.projectId}`,
      audience: opts.projectId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "sub"],
    });
    sub = payload.sub;
  } catch (err) {
    const e = err as { code?: string; name?: string };
    const code = e?.code ?? e?.name;
    // Never log the token itself; only the error code/name.
    if (!(typeof code === "string" && EXPECTED_JOSE_ERRORS.has(code)) && !(e?.name && EXPECTED_JOSE_ERRORS.has(e.name))) {
      console.warn("auth: unexpected verification error", code);
    }
    throw new HttpError(401, "unauthorized");
  }
  // requiredClaims guarantees presence; this also rejects an empty-string sub.
  if (!sub) throw new HttpError(401, "unauthorized");
  return sub;
}

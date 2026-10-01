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
  test("401 on RS384 token", async () => {
    const t = await new SignJWT({})
      .setProtectedHeader({ alg: "RS384", kid: "k1" })
      .setSubject("uid-alice")
      .setAudience(PROJECT)
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(priv);
    await expect(verifyFirebaseToken(t, { projectId: PROJECT, jwks })).rejects.toMatchObject({ status: 401 });
  });
  test("401 on token without sub", async () => {
    const t = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setAudience(PROJECT)
      .setIssuer(`https://securetoken.google.com/${PROJECT}`)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(priv);
    await expect(verifyFirebaseToken(t, { projectId: PROJECT, jwks })).rejects.toMatchObject({ status: 401 });
  });
  test("401 on empty sub", async () => {
    await expect(verifyFirebaseToken(await token({ sub: "" }), { projectId: PROJECT, jwks })).rejects.toMatchObject({ status: 401 });
  });
  test("401 on garbage", async () => {
    await expect(verifyFirebaseToken("not-a-jwt", { projectId: PROJECT, jwks })).rejects.toMatchObject({ status: 401 });
  });
});

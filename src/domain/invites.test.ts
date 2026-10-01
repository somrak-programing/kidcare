import { describe, expect, test } from "vitest";
import { INVITE_TTL_DAYS, inviteId, isInviteActive } from "./invites";

const DAY = 24 * 60 * 60 * 1000;

describe("inviteId", () => {
  test("joins family id and normalized email", () => {
    expect(inviteId("fam123", "  Zoe@Gmail.COM ")).toBe("fam123_zoe@gmail.com");
  });
});

describe("isInviteActive", () => {
  const now = 1_000_000_000_000;
  test("TTL is 14 days", () => {
    expect(INVITE_TTL_DAYS).toBe(14);
  });
  test("pending server timestamp (null) is active", () => {
    expect(isInviteActive(null, now)).toBe(true);
  });
  test("younger than 14 days is active", () => {
    expect(isInviteActive(now - 13 * DAY, now)).toBe(true);
    expect(isInviteActive(now, now)).toBe(true);
  });
  test("14 days or older is expired", () => {
    expect(isInviteActive(now - 14 * DAY, now)).toBe(false);
    expect(isInviteActive(now - 30 * DAY, now)).toBe(false);
  });
});

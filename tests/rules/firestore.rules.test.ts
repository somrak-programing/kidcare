import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch, deleteDoc,
  arrayUnion, arrayRemove, deleteField, serverTimestamp, Timestamp, type Firestore,
} from "firebase/firestore";

let env: RulesTestEnvironment;
const FID = "fam1";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-kidcare",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "families", FID), { name: "F", ownerUid: "alice", memberUids: ["alice", "bob"] });
    await setDoc(doc(db, "families", "fam2"), { name: "F2", ownerUid: "carol", memberUids: ["carol"] });
    await setDoc(doc(db, "families", FID, "children", "c1"), { name: "มะลิ" });
    await setDoc(doc(db, "families", FID, "children", "c1", "vaccineDoses", "d1"), { familyId: FID, childId: "c1", given: false });
    await setDoc(doc(db, "families", FID, "appointments", "p1"), { familyId: FID, childId: "c1" });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("users", () => {
  test("own doc only", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users", "alice"), { familyId: FID }));
    await assertFails(getDoc(doc(as("alice"), "users", "bob")));
  });
  test("cannot write another user's doc", async () => {
    await assertFails(setDoc(doc(as("alice"), "users", "bob"), { familyId: FID }));
  });
});

describe("families", () => {
  test("create own family as sole member (batched with user doc)", async () => {
    const db = as("dave");
    const b = writeBatch(db);
    b.set(doc(db, "families", "fam4"), { name: "D", ownerUid: "dave", memberUids: ["dave"] });
    b.set(doc(db, "users", "dave"), { familyId: "fam4" });
    await assertSucceeds(b.commit());
  });
  test("cannot create family listing other members", async () => {
    await assertFails(setDoc(doc(as("carol"), "families", "fam3"), { name: "C", ownerUid: "carol", memberUids: ["carol", "alice"] }));
  });
  test("members read, outsiders cannot", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "families", FID)));
    await assertFails(getDoc(doc(as("mallory"), "families", FID)));
  });
  test("non-owner cannot change memberUids", async () => {
    await assertFails(updateDoc(doc(as("bob"), "families", FID), { memberUids: ["bob"] }));
  });
  test("non-owner member can change other fields", async () => {
    await assertSucceeds(updateDoc(doc(as("bob"), "families", FID), { name: "ใหม่" }));
  });
  test("owner can add a member", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), "families", FID), { memberUids: ["alice", "bob", "dan"] }));
  });
  test("owner cannot change ownerUid", async () => {
    await assertFails(updateDoc(doc(as("alice"), "families", FID), { ownerUid: "bob" }));
  });
  test("non-owner member cannot change ownerUid", async () => {
    await assertFails(updateDoc(doc(as("bob"), "families", FID), { ownerUid: "bob" }));
  });
  test("owner cannot remove herself from memberUids", async () => {
    await assertFails(updateDoc(doc(as("alice"), "families", FID), { memberUids: ["bob"] }));
  });
  test("owner cannot set memberUids to a non-list", async () => {
    await assertFails(updateDoc(doc(as("alice"), "families", FID), { memberUids: "alice" }));
  });
  test("cannot create family with ownerUid different from auth uid", async () => {
    await assertFails(setDoc(doc(as("carol"), "families", "fam3"), { name: "C", ownerUid: "alice", memberUids: ["carol"] }));
  });
  test("unauthenticated cannot read a family", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "families", FID)));
  });
  test("unauthenticated cannot create a child", async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "families", FID, "children", "c2"), { name: "x" }));
  });
  test("family delete is denied for the owner", async () => {
    await assertFails(deleteDoc(doc(as("alice"), "families", FID)));
  });
});

describe("children subtree", () => {
  test("members read/write, outsiders cannot", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "families", FID, "children", "c1")));
    await assertSucceeds(setDoc(doc(as("bob"), "families", FID, "children", "c1", "allergies", "a1"), { substance: "x" }));
    await assertFails(getDoc(doc(as("mallory"), "families", FID, "children", "c1")));
    await assertFails(getDocs(collection(as("mallory"), "families", FID, "children", "c1", "allergies")));
  });
  test("dose writes must carry matching familyId and childId", async () => {
    const col = ["families", FID, "children", "c1", "vaccineDoses"] as const;
    await assertSucceeds(setDoc(doc(as("alice"), ...col, "d2"), { familyId: FID, childId: "c1", given: false }));
    await assertFails(setDoc(doc(as("alice"), ...col, "d3"), { familyId: "other", childId: "c1", given: false }));
    await assertFails(setDoc(doc(as("alice"), ...col, "d4"), { familyId: FID, childId: "c9", given: false }));
  });
  test("pending-dose query per child works for members", async () => {
    const q = query(collection(as("bob"), "families", FID, "children", "c1", "vaccineDoses"), where("given", "==", false));
    await assertSucceeds(getDocs(q));
  });
  test("appointments need matching familyId", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "families", FID, "appointments", "p1"), { familyId: FID, childId: "c1" }));
    await assertFails(setDoc(doc(as("alice"), "families", FID, "appointments", "p2"), { familyId: "x", childId: "c1" }));
    await assertFails(getDoc(doc(as("mallory"), "families", FID, "appointments", "p1")));
  });
});

describe("outsiders and cross-family access", () => {
  const C = ["families", FID, "children"] as const;
  test("mallory cannot write or delete in fam1", async () => {
    const m = as("mallory");
    await assertFails(setDoc(doc(m, ...C, "c2"), { name: "x" }));
    await assertFails(setDoc(doc(m, ...C, "c1", "allergies", "a1"), { substance: "x" }));
    await assertFails(setDoc(doc(m, ...C, "c1", "vaccineSeries", "s1"), { name: "x" }));
    await assertFails(setDoc(doc(m, ...C, "c1", "vaccineDoses", "d9"), { familyId: FID, childId: "c1", given: false }));
    await assertFails(setDoc(doc(m, "families", FID, "appointments", "p9"), { familyId: FID, childId: "c1" }));
    await assertFails(deleteDoc(doc(m, ...C, "c1")));
  });
  test("carol (member of fam2 only) cannot read fam1", async () => {
    await assertFails(getDoc(doc(as("carol"), ...C, "c1")));
  });
  test("carol (member of fam2 only) cannot write fam1", async () => {
    await assertFails(setDoc(doc(as("carol"), ...C, "c2"), { name: "x" }));
  });
  test("alice cannot write into fam2", async () => {
    await assertFails(setDoc(doc(as("alice"), "families", "fam2", "children", "c2"), { name: "x" }));
  });
  test("dose update cannot change familyId", async () => {
    await assertFails(updateDoc(doc(as("alice"), ...C, "c1", "vaccineDoses", "d1"), { familyId: "fam2" }));
  });
  test("dose update cannot change childId", async () => {
    await assertFails(updateDoc(doc(as("alice"), ...C, "c1", "vaccineDoses", "d1"), { childId: "c9" }));
  });
  test("dose update keeping familyId/childId succeeds", async () => {
    await assertSucceeds(updateDoc(doc(as("alice"), ...C, "c1", "vaccineDoses", "d1"), { familyId: FID, childId: "c1", given: true }));
  });
  test("mallory cannot delete vaccineDose in fam1", async () => {
    await assertFails(deleteDoc(doc(as("mallory"), ...C, "c1", "vaccineDoses", "d1")));
  });
  test("mallory cannot delete appointment in fam1", async () => {
    await assertFails(deleteDoc(doc(as("mallory"), "families", FID, "appointments", "p1")));
  });
  test("alice cannot read fam2", async () => {
    await assertFails(getDoc(doc(as("alice"), "families", "fam2")));
  });
  test("carol cannot read fam1 family doc", async () => {
    await assertFails(getDoc(doc(as("carol"), "families", FID)));
  });
  test("carol cannot update fam1 family doc", async () => {
    await assertFails(updateDoc(doc(as("carol"), "families", FID), { name: "hacked" }));
  });
});

const asUser = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

const DAY = 24 * 60 * 60 * 1000;
const inviteId = (fid: string, email: string) => `${fid}_${email}`;

/** Seed an invite with rules disabled (new id scheme). */
const seedInvite = async (
  email = "zoe@x.com",
  familyId = FID,
  opts: { invitedBy?: string; inviterEmail?: string; familyName?: string; createdAt?: Timestamp } = {},
) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "invites", inviteId(familyId, email)), {
      familyId,
      familyName: opts.familyName ?? (familyId === FID ? "F" : "F2"),
      invitedBy: opts.invitedBy ?? (familyId === FID ? "alice" : "carol"),
      inviterEmail: opts.inviterEmail ?? (familyId === FID ? "alice@x.com" : "carol@x.com"),
      email,
      createdAt: opts.createdAt ?? Timestamp.now(),
    });
  });

describe("invites: create", () => {
  const alice = () => asUser("alice", "alice@x.com");
  const valid = (over: Record<string, unknown> = {}) => ({
    familyId: FID,
    familyName: "F",
    invitedBy: "alice",
    inviterEmail: "alice@x.com",
    email: "zoe@x.com",
    createdAt: serverTimestamp(),
    ...over,
  });
  const create = (db: Firestore, id: string, data: Record<string, unknown>) => setDoc(doc(db, "invites", id), data);

  test("owner creates a valid invite (positive control)", async () => {
    await assertSucceeds(create(alice(), "fam1_zoe@x.com", valid()));
  });
  test("owner of fam2 creates a valid invite for fam2 (positive control)", async () => {
    await assertSucceeds(create(asUser("carol", "carol@x.com"), "fam2_zoe@x.com",
      valid({ familyId: "fam2", familyName: "F2", invitedBy: "carol", inviterEmail: "carol@x.com" })));
  });
  test("owner with mixed-case token email: inviterEmail is the lowercased verified email", async () => {
    await assertSucceeds(create(asUser("alice", "Alice@X.com"), "fam1_zoe@x.com", valid()));
  });
  test("wrong id format is rejected (old email-only id, wrong separator, other email)", async () => {
    await assertFails(create(alice(), "zoe@x.com", valid()));
    await assertFails(create(alice(), "fam1-zoe@x.com", valid()));
    await assertFails(create(alice(), "fam1_other@x.com", valid()));
    await assertFails(create(alice(), "fam2_zoe@x.com", valid()));
  });
  test("uppercase email is rejected", async () => {
    await assertFails(create(alice(), "fam1_Zoe@x.com", valid({ email: "Zoe@x.com" })));
  });
  test("malformed / oversized / non-string email is rejected", async () => {
    await assertFails(create(alice(), "fam1_zoe", valid({ email: "zoe" })));
    await assertFails(create(alice(), "fam1_zoe@x", valid({ email: "zoe@x" })));
    await assertFails(create(alice(), "fam1_a b@x.com", valid({ email: "a b@x.com" })));
    await assertFails(create(alice(), "fam1_a@b@x.com", valid({ email: "a@b@x.com" })));
    const long = "a".repeat(249) + "@x.com"; // 255 chars
    await assertFails(create(alice(), `fam1_${long}`, valid({ email: long })));
    await assertFails(create(alice(), "fam1_123", valid({ email: 123 })));
  });
  test("email of exactly 254 chars is accepted (boundary control)", async () => {
    const e = "a".repeat(248) + "@x.com"; // 254 chars
    await assertSucceeds(create(alice(), `fam1_${e}`, valid({ email: e })));
  });
  test("realistic email with dots, plus and 's' characters is accepted (regex control)", async () => {
    const e = "sam.s+kids@mail.example.co.th";
    await assertSucceeds(create(alice(), `fam1_${e}`, valid({ email: e })));
  });
  test("extra field is rejected", async () => {
    await assertFails(create(alice(), "fam1_zoe@x.com", valid({ extra: 1 })));
  });
  test("missing field is rejected", async () => {
    const { familyName: _omit, ...rest } = valid();
    await assertFails(create(alice(), "fam1_zoe@x.com", rest));
  });
  test("inviterEmail different from caller's verified email is rejected", async () => {
    await assertFails(create(alice(), "fam1_zoe@x.com", valid({ inviterEmail: "mallory@x.com" })));
  });
  test("familyName different from the family's name is rejected", async () => {
    await assertFails(create(alice(), "fam1_zoe@x.com", valid({ familyName: "Trusted Family" })));
  });
  test("createdAt that is not request.time is rejected", async () => {
    await assertFails(create(alice(), "fam1_zoe@x.com", valid({ createdAt: Timestamp.fromMillis(Date.now() - DAY) })));
    await assertFails(create(alice(), "fam1_zoe@x.com", valid({ createdAt: Timestamp.fromMillis(Date.now() + 30 * DAY) })));
  });
  test("invitedBy different from caller is rejected", async () => {
    await assertFails(create(alice(), "fam1_zoe@x.com", valid({ invitedBy: "bob" })));
  });
  test("caller who is a member but not the owner is rejected", async () => {
    await assertFails(create(asUser("bob", "bob@x.com"), "fam1_zoe@x.com", valid({ invitedBy: "bob", inviterEmail: "bob@x.com" })));
  });
  test("familyId of someone else's family is rejected", async () => {
    await assertFails(create(alice(), "fam2_zoe@x.com", valid({ familyId: "fam2", familyName: "F2" })));
  });
  test("non-existent family is rejected", async () => {
    await assertFails(create(alice(), "fam9_zoe@x.com", valid({ familyId: "fam9", familyName: "F" })));
  });
  test("owner with unverified email or without an email claim is rejected", async () => {
    await assertFails(create(asUser("alice", "alice@x.com", false), "fam1_zoe@x.com", valid()));
    await assertFails(create(env.authenticatedContext("alice").firestore(), "fam1_zoe@x.com", valid()));
    await assertFails(create(env.unauthenticatedContext().firestore(), "fam1_zoe@x.com", valid()));
  });
  test("an existing invite cannot be overwritten or updated", async () => {
    await seedInvite();
    await assertFails(create(alice(), "fam1_zoe@x.com", valid()));
    await assertFails(updateDoc(doc(alice(), "invites", "fam1_zoe@x.com"), { familyName: "X" }));
  });
  test("another family's invite for the same email does not block this family's invite", async () => {
    await seedInvite("zoe@x.com", "fam2");
    await assertSucceeds(create(alice(), "fam1_zoe@x.com", valid()));
  });
});

describe("invites: read, list, delete", () => {
  beforeEach(async () => {
    await seedInvite("zoe@x.com", FID);
    await seedInvite("zoe@x.com", "fam2");
    await seedInvite("other@x.com", FID);
  });
  const invites = (db: Firestore) => collection(db, "invites");

  test("invitee lists own invites by email (case-insensitive token)", async () => {
    await assertSucceeds(getDocs(query(invites(asUser("zoe", "zoe@x.com")), where("email", "==", "zoe@x.com"))));
    await assertSucceeds(getDocs(query(invites(asUser("zoe", "Zoe@X.com")), where("email", "==", "zoe@x.com"))));
  });
  test("invitee cannot list someone else's invites", async () => {
    await assertFails(getDocs(query(invites(asUser("zoe", "zoe@x.com")), where("email", "==", "other@x.com"))));
  });
  test("broad list without where is denied", async () => {
    await assertFails(getDocs(invites(asUser("zoe", "zoe@x.com"))));
    await assertFails(getDocs(invites(asUser("alice", "alice@x.com"))));
  });
  test("unverified user cannot list invites for their email", async () => {
    await assertFails(getDocs(query(invites(asUser("zoe", "zoe@x.com", false)), where("email", "==", "zoe@x.com"))));
  });
  test("inviter lists own invites; others cannot list them", async () => {
    await assertSucceeds(getDocs(query(invites(asUser("alice", "alice@x.com")), where("invitedBy", "==", "alice"))));
    await assertFails(getDocs(query(invites(asUser("mallory", "m@x.com")), where("invitedBy", "==", "alice"))));
  });
  test("invitee and inviter can get a single invite; others cannot", async () => {
    await assertSucceeds(getDoc(doc(asUser("zoe", "zoe@x.com"), "invites", "fam1_zoe@x.com")));
    await assertSucceeds(getDoc(doc(asUser("alice", "alice@x.com"), "invites", "fam1_zoe@x.com")));
    await assertFails(getDoc(doc(asUser("mallory", "m@x.com"), "invites", "fam1_zoe@x.com")));
    await assertFails(getDoc(doc(asUser("bob", "bob@x.com"), "invites", "fam1_zoe@x.com")));
  });
  test("invitee or inviter can delete; others cannot", async () => {
    await assertFails(deleteDoc(doc(asUser("mallory", "m@x.com"), "invites", "fam1_zoe@x.com")));
    await assertFails(deleteDoc(doc(asUser("zoe", "zoe@x.com", false), "invites", "fam1_zoe@x.com")));
    await assertSucceeds(deleteDoc(doc(asUser("zoe", "zoe@x.com"), "invites", "fam1_zoe@x.com")));
    await assertSucceeds(deleteDoc(doc(asUser("alice", "alice@x.com"), "invites", "fam1_other@x.com")));
  });
});

describe("joining a family by invite", () => {
  type JoinOpts = {
    uid?: string;
    email?: string;
    verified?: boolean;
    update?: Record<string, unknown>;
    deleteInvite?: string | null;
  };
  const zoeProfile = { name: "Zoe", email: "zoe@x.com" };
  const joinUpdate = (uid = "zoe", profile: unknown = zoeProfile) =>
    ({ memberUids: arrayUnion(uid), [`memberProfiles.${uid}`]: profile });
  /** The real client join: update family + set user doc + delete the invite, in one batch. */
  const joinBatch = (o: JoinOpts = {}) => {
    const uid = o.uid ?? "zoe";
    const db = asUser(uid, o.email ?? "zoe@x.com", o.verified ?? true);
    const b = writeBatch(db);
    b.update(doc(db, "families", FID), o.update ?? joinUpdate(uid));
    b.set(doc(db, "users", uid), { familyId: FID });
    const del = o.deleteInvite === undefined ? inviteId(FID, "zoe@x.com") : o.deleteInvite;
    if (del) b.delete(doc(db, "invites", del));
    return b.commit();
  };

  test("join via batch (update + user doc + delete invite) succeeds and grants access", async () => {
    await seedInvite();
    await assertSucceeds(joinBatch());
    await assertSucceeds(getDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID, "children", "c1")));
  });
  test("mixed-case token email still joins (profile email is lowercased verified email)", async () => {
    await seedInvite();
    await assertSucceeds(joinBatch({ email: "Zoe@X.com" }));
  });
  test("join without deleting the invite fails", async () => {
    await seedInvite();
    await assertFails(joinBatch({ deleteInvite: null }));
    await assertFails(updateDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID), joinUpdate()));
  });
  test("expired invite (15 days old) cannot be used; 13-day-old invite can (control)", async () => {
    await seedInvite("zoe@x.com", FID, { createdAt: Timestamp.fromMillis(Date.now() - 15 * DAY) });
    await assertFails(joinBatch());
    await seedInvite("zoe@x.com", FID, { createdAt: Timestamp.fromMillis(Date.now() - 13 * DAY) });
    await assertSucceeds(joinBatch());
  });
  test("no invite, or only an invite for another family, cannot join", async () => {
    await assertFails(joinBatch({ deleteInvite: null }));
    await seedInvite("zoe@x.com", "fam2");
    await assertFails(joinBatch({ deleteInvite: inviteId("fam2", "zoe@x.com") }));
  });
  test("unverified email or no email claim cannot join", async () => {
    await seedInvite();
    await assertFails(joinBatch({ verified: false }));
    const db = env.authenticatedContext("zoe").firestore();
    await assertFails(updateDoc(doc(db, "families", FID), joinUpdate()));
    const b = writeBatch(db);
    b.update(doc(db, "families", FID), joinUpdate());
    b.delete(doc(db, "invites", inviteId(FID, "zoe@x.com")));
    await assertFails(b.commit());
    await assertSucceeds(joinBatch()); // control: same invite, verified email
  });
  test("profile email different from token email fails", async () => {
    await seedInvite();
    await assertFails(joinBatch({ update: joinUpdate("zoe", { name: "Zoe", email: "alice@x.com" }) }));
  });
  test("profile with an extra key fails", async () => {
    await seedInvite();
    await assertFails(joinBatch({ update: joinUpdate("zoe", { ...zoeProfile, role: "owner" }) }));
  });
  test("profile with non-string or >100 char name fails; 100 chars ok (control)", async () => {
    await seedInvite();
    await assertFails(joinBatch({ update: joinUpdate("zoe", { name: 5, email: "zoe@x.com" }) }));
    await assertFails(joinBatch({ update: joinUpdate("zoe", { name: "z".repeat(101), email: "zoe@x.com" }) }));
    await assertSucceeds(joinBatch({ update: joinUpdate("zoe", { name: "z".repeat(100), email: "zoe@x.com" }) }));
  });
  test("join without writing a profile succeeds (profile optional)", async () => {
    await seedInvite();
    await assertSucceeds(joinBatch({ update: { memberUids: arrayUnion("zoe") } }));
  });
  test("invitee cannot add another uid, reorder/drop members, or change name/ownerUid/other profiles", async () => {
    await seedInvite();
    await assertFails(joinBatch({ update: { memberUids: arrayUnion("mallory") } }));
    await assertFails(joinBatch({ update: { memberUids: arrayUnion("zoe", "mallory") } }));
    await assertFails(joinBatch({ update: { memberUids: ["bob", "alice", "zoe"] } }));
    await assertFails(joinBatch({ update: { memberUids: ["alice", "zoe"] } }));
    await assertFails(joinBatch({ update: { ...joinUpdate(), name: "hacked" } }));
    await assertFails(joinBatch({ update: { ...joinUpdate(), ownerUid: "zoe" } }));
    await assertFails(joinBatch({ update: { ...joinUpdate(), "memberProfiles.bob": { name: "x", email: "zoe@x.com" } } }));
    await assertSucceeds(joinBatch()); // control
  });
  test("removed member cannot rejoin without a new invite", async () => {
    await seedInvite();
    await assertSucceeds(joinBatch());
    await assertSucceeds(updateDoc(doc(asUser("alice", "alice@x.com"), "families", FID),
      { memberUids: arrayRemove("zoe"), "memberProfiles.zoe": deleteField() }));
    await assertFails(getDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID, "children", "c1")));
    await assertFails(joinBatch({ deleteInvite: null }));
    await assertFails(updateDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID), joinUpdate()));
  });
  test("invitee can read nothing in the family before joining", async () => {
    await seedInvite();
    const db = asUser("zoe", "zoe@x.com");
    await assertFails(getDoc(doc(db, "families", FID)));
    await assertFails(getDoc(doc(db, "families", FID, "children", "c1")));
    await assertFails(getDoc(doc(db, "families", FID, "appointments", "p1")));
    await assertFails(getDoc(doc(db, "families", FID, "children", "c1", "vaccineDoses", "d1")));
  });
});

describe("members and profiles", () => {
  const bob = () => asUser("bob", "bob@x.com");
  const fam = (db: Firestore) => doc(db, "families", FID);

  test("non-owner member can update own profile with valid shape", async () => {
    await assertSucceeds(updateDoc(fam(bob()), { "memberProfiles.bob": { name: "Bob", email: "bob@x.com" } }));
    await assertSucceeds(updateDoc(fam(bob()), { "memberProfiles.bob": deleteField() }));
  });
  test("non-owner member cannot write another member's profile", async () => {
    await assertFails(updateDoc(fam(bob()), { "memberProfiles.alice": { name: "x", email: "bob@x.com" } }));
  });
  test("non-owner member cannot write a profile with wrong email, extra key, or bad name", async () => {
    await assertFails(updateDoc(fam(bob()), { "memberProfiles.bob": { name: "Bob", email: "alice@x.com" } }));
    await assertFails(updateDoc(fam(bob()), { "memberProfiles.bob": { name: "Bob", email: "bob@x.com", admin: true } }));
    await assertFails(updateDoc(fam(bob()), { "memberProfiles.bob": { name: 1, email: "bob@x.com" } }));
    await assertFails(updateDoc(fam(bob()), { "memberProfiles.bob": { name: "b".repeat(101), email: "bob@x.com" } }));
  });
  test("member without verified email cannot write a profile", async () => {
    await assertFails(updateDoc(fam(asUser("bob", "bob@x.com", false)), { "memberProfiles.bob": { name: "Bob", email: "" } }));
    await assertFails(updateDoc(fam(env.authenticatedContext("bob").firestore()), { "memberProfiles.bob": { name: "Bob", email: "" } }));
  });
  test("non-owner family name must be a string of 1..60 chars", async () => {
    await assertSucceeds(updateDoc(fam(bob()), { name: "n".repeat(60) }));
    await assertFails(updateDoc(fam(bob()), { name: "n".repeat(61) }));
    await assertFails(updateDoc(fam(bob()), { name: "" }));
    await assertFails(updateDoc(fam(bob()), { name: 42 }));
    await assertFails(updateDoc(fam(bob()), { name: deleteField() }));
  });
  test("non-owner member cannot write any other field", async () => {
    await assertFails(updateDoc(fam(bob()), { foo: 1 }));
    await assertFails(updateDoc(fam(bob()), { name: "ok", foo: 1 }));
  });
  test("owner removes a member; removed member loses access; owner cannot remove self", async () => {
    await assertSucceeds(updateDoc(fam(asUser("alice", "alice@x.com")), { memberUids: ["alice"] }));
    await assertFails(getDoc(doc(bob(), "families", FID, "children", "c1")));
    await assertFails(updateDoc(fam(asUser("alice", "alice@x.com")), { memberUids: [] }));
  });
});

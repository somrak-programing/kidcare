import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch, deleteDoc, arrayUnion } from "firebase/firestore";

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

describe("invites", () => {
  test("owner creates invite for own family; non-owner member cannot", async () => {
    await assertSucceeds(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" }));
    await assertFails(setDoc(doc(asUser("bob", "bob@x.com"), "invites", "yan@x.com"), { familyId: FID, familyName: "F", invitedBy: "bob", email: "yan@x.com" }));
  });
  test("invite doc id must equal email field and invitedBy must be caller", async () => {
    await assertFails(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "other@x.com" }));
    await assertFails(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "bob", email: "zoe@x.com" }));
  });
  test("cannot overwrite an existing invite", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "invites", "zoe@x.com"), { familyId: "fam2", familyName: "C", invitedBy: "carol", email: "zoe@x.com" });
    });
    await assertFails(setDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" }));
  });
  test("invitee (verified) and inviter can read; others and unverified cannot", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" });
    });
    await assertSucceeds(getDoc(doc(asUser("zoe", "Zoe@X.com"), "invites", "zoe@x.com")));
    await assertSucceeds(getDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com")));
    await assertFails(getDoc(doc(asUser("zoe", "zoe@x.com", false), "invites", "zoe@x.com")));
    await assertFails(getDoc(doc(asUser("mallory", "m@x.com"), "invites", "zoe@x.com")));
    // reading a non-existent own invite is allowed (returns not found)
    await assertSucceeds(getDoc(doc(asUser("yan", "yan@x.com"), "invites", "yan@x.com")));
  });
  test("inviter lists own invites", async () => {
    await assertSucceeds(getDocs(query(collection(asUser("alice", "alice@x.com"), "invites"), where("invitedBy", "==", "alice"))));
  });
  test("invitee or inviter can delete; others cannot", async () => {
    const seed = async () => env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "invites", "zoe@x.com"), { familyId: FID, familyName: "F", invitedBy: "alice", email: "zoe@x.com" });
    });
    await seed();
    await assertFails(deleteDoc(doc(asUser("mallory", "m@x.com"), "invites", "zoe@x.com")));
    await assertSucceeds(deleteDoc(doc(asUser("zoe", "zoe@x.com"), "invites", "zoe@x.com")));
    await seed();
    await assertSucceeds(deleteDoc(doc(asUser("alice", "alice@x.com"), "invites", "zoe@x.com")));
  });
});

describe("joining a family by invite", () => {
  const invite = async (email = "zoe@x.com", familyId = FID) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "invites", email), { familyId, familyName: "F", invitedBy: "alice", email });
  });
  const join = (db: ReturnType<typeof asUser>, uid: string) =>
    updateDoc(doc(db, "families", FID), { memberUids: arrayUnion(uid), [`memberProfiles.${uid}`]: { name: "Zoe", email: "zoe@x.com" } });

  test("invited user adds only themselves", async () => {
    await invite();
    await assertSucceeds(join(asUser("zoe", "zoe@x.com"), "zoe"));
    await assertSucceeds(getDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID, "children", "c1")));
  });
  test("without invite, or unverified email, or invite for another family → denied", async () => {
    await assertFails(join(asUser("zoe", "zoe@x.com"), "zoe"));
    await invite("zoe@x.com", "fam2");
    await assertFails(join(asUser("zoe", "zoe@x.com"), "zoe"));
    await invite();
    await assertFails(join(asUser("zoe", "zoe@x.com", false), "zoe"));
  });
  test("invitee cannot add someone else, change name/owner, or touch other profiles", async () => {
    await invite();
    const db = asUser("zoe", "zoe@x.com");
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: arrayUnion("mallory") }));
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: arrayUnion("zoe"), name: "hacked" }));
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: arrayUnion("zoe"), "memberProfiles.bob": { name: "x", email: "x" } }));
    await assertFails(updateDoc(doc(db, "families", FID), { memberUids: ["alice", "zoe"] }));
  });
  test("invitee can read nothing in the family before joining", async () => {
    await invite();
    await assertFails(getDoc(doc(asUser("zoe", "zoe@x.com"), "families", FID)));
  });
});

describe("members and profiles", () => {
  test("non-owner member may edit name and own profile only", async () => {
    const db = asUser("bob", "bob@x.com");
    await assertSucceeds(updateDoc(doc(db, "families", FID), { "memberProfiles.bob": { name: "Bob", email: "bob@x.com" } }));
    await assertFails(updateDoc(doc(db, "families", FID), { "memberProfiles.alice": { name: "x", email: "x" } }));
  });
  test("owner removes a member; removed member loses access; owner cannot remove self", async () => {
    await assertSucceeds(updateDoc(doc(asUser("alice", "alice@x.com"), "families", FID), { memberUids: ["alice"] }));
    await assertFails(getDoc(doc(asUser("bob", "bob@x.com"), "families", FID, "children", "c1")));
    await assertFails(updateDoc(doc(asUser("alice", "alice@x.com"), "families", FID), { memberUids: [] }));
  });
});

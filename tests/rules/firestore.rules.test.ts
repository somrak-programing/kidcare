import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";

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
    await setDoc(doc(db, "families", FID, "children", "c1"), { name: "มะลิ" });
    await setDoc(doc(db, "families", FID, "children", "c1", "vaccineDoses", "d1"), { familyId: FID, childId: "c1", given: false });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("users", () => {
  test("own doc only", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users", "alice"), { familyId: FID }));
    await assertFails(getDoc(doc(as("alice"), "users", "bob")));
  });
});

describe("families", () => {
  test("create own family as sole member (batched with user doc)", async () => {
    const db = as("carol");
    const b = writeBatch(db);
    b.set(doc(db, "families", "fam2"), { name: "C", ownerUid: "carol", memberUids: ["carol"] });
    b.set(doc(db, "users", "carol"), { familyId: "fam2" });
    await assertSucceeds(b.commit());
  });
  test("cannot create family listing other members", async () => {
    await assertFails(setDoc(doc(as("carol"), "families", "fam3"), { name: "C", ownerUid: "carol", memberUids: ["carol", "alice"] }));
  });
  test("members read, outsiders cannot", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "families", FID)));
    await assertFails(getDoc(doc(as("mallory"), "families", FID)));
  });
  test("only owner changes memberUids; nobody changes ownerUid", async () => {
    await assertFails(updateDoc(doc(as("bob"), "families", FID), { memberUids: ["bob"] }));
    await assertSucceeds(updateDoc(doc(as("bob"), "families", FID), { name: "ใหม่" }));
    await assertSucceeds(updateDoc(doc(as("alice"), "families", FID), { memberUids: ["alice", "bob", "dan"] }));
    await assertFails(updateDoc(doc(as("alice"), "families", FID), { ownerUid: "bob" }));
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

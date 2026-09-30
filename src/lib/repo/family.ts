import type { User } from "firebase/auth";
import { collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { fire } from "../fire";
import { familyDoc } from "../paths";

const inFlight = new Map<string, Promise<string>>();

/** คืน familyId ของผู้ใช้ ถ้ายังไม่มีจะสร้าง family ใหม่ที่มีผู้ใช้เป็น owner (ต้องออนไลน์ครั้งแรก) */
export function ensureFamily(user: User): Promise<string> {
  const pending = inFlight.get(user.uid);
  if (pending) return pending;
  const p = runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", user.uid);
    const snap = await tx.get(userRef);
    const existing = snap.exists() ? (snap.data().familyId as string | undefined) : undefined;
    if (existing) return existing;

    const famRef = doc(collection(db, "families"));
    tx.set(famRef, { name: "ครอบครัวของฉัน", ownerUid: user.uid, memberUids: [user.uid], createdAt: serverTimestamp() });
    tx.set(userRef, { familyId: famRef.id, displayName: user.displayName ?? "", email: user.email ?? "" }, { merge: true });
    return famRef.id;
  }).finally(() => {
    inFlight.delete(user.uid);
  });
  inFlight.set(user.uid, p);
  return p;
}

export function renameFamily(fid: string, name: string) {
  fire(updateDoc(familyDoc(fid), { name }));
}

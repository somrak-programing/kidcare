import type { User } from "firebase/auth";
import { collection, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { fire } from "../fire";
import { familyDoc } from "../paths";

/** คืน familyId ของผู้ใช้ ถ้ายังไม่มีจะสร้าง family ใหม่ที่มีผู้ใช้เป็น owner (ต้องออนไลน์ครั้งแรก) */
export async function ensureFamily(user: User): Promise<string> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? (snap.data().familyId as string | undefined) : undefined;
  if (existing) return existing;

  const famRef = doc(collection(db, "families"));
  const batch = writeBatch(db);
  batch.set(famRef, { name: "ครอบครัวของฉัน", ownerUid: user.uid, memberUids: [user.uid], createdAt: serverTimestamp() });
  batch.set(userRef, { familyId: famRef.id, displayName: user.displayName ?? "", email: user.email ?? "" }, { merge: true });
  await batch.commit();
  return famRef.id;
}

export function renameFamily(fid: string, name: string) {
  fire(updateDoc(familyDoc(fid), { name }));
}

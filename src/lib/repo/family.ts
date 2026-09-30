import type { User } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type FirestoreError,
} from "firebase/firestore";
import { familyCacheKey } from "@/hooks/useFamilyId";
import { normalizeEmail } from "@/domain/email";
import type { Invite } from "@/types";
import { db } from "../firebase";
import { fire } from "../fire";
import { familyDoc, inviteDoc } from "../paths";

const inFlight = new Map<string, Promise<string>>();

const profileOf = (user: User) => ({ name: user.displayName ?? "", email: user.email ?? "" });

/** คำเชิญใช้ได้เฉพาะอีเมลที่ยืนยันแล้ว */
const inviteEmailOf = (user: User): string | null =>
  user.emailVerified && user.email ? normalizeEmail(user.email) : null;

async function resolveFamily(user: User): Promise<string> {
  const userRef = doc(db, "users", user.uid);

  // 1) มี familyId อยู่แล้ว -> ตรวจว่ายังเป็นสมาชิกอยู่ (ถูกลบออก = permission-denied)
  const userSnap = await getDoc(userRef);
  const existing = userSnap.exists() ? (userSnap.data().familyId as string | undefined) : undefined;
  if (existing) {
    try {
      const famSnap = await getDoc(familyDoc(existing));
      const profiles = famSnap.data()?.memberProfiles as Record<string, unknown> | undefined;
      if (!profiles?.[user.uid]) {
        fire(updateDoc(familyDoc(existing), { [`memberProfiles.${user.uid}`]: profileOf(user) }));
      }
      return existing;
    } catch (err) {
      if ((err as FirestoreError)?.code !== "permission-denied") throw err;
      // ถูกลบออกจากครอบครัวแล้ว -> ล้าง familyId แล้วไปต่อ (รับคำเชิญ/สร้างใหม่)
      await setDoc(userRef, { familyId: deleteField() }, { merge: true });
    }
  }

  // 2) มีคำเชิญค้างอยู่ -> เข้าร่วมครอบครัวนั้น
  const email = inviteEmailOf(user);
  if (email) {
    let invite: Invite | null = null;
    try {
      const inv = await getDoc(inviteDoc(email));
      if (inv.exists()) invite = { id: inv.id, ...inv.data() } as Invite;
    } catch {
      invite = null;
    }
    if (invite) {
      await joinFamily(user, invite.familyId);
      return invite.familyId;
    }
  }

  // 3) สร้างครอบครัวใหม่ที่มีผู้ใช้เป็น owner
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const current = snap.exists() ? (snap.data().familyId as string | undefined) : undefined;
    if (current) return current;

    const famRef = doc(collection(db, "families"));
    tx.set(famRef, {
      name: "ครอบครัวของฉัน",
      ownerUid: user.uid,
      memberUids: [user.uid],
      memberProfiles: { [user.uid]: profileOf(user) },
      createdAt: serverTimestamp(),
    });
    tx.set(userRef, { familyId: famRef.id, displayName: user.displayName ?? "", email: user.email ?? "" }, { merge: true });
    return famRef.id;
  });
}

/** คืน familyId ของผู้ใช้ — เข้าร่วมตามคำเชิญถ้ามี ไม่เช่นนั้นสร้าง family ใหม่ที่มีผู้ใช้เป็น owner (ต้องออนไลน์ครั้งแรก) */
export function ensureFamily(user: User): Promise<string> {
  const pending = inFlight.get(user.uid);
  if (pending) return pending;
  const p = resolveFamily(user).finally(() => {
    inFlight.delete(user.uid);
  });
  inFlight.set(user.uid, p);
  return p;
}

export function renameFamily(fid: string, name: string) {
  fire(updateDoc(familyDoc(fid), { name }));
}

/** owner เชิญสมาชิกด้วยอีเมล (email ต้องผ่าน normalizeEmail แล้ว) */
export function inviteMember(fid: string, familyName: string, ownerUid: string, email: string) {
  const e = normalizeEmail(email);
  fire(
    setDoc(inviteDoc(e), { familyId: fid, familyName, invitedBy: ownerUid, email: e, createdAt: serverTimestamp() }),
    "เชิญไม่สำเร็จ (อีเมลนี้อาจมีคำเชิญค้างอยู่แล้ว)",
  );
}

export function cancelInvite(email: string) {
  fire(deleteDoc(inviteDoc(normalizeEmail(email))));
}

export function removeMember(fid: string, uid: string) {
  fire(updateDoc(familyDoc(fid), { memberUids: arrayRemove(uid), [`memberProfiles.${uid}`]: deleteField() }));
}

/** รับคำเชิญ: เพิ่มตัวเองเป็นสมาชิก + ตั้ง familyId + ลบคำเชิญ (atomic) */
export async function joinFamily(user: User, familyId: string): Promise<void> {
  const email = inviteEmailOf(user);
  if (!email) throw new Error("joinFamily requires a verified email");
  const batch = writeBatch(db);
  batch.update(familyDoc(familyId), {
    memberUids: arrayUnion(user.uid),
    [`memberProfiles.${user.uid}`]: profileOf(user),
  });
  batch.set(
    doc(db, "users", user.uid),
    { familyId, displayName: user.displayName ?? "", email: user.email ?? "" },
    { merge: true },
  );
  batch.delete(inviteDoc(email));
  await batch.commit();
  try {
    localStorage.removeItem(familyCacheKey(user.uid));
  } catch {
    /* ignore */
  }
}

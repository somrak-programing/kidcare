import type { User } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteDoc,
  type FirestoreError,
} from "firebase/firestore";
import { familyCacheKey } from "@/hooks/useFamilyId";
import { normalizeEmail } from "@/domain/email";
import { isInviteActive } from "@/domain/invites";
import type { Invite } from "@/types";
import { db } from "../firebase";
import { fire } from "../fire";
import { familyDoc, inviteDoc, inviteDocById, invitesCol } from "../paths";

const resolving = new Map<string, Promise<string | null>>();
const creating = new Map<string, Promise<string>>();

const emailOf = (user: User): string => normalizeEmail(user.email ?? "");

/** โปรไฟล์สมาชิก — ต้องตรงกับ firestore.rules (name ≤ 100, email = อีเมลที่ยืนยันแล้ว lowercase) */
const profileOf = (user: User) => ({
  name: (user.displayName || emailOf(user)).slice(0, 100),
  email: emailOf(user),
});

function clearFamilyCache(uid: string) {
  try {
    localStorage.removeItem(familyCacheKey(uid));
  } catch {
    /* ignore */
  }
}

async function doResolveFamily(user: User): Promise<string | null> {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const existing = userSnap.exists() ? (userSnap.data().familyId as string | undefined) : undefined;
  if (!existing) return null;

  try {
    const famSnap = await getDoc(familyDoc(existing));
    if (famSnap.exists()) {
      const profiles = famSnap.data()?.memberProfiles as Record<string, unknown> | undefined;
      if (!profiles?.[user.uid]) {
        fire(updateDoc(familyDoc(existing), { [`memberProfiles.${user.uid}`]: profileOf(user) }));
      }
    }
    return existing;
  } catch (err) {
    if ((err as FirestoreError)?.code !== "permission-denied") throw err;
    // ถูกลบออกจากครอบครัวแล้ว -> ล้าง familyId
    await setDoc(userRef, { familyId: deleteField() }, { merge: true });
    return null;
  }
}

/** ตรวจว่าผู้ใช้เป็นสมาชิกครอบครัวอยู่แล้วหรือไม่ — คืน familyId หรือ null (ไม่เคยมี / ถูกลบออกแล้ว) */
export function resolveFamily(user: User): Promise<string | null> {
  const pending = resolving.get(user.uid);
  if (pending) return pending;
  const p = doResolveFamily(user).finally(() => {
    resolving.delete(user.uid);
  });
  resolving.set(user.uid, p);
  return p;
}

async function doCreateFamily(user: User): Promise<string> {
  const userRef = doc(db, "users", user.uid);
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

/** สร้างครอบครัวใหม่ที่มีผู้ใช้เป็น owner (ต้องออนไลน์) — ถ้ามี familyId อยู่แล้วจะคืนอันเดิม */
export function createFamily(user: User): Promise<string> {
  const pending = creating.get(user.uid);
  if (pending) return pending;
  const p = doCreateFamily(user).finally(() => {
    creating.delete(user.uid);
  });
  creating.set(user.uid, p);
  return p;
}

/** คำเชิญที่ยังไม่หมดอายุของผู้ใช้ (ต้องยืนยันอีเมลแล้ว) — ผิดพลาด = ไม่มี */
export async function findMyInvites(user: User): Promise<Invite[]> {
  if (!user.emailVerified || !user.email) return [];
  try {
    const snap = await getDocs(query(invitesCol(), where("email", "==", normalizeEmail(user.email))));
    const now = Date.now();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Invite)
      .filter((i) => isInviteActive(i.createdAt?.toMillis() ?? null, now));
  } catch {
    return [];
  }
}

export function renameFamily(fid: string, name: string) {
  fire(updateDoc(familyDoc(fid), { name }));
}

/** owner เชิญสมาชิกด้วยอีเมล */
export function inviteMember(fid: string, familyName: string, owner: User, email: string) {
  const e = normalizeEmail(email);
  fire(
    setDoc(inviteDoc(fid, e), {
      familyId: fid,
      familyName,
      invitedBy: owner.uid,
      inviterEmail: normalizeEmail(owner.email!),
      email: e,
      createdAt: serverTimestamp(),
    }),
    "เชิญไม่สำเร็จ (อีเมลนี้อาจมีคำเชิญค้างอยู่แล้ว)",
  );
}

export function cancelInvite(invite: Invite) {
  fire(deleteDoc(inviteDocById(invite.id)));
}

/** owner เท่านั้น (UI ต้องกันไว้) */
export function removeMember(fid: string, uid: string) {
  fire(updateDoc(familyDoc(fid), { memberUids: arrayRemove(uid), [`memberProfiles.${uid}`]: deleteField() }));
}

/** รับคำเชิญ: เพิ่มตัวเองเป็นสมาชิก + ตั้ง familyId + ลบคำเชิญ (atomic ใน batch เดียว) */
export async function joinFamily(user: User, invite: Invite): Promise<void> {
  const profile = profileOf(user);
  const batch = writeBatch(db);
  batch.update(familyDoc(invite.familyId), {
    memberUids: arrayUnion(user.uid),
    [`memberProfiles.${user.uid}`]: profile,
  });
  batch.set(
    doc(db, "users", user.uid),
    { familyId: invite.familyId, displayName: user.displayName ?? "", email: user.email ?? "" },
    { merge: true },
  );
  batch.delete(inviteDocById(invite.id));
  await batch.commit();
  clearFamilyCache(user.uid);
}

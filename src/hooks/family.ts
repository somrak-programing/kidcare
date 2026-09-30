import type { User } from "firebase/auth";
import { query, where } from "firebase/firestore";
import type { Family, Invite } from "@/types";
import { normalizeEmail } from "@/domain/email";
import { familyDoc, inviteDoc, invitesCol } from "@/lib/paths";
import { useCollection, useDocument } from "./useCollection";

export function useFamily(fid: string | null) {
  return useDocument<Family>(fid ? familyDoc(fid) : null, `family/${fid ?? "-"}`);
}

/** คำเชิญที่รอผู้ใช้อยู่ (เฉพาะอีเมลที่ยืนยันแล้ว) */
export function useMyInvite(user: User | null | undefined) {
  const email = user?.emailVerified && user.email ? normalizeEmail(user.email) : null;
  return useDocument<Invite>(email ? inviteDoc(email) : null, `invite/${email ?? "-"}`);
}

/** คำเชิญที่ owner ส่งไป */
export function useSentInvites(uid: string | null) {
  return useCollection<Invite>(uid ? query(invitesCol(), where("invitedBy", "==", uid)) : null, `sentInvites/${uid ?? "-"}`);
}

import { addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Visit, VisitInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function createVisit(fid: string, cid: string, input: VisitInput): Promise<string> {
  const col = childSub(fid, cid, "visits");
  return addDoc(col, {
    ...input,
    familyId: fid,
    childId: cid,
    createdAt: serverTimestamp(),
  }).then((r) => r.id);
}

export function updateVisit(fid: string, cid: string, visitId: string, patch: Partial<Visit>) {
  const ref = doc(childSub(fid, cid, "visits"), visitId);
  fire(updateDoc(ref, { ...patch, familyId: fid, childId: cid }));
}

export function deleteVisit(fid: string, cid: string, visitId: string) {
  const ref = doc(childSub(fid, cid, "visits"), visitId);
  fire(deleteDoc(ref), "ลบไม่สำเร็จ");
}

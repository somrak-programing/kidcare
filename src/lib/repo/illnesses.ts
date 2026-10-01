import { addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Illness, IllnessInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function createIllness(fid: string, cid: string, input: IllnessInput): Promise<string> {
  const col = childSub(fid, cid, "illnesses");
  return addDoc(col, {
    ...input,
    familyId: fid,
    childId: cid,
    createdAt: serverTimestamp(),
  }).then((r) => r.id);
}

export function updateIllness(fid: string, cid: string, illnessId: string, patch: Partial<Illness>) {
  const ref = doc(childSub(fid, cid, "illnesses"), illnessId);
  fire(updateDoc(ref, { ...patch, familyId: fid, childId: cid }));
}

export function markIllnessRecovered(fid: string, cid: string, illnessId: string, endDate: string) {
  updateIllness(fid, cid, illnessId, { status: "recovered", endDate });
}

export function deleteIllness(fid: string, cid: string, illnessId: string) {
  const ref = doc(childSub(fid, cid, "illnesses"), illnessId);
  fire(deleteDoc(ref), "ลบไม่สำเร็จ");
}

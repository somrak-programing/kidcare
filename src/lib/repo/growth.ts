import { addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { GrowthRecord, GrowthRecordInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function createGrowthRecord(
  fid: string,
  cid: string,
  input: GrowthRecordInput,
): Promise<string> {
  const col = childSub(fid, cid, "growth");
  return addDoc(col, {
    ...input,
    familyId: fid,
    childId: cid,
    createdAt: serverTimestamp(),
  }).then((r) => r.id);
}

export function updateGrowthRecord(
  fid: string,
  cid: string,
  id: string,
  patch: Partial<GrowthRecord>,
) {
  const ref = doc(childSub(fid, cid, "growth"), id);
  fire(updateDoc(ref, { ...patch, familyId: fid, childId: cid }));
}

export function deleteGrowthRecord(fid: string, cid: string, id: string) {
  const ref = doc(childSub(fid, cid, "growth"), id);
  fire(deleteDoc(ref), "ลบไม่สำเร็จ");
}

import { addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { Medication, MedicationInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function createMedication(fid: string, cid: string, input: MedicationInput): Promise<string> {
  const col = childSub(fid, cid, "medications");
  return addDoc(col, {
    ...input,
    familyId: fid,
    childId: cid,
    createdAt: serverTimestamp(),
  }).then((r) => r.id);
}

export function updateMedication(fid: string, cid: string, medId: string, patch: Partial<Medication>) {
  const ref = doc(childSub(fid, cid, "medications"), medId);
  fire(updateDoc(ref, { ...patch, familyId: fid, childId: cid }));
}

export function deleteMedication(fid: string, cid: string, medId: string) {
  const ref = doc(childSub(fid, cid, "medications"), medId);
  fire(deleteDoc(ref), "ลบไม่สำเร็จ");
}

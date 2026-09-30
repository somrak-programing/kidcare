import { deleteDoc, doc, setDoc } from "firebase/firestore";
import type { AllergyInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function saveAllergy(fid: string, cid: string, input: AllergyInput, id?: string) {
  const col = childSub(fid, cid, "allergies");
  const ref = id ? doc(col, id) : doc(col);
  fire(setDoc(ref, input));
}

export function deleteAllergy(fid: string, cid: string, id: string) {
  fire(deleteDoc(doc(childSub(fid, cid, "allergies"), id)), "ลบไม่สำเร็จ");
}

import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { ChildInput } from "@/types";
import { fire } from "../fire";
import { childDoc, childrenCol } from "../paths";

export function createChild(fid: string, input: ChildInput): string {
  const ref = doc(childrenCol(fid));
  fire(setDoc(ref, { ...input, createdAt: serverTimestamp() }));
  return ref.id;
}

export function updateChild(fid: string, cid: string, input: ChildInput) {
  fire(updateDoc(childDoc(fid, cid), { ...input }));
}

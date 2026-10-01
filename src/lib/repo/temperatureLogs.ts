import { addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import type { TemperatureLog, TemperatureLogInput } from "@/types";
import { fire } from "../fire";
import { childSub } from "../paths";

export function createTemperatureLog(
  fid: string,
  cid: string,
  input: TemperatureLogInput,
): Promise<string> {
  const col = childSub(fid, cid, "temperatureLogs");
  return addDoc(col, {
    ...input,
    familyId: fid,
    childId: cid,
    createdAt: serverTimestamp(),
  }).then((r) => r.id);
}

export function deleteTemperatureLog(fid: string, cid: string, logId: string) {
  const ref = doc(childSub(fid, cid, "temperatureLogs"), logId);
  fire(deleteDoc(ref), "ลบไม่สำเร็จ");
}

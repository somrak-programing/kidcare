import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import type { AppointmentInput } from "@/types";
import { fire } from "../fire";
import { appointmentsCol } from "../paths";

export function saveAppointment(fid: string, input: AppointmentInput, id?: string) {
  const col = appointmentsCol(fid);
  const ref = id ? doc(col, id) : doc(col);
  fire(setDoc(ref, { ...input, familyId: fid }));
}

export function setAppointmentDone(fid: string, id: string, done: boolean) {
  fire(updateDoc(doc(appointmentsCol(fid), id), { done, familyId: fid }));
}

export function deleteAppointment(fid: string, id: string) {
  fire(deleteDoc(doc(appointmentsCol(fid), id)), "ลบไม่สำเร็จ");
}

import { collection, doc } from "firebase/firestore";
import { db } from "./firebase";

export const familyDoc = (fid: string) => doc(db, "families", fid);
export const childrenCol = (fid: string) => collection(db, "families", fid, "children");
export const childDoc = (fid: string, cid: string) => doc(db, "families", fid, "children", cid);
export const childSub = (fid: string, cid: string, name: "allergies" | "vaccineSeries" | "vaccineDoses") =>
  collection(db, "families", fid, "children", cid, name);
export const appointmentsCol = (fid: string) => collection(db, "families", fid, "appointments");

import { collection, doc } from "firebase/firestore";
import { inviteId } from "@/domain/invites";
import { db } from "./firebase";

export const familyDoc = (fid: string) => doc(db, "families", fid);
export const childrenCol = (fid: string) => collection(db, "families", fid, "children");
export const childDoc = (fid: string, cid: string) => doc(db, "families", fid, "children", cid);
export const childSub = (
  fid: string,
  cid: string,
  name: "allergies" | "vaccineSeries" | "vaccineDoses" | "illnesses" | "visits" | "medications" | "temperatureLogs",
) => collection(db, "families", fid, "children", cid, name);
export const appointmentsCol = (fid: string) => collection(db, "families", fid, "appointments");

export const invitesCol = () => collection(db, "invites");
export const inviteDoc = (familyId: string, email: string) => doc(db, "invites", inviteId(familyId, email));
export const inviteDocById = (id: string) => doc(db, "invites", id);

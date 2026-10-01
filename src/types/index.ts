import type { Timestamp } from "firebase/firestore";

export type ISODate = string; // "YYYY-MM-DD", Gregorian

export type Sex = "M" | "F";

export interface Hospital {
  name: string;
  hn: string;
}

export interface Family {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  memberProfiles?: Record<string, { name: string; email: string }>;
}

export interface Invite {
  id: string; // = `${familyId}_${emailLower}`
  familyId: string;
  familyName: string;
  invitedBy: string;
  inviterEmail: string;
  email: string;
  createdAt?: Timestamp; // undefined/null ขณะ server timestamp ยังไม่ resolve
}

export interface Child {
  id: string;
  name: string;
  nickname?: string;
  birthDate: ISODate;
  sex: Sex;
  bloodType?: string;
  hospitals: Hospital[];
}
export type ChildInput = Omit<Child, "id">;

export type AllergyType = "drug" | "food" | "other";
export type Severity = "mild" | "moderate" | "severe";

export interface Allergy {
  id: string;
  type: AllergyType;
  substance: string;
  reaction: string;
  severity: Severity;
  notes?: string;
}
export type AllergyInput = Omit<Allergy, "id">;

export type SeriesSource = "epi" | "custom";

export interface VaccineSeries {
  id: string;
  name: string;
  source: SeriesSource;
  templateKey?: string;
  reason?: string;
}

export interface VaccineDose {
  id: string;
  familyId: string;
  childId: string;
  seriesId: string;
  vaccineName: string;
  vaccineCode?: string | null;
  doseNo: number;
  dueDate: ISODate | null;
  given: boolean;
  givenDate: ISODate | null;
  givenDateUnknown: boolean;
  brand?: string;
  lotNo?: string;
  amount?: string;
  site?: string;
  givenBy?: string;
  place?: string;
  notes?: string;
  source: "manual" | "import";
  importConfidence?: "high" | "medium" | "low";
}

export type DoseStatus = "given" | "overdue" | "dueSoon" | "scheduled" | "unscheduled";

export interface Appointment {
  id: string;
  familyId: string;
  childId: string;
  date: ISODate;
  time?: string; // "HH:mm"
  place: string;
  purpose: string;
  linkedDoseId?: string;
  notes?: string;
  done: boolean;
}
export type AppointmentInput = Omit<Appointment, "id" | "familyId">;

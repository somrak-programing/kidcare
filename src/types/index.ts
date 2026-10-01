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

// --- Phase 2: Illnesses, Visits, Medications, Temperature Logs ---

export type IllnessStatus = "active" | "recovered";

export interface Illness {
  id: string;
  familyId: string;
  childId: string;
  name: string;
  startDate: ISODate;
  endDate?: ISODate | null;
  symptoms: string[];
  notes?: string;
  status: IllnessStatus;
  createdAt?: Timestamp;
}
export type IllnessInput = Omit<Illness, "id" | "familyId">;

export interface Visit {
  id: string;
  familyId: string;
  childId: string;
  illnessId?: string | null;
  date: ISODate;
  time?: string;
  hospital: string;
  doctor?: string;
  diagnosis?: string;
  advice?: string;
  nextApptDate?: ISODate;
  createdAt?: Timestamp;
}
export type VisitInput = Omit<Visit, "id" | "familyId">;

export type MedicationType = "fever" | "antibiotic" | "cough_cold" | "allergy" | "other";
export type MedicationStatus = "active" | "completed" | "discontinued";

export interface Medication {
  id: string;
  familyId: string;
  childId: string;
  illnessId?: string | null;
  visitId?: string | null;
  name: string;
  type: MedicationType;
  dosage: string;
  frequency: string;
  requiresCompletion: boolean;
  startDate: ISODate;
  endDate?: ISODate | null;
  status: MedicationStatus;
  notes?: string;
  createdAt?: Timestamp;
}
export type MedicationInput = Omit<Medication, "id" | "familyId">;

export type TempMethod = "ear" | "armpit" | "forehead" | "rectal";

export interface TemperatureLog {
  id: string;
  familyId: string;
  childId: string;
  illnessId?: string | null;
  measuredAt: string; // ISO string e.g. "2026-10-01T14:30:00"
  tempCelsius: number;
  method: TempMethod;
  gaveAntipyretic: boolean;
  antipyreticMedName?: string;
  antipyreticDose?: string;
  notes?: string;
  createdAt?: Timestamp;
}
export type TemperatureLogInput = Omit<TemperatureLog, "id" | "familyId">;

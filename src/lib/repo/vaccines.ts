import { doc, serverTimestamp, updateDoc, writeBatch, type WriteBatch } from "firebase/firestore";
import { EPI_TEMPLATE } from "@/data/epi";
import { generateEpiSeries, type DoseDraft, type SeriesDraft } from "@/domain/schedule";
import type { ISODate, VaccineDose } from "@/types";
import { db } from "../firebase";
import { fire } from "../fire";
import { childSub } from "../paths";
import { undefinedToDelete } from "./clearUndefined";

function newDoseDoc(fid: string, cid: string, seriesId: string, d: DoseDraft): Omit<VaccineDose, "id"> {
  return {
    familyId: fid,
    childId: cid,
    seriesId,
    vaccineName: d.vaccineName,
    vaccineCode: d.vaccineCode ?? null,
    doseNo: d.doseNo,
    dueDate: d.dueDate,
    given: d.given ?? false,
    givenDate: d.givenDate ?? null,
    givenDateUnknown: d.givenDateUnknown ?? false,
    source: "manual",
  };
}

function addSeriesToBatch(batch: WriteBatch, fid: string, cid: string, s: SeriesDraft): string {
  const seriesRef = doc(childSub(fid, cid, "vaccineSeries"));
  batch.set(seriesRef, { name: s.name, source: s.source, templateKey: s.templateKey, reason: s.reason, createdAt: serverTimestamp() });
  for (const d of s.doses) {
    batch.set(doc(childSub(fid, cid, "vaccineDoses")), newDoseDoc(fid, cid, seriesRef.id, d));
  }
  return seriesRef.id;
}

export function createSeriesWithDoses(fid: string, cid: string, s: SeriesDraft): string {
  const batch = writeBatch(db);
  const id = addSeriesToBatch(batch, fid, cid, s);
  fire(batch.commit());
  return id;
}

export function createEpiSeries(fid: string, cid: string, birthDate: ISODate) {
  const batch = writeBatch(db);
  for (const s of generateEpiSeries(EPI_TEMPLATE, birthDate)) addSeriesToBatch(batch, fid, cid, s);
  fire(batch.commit());
}

export function updateDose(
  fid: string,
  cid: string,
  doseId: string,
  patch: Partial<Omit<VaccineDose, "id" | "familyId" | "childId">>,
) {
  // familyId/childId ส่งซ้ำเพื่อให้ผ่าน rules (request.resource.data ต้องมี)
  fire(updateDoc(doc(childSub(fid, cid, "vaccineDoses"), doseId), { ...undefinedToDelete(patch), familyId: fid, childId: cid }));
}

export function applyDueDates(fid: string, cid: string, updates: { id: string; dueDate: ISODate }[]) {
  if (!updates.length) return;
  const batch = writeBatch(db);
  for (const u of updates) batch.update(doc(childSub(fid, cid, "vaccineDoses"), u.id), { dueDate: u.dueDate });
  fire(batch.commit());
}

export function markDosesGiven(fid: string, cid: string, items: { id: string; givenDate: ISODate | null }[]) {
  if (!items.length) return;
  const batch = writeBatch(db);
  for (const it of items) {
    batch.update(doc(childSub(fid, cid, "vaccineDoses"), it.id), {
      given: true,
      givenDate: it.givenDate,
      givenDateUnknown: it.givenDate === null,
    });
  }
  fire(batch.commit());
}

export function deleteSeries(fid: string, cid: string, seriesId: string, doseIds: string[]) {
  const batch = writeBatch(db);
  for (const id of doseIds) batch.delete(doc(childSub(fid, cid, "vaccineDoses"), id));
  batch.delete(doc(childSub(fid, cid, "vaccineSeries"), seriesId));
  fire(batch.commit(), "ลบไม่สำเร็จ");
}

import { doc, serverTimestamp, updateDoc, writeBatch, type WriteBatch } from "firebase/firestore";
import { EPI_TEMPLATE } from "@/data/epi";
import type { ImportedRecord } from "@/domain/importMatch";
import { generateEpiSeries, type DoseDraft, type SeriesDraft } from "@/domain/schedule";
import type { ISODate, VaccineDose } from "@/types";
import { db } from "../firebase";
import { fire } from "../fire";
import { childSub } from "../paths";
import { undefinedKeysToDelete } from "./clearUndefined";

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
    lotNo: d.lotNo,
    place: d.place,
    source: d.source ?? "manual",
    importConfidence: d.importConfidence,
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

const DOSE_OPTIONAL_KEYS = ["brand", "lotNo", "amount", "site", "givenBy", "place", "notes"] as const;

export function updateDose(
  fid: string,
  cid: string,
  doseId: string,
  patch: Partial<Omit<VaccineDose, "id" | "familyId" | "childId">>,
) {
  // familyId/childId ส่งซ้ำเพื่อให้ผ่าน rules (request.resource.data ต้องมี)
  // ลบ field เฉพาะ key ตัวเลือกที่ส่งมาเป็น undefined — key ที่ไม่ได้ส่งมาคงเดิม
  fire(updateDoc(doc(childSub(fid, cid, "vaccineDoses"), doseId), { ...undefinedKeysToDelete(patch, DOSE_OPTIONAL_KEYS), familyId: fid, childId: cid }));
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

export function saveImport(fid: string, cid: string, rows: { target: string; record: ImportedRecord }[]) {
  if (!rows.length) return;
  const batch = writeBatch(db);
  const doseCol = childSub(fid, cid, "vaccineDoses");

  for (const { target, record: r } of rows) {
    if (target === "new") continue;
    batch.update(doc(doseCol, target), {
      given: true,
      givenDate: r.dateGiven,
      givenDateUnknown: r.dateGiven === null,
      lotNo: r.lotNo ?? undefined,
      place: r.place ?? undefined,
      source: "import",
      importConfidence: r.confidence,
    });
  }

  // รายการที่ไม่มีเข็มให้จับคู่ → สร้างชุดใหม่ ต่อวัคซีน 1 ชุด
  const groups = new Map<string, ImportedRecord[]>();
  for (const { target, record: r } of rows) {
    if (target !== "new") continue;
    const k = r.vaccineCode === "OTHER" ? `OTHER|${r.vaccineRaw.trim()}` : r.vaccineCode;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const recs of groups.values()) {
    recs.sort((a, b) => (a.dateGiven ?? "9999").localeCompare(b.dateGiven ?? "9999"));
    const name = recs[0].vaccineRaw.trim() || recs[0].vaccineCode;
    addSeriesToBatch(batch, fid, cid, {
      name,
      source: "custom",
      templateKey: "import",
      doses: recs.map((r, i) => ({
        vaccineName: name,
        vaccineCode: r.vaccineCode === "OTHER" ? undefined : r.vaccineCode,
        doseNo: r.doseNo ?? i + 1,
        dueDate: r.dateGiven,
        given: true,
        givenDate: r.dateGiven,
        givenDateUnknown: r.dateGiven === null,
        lotNo: r.lotNo ?? undefined,
        place: r.place ?? undefined,
        source: "import",
        importConfidence: r.confidence,
      })),
    });
  }
  fire(batch.commit());
}

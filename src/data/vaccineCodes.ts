// ต้องตรงกับ worker/src/schema.ts (มี test ตรวจ)
export const VACCINE_CODES = [
  "BCG", "HB", "DTP-HB-Hib", "DTP", "OPV", "IPV", "ROTA", "MMR", "JE", "HPV", "dT", "RABIES", "FLU", "OTHER",
] as const;
export type VaccineCode = (typeof VACCINE_CODES)[number];

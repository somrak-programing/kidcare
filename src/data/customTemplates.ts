import type { CustomTemplate } from "@/domain/schedule";

export const CUSTOM_TEMPLATES: CustomTemplate[] = [
  { key: "rabies-pep-im", name: "พิษสุนัขบ้า หลังสัมผัส (ฉีดเข้ากล้าม)", vaccineCode: "RABIES", dayOffsets: [0, 3, 7, 14, 28] },
  { key: "rabies-pep-id", name: "พิษสุนัขบ้า หลังสัมผัส (ฉีดเข้าผิวหนัง)", vaccineCode: "RABIES", dayOffsets: [0, 3, 7, 28] },
  { key: "flu", name: "ไข้หวัดใหญ่", vaccineCode: "FLU", dayOffsets: [0] },
  { key: "blank", name: "", dayOffsets: [0] },
];

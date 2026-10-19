// src/features/consultations/generalsFields.ts
import type { Generals } from "./caseRecordSchema";

export type GeneralsGroup = {
  title?: string;
  /** Menstrual group: only collected for Female patients. */
  menstrual?: boolean;
  fields: { key: keyof Generals; label: string }[];
};

export const GENERALS_GROUPS: GeneralsGroup[] = [
  {
    fields: [
      { key: "appetite", label: "Appetite" },
      { key: "thirst", label: "Thirst" },
      { key: "bladder", label: "Bladder" },
      { key: "bowel", label: "Bowel" },
      { key: "sleepDreams", label: "Sleep & dreams" },
    ],
  },
  {
    title: "Menstrual",
    menstrual: true,
    fields: [
      { key: "lmp", label: "LMP" },
      { key: "menarche", label: "Menarche" },
      { key: "menopause", label: "Menopause" },
      { key: "menstrualPain", label: "Pain" },
      { key: "clots", label: "Clots" },
      { key: "moodSwings", label: "Mood swings" },
      { key: "leucorrhoea", label: "Leucorrhoea" },
    ],
  },
  {
    title: "Perspiration",
    fields: [
      { key: "perspirationOdour", label: "Odour" },
      { key: "perspirationStaining", label: "Staining" },
      { key: "perspirationRemarks", label: "Remarks" },
    ],
  },
  {
    title: "History",
    fields: [
      { key: "sexualHistory", label: "Sexual history" },
      { key: "pastHistory", label: "Past history" },
      { key: "mentals", label: "Mentals" },
      { key: "allergicHistory", label: "Allergic history" },
    ],
  },
];

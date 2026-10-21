// src/features/consultations/generalsFields.ts
import type { Generals } from "./caseRecordSchema";

export type GeneralsGroup = {
  title?: string;
  /** Menstrual group: only collected for Female patients. */
  menstrual?: boolean;
  /** Homoeopathy only: hidden for other clinic types. */
  homoeo?: true;
  /**
   * `formLabel` disambiguates a field on the consultation form; `homoeo` hides
   * it for other clinic types, which see `generalLabel` instead of `label`.
   */
  fields: {
    key: keyof Generals;
    label: string;
    formLabel?: string;
    homoeo?: true;
    generalLabel?: string;
  }[];
};

export const GENERALS_GROUPS: GeneralsGroup[] = [
  {
    fields: [
      { key: "appetite", label: "Appetite" },
      { key: "thirst", label: "Thirst" },
      { key: "bladder", label: "Bladder" },
      { key: "bowel", label: "Bowel" },
      { key: "sleepDreams", label: "Sleep & dreams", generalLabel: "Sleep" },
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
    homoeo: true,
    fields: [
      { key: "perspirationOdour", label: "Odour" },
      { key: "perspirationStaining", label: "Staining" },
      {
        key: "perspirationRemarks",
        label: "Remarks",
        formLabel: "Perspiration remarks",
      },
    ],
  },
  {
    title: "History",
    fields: [
      { key: "sexualHistory", label: "Sexual history" },
      { key: "pastHistory", label: "Past history" },
      { key: "mentals", label: "Mentals", homoeo: true },
      { key: "allergicHistory", label: "Allergic history" },
    ],
  },
];

/** The groups a clinic shows: everything for homoeo, else without the homoeo extras. */
export function generalsGroupsFor(homoeo: boolean): GeneralsGroup[] {
  if (homoeo) return GENERALS_GROUPS;
  return GENERALS_GROUPS.filter((g) => !g.homoeo).map((g) => ({
    ...g,
    fields: g.fields
      .filter((f) => !f.homoeo)
      .map((f) => (f.generalLabel ? { ...f, label: f.generalLabel } : f)),
  }));
}

/** Whether any field the clinic shows has a value (hidden ones don't count). */
export function hasShownGenerals(g: Generals, homoeo: boolean): boolean {
  return generalsGroupsFor(homoeo).some((group) =>
    group.fields.some((f) =>
      f.key === "lmp" ? g.lmp != null : String(g[f.key] ?? "").trim() !== "",
    ),
  );
}
